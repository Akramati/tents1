"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const ReportTableLayout = forwardRef(({ data, settings, previewSettings }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";

  const rowClass = (row) => {
    if (Array.isArray(row)) return "";
    if (row.type === "income") return "ps-row-income";
    if (row.type === "expense") return "ps-row-expense";
    if (row.type === "liability") return "ps-row-liability";
    return "";
  };

  const rowCells = (row) => Array.isArray(row) ? row : row.cells;

  const fmtDay = (dateStr) => {
    if (!dateStr) return "";
    try { const d = new Date(dateStr); return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}`; }
    catch { return dateStr; }
  };

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">{data.title || "تقرير"}</td></tr>
      </tbody></table>

      {data.dateHeader && (
        <div style={{ textAlign: "center", fontSize: sizes.subtitleSize, fontWeight: "bold", color: "#333", marginBottom: "0.3rem" }}>
          {fmtDay(data.dateHeader)}
        </div>
      )}

      {data.subtitle && (
        <div style={{ textAlign: "center", fontSize: sizes.detailSize, color: "#666", marginBottom: sizes.isHalf ? "0.2rem" : "0.3rem" }}>{data.subtitle}</div>
      )}

      {data.summary && data.summary.length > 0 && (
        <table className="ps-summary">
          <tbody>
            {data.summary.map((row, i) => (
              <tr key={i}>
                <td className="label">{row.label}</td>
                <td className="value">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(data.headers || []).length > 0 && (
        <table className="ps-report-table">
          <thead>
            <tr>
              {(data.headers || []).map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(data.rows || []).map((row, ri) => (
              <tr key={ri} className={rowClass(row)}>
                {rowCells(row).map((cell, ci) => <td key={ci}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.totals && (
        <div className="ps-totals">
          <table>
            <tbody>
              {data.totals.income !== undefined && (
                <tr className="ps-total-income">
                  <td className="label">إجمالي الإيرادات</td>
                  <td className="amount">{data.totals.income}</td>
                </tr>
              )}
              {data.totals.expense !== undefined && (
                <tr className="ps-total-expense">
                  <td className="label">{data.totalLabels?.expense || "إجمالي المصروفات"}</td>
                  <td className="amount">{data.totals.expense}</td>
                </tr>
              )}
              {data.totals.liability !== undefined && data.totals.liability > 0 && (
                <tr className="ps-total-income">
                  <td className="label">{data.totalLabels?.liability || "عربون (مطلوبات)"}</td>
                  <td className="amount">{data.totals.liability}</td>
                </tr>
              )}
              {data.totals.net !== undefined && (
                <tr className="ps-total-net" style={{ borderTop: "2px solid #1a5c3e" }}>
                  <td className="label" style={{ fontWeight: "bold", fontSize: sizes.subtitleSize }}>الصافي</td>
                  <td className="amount" style={{ fontWeight: "bold", fontSize: sizes.subtitleSize }}>{data.totals.net}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data.footer && !data.totals && <div className="ps-report-footer">{data.footer}</div>}
    </div>
  );
});

ReportTableLayout.displayName = "ReportTableLayout";
export default ReportTableLayout;
