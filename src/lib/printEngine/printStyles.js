export function buildPrintCSS({ font, titleSize, subtitleSize, detailSize, financialSize, noteSize, sigSize, bodyWidth, bodyPad }) {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .ps-root { background: white; color: #111; font-family: '${font}', sans-serif; direction: rtl; width: ${bodyWidth}; padding: ${bodyPad}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    td, th { padding: 0.5rem 0.75rem; text-align: right; }
    .ps-title { font-size: ${titleSize}; font-weight: bold; text-align: center; color: #1a5c3e; padding-bottom: 0.25rem; }
    .ps-subtitle { font-size: ${subtitleSize}; font-weight: bold; text-align: center; color: #b8860b; padding-bottom: 0.75rem; border-bottom: 2px solid #b8860b; }
    .ps-type td { font-size: ${detailSize}; font-weight: 600; text-align: center; color: #1a5c3e; padding: 0.75rem; }
    .ps-details td { border-bottom: 1px dashed #ccc; font-size: ${detailSize}; }
    .ps-label { width: 38%; font-weight: 600; color: #333; }
    .ps-value { font-weight: 400; color: #000; }
    .ps-financial { margin: 1rem 0; }
    .ps-financial th { background: #1a5c3e; color: white; font-weight: bold; text-align: center; font-size: ${financialSize}; }
    .ps-financial th:first-child { text-align: right; }
    .ps-financial td { border-bottom: 1px solid #ddd; font-size: ${financialSize}; }
    .ps-amount { text-align: left; font-weight: 600; direction: ltr; }
    .ps-remaining td { font-weight: bold; font-size: ${subtitleSize}; color: #000; border-top: 2px solid #000; }
    .ps-notes { margin: 0.75rem 0; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: ${noteSize}; }
    .ps-signature { margin-top: 2rem; }
    .ps-sign-col { width: 50%; text-align: center; vertical-align: bottom; padding: 1rem 0.5rem; font-size: ${sigSize}; }
    .ps-sign-line { border-top: 1px solid #333; width: 70%; margin: 0 auto 0.5rem; height: 2rem; }
    .ps-report-title { font-size: ${subtitleSize}; font-weight: bold; text-align: center; color: #1a5c3e; padding: 1rem 0 0.5rem; }
    .ps-report-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .ps-report-table th { background: #1a5c3e; color: white; font-weight: bold; text-align: center; font-size: ${detailSize}; padding: 0.6rem; border: 1px solid #1a5c3e; }
    .ps-report-table td { border: 1px solid #d1d5db; font-size: ${detailSize}; padding: 0.5rem; text-align: center; }
    .ps-report-table tr:nth-child(even) td { background: #f9fafb; }
    .ps-report-footer { text-align: center; font-size: ${noteSize}; color: #666; padding-top: 1rem; border-top: 1px solid #e5e7eb; margin-top: 1rem; }
    .ps-inv-header { font-size: ${detailSize}; font-weight: bold; text-align: center; padding: 0.5rem; color: #555; }
    .ps-inv-deficit { color: #dc2626; font-weight: 600; }
    .ps-inv-ok { color: #16a34a; font-weight: 600; }
    @media print {
      .no-print { display: none !important; }
    }
  `;
}

export function computePrintSizes(previewSettings, systemSettings) {
  const fs = previewSettings.fontSize || "normal";
  const scale = fs === "small" ? 0.75 : fs === "large" ? 1.25 : 1;
  const templateType = previewSettings.templateType || "A4";
  const bodyWidth = templateType === "thermal" ? "80mm" : "100%";
  const bodyPad = templateType === "thermal" ? "0.3cm" : "0.8cm";
  const font = systemSettings?.defaultFont || "Arial";
  const titleSize = `${Math.round(26 * scale)}px`;
  const subtitleSize = `${Math.round(18 * scale)}px`;
  const detailSize = `${Math.round(14 * scale)}px`;
  const financialSize = `${Math.round(14 * scale)}px`;
  const noteSize = `${Math.round(12 * scale)}px`;
  const sigSize = `${Math.round(14 * scale)}px`;
  return { font, titleSize, subtitleSize, detailSize, financialSize, noteSize, sigSize, bodyWidth, bodyPad };
}
