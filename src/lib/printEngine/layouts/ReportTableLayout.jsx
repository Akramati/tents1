"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

const ReportTableLayout = forwardRef(({ data, settings, previewSettings }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <div className="ps-center">
        <table><tbody>
          <tr><td className="ps-title">{company}</td></tr>
          <tr><td className="ps-subtitle">{data.title || "تقرير"}</td></tr>
        </tbody></table>

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
                <tr key={ri}>
                  {(row || []).map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data.footer && <div className="ps-report-footer">{data.footer}</div>}
      </div>
    </div>
  );
});

ReportTableLayout.displayName = "ReportTableLayout";
export default ReportTableLayout;
