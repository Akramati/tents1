import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A2:I",
    });
    const rows = response.data.values || [];
    const validRows = rows.filter((r) => r[0] && r[0].trim());

    const outstanding = validRows
      .map((row) => {
        const total = parseFloat(row[5] || 0);
        const paid = parseFloat(row[6] || 0);
        const remaining = parseFloat(row[7] || 0);
        const calcRemaining = remaining > 0 ? remaining : Math.max(0, total - paid);
        return {
          bookingId: row[0],
          customerName: row[1] || `عميل حجز ${row[0]}`,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: calcRemaining,
          status: row[8] || "",
        };
      })
      .filter((b) => b.outstandingAmount > 0 && b.status !== "ملغي");

    return NextResponse.json({ success: true, items: outstanding });
  } catch (err) {
    console.error("Error fetching outstanding bookings:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
