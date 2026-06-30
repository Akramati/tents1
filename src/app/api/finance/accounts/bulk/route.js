import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// DELETE /api/finance/accounts/bulk — bulk hard-delete rows from Chart_Of_Accounts
export async function DELETE(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { accountCodes } = body;
    if (!accountCodes || !Array.isArray(accountCodes) || accountCodes.length === 0) {
      return NextResponse.json({ success: false, error: "قائمة أكواد الحسابات مطلوبة" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:G",
    });
    const rows = res.data.values || [];
    let deletedCount = 0;

    for (const code of accountCodes) {
      const indices = rows.map((r, i) => r[0] === code ? i : -1).filter(i => i >= 0);
      for (const idx of indices) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `Chart_Of_Accounts!A${idx + 1}:G${idx + 1}`,
        });
        deletedCount++;
      }
    }

    return NextResponse.json({ success: true, deletedCount, message: `تم حذف ${deletedCount} صف` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/finance/accounts/bulk — clear entries or transfer to another account
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { accountCodes, action, targetAccount } = body;

    if (!accountCodes || !Array.isArray(accountCodes) || accountCodes.length === 0) {
      return NextResponse.json({ success: false, error: "قائمة أكواد الحسابات مطلوبة" }, { status: 400 });
    }
    if (!action || !["delete", "transfer"].includes(action)) {
      return NextResponse.json({ success: false, error: "الإجراء مطلوب (delete أو transfer)" }, { status: 400 });
    }
    if (action === "transfer" && !targetAccount) {
      return NextResponse.json({ success: false, error: "الحساب الهدف مطلوب للتحويل" }, { status: 400 });
    }

    const ledgerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Finance_Ledger!A2:M",
    });
    const rows = ledgerRes.data.values || [];
    const codeSet = new Set(accountCodes);
    let affectedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      if (!codeSet.has(r[2])) continue;
      const rowNum = i + 2;

      if (action === "delete") {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Finance_Ledger!A${rowNum}:M${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [["", "", "", "", "", "", "", "", "", "", "", "", ""]] },
        });
        affectedCount++;
      } else if (action === "transfer") {
        r[2] = targetAccount;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Finance_Ledger!A${rowNum}:M${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [r] },
        });
        affectedCount++;
      }
    }

    const msg = action === "delete"
      ? `تم مسح ${affectedCount} قيد من الحسابات المحددة`
      : `تم نقل ${affectedCount} قيد إلى الحساب ${targetAccount}`;

    return NextResponse.json({ success: true, affectedCount, message: msg });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
