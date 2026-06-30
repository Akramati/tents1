"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

function AccountTreeRow({ account, depth, isIncome }) {
  const amount = account.balance;
  const absAmount = Math.abs(amount);
  return (
    <>
      <tr>
        <td style={{ paddingRight: `${depth * 1.5 + 0.5}rem` }}>
          {depth > 0 && "└ "}{account.accountName}
          <span className="text-muted" style={{ fontSize: "0.8rem", marginRight: "0.5rem" }}>
            ({account.accountCode})
          </span>
        </td>
        <td style={{ color: isIncome ? "#059669" : "#dc2626", fontWeight: depth === 0 ? "bold" : "normal" }}>
          {formatCurrency(isIncome ? amount : absAmount)}
        </td>
      </tr>
      {(account.children || []).map((child) => (
        <AccountTreeRow key={child.accountCode} account={child} depth={depth + 1} isIncome={isIncome} />
      ))}
    </>
  );
}

function renderTree(tree, isIncome) {
  return tree.map((acct) => (
    <AccountTreeRow key={acct.accountCode} account={acct} depth={0} isIncome={isIncome} />
  ));
}

export default function ProfitLossView({
  pnlData,
  pnlLoading,
  fetchProfitLoss,
  print,
}) {
  const [costCenters, setCostCenters] = useState([]);
  const [selectedPnlCostCenter, setSelectedPnlCostCenter] = useState("");

  useEffect(() => {
    fetch("/api/finance/cost-centers").then(r => r.json()).then(d => { if (d.success) setCostCenters((d.centers || []).filter(c => c.type === "booking" || c.type === "administrative")); }).catch(() => {});
  }, []);

  const handleRefresh = () => {
    fetchProfitLoss(undefined, undefined, selectedPnlCostCenter || undefined);
  };

  if (!pnlData) {
    return (
      <section className="inventory-section glass">
        <div className="section-title-row">
          <h2>📊 تقرير الأرباح والخسائر</h2>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={pnlLoading}>
            {pnlLoading ? "جاري التحميل..." : "🔄 تحديث"}
          </button>
        </div>
        <p className="no-data">اضغط "تحديث" لتحميل التقرير</p>
      </section>
    );
  }

  const { summary, incomeTree, expenseTree, categoryBreakdown } = pnlData;

  const summaryRows = [
    ["إجمالي الإيرادات", formatCurrency(summary.totalIncome)],
    ["إجمالي المصروفات", formatCurrency(summary.totalExpenses)],
    ["صافي الربح", formatCurrency(summary.netProfit)],
    ["هامش الربح", summary.profitMarginPercent.toFixed(1) + "%"],
    ["عدد القيود", summary.ledgerCount],
  ];

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>📊 تقرير الأرباح والخسائر</h2>
        <div className="no-print" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select className="form-control" style={{ width: "auto", maxWidth: "200px", fontSize: "0.8rem" }} value={selectedPnlCostCenter} onChange={e => { setSelectedPnlCostCenter(e.target.value); }}>
            <option value="">كل مراكز التكلفة</option>
            {costCenters.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={pnlLoading}>
            {pnlLoading ? "جاري التحميل..." : "🔄 تحديث"}
          </button>
          <button className="btn btn-gold" onClick={() => {
            print("REPORT_TABLE", {
              title: "تقرير الأرباح والخسائر",
              headers: ["البيان", "القيمة"],
              rows: summaryRows,
              footer: `تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}`,
            }, { documentTitle: "تقرير الأرباح والخسائر" });
          }}>📄 PDF</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>ملخص سريع</h3>
        <button className="btn btn-sm print-btn" onClick={() => {
          print("REPORT_TABLE", {
            title: "ملخص الأرباح والخسائر",
            headers: ["البيان", "القيمة"],
            rows: summaryRows,
            footer: `تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}`,
          }, { documentTitle: "ملخص الأرباح والخسائر" });
        }}>🖨️ طباعة</button>
      </div>
      <div className="stats-grid four-col">
        <div className="stat-card glass">
          <span className="stat-icon text-emerald">💰</span>
          <div className="stat-info">
            <h3>إجمالي الإيرادات</h3>
            <p className="stat-value text-emerald">{formatCurrency(summary.totalIncome)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-red">💸</span>
          <div className="stat-info">
            <h3>إجمالي المصروفات</h3>
            <p className="stat-value text-red">{formatCurrency(summary.totalExpenses)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon" style={{ color: summary.netProfit >= 0 ? "#059669" : "#dc2626" }}>📈</span>
          <div className="stat-info">
            <h3>صافي الربح</h3>
            <p className="stat-value" style={{ color: summary.netProfit >= 0 ? "#059669" : "#dc2626" }}>
              {formatCurrency(summary.netProfit)}
            </p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-gold">📊</span>
          <div className="stat-info">
            <h3>هامش الربح</h3>
            <p className="stat-value text-gold">{summary.profitMarginPercent.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Income Tree */}
      {incomeTree && incomeTree.length > 0 && (
        <div className="inv-table-wrapper">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>شجرة الإيرادات</h3>
            <button className="btn btn-sm print-btn" onClick={() => {
              const gatherRows = (tree, depth) => {
                const rows = [];
                for (const a of tree) {
                  rows.push(["  ".repeat(depth) + a.accountName + " (" + a.accountCode + ")", formatCurrency(a.balance >= 0 ? a.balance : 0)]);
                  if (a.children) rows.push(...gatherRows(a.children, depth + 1));
                }
                return rows;
              };
              const rows = gatherRows(incomeTree, 0);
              rows.push(["الإجمالي", formatCurrency(summary.totalIncome)]);
              print("REPORT_TABLE", {
                title: "شجرة الإيرادات",
                headers: ["الحساب", "المبلغ"],
                rows,
                footer: `تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}`,
              }, { documentTitle: "شجرة الإيرادات" });
            }}>🖨️ طباعة</button>
          </div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>الحساب</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>{renderTree(incomeTree, true)}</tbody>
          </table>
        </div>
      )}

      {/* Expense Tree */}
      {expenseTree && expenseTree.length > 0 && (
        <div className="inv-table-wrapper">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>شجرة المصروفات</h3>
            <button className="btn btn-sm print-btn" onClick={() => {
              const gatherRows = (tree, depth) => {
                const rows = [];
                for (const a of tree) {
                  rows.push(["  ".repeat(depth) + a.accountName + " (" + a.accountCode + ")", formatCurrency(Math.abs(a.balance))]);
                  if (a.children) rows.push(...gatherRows(a.children, depth + 1));
                }
                return rows;
              };
              const rows = gatherRows(expenseTree, 0);
              rows.push(["الإجمالي", formatCurrency(summary.totalExpenses)]);
              print("REPORT_TABLE", {
                title: "شجرة المصروفات",
                headers: ["الحساب", "المبلغ"],
                rows,
                footer: `تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}`,
              }, { documentTitle: "شجرة المصروفات" });
            }}>🖨️ طباعة</button>
          </div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>الحساب</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>{renderTree(expenseTree, false)}</tbody>
          </table>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown && Object.keys(categoryBreakdown).length > 0 && (
        <div className="inv-table-wrapper">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>تفصيل حسب الحساب</h3>
            <button className="btn btn-sm print-btn" onClick={() => {
              const rows = Object.entries(categoryBreakdown).map(([cat, val]) => [
                cat,
                formatCurrency(val.income),
                formatCurrency(val.expense),
              ]);
              rows.push(["الإجمالي", formatCurrency(summary.totalIncome), formatCurrency(summary.totalExpenses)]);
              print("REPORT_TABLE", {
                title: "تفصيل حسب الحساب",
                headers: ["الحساب", "إيرادات", "مصروفات"],
                rows,
                footer: `تم الإنشاء: ${new Date().toLocaleDateString("ar-SA")}`,
              }, { documentTitle: "تفصيل الحسابات" });
            }}>🖨️ طباعة</button>
          </div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>الحساب</th>
                <th>إيرادات</th>
                <th>مصروفات</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categoryBreakdown).map(([cat, val], idx) => (
                <tr key={idx}>
                  <td>{cat}</td>
                  <td className="text-emerald">{val.income > 0 ? formatCurrency(val.income) : "-"}</td>
                  <td className="text-red">{val.expense > 0 ? formatCurrency(val.expense) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
