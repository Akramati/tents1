"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

const InventoryListLayout = forwardRef(({ data, settings, previewSettings }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";
  const items = data.items || [];

  const totalExpected = items.reduce((s, i) => s + (parseFloat(i.expected) || 0), 0);
  const totalActual = items.reduce((s, i) => s + (parseFloat(i.actual) || 0), 0);
  const totalDeficit = items.reduce((s, i) => s + (parseFloat(i.deficit) || 0), 0);

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">{data.title || "قائمة الجرد"}</td></tr>
      </tbody></table>
      <div className="ps-inv-header">{data.date ? `تاريخ الجرد: ${data.date}` : ""}</div>

      <table className="ps-report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>الصنف</th>
            <th>المتوقع</th>
            <th>الفعلي</th>
            <th>العجز / الزيادة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{item.name}</td>
              <td>{item.expected}</td>
              <td>{item.actual}</td>
              <td className={parseFloat(item.deficit) > 0 ? "ps-inv-deficit" : "ps-inv-ok"}>{item.deficit}</td>
              <td className={item.status === "عجز" ? "ps-inv-deficit" : "ps-inv-ok"}>{item.status || "✓"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #000" }}>
            <td colSpan="2">الإجمالي</td>
            <td>{totalExpected}</td>
            <td>{totalActual}</td>
            <td className={totalDeficit > 0 ? "ps-inv-deficit" : "ps-inv-ok"}>{totalDeficit}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className="ps-signature" style={{ marginTop: "2rem" }}>
        <table><tbody>
          <tr>
            <td className="ps-sign-col"><div className="ps-sign-line"></div><div>توقيع أمين المخزن</div></td>
            <td className="ps-sign-col"><div className="ps-sign-line"></div><div>توقيع المدير</div></td>
          </tr>
        </tbody></table>
      </div>

      <div className="ps-report-footer">قائمة جرد معتمدة — مجموعة التعزي لإدارة المناسبات والتأجير</div>
    </div>
  );
});

InventoryListLayout.displayName = "InventoryListLayout";
export default InventoryListLayout;
