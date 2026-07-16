"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatCurrency, formatDateArabic } from "@/lib/utils";

const MAIN_CALENDAR_ID = "0483eb0f27b59560c6b9a14c4c896284349efa9147ce9bef773557e9c7bb3b12@group.calendar.google.com";

export default function CalendarView() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

  // External ICS state
  const [externalEvents, setExternalEvents] = useState([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState("");
  const [newIcsUrl, setNewIcsUrl] = useState("");
  const [savedUrls, setSavedUrls] = useState(() => {
    try { return JSON.parse(localStorage.getItem("calSavedUrls") || "[]"); }
    catch { return []; }
  });
  const fileInputRef = useRef(null);

  // Export modal
  const [exportModal, setExportModal] = useState(false);
  const [exportCalId, setExportCalId] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/bookings?limit=2000")
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const confirmed = data.bookings.filter(b => b.status === "مؤكد" || b.status === "منتهي");
          setBookings(confirmed);
          if (confirmed.length > 0) {
            const dates = confirmed.map(b => b.startDate).filter(Boolean).sort();
            setSelectedMonth(dates[0].slice(0, 7));
          }
        } else setError("فشل تحميل الحجوزات");
      })
      .catch(() => setError("خطأ في الاتصال"))
      .finally(() => setLoading(false));
  }, []);

  // Auto-fetch first saved URL on mount
  useEffect(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem("calSavedUrls") || "[]"); } catch { return []; } })();
    if (saved.length > 0) fetchExtEvents(saved[0].url);
  }, []);

  const months = useMemo(() => {
    const m = new Set();
    bookings.forEach(b => { if (b.startDate) m.add(b.startDate.slice(0, 7)); });
    return [...m].sort().reverse();
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (!selectedMonth) return bookings;
    return bookings.filter(b => b.startDate && b.startDate.startsWith(selectedMonth));
  }, [bookings, selectedMonth]);

  const summary = useMemo(() => {
    const total = filteredBookings.length;
    const revenue = filteredBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paid = filteredBookings.reduce((s, b) => s + (b.paidAmount || 0), 0);
    const remaining = filteredBookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
    return { total, revenue, paid, remaining };
  }, [filteredBookings]);

  const getIcsEmbedUrl = () => null;

  const normalizeUrl = (input) => {
    const trimmed = input.trim();
    // Already an ICS URL
    if (trimmed.includes("/basic.ics") || trimmed.includes("/default.ics")) return trimmed;
    // Google Calendar embed URL: extract the email
    const embedMatch = trimmed.match(/src=([^&]+)/);
    if (embedMatch) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(decodeURIComponent(embedMatch[1]))}/public/basic.ics`;
    // Plain email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(trimmed)}/public/basic.ics`;
    return trimmed;
  };

  const persistUrls = (urls) => {
    setSavedUrls(urls);
    localStorage.setItem("calSavedUrls", JSON.stringify(urls));
  };

  const fetchExtEvents = async (url) => {
    setExtLoading(true);
    setExtError("");
    setExternalEvents([]);
    try {
      const res = await fetch("/api/calendar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: url }),
      });
      const data = await res.json();
      if (data.success) setExternalEvents(data.events);
      else setExtError(data.error || "فشل جلب الأحداث");
    } catch { setExtError("خطأ في الاتصال"); }
    setExtLoading(false);
  };

  const handleSaveUrl = () => {
    if (!newIcsUrl.trim()) return;
    const normalized = normalizeUrl(newIcsUrl.trim());
    if (normalized !== newIcsUrl.trim()) setNewIcsUrl(normalized);
    const updated = [...savedUrls.filter(u => u.url !== normalized), { url: normalized }];
    persistUrls(updated);
    setNewIcsUrl("");
    fetchExtEvents(normalized);
  };

  const handleDeleteUrl = (url) => {
    const updated = savedUrls.filter(u => u.url !== url);
    persistUrls(updated);
    if (externalEvents.length > 0 && url === savedUrls.find(s => s.url)?.url) setExternalEvents([]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtLoading(true);
    setExtError("");
    setExternalEvents([]);
    try {
      const text = await file.text();
      const res = await fetch("/api/calendar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsContent: text }),
      });
      const data = await res.json();
      if (data.success) setExternalEvents(data.events);
      else setExtError(data.error || "فشل قراءة الملف");
    } catch { setExtError("فشل قراءة الملف"); }
    setExtLoading(false);
    e.target.value = "";
  };

  const createBookingFromEvent = async (ev) => {
    const name = prompt("اسم العميل:", ev.summary) || ev.summary;
    if (!name) return;
    const phone = prompt("رقم الجوال:", "");
    if (!phone) return;
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name, customerPhone: phone,
          startDate: ev.startDate, endDate: ev.endDate,
          totalAmount: "0", paidAmount: "0",
          bookingType: "حجز خيمة", status: "قيد الانتظار",
          notes: `مستورد من تقويم خارجي\nالحدث الأصلي: ${ev.summary}\n${ev.description}`.slice(0, 500),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExternalEvents(prev => prev.filter(e => e.eventId !== ev.eventId));
        setTimeout(() => window.location.reload(), 500);
      } else alert("فشل إنشاء الحجز: " + (data.error || ""));
    } catch { alert("خطأ في الاتصال"); }
  };

  const downloadICS = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HappyLand//Calendar//AR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:حجوزات هابي لاند\n";
    filteredBookings.forEach(b => {
      const ds = b.startDate.replace(/-/g, "");
      const de = (() => { const d = new Date(b.endDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0].replace(/-/g, ""); })();
      const lines = [
        `رقم الحجز: ${b.bookingId}`, `العميل: ${b.customerName}`, `الجوال: ${b.customerPhone}`,
        `العنوان: ${b.customerAddress}`, `المبلغ الإجمالي: ${formatCurrency(b.totalAmount)}`,
        `المقدم: ${formatCurrency(b.paidAmount)}`, `المتبقي: ${formatCurrency(b.remainingAmount)}`,
        `نوع الحجز: ${b.bookingType}`, `تاريخ الحجز: ${b.timestamp}`,
        `نوع الفعالية: ${b.eventType}`, `الفترة: ${b.shift}`,
      ].filter(l => l.split(": ")[1]);
      ics += "BEGIN:VEVENT\n" + `UID:${b.bookingId}@happyland\n` + `DTSTART;VALUE=DATE:${ds}\n` + `DTEND;VALUE=DATE:${de}\n` + `SUMMARY:${b.customerName} - ${b.bookingType}\n` + `DESCRIPTION:${lines.join("\\n")}\n` + `LOCATION:${b.customerAddress || ""}\n` + "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "happyland-bookings.ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyEventDetails = (b) => {
    const txt = [`رقم الحجز: ${b.bookingId}`, `العميل: ${b.customerName}`, `الهاتف: ${b.customerPhone}`, `العنوان: ${b.customerAddress}`, `تاريخ البداية: ${formatDateArabic(b.startDate)}`, `تاريخ النهاية: ${formatDateArabic(b.endDate)}`, `المبلغ الإجمالي: ${formatCurrency(b.totalAmount)}`, `المبلغ المقدم: ${formatCurrency(b.paidAmount)}`, `المتبقي: ${formatCurrency(b.remainingAmount)}`, `نوع الحجز: ${b.bookingType}`, `تاريخ الحجز: ${b.timestamp}`, `نوع الفعالية: ${b.eventType}`, `الفترة: ${b.shift}`, `الباقة: ${b.packageUsed}`, `الملاحظات: ${b.notes}`].filter(l => l.split(": ")[1]).join("\n");
    navigator.clipboard.writeText(txt).then(() => { setCopySuccess(b.bookingId); setTimeout(() => setCopySuccess(""), 2000); });
  };

  const handleExport = async () => {
    if (!exportCalId.trim()) { setExportError("الرجاء إدخال معرف التقويم الهدف"); return; }
    setExportLoading(true); setExportError(""); setExportResult(null);
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCalendarId: exportCalId.trim(), bookingIds: filteredBookings.map(b => b.bookingId) }),
      });
      const data = await res.json();
      if (data.success) setExportResult(data); else setExportError(data.error || "فشل التصدير");
    } catch { setExportError("خطأ في الاتصال"); }
    setExportLoading(false);
  };

  const monthName = (m) => {
    const names = { "01": "يناير", "02": "فبراير", "03": "مارس", "04": "إبريل", "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس", "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر" };
    return `${names[m.slice(5)]} ${m.slice(0, 4)}`;
  };

  if (loading) return <div className="ops-loading"><div className="spinner" /><p>جاري تحميل التقويم...</p></div>;

  return (
    <div className="glass" style={{ padding: "1.25rem", borderRadius: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>📅 تقويم الحجوزات</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "auto" }}>
            <option value="">كل الحجوزات</option>
            {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
          <button className="btn btn-outline" onClick={() => window.open("https://calendar.google.com/calendar/u/0/r/month", "_blank")}>📅 فتح التقويم</button>
          <button className="btn btn-primary" onClick={downloadICS} disabled={filteredBookings.length === 0}>⬇️ ICS</button>
          <button className="btn btn-outline" onClick={() => setExportModal(true)}>📤 تصدير</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div className="stat-card"><span className="stat-label">عدد الحجوزات</span><span className="stat-value">{summary.total}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي الإيرادات</span><span className="stat-value gold">{formatCurrency(summary.revenue)}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي المدفوع</span><span className="stat-value" style={{ color: "#4caf50" }}>{formatCurrency(summary.paid)}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي المتبقي</span><span className="stat-value" style={{ color: "#f44336" }}>{formatCurrency(summary.remaining)}</span></div>
      </div>

      {/* External Calendar Section */}
      <div style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>📥 التقويم الخارجي</h3>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            {savedUrls.map((su, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,255,255,0.08)", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", maxWidth: "200px", overflow: "hidden" }}>
                <span style={{ direction: "ltr", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={su.url}>{su.url}</span>
                <button className="btn btn-sm" style={{ padding: "0.1rem 0.3rem", fontSize: "0.7rem" }} onClick={() => fetchExtEvents(su.url)} disabled={extLoading}>🔄</button>
                <button className="btn btn-sm" style={{ padding: "0.1rem 0.3rem", fontSize: "0.7rem", background: "rgba(255,0,0,0.2)" }} onClick={() => handleDeleteUrl(su.url)}>✕</button>
              </div>
            ))}
            <input ref={fileInputRef} type="file" accept=".ics" onChange={handleFileUpload} style={{ display: "none" }} />
            <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()} title="رفع ملف ICS">📂</button>
          </div>
        </div>

        {/* Add new URL bar */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
          <input className="form-control" dir="ltr" placeholder="رابط ICS أو رابط التضمين (embed) أو البريد الإلكتروني للتقويم..." value={newIcsUrl} onChange={e => setNewIcsUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSaveUrl(); }} style={{ fontSize: "0.82rem" }} />
          <button className="btn btn-primary" onClick={handleSaveUrl} disabled={!newIcsUrl.trim() || extLoading}>حفظ وجلب</button>
        </div>

        {extLoading && <div style={{ textAlign: "center", padding: "1rem", opacity: 0.5 }}>جاري جلب الأحداث...</div>}
        {extError && <div className="alert alert-danger" style={{ fontSize: "0.85rem", padding: "0.5rem" }}>{extError}</div>}

        {externalEvents.length > 0 && (
          <div>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>الأحداث الخارجية ({externalEvents.length})</h4>
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {externalEvents.map(ev => (
                <div key={ev.eventId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", marginBottom: "0.2rem", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{ev.summary}</strong>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                      {formatDateArabic(ev.startDate)} → {formatDateArabic(ev.endDate)}
                      {ev.location && ` · ${ev.location}`}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => createBookingFromEvent(ev)}>➕ إنشاء حجز</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!extLoading && savedUrls.length === 0 && !extError && (
          <div style={{ textAlign: "center", opacity: 0.4, padding: "1rem", fontSize: "0.85rem" }}>
            أضف رابط ICS أعلاه لاستيراد الأحداث من تقويمك الخارجي وعرضها هنا مباشرة
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div style={{ textAlign: "center", opacity: 0.5, padding: "2rem" }}>لا توجد حجوزات مؤكدة في هذه الفترة</div>
      ) : (
        <div className="calendar-list">
          {filteredBookings.map(b => {
            const isExpanded = expandedBooking === b.bookingId;
            return (
              <div key={b.bookingId} className={`calendar-event ${isExpanded ? "expanded" : ""}`}
                onClick={() => setExpandedBooking(isExpanded ? null : b.bookingId)}
                style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0.75rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "1.2rem" }}>{b.bookingType === "حجز الصالة" ? "🏛️" : "⛺"}</span>
                    <div style={{ minWidth: 0 }}><strong>{b.customerName}</strong><span style={{ opacity: 0.6, marginRight: "0.5rem", fontSize: "0.85rem" }}>{b.bookingType}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem" }}>
                    <span>{formatDateArabic(b.startDate)}</span>
                    <span style={{ color: "#4caf50", fontWeight: "bold" }}>مقدم: {formatCurrency(b.paidAmount)}</span>
                    <span style={{ color: b.remainingAmount > 0 ? "#f44336" : "#4caf50", fontWeight: "bold" }}>متبقي: {formatCurrency(b.remainingAmount)}</span>
                    <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={e => { e.stopPropagation(); copyEventDetails(b); }}>{copySuccess === b.bookingId ? "✅" : "📋"}</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", fontSize: "0.85rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
                      <div><span style={{ opacity: 0.6 }}>رقم الحجز:</span> {b.bookingId}</div>
                      <div><span style={{ opacity: 0.6 }}>الهاتف:</span> {b.customerPhone}</div>
                      <div><span style={{ opacity: 0.6 }}>العنوان:</span> {b.customerAddress || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>تاريخ البداية:</span> {formatDateArabic(b.startDate)}</div>
                      <div><span style={{ opacity: 0.6 }}>تاريخ النهاية:</span> {formatDateArabic(b.endDate)}</div>
                      <div><span style={{ opacity: 0.6 }}>الإجمالي:</span> {formatCurrency(b.totalAmount)}</div>
                      <div><span style={{ opacity: 0.6 }}>المقدم:</span> {formatCurrency(b.paidAmount)}</div>
                      <div><span style={{ opacity: 0.6 }}>المتبقي:</span> {formatCurrency(b.remainingAmount)}</div>
                      <div><span style={{ opacity: 0.6 }}>نوع الحجز:</span> {b.bookingType}</div>
                      <div><span style={{ opacity: 0.6 }}>تاريخ الحجز:</span> {b.timestamp}</div>
                      <div><span style={{ opacity: 0.6 }}>نوع الفعالية:</span> {b.eventType || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>الفترة:</span> {b.shift || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>الباقة:</span> {b.packageUsed || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>العرض:</span> {b.tentWidth || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>الطول:</span> {b.tentLength || "—"}</div>
                      <div><span style={{ opacity: 0.6 }}>العدد:</span> {b.tentCount || "—"}</div>
                    </div>
                    {b.notes && <div style={{ marginTop: "0.5rem" }}><span style={{ opacity: 0.6 }}>ملاحظات:</span> {b.notes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Export Modal */}
      {exportModal && (
        <div className="modal-overlay" onClick={() => setExportModal(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="modal-header"><h3>📤 تصدير إلى تقويم خارجي</h3><button className="modal-close" onClick={() => setExportModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "6px" }}>
                <strong>الشرط:</strong> يجب مشاركة التقويم الهدف مع الحساب الخدمي <code dir="ltr" style={{ fontSize: "0.7rem" }}>happy-land@steel-flare-475919-n8.iam.gserviceaccount.com</code>
                <br />سيتم تصدير جميع الحجوزات المعروضة حالياً ({filteredBookings.length} حجز).
                <br /><strong>بديل:</strong> استخدم زر <strong>⬇️ ICS</strong> لتحميل الملف واستيراده في أي تقويم.
              </div>
              <div className="form-group">
                <label>معرف التقويم الهدف:</label>
                <input className="form-control" dir="ltr" placeholder="example@gmail.com" value={exportCalId} onChange={e => setExportCalId(e.target.value)} />
              </div>
              {exportError && <div className="alert alert-danger">{exportError}</div>}
              {exportResult && <div className="alert alert-success" style={{ marginTop: "0.5rem" }}>✅ تم التصدير: {exportResult.exported} حجز{exportResult.failed > 0 && `، فشل ${exportResult.failed}`}</div>}
              <button className="btn btn-primary" onClick={handleExport} disabled={exportLoading} style={{ marginTop: "0.5rem" }}>{exportLoading ? "جاري..." : "📤 تصدير"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
