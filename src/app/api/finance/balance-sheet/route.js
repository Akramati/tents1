import { NextResponse } from "next/server";
import { getFinanceLedger, getChartOfAccounts, getCumulativeCashBalances } from "@/lib/sheets";

export async function GET() {
  try {
    const [ledger, accounts, cashBalances] = await Promise.all([
      getFinanceLedger(),
      getChartOfAccounts(),
      getCumulativeCashBalances(),
    ]);

    const accountMap = {};
    for (const a of accounts) accountMap[a.accountCode] = a;

    // Build account totals from ledger (debit/credit style)
    const accountTotals = {};
    for (const entry of ledger) {
      const code = entry.accountCode;
      if (!accountTotals[code]) accountTotals[code] = 0;
      if (entry.entryType === "income" || entry.entryType === "liability") {
        accountTotals[code] += entry.amount;
      } else {
        accountTotals[code] -= entry.amount;
      }
    }

    const buildTree = (parents, type) => {
      return parents.map((p) => {
        const children = accounts.filter((a) => a.parentCode === p.accountCode && a.isActive !== false);
        const childTree = children.length > 0 ? buildTree(children, type) : [];
        let balance;
        if (type === "asset") {
          balance = -1 * (accountTotals[p.accountCode] || 0) + (cashBalances[p.accountCode] || 0) + childTree.reduce((s, c) => s + c.balance, 0);
        } else {
          balance = (accountTotals[p.accountCode] || 0) + childTree.reduce((s, c) => s + c.balance, 0);
        }
        return { ...p, balance, children: childTree };
      });
    };

    const assetParents = accounts.filter((a) => a.accountType === "asset" && !a.parentCode);
    const liabilityParents = accounts.filter((a) => a.accountType === "liability" && !a.parentCode);
    const equityParents = accounts.filter((a) => a.accountType === "equity" && !a.parentCode);

    const assets = buildTree(assetParents, "asset");
    const liabilities = buildTree(liabilityParents, "liability");
    const equity = buildTree(equityParents, "equity");

    // Add cash sub-ledger details (only actual cash accounts)
    const cashAccountCodes = new Set(
      accounts.filter((a) => a.parentCode === "1100" || a.accountCode === "1100").map((a) => a.accountCode)
    );
    const cashDetails = {};
    for (const [code, balance] of Object.entries(cashBalances)) {
      if (!cashAccountCodes.has(code)) continue;
      const name = accountMap[code]?.accountName || code;
      cashDetails[code] = { code, name, balance };
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    return NextResponse.json({
      success: true,
      summary: { totalAssets, totalLiabilities, totalEquity },
      assets,
      liabilities,
      equity,
      cashDetails,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
