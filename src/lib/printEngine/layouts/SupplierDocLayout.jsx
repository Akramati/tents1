"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";
import { amountInWords } from "@/lib/numberToWords";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const SupplierDocLayout = forwardRef(({ data, settings, previewSettings }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";

  const fmtDay = (dateStr) => {
    if (!dateStr) return "";
    try { const d = new Date(dateStr); return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}`; }
    catch { return dateStr; }
  };

  const balLabel = data.balanceLabel || "الرصيد الحالي";

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>

      {/* Report title */}
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">{data.title || "تقرير مورد"}</td></tr>
      </tbody></table>

      {data.date && (
        <div style={{ textAlign: "center", fontSize: sizes.subtitleSize, fontWeight: "bold", color: "#333", marginBottom: "0.3rem" }}>
          {fmtDay(data.date)}
        </div>
      )}

      {/* Party info + doc number */}
      <table className="ps-details">
        <tbody>
          <tr><td className="ps-label">المورد</td><td className="ps-value">{data.partyName}</td></tr>
          {data.partyPhone && <tr><td className="ps-label">الجوال</td><td className="ps-value">{data.partyPhone}</td></tr>}
          {data.docNumber && <tr><td className="ps-label">رقم المستند</td><td className="ps-value">{data.docNumber}</td></tr>}
        </tbody>
      </table>

      {/* Items table */}
      <table className="ps-report-table">
        <thead>
          <tr>
            <th style={{ width: "18%" }}>التاريخ</th>
            <th style={{ width: "14%" }}>النوع</th>
            <th style={{ width: "14%" }}>الرقم</th>
            <th style={{ width: "26%" }}>البيان</th>
            <th style={{ width: "14%" }}>مدين</th>
            <th style={{ width: "14%" }}>دائن</th>
          </tr>
        </thead>
        <tbody>
          {(data.items || []).map((row, ri) => (
            <tr key={ri}>
              <td style={{ fontSize: sizes.detailSize }}>{row.date || "-"}</td>
              <td style={{ fontSize: sizes.detailSize }}>{row.type || "-"}</td>
              <td style={{ fontSize: sizes.detailSize }}>{row.number || "-"}</td>
              <td style={{ fontSize: sizes.detailSize, textAlign: "right" }}>{row.description || "-"}</td>
              <td className="ps-amount" style={{ color: row.debit > 0 ? "#dc2626" : "inherit" }}>{row.debit > 0 ? row.debit.toLocaleString() : "-"}</td>
              <td className="ps-amount" style={{ color: row.credit > 0 ? "#059669" : "inherit" }}>{row.credit > 0 ? row.credit.toLocaleString() : "-"}</td>
            </tr>
          ))}
          {(data.items || []).length === 0 && (
            <tr><td colSpan="6" style={{ textAlign: "center", padding: "0.5rem", opacity: 0.5 }}>لا توجد معاملات</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      {data.totals && (
        <div className="ps-totals">
          <table>
            <tbody>
              <tr className="ps-total-income">
                <td className="label" style={{ textAlign: "right" }}>إجمالي الدائن</td>
                <td className="amount">{data.totals.credit?.toLocaleString?.() || 0}</td>
              </tr>
              <tr className="ps-total-expense">
                <td className="label" style={{ textAlign: "right" }}>إجمالي المدين</td>
                <td className="amount">{data.totals.debit?.toLocaleString?.() || 0}</td>
              </tr>
              <tr className="ps-total-net" style={{ borderTop: "2px solid #1a5c3e" }}>
                <td className="label" style={{ textAlign: "right" }}>الفرق</td>
                <td className="amount">{(data.totals.debit - data.totals.credit)?.toLocaleString?.() || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Balance section */}
      <div className="ps-balance-box" style={{ marginTop: "0.6rem", padding: "0.5rem", border: "2px solid #1a5c3e", borderRadius: "8px", background: "#f0fdf4" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: "bold", fontSize: sizes.subtitleSize, color: "#1a5c3e", textAlign: "center", padding: "0.2rem 0" }}>
                {balLabel}: {data.balance?.toLocaleString?.() || 0} ريال يمني
              </td>
            </tr>
            {data.amountInWords && (
              <tr>
                <td style={{ fontSize: sizes.detailSize, color: "#333", textAlign: "center", padding: "0.15rem 0" }}>
                  (فقط {data.amountInWords})
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Signature */}
      <table className="ps-signature">
        <tbody>
          <tr>
            <td className="ps-sign-col"><div className="ps-sign-line"></div><div style={{ fontSize: sizes.detailSize }}>توقيع المدير</div></td>
            <td className="ps-sign-col"><div className="ps-sign-line"></div><div style={{ fontSize: sizes.detailSize }}>الختم</div></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

SupplierDocLayout.displayName = "SupplierDocLayout";
export default SupplierDocLayout;
