import { NextResponse } from "next/server";
import { sheets, calendar } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// GET /api/inventory/available?date=YYYY-MM-DD  (single day)
// GET /api/inventory/available?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD  (date range)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const excludeBookingId = searchParams.get("excludeBookingId") || "";

    // Get all inventory items
    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A2:D",
    });
    const invRows = invRes.data.values || [];
    const inventory = invRows.map((row) => ({
      itemId: row[0],
      itemName: row[1] || "",
      totalQuantity: parseInt(row[2] || 0),
      underMaintenance: parseInt(row[3] || 0),
    }));

    // Determine the date range to check
    function fmt(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
    let datesToCheck = [];
    if (startDate && endDate) {
      const [sy,sm,sd]=startDate.split("-").map(Number);
      const [ey,em,ed]=endDate.split("-").map(Number);
      const start = new Date(sy, sm-1, sd);
      const end = new Date(ey, em-1, ed);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToCheck.push(fmt(d));
      }
    } else if (date) {
      datesToCheck = [date];
    }

    // Get all bookings
    const bookRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A2:O",
    });
    const allBookings = bookRes.data.values || [];

    // Compute max rented qty per item across all dates in range
    const maxRented = {};

    // Fetch rented items once
    let allRentedRows = [];
    try {
      const rentRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A2:E",
      });
      allRentedRows = rentRes.data.values || [];
    } catch (e) {
      // Rented_Items might be new/empty
    }

    for (const d of datesToCheck) {
      const activeBookings = allBookings.filter((b) => {
        if (excludeBookingId && b[0] === excludeBookingId) return false;
        const mainStatus = (b[8] || "").trim();
        if (mainStatus === "مكتمل" || mainStatus === "ملغي" || mainStatus === "منتهي") return false;
        const fieldStatus = (b[14] || "").trim();
        if (fieldStatus === "cancelled" || fieldStatus === "archived") return false;
        const isHall = (b[11] || "").trim().includes("صالة");
        if (fieldStatus === "completed") return false;
        if (!b[3] || !b[4]) return false;
        const start = new Date(b[3]);
        const end = new Date(b[4]);
        const target = new Date(d);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return target >= start && target <= end;
      });

      if (activeBookings.length > 0) {
        const activeIds = new Set(activeBookings.map((b) => b[0]));
        const daySum = {};
        for (const r of allRentedRows) {
          if (activeIds.has(r[1])) {
            const itemId = r[2];
            const qty = parseInt(r[3] || 0);
            daySum[itemId] = (daySum[itemId] || 0) + qty;
          }
        }
        for (const [itemId, totalQty] of Object.entries(daySum)) {
          if (totalQty > (maxRented[itemId] || 0)) {
            maxRented[itemId] = totalQty;
          }
        }
      }
    }

    // Calculate available quantities
    const items = inventory.map((item) => {
      const rented = maxRented[item.itemId] || 0;
      return {
        ...item,
        rentedOnDate: rented,
        availableQuantity: item.totalQuantity - item.underMaintenance - rented,
      };
    });

    // Calendar reconciliation: detect orphaned/external events
    let calendarWarnings = [];
    const checkStartDate = startDate || date;
    const checkEndDate = endDate || date;
    if (CALENDAR_ID && checkStartDate) {
      try {
        const timeMin = new Date(checkStartDate + "T00:00:00+03:00").toISOString();
        const timeMax = new Date(checkEndDate + "T23:59:59+03:00").toISOString();
        const calRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        const calEvents = calRes.data.items || [];
        const allBookingIds = new Set(allBookings.map((b) => b[0]).filter(Boolean));
        const hlPattern = /HL-\d{6}/g;

        for (const evt of calEvents) {
          const summary = evt.summary || "";
          const description = evt.description || "";
          const combined = summary + " " + description;
          const idsFound = combined.match(hlPattern) || [];
          const hasBookingId = idsFound.length > 0;
          const validIdFound = idsFound.some((id) => allBookingIds.has(id));

          if (!hasBookingId || !validIdFound) {
            const startEvt = evt.start?.date || evt.start?.dateTime || "";
            const endEvt = evt.end?.date || evt.end?.dateTime || "";
            calendarWarnings.push({
              eventTitle: summary,
              startDate: startEvt.slice(0, 10),
              endDate: endEvt.slice(0, 10),
              bookingId: idsFound.length > 0 ? idsFound[0] : null,
              type: !hasBookingId ? "بدون رقم حجز" : "رقم حجز غير موجود في قاعدة البيانات",
            });
          }
        }
      } catch (calError) {
        console.error("Calendar fetch error:", calError);
      }
    }

    return NextResponse.json({
      success: true,
      date: date || null,
      startDate: startDate || null,
      endDate: endDate || null,
      items,
      calendarWarnings,
    });
  } catch (error) {
    console.error("Available GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
