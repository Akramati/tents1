"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

const InvoiceLayout = forwardRef(({ data, settings, previewSettings, formatDateArabic }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";

  const beh = data.behavior || "hall";
  let typeRow;
  if (beh === "hall") {
    typeRow = "مكان المحجوز: صالة هابي لاند للمناسبات";
  } else {
    const pkgInfo = data.packageUsed ? `الباقة: ${data.packageUsed}` : "";
    const dims = (data.tentWidth && data.tentLength) ? ` | ${data.tentWidth}م × ${data.tentLength}م` : "";
    typeRow = pkgInfo + dims;
  }

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">سند حجز وتأكيد عقد</td></tr>
      </tbody></table>
      <table><tbody>
        <tr><td className="ps-type">{typeRow}</td></tr>
      </tbody></table>
      <table className="ps-details"><tbody>
        <tr><td className="ps-label">رقم الحجز</td><td className="ps-value">{data.bookingId}</td></tr>
        <tr><td className="ps-label">العميل</td><td className="ps-value">{data.customerName}</td></tr>
        <tr><td className="ps-label">الجوال</td><td className="ps-value">{data.customerPhone}</td></tr>
        <tr><td className="ps-label">نوع الحجز</td><td className="ps-value">{data.bookingType}</td></tr>
        {data.packageUsed && <tr><td className="ps-label">الباقة</td><td className="ps-value">{data.packageUsed}</td></tr>}
        {data.tentWidth && data.tentLength && <tr><td className="ps-label">أبعاد الخيمة</td><td className="ps-value">{data.tentWidth}م × {data.tentLength}م</td></tr>}
        <tr><td className="ps-label">الفترة</td><td className="ps-value">{data.eventType}{data.shift ? ` (${data.shift})` : ""}</td></tr>
        <tr><td className="ps-label">من تاريخ</td><td className="ps-value">{formatDateArabic ? formatDateArabic(data.startDate) : data.startDate}</td></tr>
        <tr><td className="ps-label">إلى تاريخ</td><td className="ps-value">{formatDateArabic ? formatDateArabic(data.endDate) : data.endDate}</td></tr>
        {data.customerAddress && <tr><td className="ps-label">العنوان</td><td className="ps-value">{data.customerAddress}</td></tr>}
      </tbody></table>
      <table className="ps-financial">
        <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>
          <tr><td>إجمالي الحجز</td><td className="ps-amount">{data.totalAmount?.toLocaleString?.() || data.totalAmount} ريال</td></tr>
          <tr><td>المدفوع (مقدم)</td><td className="ps-amount">{data.paidAmount?.toLocaleString?.() || data.paidAmount} ريال</td></tr>
          <tr className="ps-remaining"><td>المتبقي</td><td className="ps-amount">{data.remainingAmount?.toLocaleString?.() || data.remainingAmount} ريال</td></tr>
        </tbody>
      </table>
      {data.notes && <div className="ps-notes">{data.notes}</div>}
      <table className="ps-signature"><tbody>
        <tr>
          <td className="ps-sign-col"><div className="ps-sign-line"></div><div>توقيع المشرف</div></td>
          <td className="ps-sign-col"><div className="ps-sign-line"></div><div>توقيع العميل</div></td>
        </tr>
      </tbody></table>
    </div>
  );
});

InvoiceLayout.displayName = "InvoiceLayout";
export default InvoiceLayout;
