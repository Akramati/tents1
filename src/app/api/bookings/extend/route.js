import { NextResponse } from "next/server";
import { sheets, calendar } from "@/lib/google";
import { getSheetData, getFinanceLedger, addFinanceEntry, getIncomeAccountForBooking } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { bookingId, newEndDate, additionalAmount, paidAmount, notes, cashAccountCode } = body;

    if (!bookingId || !newEndDate) {
      return NextResponse.json({ success: false, error: "رقم الحجز والتاريخ الجديد مطلوبان" }, { status: 400 });
    }

    const rows = await getSheetData("Bookings", "A:AF");
    const idx = rows.findIndex((r) => r[0] === bookingId);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "الحجز غير موجود" }, { status: 404 });
    }

    const row = rows[idx];
    const rowNum = idx + 1;

    // Prevent extending backwards or to same date
    if (newEndDate <= (row[4] || "")) {
      return NextResponse.json({ success: false, error: "تاريخ النهاية الجديد يجب أن يكون بعد التاريخ الحالي" }, { status: 400 });
    }

    // Prevent duplicate extension to the same date
    const oldNotes = row[13] || "";
    if (oldNotes.includes(`تمديد:`) && oldNotes.includes(`→ ${newEndDate}`)) {
      return NextResponse.json({ success: false, error: "هذا الحجز ممدد مسبقاً لنفس التاريخ" }, { status: 400 });
    }
    const customerName = row[1] || "";
    const bookingType = row[11] || "";
    const currentTotal = parseFloat(row[5] || 0);
    const currentPaid = parseFloat(row[6] || 0);
    const currentEndDate = row[4] || "";

    const addAmt = parseFloat(additionalAmount || 0);
    const paidAmt = parseFloat(paidAmount || 0);

    // Calculate new totals
    const newTotal = currentTotal + addAmt;
    const newPaid = currentPaid + paidAmt;
    const newRemaining = Math.max(0, newTotal - newPaid);

    // Check for item conflicts with other bookings in the extension period
    const conflicts = [];
    try {
      const rentRows = await getSheetData("Rented_Items", "A2:E");
      const invRows = await getSheetData("Inventory_Stock", "A2:D");
      const invMap = {};
      for (const r of invRows) invMap[r[0]] = r[1] || "";

      // Items belonging to this booking
      const myItems = rentRows.filter((r) => r[1] === bookingId);
      const myItemIds = new Set(myItems.map((r) => r[2]));

      if (myItemIds.size > 0) {
        // Other bookings that share the same items
        const otherRentals = rentRows.filter(
          (r) => r[1] !== bookingId && myItemIds.has(r[2])
        );
        const otherBookingIds = [...new Set(otherRentals.map((r) => r[1]))];

        if (otherBookingIds.length > 0) {
          const otherBookings = rows.filter((r) => otherBookingIds.includes(r[0]));
          const extStart = currentEndDate;
          const extEnd = newEndDate;

          for (const ob of otherBookings) {
            const obStart = ob[3] || "";
            const obEnd = ob[4] || "";
            // Check date overlap
            if (obStart && obEnd && extStart && extEnd) {
              const s1 = new Date(extStart);
              const e1 = new Date(extEnd);
              const s2 = new Date(obStart);
              const e2 = new Date(obEnd);
              if (s1 <= e2 && s2 <= e1 && e1 >= s2) {
                const itemNames = otherRentals
                  .filter((r) => r[1] === ob[0])
                  .map((r) => invMap[r[2]] || `#${r[2]}`)
                  .join(", ");
                conflicts.push({
                  bookingId: ob[0],
                  customerName: ob[1] || "",
                  period: `${obStart} → ${obEnd}`,
                  items: itemNames,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Conflict check error:", err);
    }

    // Update sheet: EndDate(E), TotalAmount(F), PaidAmount(G), RemainingAmount(H), Notes(N)
    const newNotes = oldNotes
      ? `${oldNotes} | تمديد: ${currentEndDate} → ${newEndDate}${addAmt ? ` +${addAmt}ريال` : ""}${notes ? ` (${notes})` : ""}`
      : `تمديد: ${currentEndDate} → ${newEndDate}${addAmt ? ` +${addAmt}ريال` : ""}${notes ? ` (${notes})` : ""}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!E${rowNum}:H${rowNum}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newEndDate, newTotal.toString(), newPaid.toString(), newRemaining.toString()]],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!N${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newNotes]] },
    });

    // Record finance entry for the additional amount (عربون)
    if (addAmt > 0) {
      try {
        await addFinanceEntry({
          date: new Date().toLocaleDateString("en-CA"),
          accountCode: "2300",
          entryType: "liability",
          amount: addAmt,
          linkedBookingId: bookingId,
          notes: `تمديد حجز ${bookingId} - ${customerName}${notes ? ` (${notes})` : ""}`,
          cashAccountCode: cashAccountCode || "1101",
        });
      } catch (finError) {
        console.error("Failed to record finance entry for extension:", finError);
      }
    }

    // Sync calendar event with new end date and extended description
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
          const endDateTime = new Date(newEndDate);
          endDateTime.setDate(endDateTime.getDate() + 1);
          const updatedDesc = (existingEvent.description || "") + `\n[تم التمديد إلى ${newEndDate}]`;
          await calendar.events.update({
            calendarId: CALENDAR_ID,
            eventId: existingEvent.id,
            requestBody: {
              summary: existingEvent.summary || "",
              description: updatedDesc,
              start: existingEvent.start,
              end: { date: endDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
              extendedProperties: existingEvent.extendedProperties,
            },
          });
        }
      }
    } catch (calError) {
      console.error("Failed to sync calendar event on extend:", calError);
    }

    return NextResponse.json({
      success: true,
      message: `تم تمديد الحجز ${bookingId} حتى ${newEndDate}`,
      bookingId,
      newEndDate,
      newTotal,
      newPaid,
      newRemaining,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    });
  } catch (error) {
    console.error("Extend error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تمديد الحجز" },
      { status: 500 }
    );
  }
}
