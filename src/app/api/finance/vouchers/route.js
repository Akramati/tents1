import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { addFinanceEntry, getChartOfAccounts } from "@/lib/sheets";
import { requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/finance/vouchers?from=...&to=...
export async function GET(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Payment_Vouchers!A2:L",
      });
      rows = res.data.values || [];
    } catch {
      return NextResponse.json({ success: true, vouchers: [] });
    }

    const accounts = await getChartOfAccounts(true);
    const accountMap = {};
    for (const a of accounts) accountMap[a.accountCode] = a.accountName;

    const vouchers = rows.filter(r => r[0]).map(r => {
      const v = {
        voucherId: r[0] || "",
        date: r[1] || "",
        recipient: r[2] || "",
        amount: parseFloat(r[3] || 0),
        accountCode: r[4] || "",
        accountName: r[5] || accountMap[r[4]] || "",
        cashAccountCode: r[6] || "",
        notes: r[7] || "",
        linkedBookingId: r[8] || "",
        journalId: r[9] || "",
        createdAt: r[10] || "",
        branch: r[11] || "",
      };
      return v;
    });

    let filtered = vouchers;
    if (from) filtered = filtered.filter(v => v.date >= from);
    if (to) filtered = filtered.filter(v => v.date <= to);
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.voucherId.localeCompare(a.voucherId));

    return NextResponse.json({ success: true, vouchers: filtered });
  } catch (error) {
    console.error("GET /api/finance/vouchers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/finance/vouchers — create a payment voucher
export async function POST(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { date, recipient, accountCode, cashAccountCode, amount, notes, linkedBookingId, branch, costCenter } = body;

    if (!accountCode || !cashAccountCode || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "الحساب المدينة والحساب الدائن والمبلغ مطلوبون" }, { status: 400 });
    }

    const amt = parseFloat(amount);

    // Get account info
    const accounts = await getChartOfAccounts(true);
    const debitAccount = accounts.find(a => a.accountCode === accountCode);
    const creditAccount = accounts.find(a => a.accountCode === cashAccountCode);
    if (!debitAccount) return NextResponse.json({ success: false, error: "الحساب المدينة غير موجود" }, { status: 404 });
    if (!creditAccount) return NextResponse.json({ success: false, error: "الحساب الدائن غير موجود" }, { status: 404 });

    // Determine entryType from debit account type
    const entryType = debitAccount.accountType === "income" ? "income" : debitAccount.accountType === "liability" ? "liability" : "expense";

    // Record in Finance_Ledger
    const notesParts = [`سند صرف - ${recipient || "غير محدد"}`];
    if (notes) notesParts.push(notes);
    if (linkedBookingId) notesParts.push(`حجز #${linkedBookingId}`);
    const entryNotes = notesParts.join(" | ");

    const journalId = await addFinanceEntry({
      date: date || new Date().toLocaleDateString("en-CA"),
      accountCode,
      entryType,
      amount: amt,
      cashAccountCode,
      notes: entryNotes,
      linkedBookingId: linkedBookingId || "",
      branch: branch || "DHM",
      costCenter: costCenter || "",
    });

    // Ensure Payment_Vouchers sheet tab exists
    let sheetExists = false;
    try {
      const sheetRes = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      sheetExists = (sheetRes.data.sheets || []).some(s => (s.properties?.title || "") === "Payment_Vouchers");
    } catch {}
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: "Payment_Vouchers" } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Payment_Vouchers!A1:L1",
        valueInputOption: "RAW",
        requestBody: { values: [["VoucherID","Date","Recipient","Amount","AccountCode","AccountName","CashAccountCode","Notes","LinkedBookingID","JournalID","CreatedAt","Branch"]] },
      });
    }

    // Generate voucher ID
    let maxVid = 0;
    try {
      const vr = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Payment_Vouchers!A:A",
      });
      const vRows = vr.data.values || [];
      for (const r of vRows) { const n = parseInt(r[0]); if (n > maxVid) maxVid = n; }
    } catch {}
    const voucherId = maxVid + 1;

    // Record in Payment_Vouchers sheet
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Payment_Vouchers!A:L",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          voucherId.toString(),
          date || new Date().toLocaleDateString("en-CA"),
          recipient || "",
          amt.toString(),
          accountCode,
          debitAccount.accountName,
          cashAccountCode,
          notes || "",
          linkedBookingId || "",
          journalId.toString(),
          now,
          branch || "DHM",
        ]],
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إنشاء سند صرف رقم ${voucherId}`,
      voucherId,
      journalId,
    });
  } catch (error) {
    console.error("POST /api/finance/vouchers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
