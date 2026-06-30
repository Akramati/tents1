import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/finance/suppliers/transactions?supplierId=SUP-0001
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Supplier_Transactions!A2:H",
    });
    let rows = res.data.values || [];

    if (supplierId) {
      rows = rows.filter((r) => r[1] === supplierId);
    }

    const transactions = rows.map((r) => ({
      transId: parseInt(r[0]),
      supplierId: r[1],
      date: r[2] || "",
      type: r[3] || "",
      amount: parseFloat(r[4] || 0),
      purchaseId: r[5] || "",
      notes: r[6] || "",
      cashAccountCode: r[7] || "",
    }));

    // Sort by date descending
    transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    console.error("GET /api/finance/suppliers/transactions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
