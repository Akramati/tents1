import { NextResponse } from "next/server";
import { sheets, calendar } from "@/lib/google";
import { getSheetData, addFinanceEntry, getFinanceLedger } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// PATCH /api/bookings/cancel — cancel a booking
export async function PATCH(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { bookingId, refundAmount = 0, penaltyAmount = 0 } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "رقم الحجز مطلوب" },
        { status: 400 }
      );
    }

    // Find booking
    const rows = await getSheetData("Bookings", "A:O");
    const idx = rows.findIndex((r) => r[0] === bookingId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: "الحجز غير موجود" },
        { status: 404 }
      );
    }

    const row = rows[idx];
    const rowNum = idx + 1;
    const currentPaid = parseFloat(row[6] || 0);
    const refundVal = parseFloat(refundAmount) || 0;
    const penaltyVal = parseFloat(penaltyAmount) || 0;

    // Calculate final paid after cancellation
    let finalPaid = currentPaid - refundVal;
    if (penaltyVal > 0) {
      finalPaid = Math.max(0, finalPaid - penaltyVal);
    }

    // Update status to "ملغي", update Paid/Remaining
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!G${rowNum}:I${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[finalPaid.toString(), "0", "ملغي"]] },
    });

    // Update field status to "cancelled"
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!O${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [["cancelled"]] },
    });

    // Delete calendar event if exists
    let calWarning = null;
    try {
      if (CALENDAR_ID) {
        const eventsRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          q: bookingId,
          maxResults: 10,
        });
        const events = eventsRes.data.items || [];
        for (const event of events) {
          if (event.description && event.description.includes(bookingId)) {
            await calendar.events.delete({
              calendarId: CALENDAR_ID,
              eventId: event.id,
            });
          }
        }
      }
    } catch (calError) {
      console.error("Failed to delete calendar event:", calError);
      calWarning = "⚠️ تعذر حذف الحدث من تقويم جوجل.";
    }

    // Reverse ALL original liability entries for this booking
    try {
      const allEntries = await getFinanceLedger();
      const liabilityEntries = allEntries.filter((e) => e.linkedBookingId === bookingId && e.entryType === "liability" && e.amount > 0);
      const totalLiability = liabilityEntries.reduce((s, e) => s + e.amount, 0);
      const cashCode = body.cashAccountCode || liabilityEntries[0]?.cashAccountCode || "1101";

      if (totalLiability > 0) {
        if (penaltyVal > 0) {
          // 1. Record the refund portion explicitly
          await addFinanceEntry({
            date: new Date().toLocaleDateString("en-CA"),
            accountCode: "2300",
            entryType: "liability",
            amount: -refundVal,
            linkedBookingId: bookingId,
            notes: `مردود عربون للعميل - الحجز الملغي ${bookingId}`,
            cashAccountCode: cashCode,
            branch: liabilityEntries[0]?.branch || "",
          });

          // 2. Record the penalty as income (liability reduction = income, no cash impact)
          await addFinanceEntry({
            date: new Date().toLocaleDateString("en-CA"),
            accountCode: "4002",
            entryType: "income",
            amount: penaltyVal,
            linkedBookingId: bookingId,
            notes: `غرامة إلغاء الحجز ${bookingId}`,
            cashAccountCode: cashCode,
          });
        } else {
          // No penalty — reverse the full liability (full refund to customer)
          await addFinanceEntry({
            date: new Date().toLocaleDateString("en-CA"),
            accountCode: "2300",
            entryType: "liability",
            amount: -totalLiability,
            linkedBookingId: bookingId,
            notes: `مردود عربون كامل للعميل - الحجز الملغي ${bookingId}`,
            cashAccountCode: cashCode,
            branch: liabilityEntries[0]?.branch || "",
          });
        }
      }
    } catch (finError) {
      console.error("Failed to process cancellation entries:", finError);
    }

    const parts = [`تم إلغاء الحجز ${bookingId}`];
    if (refundVal > 0) parts.push(`واسترداد ${refundVal} ريال`);
    if (penaltyVal > 0) parts.push(`وغرامة ${penaltyVal} ريال`);
    if (calWarning) parts.push(calWarning);
    parts.push("(تم عكس الإيراد الأصلي)");

    return NextResponse.json({
      success: true,
      message: parts.join("، "),
      bookingId,
      refundAmount: refundVal,
      penaltyAmount: penaltyVal,
      calWarning: !!calWarning,
    });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إلغاء الحجز" },
      { status: 500 }
    );
  }
}
