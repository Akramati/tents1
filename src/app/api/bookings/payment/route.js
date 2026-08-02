import { NextResponse } from "next/server";
import { sheets, calendar } from "@/lib/google";
import { getSheetData, getFinanceLedger, addFinanceEntry, getIncomeAccountForBooking } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// PATCH /api/bookings/payment — record a payment
export async function PATCH(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { bookingId, amount, confirmBooking, cashAccountCode, costCenter, transportType, invoiceLink } = body;

    if (!bookingId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "رقم الحجز والمبلغ مطلوبان" },
        { status: 400 }
      );
    }

    const rows = await getSheetData("Bookings", "A:O");
    const idx = rows.findIndex((r) => r[0] === bookingId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: "الحجز غير موجود" },
        { status: 404 }
      );
    }

    const row = rows[idx];
    const currentPaid = parseFloat(row[6] || 0);
    const currentTotal = parseFloat(row[5] || 0);
    const currentStatus = row[8] || "";
    const bookingType = row[11] || "";
    const customerName = row[1] || "";
    const newPaid = currentPaid + parseFloat(amount);
    const newRemaining = Math.max(0, currentTotal - newPaid);
    const rowNum = idx + 1;

    // Update G (PaidAmount) and H (RemainingAmount)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!G${rowNum}:H${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newPaid.toString(), newRemaining.toString()]] },
    });

    // Determine new status
    let newStatus = currentStatus;
    if (confirmBooking && currentStatus === "قيد الانتظار") {
      newStatus = "مؤكد";
    }
    if (newRemaining <= 0 && newStatus !== "ملغي" && currentStatus !== "مكتمل") {
      newStatus = "مدفوع";
    }
    if (newStatus !== currentStatus) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Bookings!I${rowNum}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newStatus]] },
      });
    }

    // Record finance entry
    try {
      const noteParts = [`دفعة من ${customerName} - ${bookingType}`];
      if (invoiceLink) noteParts.push(`رابط: ${invoiceLink}`);
      // If booking is already completed, reduce receivable (1202) instead of recording عربون
      if (currentStatus === "مكتمل") {
        await addFinanceEntry({
          accountCode: "1202",
          entryType: "income",
          amount: parseFloat(amount),
          linkedBookingId: bookingId,
          notes: `تحصيل ذمة من ${customerName} - ${bookingType}`,
          cashAccountCode: cashAccountCode || "1101",
          costCenter: costCenter || "",
          costCenterType: costCenter ? "booking" : "",
          transportType: transportType || "",
        });
      } else {
        // Record as عربون (liability) — service not yet completed
        await addFinanceEntry({
          accountCode: "2300",
          entryType: "liability",
          amount: parseFloat(amount),
          linkedBookingId: bookingId,
          notes: noteParts.join(" | "),
          cashAccountCode: cashAccountCode || "",
          costCenter: costCenter || "",
          costCenterType: costCenter ? "booking" : "",
          transportType: transportType || "",
        });
      }
    } catch (finError) {
      console.error("Failed to record finance entry for payment:", finError);
    }

    // Sync calendar event with updated payment info
    try {
      if (CALENDAR_ID) {
        const evRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          privateExtendedProperty: `bookingId=${bookingId}`,
          maxResults: 1,
        });
        let existingEvent = evRes.data.items?.[0];
        if (!existingEvent) {
          const fallback = await calendar.events.list({
            calendarId: CALENDAR_ID,
            q: bookingId,
            maxResults: 10,
          });
          existingEvent = (fallback.data.items || []).find((ev) =>
            ev.description && ev.description.includes(bookingId)
          );
        }
        if (existingEvent) {
          const newDescLines = (existingEvent.description || "").split("\n");
          const updatedDesc = newDescLines.map((line) => {
            if (line.startsWith("المبلغ المقدم:")) return `المبلغ المقدم: ${newPaid}`;
            if (line.startsWith("المدفوع:")) return `المدفوع: ${newPaid}`;
            if (line.startsWith("المتبقي:")) return `المتبقي: ${newRemaining}`;
            return line;
          }).join("\n");
          await calendar.events.update({
            calendarId: CALENDAR_ID,
            eventId: existingEvent.id,
            requestBody: {
              summary: existingEvent.summary || "",
              description: updatedDesc,
              start: existingEvent.start,
              end: existingEvent.end,
              extendedProperties: existingEvent.extendedProperties,
            },
          });
        }
      }
    } catch (calError) {
      console.error("Failed to sync calendar event on payment:", calError);
    }

    return NextResponse.json({
      success: true,
      message: `تم تسجيل دفعة بقيمة ${amount} ريال للحجز ${bookingId}`,
      bookingId,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newStatus,
    });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تسجيل الدفعة" },
      { status: 500 }
    );
  }
}
