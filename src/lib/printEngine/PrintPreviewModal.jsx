"use client";
import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import InvoiceLayout from "./layouts/InvoiceLayout";
import ReportTableLayout from "./layouts/ReportTableLayout";
import SupplierDocLayout from "./layouts/SupplierDocLayout";
import InventoryListLayout from "./layouts/InventoryListLayout";
import FieldItemsLayout from "./layouts/FieldItemsLayout";
import TransferItemsLayout from "./layouts/TransferItemsLayout";

export default function PrintPreviewModal({
  printData, systemSettings, previewSettings, setPreviewSettings,
  printRef, printFn, onClose, documentTitle
}) {
  const { templateType, targetData } = printData;
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  const formatDateArabic = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    } catch { return dateStr; }
  };

  const renderLayout = () => {
    const commonProps = {
      settings: systemSettings,
      previewSettings,
      formatDateArabic,
    };
    switch (templateType) {
      case "INVOICE":
        return <InvoiceLayout ref={printRef} data={targetData} {...commonProps} />;
      case "REPORT_TABLE":
        return <ReportTableLayout ref={printRef} data={targetData} {...commonProps} />;
      case "SUPPLIER_DOC":
        return <SupplierDocLayout ref={printRef} data={targetData} {...commonProps} />;
      case "INVENTORY_LIST":
        return <InventoryListLayout ref={printRef} data={targetData} {...commonProps} />;
      case "FIELD_ITEMS":
        return <FieldItemsLayout ref={printRef} data={targetData} {...commonProps} />;
      case "TRANSFER_ITEMS":
        return <TransferItemsLayout ref={printRef} data={targetData} {...commonProps} />;
      default:
        return <div style={{ padding: "2rem", textAlign: "center" }}>نوع الطباعة غير معروف: {templateType}</div>;
    }
  };

  const handleDownloadImage = async () => {
    const el = printRef.current;
    if (!el) return;
    const origWidth = el.style.width;
    const origHeight = el.style.height;
    el.style.width = "794px";
    el.style.height = "auto";
    el.style.margin = "0 auto";
    const scrollEl = el.closest(".preview-scroll");
    const origOverflow = scrollEl?.style.overflowY;
    const origSh = scrollEl?.style.height;
    if (scrollEl) { scrollEl.style.overflowY = "visible"; scrollEl.style.height = "auto"; }
    await new Promise(r => setTimeout(r, 400));
    const rect = el.getBoundingClientRect();
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: rect.width, height: rect.height, y: 0, scrollY: 0, windowWidth: rect.width, windowHeight: rect.height });
    el.style.width = origWidth || "";
    el.style.height = origHeight || "";
    el.style.margin = "";
    if (scrollEl) { scrollEl.style.overflowY = origOverflow || ""; scrollEl.style.height = origSh || ""; }
    const link = document.createElement("a");
    link.download = `${documentTitle || "document"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleDownloadPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    const origWidth = el.style.width;
    const origHeight = el.style.height;
    el.style.width = "794px";
    el.style.height = "auto";
    el.style.margin = "0 auto";
    const scrollEl = el.closest(".preview-scroll");
    const origOverflow = scrollEl?.style.overflowY;
    const origSh = scrollEl?.style.height;
    if (scrollEl) { scrollEl.style.overflowY = "visible"; scrollEl.style.height = "auto"; }
    await new Promise(r => setTimeout(r, 400));
    const rect = el.getBoundingClientRect();
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: rect.width, height: rect.height, y: 0, scrollY: 0, windowWidth: rect.width, windowHeight: rect.height });
    el.style.width = origWidth || "";
    el.style.height = origHeight || "";
    el.style.margin = "";
    if (scrollEl) { scrollEl.style.overflowY = origOverflow || ""; scrollEl.style.height = origSh || ""; }
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let offset = 0;
    while (offset < imgH) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -offset, pageW, imgH);
      offset += pageH;
    }
    pdf.save(`${documentTitle || "document"}.pdf`);
  };

  const handleEmailPrint = async () => {
    const el = printRef.current;
    if (!el) return;
    setEmailSending(true);
    setEmailMsg(null);
    try {
      const origWidth = el.style.width;
      const origHeight = el.style.height;
      const isA5 = previewSettings.templateType === "A5";
      const scrollEl = el.closest(".preview-scroll");
      const origOverflow = scrollEl?.style.overflowY;
      const origSh = scrollEl?.style.height;
      if (scrollEl) { scrollEl.style.overflowY = "visible"; scrollEl.style.height = "auto"; }
      el.style.width = isA5 ? "560px" : "794px";
      el.style.height = "auto";
      el.style.margin = "0 auto";
      await new Promise(r => setTimeout(r, 200));
      el.scrollTop = 0;
      const rect = el.getBoundingClientRect();
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", height: rect.height, width: rect.width, y: 0, scrollY: 0, windowWidth: rect.width, windowHeight: rect.height });
      el.style.width = origWidth || "";
      el.style.height = origHeight || "";
      el.style.margin = "";
      if (scrollEl) { scrollEl.style.overflowY = origOverflow || ""; scrollEl.style.height = origSh || ""; }
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", isA5 ? "a5" : "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let offset = 0;
      while (offset < imgH) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -offset, pageW, imgH);
        offset += pageH;
      }
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      const res = await fetch("/api/print/epson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64, title: documentTitle }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailMsg("✅ تم إرسال المستند للطابعة");
      } else {
        setEmailMsg("❌ فشل الإرسال: " + (data.error || ""));
      }
    } catch (err) {
      setEmailMsg("❌ خطأ: " + err.message);
    }
    setEmailSending(false);
  };

  return (
    <div className="print-preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-preview-modal">
        <div className="preview-controls">
          <div className="preview-controls-row">
            <div className="preview-control-group">
              <label>نوع القالب</label>
              <select value={previewSettings.templateType} onChange={(e) => setPreviewSettings({ ...previewSettings, templateType: e.target.value })}>
                <option value="A4">ورقة A4 كاملة</option>
                <option value="A5">نصف ورقة A5</option>
                <option value="thermal">إيصال حراري صغير</option>
              </select>
            </div>
            <div className="preview-control-group">
              <label>حجم الخط</label>
              <div className="font-size-btns">
                {["small", "normal", "large"].map((s) => (
                  <button key={s} className={`preview-fs-btn ${previewSettings.fontSize === s ? "active" : ""}`}
                    onClick={() => setPreviewSettings({ ...previewSettings, fontSize: s })}>
                    {s === "small" ? "صغير جداً" : s === "normal" ? "عادي" : "كبير"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="preview-scroll">
          {renderLayout()}
        </div>

        {emailMsg && (
          <div style={{ padding: "0.5rem 1.5rem", textAlign: "center", fontSize: "0.9rem", fontWeight: "bold", color: emailMsg.startsWith("✅") ? "#059669" : "#dc2626" }}>
            {emailMsg}
          </div>
        )}

        <div className="preview-actions">
          <button className="btn btn-primary" onClick={() => printFn()}>
            🖨️ طباعة (قريب)
          </button>
          <button className="btn btn-gold" onClick={handleEmailPrint} disabled={emailSending}>
            {emailSending ? "⏳ جاري الإرسال..." : "📧 إرسال للطابعة (عن بعد)"}
          </button>
          <button className="btn" style={{ background: "#059669", color: "#fff" }} onClick={handleDownloadPdf}>
            📄 PDF
          </button>
          <button className="btn" style={{ background: "#6366f1", color: "#fff" }} onClick={handleDownloadImage}>
            🖼️ صورة
          </button>
          <button className="btn btn-secondary" onClick={onClose}>❌ إلغاء</button>
        </div>

        <style>{`
          .print-preview-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.65); display: flex; justify-content: center;
            align-items: center; z-index: 10000; padding: 1rem;
          }
          .print-preview-modal {
            background: #fff; color: #111; border-radius: 16px; width: 100%;
            max-width: 800px; max-height: 95vh; display: flex; flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5); direction: rtl;
          }
          .preview-controls {
            padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
          }
          .preview-controls-row { display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-end; }
          .preview-control-group { display: flex; flex-direction: column; gap: 0.4rem; }
          .preview-control-group label { font-size: 0.85rem; font-weight: 700; color: #555; }
          .preview-control-group select {
            padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px;
            font-size: 0.9rem; background: #f9fafb; color: #111; min-width: 150px;
          }
          .font-size-btns { display: flex; gap: 0.35rem; }
          .preview-fs-btn {
            padding: 0.4rem 0.9rem; border: 1px solid #d1d5db; border-radius: 8px;
            font-size: 0.8rem; cursor: pointer; background: #f9fafb; color: #333; transition: all 0.15s;
          }
          .preview-fs-btn.active { background: #1a5c3e; color: #fff; border-color: #1a5c3e; }
          .preview-scroll {
            flex: 1; overflow-y: auto; padding: 1.5rem; background: #f3f4f6;
            display: flex; justify-content: center;
          }
          .preview-scroll .ps-root {
            background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.1); width: 100%;
          }
          .preview-actions {
            padding: 0.75rem 1.5rem; border-top: 1px solid #e5e7eb;
            display: flex; gap: 0.75rem; justify-content: center; flex-shrink: 0; flex-wrap: wrap;
          }
          .preview-actions .btn-secondary { background: #6b7280; color: white; border: none; }
          .preview-actions .btn-secondary:hover { background: #4b5563; }
        `}</style>
      </div>
    </div>
  );
}
