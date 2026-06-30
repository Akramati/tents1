import { NextResponse } from "next/server";
import { getFinanceLedger, getChartOfAccounts } from "@/lib/sheets";
import { sheets } from "@/lib/google";
import { requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function ensureSheets() {
  for (const name of ["Finance_Ledger", "Chart_Of_Accounts"]) {
    try {
      await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${name}!A1` });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
      });
    }
  }
}

export async function GET(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    await ensureSheets();
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const costCenterFilter = searchParams.get("costCenter") || "";

    const [ledger, accounts] = await Promise.all([
      getFinanceLedger(fromDate, toDate),
      getChartOfAccounts(),
    ]);

    // Filter by costCenter if specified
    const filteredLedger = costCenterFilter
      ? ledger.filter((e) => e.costCenter === costCenterFilter)
      : ledger;

    // Build account map
    const accountMap = {};
    for (const a of accounts) accountMap[a.accountCode] = a;

    // Calculate income/expense by account
    const accountTotals = {};
    for (const entry of filteredLedger) {
      if (entry.entryType === "liability") continue;
      const code = entry.accountCode;
      if (!accountTotals[code]) accountTotals[code] = 0;
      if (entry.entryType === "income") {
        accountTotals[code] += entry.amount;
      } else {
        accountTotals[code] -= entry.amount;
      }
    }

    // Build P&L by account hierarchy
    const incomeAccounts = accounts.filter((a) => a.accountType === "income" && !a.parentCode);
    const expenseAccounts = accounts.filter((a) => a.accountType === "expense" && !a.parentCode);

    const buildTree = (parents) => {
      return parents.map((p) => {
        const directBalance = accountTotals[p.accountCode] || 0;
        const children = accounts.filter((a) => a.parentCode === p.accountCode);
        const childTree = children.length > 0 ? buildTree(children) : [];
        const childBalance = childTree.reduce((s, c) => s + c.balance, 0);
        const totalBalance = directBalance + childBalance;
        return { ...p, balance: totalBalance, children: childTree };
      });
    };

    const incomeTree = buildTree(incomeAccounts);
    const expenseTree = buildTree(expenseAccounts);

    const totalIncome = incomeTree.reduce((s, i) => s + i.balance, 0);
    const totalExpenses = expenseTree.reduce((s, e) => s + Math.abs(e.balance), 0);
    const netProfit = totalIncome - totalExpenses;

    // Category breakdown for display
    const categoryBreakdown = {};
    for (const entry of filteredLedger) {
      if (entry.entryType === "liability") continue;
      const acct = accountMap[entry.accountCode];
      const cat = acct ? acct.accountName : entry.accountCode;
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { income: 0, expense: 0 };
      if (entry.entryType === "income") categoryBreakdown[cat].income += entry.amount;
      else categoryBreakdown[cat].expense += entry.amount;
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMarginPercent: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
        ledgerCount: filteredLedger.length,
      },
      incomeTree,
      expenseTree,
      categoryBreakdown,
      ledger: filteredLedger,
    });
  } catch (error) {
    console.error("P&L error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
