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
    { label: "اسم العميل", value: data.customerName },
    { label: "رقم الجوال", value: data.customerPhone },
    { label: "العنوان", value: data.customerAddress },
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
                <td key={ci} style={{ width: "50%", borderBottom: "1px dashed #ccc", padding: "0.3rem 0.5rem", fontSize: sizes?.detailSize }}>
                  <span style={{ fontWeight: 600, color: "#333" }}>{cell.label}:</span>
                  <span style={{ marginRight: "0.3rem", color: "#000" }}>{cell.value || "-"}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody></table>
      <div style={{ marginTop: "1rem", fontWeight: "bold" }}>الأصناف والكميات:</div>
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
            <tr><td colSpan="3" style={{ textAlign: "center", padding: "1rem" }}>لا توجد أصناف</td></tr>
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
      <div className="ps-signature" style={{ marginTop: "2rem" }}>
        <table style={{ width: "100%", direction: "rtl" }}><tbody>
          <tr>
            <td style={{ width: "50%", textAlign: "center", paddingBottom: "0.5rem" }}>
              <div style={{ borderTop: "1px solid #333", width: "70%", margin: "0 auto", paddingTop: "0.5rem" }}>
                <div style={{ fontWeight: "bold", fontSize: sizes?.small ? "0.7rem" : "0.85rem" }}>توقيع أمين المخزن</div>
                <div style={{ fontSize: sizes?.small ? "0.6rem" : "0.75rem", color: "#666" }}>مدير المخازن</div>
              </div>
            </td>
            <td style={{ width: "50%", textAlign: "center", paddingBottom: "0.5rem" }}>
              <div style={{ borderTop: "1px solid #333", width: "70%", margin: "0 auto", paddingTop: "0.5rem" }}>
                <div style={{ fontWeight: "bold", fontSize: sizes?.small ? "0.7rem" : "0.85rem" }}>توقيع حارس الخيمة</div>
                <div style={{ fontSize: sizes?.small ? "0.6rem" : "0.75rem", color: "#666" }}>حارس الخيمة</div>
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
