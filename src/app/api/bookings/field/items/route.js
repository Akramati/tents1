import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// POST /api/bookings/field/items — update rented items for a booking (installed stage edit)
export async function POST(request) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, items } = body;

    if (!bookingId || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: "بيانات غير مكتملة" }, { status: 400 });
    }

    // Read all rented items
    const rentRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Rented_Items!A:E",
    });
    const allRentRows = rentRes.data.values || [];

    // Keep header + rows for other bookings
    const keptRows = allRentRows.filter((r, i) => i === 0 || r[1] !== bookingId);

    // Compute max ID
    let maxId = 0;
    for (const r of keptRows) {
      const n = parseInt(r[0]);
      if (n > maxId) maxId = n;
    }

    // Build new rows
    const newRows = items.filter((ri) => ri.itemId).map((ri) => [
      (++maxId).toString(),
      bookingId,
      ri.itemId,
      (ri.quantityRequested || 1).toString(),
      (ri.unitPrice || 0).toString(),
    ]);

    // Rewrite the sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: "Rented_Items!A:E",
    });
    if (keptRows.length > 0 || newRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A:E",
        valueInputOption: "RAW",
        requestBody: { values: [...keptRows, ...newRows] },
      });
    } else {
      // Reset with header
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A1",
        valueInputOption: "RAW",
        requestBody: { values: [["ID", "BookingID", "ItemID", "QuantityRequested", "UnitPrice"]] },
      });
    }

    return NextResponse.json({ success: true, message: "تم تحديث الأصناف" });
  } catch (error) {
    console.error("POST /api/bookings/field/items error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
