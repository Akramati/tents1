"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

function fmtDate(d, formatDateArabic) {
  return formatDateArabic ? formatDateArabic(d) : d;
}

const FieldItemsLayout = forwardRef(({ data, settings, previewSettings, formatDateArabic }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";
  const items = data.items || [];
  const hasTent = data.tentLength || data.tentWidth;

  const cells = [
    { label: "رقم الحجز", value: data.bookingId },
    { label: "العميل", value: data.customerName },
    { label: "الجوال", value: data.customerPhone },
    { label: "نوع الحجز", value: data.bookingType },
  ];
  if (hasTent) cells.push({ label: "مقاس الخيمة", value: `${data.tentWidth} × ${data.tentLength} م` });
  cells.push(
    { label: "من تاريخ", value: fmtDate(data.startDate, formatDateArabic) },
    { label: "إلى تاريخ", value: fmtDate(data.endDate, formatDateArabic) },
  );

  const pairs = [];
  for (let i = 0; i < cells.length; i += 2) {
    pairs.push([cells[i], cells[i + 1] || null]);
  }

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">الأصناف المطلوبة للحجز</td></tr>
      </tbody></table>
        <table className="ps-details"><tbody>
          {pairs.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                if (!cell) return <td key={ci} style={{ width: "50%" }} />;
                return (
                  <td key={ci} style={{ width: "50%", borderBottom: "1px dashed #ccc", padding: sizes.isHalf ? "0.15rem 0.3rem" : "0.25rem 0.4rem", fontSize: sizes?.detailSize }}>
                    <span style={{ fontWeight: 600, color: "#333" }}>{cell.label}:</span>
                    <span style={{ marginRight: "0.2rem", color: "#000" }}>{cell.value || "-"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody></table>
        <div style={{ marginTop: sizes.isHalf ? "0.3rem" : "0.5rem", fontWeight: "bold", fontSize: sizes.detailSize }}>الأصناف والكميات:</div>
        <table className="ps-report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="3" style={{ textAlign: "center", padding: sizes.isHalf ? "0.3rem" : "0.5rem" }}>لا توجد أصناف</td></tr>
            )}
            {items.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{item.itemName || item.name}</td>
                <td>{item.quantityRequested || item.quantity || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ps-signature" style={{ marginTop: sizes.isHalf ? "0.5rem" : "1rem" }}>
          <table style={{ width: "100%", direction: "rtl" }}><tbody>
            <tr>
              <td style={{ width: "50%", textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", width: "60%", margin: "0 auto", paddingTop: sizes.isHalf ? "0.2rem" : "0.3rem" }}>
                  <div style={{ fontWeight: "bold", fontSize: sizes.detailSize }}>توقيع أمين المخزن</div>
                </div>
              </td>
              <td style={{ width: "50%", textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", width: "60%", margin: "0 auto", paddingTop: sizes.isHalf ? "0.2rem" : "0.3rem" }}>
                  <div style={{ fontWeight: "bold", fontSize: sizes.detailSize }}>توقيع الحارس</div>
                </div>
              </td>
            </tr>
          </tbody></table>
        </div>
    </div>
  );
});

FieldItemsLayout.displayName = "FieldItemsLayout";
export default FieldItemsLayout;
