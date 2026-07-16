"use client";
import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency, formatDateArabic } from "@/lib/utils";

export default function CalendarView() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

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

  const downloadICS = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HappyLand//Calendar//AR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:حجوزات هابي لاند\n";
    filteredBookings.forEach(b => {
      const ds = b.startDate.replace(/-/g, "");
      const de = (() => { const d = new Date(b.endDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0].replace(/-/g, ""); })();
      const lines = [
        `رقم الحجز: ${b.bookingId}`,
        `العميل: ${b.customerName}`,
        `الجوال: ${b.customerPhone}`,
        `العنوان: ${b.customerAddress}`,
        `المبلغ الإجمالي: ${formatCurrency(b.totalAmount)}`,
        `المقدم: ${formatCurrency(b.paidAmount)}`,
        `المتبقي: ${formatCurrency(b.remainingAmount)}`,
        `نوع الحجز: ${b.bookingType}`,
        `تاريخ الحجز: ${b.timestamp}`,
        `نوع الفعالية: ${b.eventType}`,
        `الفترة: ${b.shift}`,
      ].filter(l => l.split(": ")[1]);
      ics += "BEGIN:VEVENT\n" +
        `UID:${b.bookingId}@happyland\n` +
        `DTSTART;VALUE=DATE:${ds}\n` +
        `DTEND;VALUE=DATE:${de}\n` +
        `SUMMARY:${b.customerName} - ${b.bookingType}\n` +
        `DESCRIPTION:${lines.join("\\n")}\n` +
        `LOCATION:${b.customerAddress || ""}\n` +
        "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "happyland-bookings.ics";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyEventDetails = (b) => {
    const txt = [
      `رقم الحجز: ${b.bookingId}`,
      `العميل: ${b.customerName}`,
      `الهاتف: ${b.customerPhone}`,
      `العنوان: ${b.customerAddress}`,
      `تاريخ البداية: ${formatDateArabic(b.startDate)}`,
      `تاريخ النهاية: ${formatDateArabic(b.endDate)}`,
      `المبلغ الإجمالي: ${formatCurrency(b.totalAmount)}`,
      `المبلغ المقدم: ${formatCurrency(b.paidAmount)}`,
      `المتبقي: ${formatCurrency(b.remainingAmount)}`,
      `نوع الحجز: ${b.bookingType}`,
      `تاريخ الحجز: ${b.timestamp}`,
      `نوع الفعالية: ${b.eventType}`,
      `الفترة: ${b.shift}`,
      `الباقة: ${b.packageUsed}`,
      `الملاحظات: ${b.notes}`,
    ].filter(l => l.split(": ")[1]).join("\n");
    navigator.clipboard.writeText(txt).then(() => {
      setCopySuccess(b.bookingId);
      setTimeout(() => setCopySuccess(""), 2000);
    });
  };

  const monthName = (m) => {
    const names = { "01": "يناير", "02": "فبراير", "03": "مارس", "04": "إبريل", "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس", "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر" };
    return `${names[m.slice(5)]} ${m.slice(0, 4)}`;
  };

  if (loading) return <div className="ops-loading"><div className="spinner" /><p>جاري تحميل التقويم...</p></div>;

  return (
    <div className="glass" style={{ padding: "1.25rem", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>📅 تقويم الحجوزات</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "auto" }}>
            <option value="">كل الحجوزات</option>
            {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={downloadICS} disabled={filteredBookings.length === 0}>
            ⬇️ تصدير ICS
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div className="stat-card"><span className="stat-label">عدد الحجوزات</span><span className="stat-value">{summary.total}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي الإيرادات</span><span className="stat-value gold">{formatCurrency(summary.revenue)}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي المدفوع</span><span className="stat-value" style={{ color: "#4caf50" }}>{formatCurrency(summary.paid)}</span></div>
        <div className="stat-card"><span className="stat-label">إجمالي المتبقي</span><span className="stat-value" style={{ color: "#f44336" }}>{formatCurrency(summary.remaining)}</span></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

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
                    <div style={{ minWidth: 0 }}>
                      <strong>{b.customerName}</strong>
                      <span style={{ opacity: 0.6, marginRight: "0.5rem", fontSize: "0.85rem" }}>{b.bookingType}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem" }}>
                    <span title="تاريخ البداية">{formatDateArabic(b.startDate)}</span>
                    <span title="المبلغ المقدم" style={{ color: "#4caf50", fontWeight: "bold" }}>مقدم: {formatCurrency(b.paidAmount)}</span>
                    <span title="المتبقي" style={{ color: b.remainingAmount > 0 ? "#f44336" : "#4caf50", fontWeight: "bold" }}>متبقي: {formatCurrency(b.remainingAmount)}</span>
                    <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={e => { e.stopPropagation(); copyEventDetails(b); }}>
                      {copySuccess === b.bookingId ? "✅ تم النسخ" : "📋 نسخ"}
                    </button>
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
    </div>
  );
}
