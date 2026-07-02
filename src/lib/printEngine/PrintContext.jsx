"use client";
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import PrintPreviewModal from "./PrintPreviewModal";

const PrintContext = createContext(null);

export function PrintProvider({ children }) {
  const [systemSettings, setSystemSettings] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printData, setPrintData] = useState({ templateType: null, targetData: null });
  const [previewSettings, setPreviewSettings] = useState({ templateType: "A4", fontSize: "normal" });
  const [documentTitle, setDocumentTitle] = useState("طباعة");
  const printRef = useRef(null);
  const settingsFetched = useRef(false);

  const printFn = useCallback(() => {
    const el = printRef.current;
    if (!el) return;

    const styles = [];
    for (const s of el.querySelectorAll("style")) {
      styles.push(s.innerHTML);
    }

    const pageSize = previewSettings.templateType === "A5" ? "A5 portrait" : "A4 portrait";
    const css = `@page { size: ${pageSize}; margin: 4mm 6mm; }
@media print {
  body { margin: 0; padding: 0; font-family: sans-serif; direction: rtl; display: flex; align-items: center; min-height: 100vh; }
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
${styles.join("\n")}`;

    const win = window.open("", "_blank", "width=800,height=600,scrollbars=yes");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="utf-8"><title>${documentTitle}</title><style>${css.replace(/<\/script>/g, "<\\/script>")}</style></head>
<body>${el.innerHTML}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);

    setTimeout(() => {
      setShowPrintPreview(false);
      setPrintData({ templateType: null, targetData: null });
    }, 500);
  }, [documentTitle, previewSettings.templateType]);

  // Fetch system settings once
  useEffect(() => {
    if (settingsFetched.current) return;
    settingsFetched.current = true;
    fetch("/api/config/system-settings")
      .then(r => r.json())
      .then(d => { if (d.success) setSystemSettings(d.settings); })
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!showPrintPreview) return;
    const onKey = (e) => { if (e.key === "Escape") { setShowPrintPreview(false); setPrintData({ templateType: null, targetData: null }); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPrintPreview]);

  const print = useCallback((templateType, targetData, options = {}) => {
    if (!templateType || !targetData) return;
    setPrintData({ templateType, targetData });
    setPreviewSettings({ templateType: "A4", fontSize: "normal", ...(options.previewSettings || {}) });
    setDocumentTitle(options.documentTitle || getDefaultTitle(templateType));
    setShowPrintPreview(true);
  }, []);

  return (
    <PrintContext.Provider value={{ systemSettings, print, showPrintPreview }}>
      {children}
      {showPrintPreview && (
        <PrintPreviewModal
          printData={printData}
          systemSettings={systemSettings}
          previewSettings={previewSettings}
          setPreviewSettings={setPreviewSettings}
          printRef={printRef}
          printFn={printFn}
          onClose={() => { setShowPrintPreview(false); setPrintData({ templateType: null, targetData: null }); }}
          documentTitle={documentTitle}
        />
      )}
    </PrintContext.Provider>
  );
}

function getDefaultTitle(templateType) {
  switch (templateType) {
    case "INVOICE": return "سند حجز وتأكيد عقد";
    case "REPORT_TABLE": return "تقرير";
    case "INVENTORY_LIST": return "قائمة الجرد";
    default: return "طباعة";
  }
}

export function usePrintEngine() {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrintEngine must be used within PrintProvider");
  return ctx;
}
