import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData } from "@/lib/sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookingId, amount } = body;

    if (!bookingId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "رقم الحجز والمبلغ مطلوبان" }, { status: 400 });
    }

    const rows = await getSheetData("Bookings", "A:O");
    const idx = rows.findIndex((r) => r[0] === bookingId);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "الحجز غير موجود" }, { status: 404 });
    }

    const row = rows[idx];
    const currentPaid = parseFloat(row[6] || 0);
    const currentTotal = parseFloat(row[5] || 0);
    const newPaid = currentPaid + parseFloat(amount);
    const newRemaining = Math.max(0, currentTotal - newPaid);
    const rowNum = idx + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!G${rowNum}:H${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newPaid.toString(), newRemaining.toString()]] },
    });

    return NextResponse.json({ success: true, bookingId, paidAmount: newPaid, remainingAmount: newRemaining });
  } catch (err) {
    console.error("Error processing payment:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
