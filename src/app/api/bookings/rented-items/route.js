import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId required" }, { status: 400 });
    }

    // Fetch all rented items
    const rentRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Rented_Items!A2:E",
    });
    const rentRows = rentRes.data.values || [];

    // Fetch inventory for names
    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A2:D",
    });
    const invRows = invRes.data.values || [];
    const invMap = {};
    for (const r of invRows) invMap[r[0]] = r[1] || "";

    const items = rentRows
      .filter((r) => r[1] === bookingId)
      .map((r) => ({
        id: r[0],
        bookingId: r[1],
        itemId: r[2],
        itemName: invMap[r[2]] || `صنف #${r[2]}`,
        quantityRequested: parseInt(r[3] || 0),
        unitPrice: parseFloat(r[4] || 0),
      }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Rented-items GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
