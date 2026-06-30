"use client";
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
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

  const printFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: documentTitle,
    onAfterPrint: () => {
      setShowPrintPreview(false);
      setPrintData({ templateType: null, targetData: null });
    },
    pageStyle: "@page { margin: 0; }",
    ignoreGlobalStyles: true,
  });

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
