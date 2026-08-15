import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData, addFinanceEntry } from "@/lib/sheets";

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
    const customerName = row[1] || "";
    const rowNum = idx + 1;
    const currentTotal = parseFloat(row[5] || 0);
    const currentPaid = parseFloat(row[6] || 0);
    const amountValue = parseFloat(amount);

    // Update paid amount (G) and zero out remaining amount (H) so the booking
    // no longer appears as outstanding after the receivable transfer.
    const newPaid = currentPaid + amountValue;
    const newRemaining = Math.max(0, currentTotal - newPaid);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!G${rowNum}:H${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newPaid.toString(), newRemaining.toString()]] },
    });

    // Optionally record to Receivables / Finance Ledger if finance ledger exists
    try {
      await addFinanceEntry({
        date: new Date().toISOString().slice(0, 10),
        bookingId,
        customerName,
        debitAccount: "1201", // حساب الذمم المدينة
        creditAccount: "4101", // إيرادات الحجوزات
        amount: parseFloat(amount),
        notes: `تحويل المتبقي من الجرد الميداني للذمم المدينة - حجز #${bookingId}`,
      });
    } catch (e) {
      console.warn("Could not log to finance ledger:", e.message);
    }

    return NextResponse.json({ success: true, bookingId, transferredAmount: amount });
  } catch (err) {
    console.error("Error creating receivable entry:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
