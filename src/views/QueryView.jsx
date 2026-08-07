"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { formatCurrency, formatDateArabic, getBehavior } from "@/lib/utils";
import ConfirmModal from "@/components/ConfirmModal";
import DualCalendarPicker from "@/components/DualCalendarPicker";

export default function QueryView() {
  const { handlePrint, setErrorMsg, setSuccessMsg, bookingTypes, setView, setEditBooking, setPaymentRedirect, print, getTodayString, userRole } = useApp();

  const [selectedDate, setSelectedDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [detailModalBooking, setDetailModalBooking] = useState(null);

  const [rentedItemsCache, setRentedItemsCache] = useState({});
  const [openItemsBookingId, setOpenItemsBookingId] = useState(null);
  const [loadingRentedItems, setLoadingRentedItems] = useState(null);

  const [payModalBooking, setPayModalBooking] = useState(null);
  const [payModalAmount, setPayModalAmount] = useState("");
  const [payModalCashAccount, setPayModalCashAccount] = useState("1101");
  const [payModalCostCenter, setPayModalCostCenter] = useState("");
  const [payModalTransportType, setPayModalTransportType] = useState("");
  const [payModalInvoiceLink, setPayModalInvoiceLink] = useState("");
  const [payModalConfirmBooking, setPayModalConfirmBooking] = useState(false);
  const [payModalSubmitting, setPayModalSubmitting] = useState(false);
  const [payReceipt, setPayReceipt] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelRefund, setCancelRefund] = useState("");
  const [cancelPenalty, setCancelPenalty] = useState("");
  const [cancelExpensesTotal, setCancelExpensesTotal] = useState(0);
  const [cancelExpensesLoading, setCancelExpensesLoading] = useState(false);
  const [chartAccounts, setChartAccounts] = useState([]);
  const [financeDetailBooking, setFinanceDetailBooking] = useState(null);
  const [financeDetailData, setFinanceDetailData] = useState([]);
  const [financeDetailLoading, setFinanceDetailLoading] = useState(false);

  const [customFields, setCustomFields] = useState([]);
  const [waTemplate, setWaTemplate] = useState("");
  const [costCenters, setCostCenters] = useState([]);
  const [branches, setBranches] = useState([]);
  const [costCenterFilter, setCostCenterFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [ledgerFilterCache, setLedgerFilterCache] = useState([]);
  const [calNotif, setCalNotif] = useState(null);

  // Mini month calendar state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [allCalendarBookings, setAllCalendarBookings] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarEventCache, setCalendarEventCache] = useState(null);

  const authHeaders = () => {
    const tk = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const h = { "Content-Type": "application/json" };
    if (tk) h["Authorization"] = `Bearer ${tk}`;
    return h;
  };

  // Check for new calendar events on mount
  useEffect(() => {
    const checkCal = async () => {
      try {
        const raw = localStorage.getItem("calSavedUrls");
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved.length) return;
        const [evRes, bkRes] = await Promise.all([
          fetch("/api/calendar/import", {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify({ icsUrl: saved[0].url }),
          }),
          fetch("/api/bookings?limit=5000"),
        ]);
        const evData = await evRes.json();
        const bkData = await bkRes.json();
        if (!evData.success) return;
        const today = new Date().toISOString().slice(0, 10);
        const allBookings = (bkData.success ? bkData.bookings || [] : []);
        const futureEvents = evData.events.filter(e => e.startDate >= today);
        // Match by customer name (case-insensitive) and date overlap
        const unmatched = futureEvents.filter(ev => {
          const evStart = ev.startDate;
          const evEnd = ev.endDate || evStart;
          return !allBookings.some(b => {
            if (!b.customerName) return false;
            const sameName = b.customerName.trim().toLowerCase() === (ev.summary || "").trim().toLowerCase();
            if (!sameName) return false;
            const bStart = b.startDate || "";
            const bEnd = b.endDate || bStart;
            return evStart <= bEnd && evEnd >= bStart;
          });
        });
        if (unmatched.length > 0) {
          setCalNotif({ count: unmatched.length, names: unmatched.map(e => e.summary).slice(0, 5) });
        }
      } catch {}
    };
    checkCal();
  }, []);

  useEffect(() => {
    fetch("/api/config/fields")
      .then((r) => r.json())
      .then((data) => { if (data.success) setCustomFields(data.fields || []); })
      .catch(() => {});
    fetch("/api/config/message?type=bookingConfirm")
      .then((r) => r.json())
      .then((data) => { if (data.success) setWaTemplate(data.template); })
      .catch(() => {});
    fetch("/api/finance/cost-centers")
      .then((r) => r.json())
      .then((data) => { if (data.success) setCostCenters(data.centers || []); })
      .catch(() => {});
    fetch("/api/finance/branches")
      .then((r) => r.json())
      .then((data) => { if (data.success) setBranches(data.branches || []); })
      .catch(() => {});
    fetch("/api/finance/ledger")
      .then((r) => r.json())
      .then((data) => { if (data.success) setLedgerFilterCache(data.entries || []); })
      .catch(() => {});
  }, []);

  // Load all bookings once for the mini month calendar
  useEffect(() => {
    setCalendarLoading(true);
    fetch("/api/bookings?limit=10000")
      .then(r => r.json())
      .then(d => { if (d.success) setAllCalendarBookings(d.bookings || []); })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, []);

  // Cache calendar events by (year,month) — events fall on any day within the range
  const calendarEventsForMonth = useMemo(() => {
    const key = `${calYear}-${calMonth}`;
    if (calendarEventCache && calendarEventCache.key === key) return calendarEventCache;
    const map = {};
    for (const b of allCalendarBookings) {
      if (b.status === "ملغي") continue;
      const start = b.startDate ? new Date(b.startDate + "T00:00:00") : null;
      const end = b.endDate ? new Date(b.endDate + "T00:00:00") : null;
      if (!start || isNaN(start.getTime())) continue;
      const rangeEnd = end && !isNaN(end.getTime()) ? end : start;
      for (let d = new Date(start); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (!map[ds]) map[ds] = [];
          map[ds].push(b);
        }
      }
    }
    const result = { key, map };
    setCalendarEventCache(result);
    return result;
  }, [calYear, calMonth, allCalendarBookings, calendarEventCache]);

  const fetchBookings = async (page) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const p = page || currentPage;
      const params = new URLSearchParams({ page: p, limit: "10" });
      if (selectedDate) params.set("date", selectedDate);
      if (searchTerm) params.set("search", searchTerm);
      else params.set("status", "مؤكد");
      if (showCancelled) params.set("showCancelled", "true");
      const res = await fetch(`/api/bookings?${params}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings || []);
        setPagination(data.pagination || null);
      } else {
        setErrorMsg(data.error || "فشل في تحميل الحجوزات");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (!costCenterFilter && !branchFilter) return bookings;
    let matchingIds = new Set();
    if (costCenterFilter || branchFilter) {
      for (const e of ledgerFilterCache) {
        if (costCenterFilter && e.costCenter !== costCenterFilter) continue;
        if (branchFilter && e.costCenter && !e.costCenter.startsWith(`CC-${branchFilter}`)) continue;
        if (e.linkedBookingId) matchingIds.add(e.linkedBookingId);
      }
    }
    return bookings.filter(b => matchingIds.has(b.bookingId));
  }, [bookings, costCenterFilter, branchFilter, ledgerFilterCache]);

  useEffect(() => {
    fetchBookings(currentPage);
  }, [selectedDate, searchTerm, currentPage, showCancelled]);

  const openDetailModal = (booking) => {
    setDetailModalBooking(booking);
    loadRentedItemsForBooking(booking.bookingId);
    fetchChartAccounts();
  };

  const fetchChartAccounts = async () => {
    try { const r = await fetch("/api/finance/accounts"); const d = await r.json(); if (d.success) setChartAccounts(d.accounts || []); } catch {}
  };

  const closeDetailModal = () => setDetailModalBooking(null);

  const acctName = (code) => { const a = chartAccounts.find(a => a.accountCode === code); return a ? a.accountName : code; };

  const expenseTypeLabel = (e) => {
    const m = (e.notes || "").match(/^\[[^\]]*\]\s*(.*)$/);
    const desc = m ? m[1].trim() : "";
    if (desc) return desc;
    return acctName(e.accountCode) || e.accountCode;
  };

  const loadRentedItemsForBooking = async (bookingId) => {
    if (rentedItemsCache[bookingId]) return;
    setLoadingRentedItems(bookingId);
    try {
      const res = await fetch(`/api/bookings/rented-items?bookingId=${bookingId}`);
      const data = await res.json();
      if (data.success) setRentedItemsCache((prev) => ({ ...prev, [bookingId]: data.items || [] }));
    } catch (err) {
      console.error(err);
    }
    setLoadingRentedItems(null);
  };

  const fillWaTemplate = (booking) => {
    if (!waTemplate) return "";
    const contractPart = booking.contractLink ? `\n📄 رابط العقد: ${booking.contractLink}` : "";
    const map = {
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      bookingId: booking.bookingId || "",
      startDate: formatDateArabic(booking.startDate),
      endDate: formatDateArabic(booking.endDate),
      totalAmount: formatCurrency(booking.totalAmount),
      paidAmount: formatCurrency(booking.paidAmount),
      remainingAmount: formatCurrency(booking.remainingAmount),
      bookingType: booking.bookingType || "",
      contractLink: contractPart,
      notes: booking.notes || "",
      eventType: booking.eventType || "",
      shift: booking.shift || "",
      guarantorName: booking.guarantorName || "",
      guarantorPhone: booking.guarantorPhone || "",
      customerAddress: booking.customerAddress || "",
      customerIdNumber: booking.customerIdNumber || "",
    };
    return waTemplate.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? `{${k}}`);
  };

  const openWhatsApp = (booking) => {
    const countryCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "966";
    const phone = countryCode + (booking.customerPhone || "").replace(/^0/, "").replace(/[^0-9]/g, "");
    const msg = fillWaTemplate(booking);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const openFinanceDetail = async (booking) => {
    setFinanceDetailBooking(booking);
    setFinanceDetailLoading(true);
    try {
      const r = await fetch("/api/finance/ledger");
      const d = await r.json();
      if (d.success) setFinanceDetailData(d.entries.filter(e => e.linkedBookingId === booking.bookingId) || []);
    } catch { setFinanceDetailData([]); }
    setFinanceDetailLoading(false);
  };

  const printCustomerStatement = async (booking) => {
    if (!booking) return;
    const name = (booking.customerName || "").trim();
    const phone = (booking.customerPhone || "").trim();
    if (!name) return;
    try {
      const r = await fetch(`/api/bookings?search=${encodeURIComponent(name)}&limit=100`);
      const d = await r.json();
      if (!d.success) return;
      const allBks = (d.bookings || []).filter(b =>
        b.customerName?.trim() === name &&
        (b.customerPhone?.trim() === phone || !phone)
      );
      if (allBks.length === 0) return;
      const headers = ["رقم الحجز", "التاريخ", "النوع", "التفاصيل", "الإجمالي", "المدفوع", "المتبقي", "الحالة"];
      const rows = [];
      for (const b of allBks) {
        const typeDetail = b.packageUsed
          ? `${b.packageUsed}${b.tentWidth ? ` | ${b.tentWidth}×${b.tentLength}م` : ""}`
          : (b.bookingType || "");
        rows.push([
          b.bookingId || "",
          b.startDate || "",
          b.bookingType || "",
          typeDetail,
          formatCurrency(b.totalAmount || 0),
          formatCurrency(b.paidAmount || 0),
          formatCurrency(b.remainingAmount || 0),
          b.status || "",
        ]);
        const isPackage = !!(b.packageUsed || b.tentWidth || b.tentLength);
        if (!isPackage) {
          const items = b.rentedItems || [];
          for (const item of items) {
            const itemTotal = (item.quantityRequested || 0) * (item.unitPrice || 0);
            rows.push([
              "",
              "",
              `📦 ${item.itemName}`,
              `×${item.quantityRequested} @ ${formatCurrency(item.unitPrice)}`,
              formatCurrency(itemTotal),
              "",
              "",
              "",
            ]);
          }
        }
      }
      const totalAmt = allBks.reduce((s, b) => s + (b.totalAmount || 0), 0);
      const totalPaid = allBks.reduce((s, b) => s + (b.paidAmount || 0), 0);
      const totalRem = allBks.reduce((s, b) => s + (b.remainingAmount || 0), 0);
      print("REPORT_TABLE", {
        title: `كشف حساب ${booking.customerName || ""}`,
        subtitle: `${booking.customerPhone || ""}`,
        dateHeader: new Date().toLocaleDateString("en-CA"),
        headers,
        rows,
        footer: `الإجمالي: ${formatCurrency(totalAmt)} | المدفوع: ${formatCurrency(totalPaid)} | المتبقي: ${formatCurrency(totalRem)}`,
      });
    } catch {}
  };

  const fetchCancelExpenses = async (bookingId) => {
    setCancelExpensesLoading(true);
    try {
      const r = await fetch(`/api/bookings/field/expense?bookingId=${encodeURIComponent(bookingId)}`);
      const d = await r.json();
      if (d.success) {
        const total = (d.totals?.preparation || 0) + (d.totals?.installation || 0) + (d.totals?.removal || 0);
        setCancelExpensesTotal(total);
      }
    } catch {}
    setCancelExpensesLoading(false);
  };

  const cancelRefundAmount = useMemo(() => {
    if (!cancelConfirm) return 0;
    const paid = parseFloat(cancelConfirm.paidAmount) || 0;
    const penalty = parseFloat(cancelPenalty) || 0;
    return Math.max(0, paid - cancelExpensesTotal - penalty);
  }, [cancelConfirm, cancelExpensesTotal, cancelPenalty]);

  const handleCancelBooking = async () => {
    if (!cancelConfirm) return;
    setCancelSubmitting(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/bookings/cancel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ bookingId: cancelConfirm.bookingId, refundAmount: cancelRefundAmount, penaltyAmount: parseFloat(cancelPenalty) || 0 }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || `تم إلغاء الحجز ${cancelConfirm.bookingId}`);
        setCancelConfirm(null);
        closeDetailModal();
        fetchBookings();
      } else {
        setErrorMsg(data.error || "فشل إلغاء الحجز");
      }
    } catch { setErrorMsg("خطأ في الاتصال"); }
    setCancelSubmitting(false);
  };

  const handleEditFromModal = () => {
    const b = detailModalBooking;
    closeDetailModal();
    setEditBooking(b);
    setView("create");
  };

  const openItemsModal = (bookingId) => {
    setOpenItemsBookingId(bookingId);
    loadRentedItemsForBooking(bookingId);
  };

  const openPayModal = (booking) => {
    setPayModalBooking(booking);
    setPayModalAmount("");
    setPayModalConfirmBooking(false);
    setPayModalCashAccount("1101");
    setPayModalCostCenter("");
    setPayModalTransportType("");
    setPayModalInvoiceLink("");
    closeDetailModal();
  };

  const totalBookingsCount = pagination?.totalCount || bookings.length;

  const CAL_MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const CAL_DAY_NAMES = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];

  const changeCalMonth = (delta) => {
    let y = calYear;
    let m = calMonth + delta;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalYear(y);
    setCalMonth(m);
    setCalendarEventCache(null);
  };

  const goCalToToday = () => {
    const today = new Date();
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setCalendarEventCache(null);
  };

  const fmtCalKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fmtCalendarArabic = (ds) => {
    try { return new Date(ds + "T00:00:00").toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
    catch { return ds; }
  };

  // Build the mini month grid (Saturday-first, matching the app's calendar convention)
  const buildCalWeeks = useMemo(() => {
    const firstDayWeekday = new Date(calYear, calMonth, 1).getDay();
    const offset = (firstDayWeekday + 1) % 7; // Saturday-first
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const weeks = [];
    let row = new Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      row.push(d);
      if (row.length === 7) { weeks.push(row); row = []; }
    }
    if (row.length > 0) { while (row.length < 7) row.push(null); weeks.push(row); }
    return weeks;
  }, [calYear, calMonth]);

  const resolveCustomFieldValue = (booking, field) => {
    if (field.type === "عدد صحيح" || field.type === "number") {
      return booking.customFields?.[field.name] || booking[field.name] || "";
    }
    if (field.type === "قائمة" || field.type === "select") {
      return booking.customFields?.[field.name] || "";
    }
    return booking.customFields?.[field.name] || "";
  };

  const renderCustomFields = (booking) => {
    if (!customFields.length) return null;
    const hasValues = customFields.some((f) => resolveCustomFieldValue(booking, f));
    if (!hasValues) return null;
    return (
      <div className="custom-fields-display">
        {customFields.map((field) => {
          const val = resolveCustomFieldValue(booking, field);
          if (!val) return null;
          return <span key={field.name} className="cf-badge">{field.label || field.name}: {val}</span>;
        })}
      </div>
    );
  };

  return (
    <>
      {calNotif !== null && (
        <div className="alert alert-info glass" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", cursor: "pointer" }} onClick={() => { setView("calendar"); setCalNotif(null); }}>
          <span>📅 يوجد <strong>{calNotif.count}</strong> حجز/حجوزات جديدة في التقويم الخارجي ليس لها مثيل في النظام{calNotif.names.length > 0 ? <>: {calNotif.names.join("، ")}{calNotif.count > 5 ? "..." : ""}</> : ""}</span>
          <button className="btn btn-sm btn-primary" style={{ marginRight: "0.5rem" }}>عرض في التقويم</button>
        </div>
      )}
      <section className="query-section glass">
        <div className="filter-bar">
          <div className="filter-group">
            <label>تصفية بالتاريخ</label>
            <DualCalendarPicker value={selectedDate} onChange={(val) => { setSelectedDate(val); setCurrentPage(1); }} />
          </div>
          <div className="filter-group">
            <label>بحث بالاسم أو الهاتف</label>
            <input type="text" placeholder="ابحث عن عميل..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="form-control" />
          </div>
          <div className="filter-group">
            <label>🏢 الفرع</label>
            <select className="form-control" value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">كل الفروع</option>
              {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>🏷️ مركز التكلفة</label>
            <select className="form-control" value={costCenterFilter} onChange={(e) => { setCostCenterFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">كل المراكز</option>
              {costCenters.filter(c => c.type === "booking" || c.type === "administrative").map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="filter-group" style={{justifyContent:"flex-end"}}>
            <label style={{opacity:0}}>.</label>
            <button className={`btn btn-sm ${showCancelled ? "btn-gold" : ""}`} onClick={() => { setShowCancelled((v) => !v); setCurrentPage(1); }} style={{border: showCancelled ? "none" : "1px solid var(--card-border)"}}>
              {showCancelled ? "🟢 إخفاء الملغية" : "👁️ إظهار الملغية"}
            </button>
          </div>
        </div>

        {/* ─── Mini Month Calendar ─────────────────────────────────── */}
        <div className="mini-calendar glass" style={{ marginBottom: "1rem", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", padding: "0.6rem 0.85rem", background: "rgba(255,255,255,0.04)" }}>
            <strong style={{ fontSize: "0.95rem" }}>📅 {CAL_MONTH_NAMES[calMonth]} {calYear}</strong>
            <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
              <button className="btn btn-sm" onClick={changeCalMonth.bind(null, -1)} title="الشهر السابق">◀</button>
              <button className="btn btn-sm" onClick={goCalToToday} style={{ fontWeight: "bold" }}>اليوم</button>
              <button className="btn btn-sm" onClick={changeCalMonth.bind(null, 1)} title="الشهر التالي">▶</button>
            </div>
          </div>
          {calendarLoading ? (
            <div style={{ textAlign: "center", padding: "1rem", opacity: 0.5, fontSize: "0.85rem" }}>جاري تحميل التقويم...</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", fontSize: "0.72rem", padding: "0.35rem 0", background: "rgba(255,255,255,0.02)", fontWeight: "bold" }}>
                {CAL_DAY_NAMES.map(dn => <div key={dn}>{dn}</div>)}
              </div>
              {buildCalWeeks.map((week, wi) => (
                <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} />;
                    const ds = fmtCalKey(calYear, calMonth, day);
                    const dayEvents = calendarEventsForMonth.map[ds] || [];
                    const todayStr2 = new Date().toLocaleDateString("en-CA");
                    const isToday = ds === todayStr2;
                    const isSelected = ds === selectedDate;
                    const hasEvents = dayEvents.length > 0;
                    return (
                      <button key={di}
                        onClick={() => { setSelectedDate(isSelected ? "" : ds); setCurrentPage(1); setSearchTerm(""); }}
                        style={{
                          minHeight: "52px", padding: "0.3rem 0.2rem", cursor: "pointer", border: "none",
                          background: isSelected ? "var(--accent)" : isToday ? "rgba(251,191,36,0.18)" : "transparent",
                          color: isSelected ? "#fff" : "inherit", borderRadius: "0", borderLeft: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)",
                          fontFamily: "inherit", textAlign: "center", position: "relative",
                        }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: isToday || isSelected ? 800 : 400 }}>{day}</span>
                        {dayEvents.length > 0 && (
                          <div style={{ marginTop: "0.25rem", display: "flex", justifyContent: "center", gap: "0.15rem", flexWrap: "wrap" }}>
                            {dayEvents.slice(0, 3).map((e, i) => (
                              <span key={i} title={`${e.customerName} — ${e.bookingType || ""}`} style={{ width: "8px", height: "8px", borderRadius: "50%", display: "inline-block", background: e.remainingAmount > 0 ? "#f59e0b" : "#4caf50" }} />
                            ))}
                            {dayEvents.length > 3 && <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>+{dayEvents.length - 3}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
        {/* Mini calendar selected-day summary */}
        {selectedDate && (() => {
          const dayEvs = calendarEventsForMonth.map[selectedDate] || [];
          return (
            <div className="mini-calendar-day-summary glass" style={{ marginBottom: "1rem", padding: "0.6rem 0.85rem", borderRadius: "10px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
                <strong>📌 {fmtCalendarArabic(selectedDate)} — {dayEvs.length} حجز</strong>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDate("")}>✕ إلغاء التصفية</button>
              </div>
              {dayEvs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.5rem" }}>
                  {dayEvs.map(e => (
                    <div key={e.bookingId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.5rem", background: "rgba(255,255,255,0.04)", borderRadius: "6px" }}>
                      <span><strong>{e.customerName}</strong> <span style={{ opacity: 0.6 }}>({e.bookingType || "-"})</span></span>
                      <span style={{ color: e.remainingAmount > 0 ? "#f59e0b" : "#4caf50", fontWeight: 700 }}>{e.remainingAmount > 0 ? `متبقي ${formatCurrency(e.remainingAmount)}` : "مسدد ✅"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div className="section-title-row">
          <h2>نتائج الاستعلام ({costCenterFilter || branchFilter ? filteredBookings.length : totalBookingsCount})</h2>
          {selectedDate && <span className="date-badge">📅 {formatDateArabic(selectedDate)}</span>}
        </div>

        {loading ? (
          <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
            <p>جاري تحميل الحجوزات من Google Sheets...</p>
          </div>
        ) : (costCenterFilter || branchFilter ? filteredBookings : bookings).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>لا توجد حجوزات مطابقة</h3>
            {(costCenterFilter || branchFilter) ? (
              <p>لا توجد حجوزات مرتبطة بمركز التكلفة المحدد. جرب تغيير الفلتر.</p>
            ) : (
              <p>جرب تغيير تاريخ البحث أو كتابة عبارة بحث مختلفة.</p>
            )}
            <button className="btn btn-gold" onClick={() => { setSelectedDate(""); setSearchTerm(""); }}>
              عرض جميع الحجوزات
            </button>
          </div>
        ) : (
          <div className="booking-cards-grid">
            {(costCenterFilter || branchFilter ? filteredBookings : bookings).map((booking) => (
              <div key={booking.bookingId} className="booking-card glass" style={{ cursor: "pointer" }}>
                <div className="booking-card-header">
                  <span className="booking-id">{booking.bookingId}</span>
                  <span className={`status-badge ${booking.status === "ملغي" ? "status-cancelled" : booking.status === "مكتمل" ? "status-completed" : booking.status === "منتهي" ? "status-expired" : booking.status === "قيد الانتظار" ? "status-pending" : "status-active"}`}>
                    {booking.status}
                  </span>
                </div>

                <div className="booking-card-body" onClick={() => openDetailModal(booking)}>
                  <h3>{booking.customerName}</h3>
                  <p className="phone-number">📞 {booking.customerPhone}</p>
                  {booking.customerIdNumber && <p className="phone-number" style={{ fontSize: "0.8rem" }}>🪪 {booking.customerIdNumber}</p>}
                  {booking.customerAddress && <p className="phone-number" style={{ fontSize: "0.8rem" }}>📍 {booking.customerAddress}</p>}

                  <div className="card-type-row">
                    {booking.bookingType && (
                      <span className={`type-badge type-${getBehavior(booking.bookingType, bookingTypes)}`}>
                        {booking.bookingType}
                        {booking.shift && ` — ${booking.shift === "صباحي" ? "🌅 نهاري" : booking.shift === "مسائي" ? "🌙 ليلي" : "☀️🌙 يوم كامل"}`}
                      </span>
                    )}
                    {booking.packageUsed && <span className="package-badge">🎁 {booking.packageUsed}</span>}
                    {booking.tentWidth && booking.tentLength && (
                      <span className="dimen-badge">📐 {booking.tentWidth}×{booking.tentLength}م {booking.tentCount && `(${booking.tentCount})`}</span>
                    )}
                  </div>

                  <div className="date-range-box">
                    <div>
                      <span className="label">من</span>
                      <span className="val">{formatDateArabic(booking.startDate)}</span>
                    </div>
                    <div>
                      <span className="label">إلى</span>
                      <span className="val">{formatDateArabic(booking.endDate)}</span>
                    </div>
                  </div>

                  <div className="financial-summary">
                    <div>
                      <span className="label">الإجمالي</span>
                      <span className="val">{formatCurrency(booking.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="label">المدفوع</span>
                      <span className="val text-emerald">{formatCurrency(booking.paidAmount)}</span>
                    </div>
                    <div className="fin-itemHighlight">
                      <span className="label">المتبقي</span>
                      <span className="val text-red">{formatCurrency(booking.remainingAmount)}</span>
                    </div>
                  </div>

                  {booking.notes && <div className="booking-notes">📝 {booking.notes}</div>}
                </div>
                <div className="booking-card-actions" style={{ padding: "0.35rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                  {booking.remainingAmount > 0 && booking.status !== "ملغي" && booking.status !== "مكتمل" && (
                    <button className="link-btn" style={{ fontSize: "0.65rem", color: "#059669" }} onClick={(e) => { e.stopPropagation(); openPayModal(booking); }}>💰 دفعة</button>
                  )}
                  <button className="link-btn" style={{ fontSize: "0.65rem", color: "#6366f1" }} onClick={(e) => { e.stopPropagation(); printCustomerStatement(booking); }}>🖨️ كشف الحساب</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="pagination-bar">
            <button className="btn btn-sm" disabled={pagination.currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              ← السابق
            </button>
            <span className="pagination-info">صفحة {pagination.currentPage} من {pagination.totalPages} (إجمالي {pagination.totalCount})</span>
            <button className="btn btn-sm" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              التالي →
            </button>
          </div>
        )}
      </section>

      {detailModalBooking && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"640px"}}>
            <div className="modal-header">
              <h2>📋 تفاصيل الحجز</h2>
              <button className="modal-close" onClick={closeDetailModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="selected-booking-info">
                <h3>{detailModalBooking.customerName}</h3>
                <p><strong>رقم الحجز:</strong> {detailModalBooking.bookingId}</p>
                <p><strong>📞 الهاتف:</strong> {detailModalBooking.customerPhone}</p>
                {detailModalBooking.customerIdNumber && <p><strong>🪪 رقم الهوية:</strong> {detailModalBooking.customerIdNumber}</p>}
                {detailModalBooking.customerAddress && <p><strong>📍 العنوان:</strong> {detailModalBooking.customerAddress}</p>}
                <p style={{marginTop:"0.75rem"}}>
                  <span className={`status-badge ${detailModalBooking.status === "ملغي" ? "status-cancelled" : detailModalBooking.status === "مكتمل" ? "status-completed" : detailModalBooking.status === "منتهي" ? "status-expired" : detailModalBooking.status === "قيد الانتظار" ? "status-pending" : "status-active"}`}>
                    {detailModalBooking.status}
                  </span>
                </p>
              </div>

              <div style={{marginTop:"1rem", display:"flex", flexDirection:"column", gap:"0.75rem"}}>
                <div className="card-type-row">
                  {detailModalBooking.bookingType && (
                    <span className={`type-badge type-${getBehavior(detailModalBooking.bookingType, bookingTypes)}`}>
                      {detailModalBooking.bookingType}
                      {detailModalBooking.shift && ` — ${detailModalBooking.shift === "صباحي" ? "🌅 نهاري" : detailModalBooking.shift === "مسائي" ? "🌙 ليلي" : "☀️🌙 يوم كامل"}`}
                    </span>
                  )}
                  {detailModalBooking.packageUsed && <span className="package-badge">🎁 {detailModalBooking.packageUsed}</span>}
                  {detailModalBooking.tentWidth && detailModalBooking.tentLength && (
                    <span className="dimen-badge">📐 {detailModalBooking.tentWidth}×{detailModalBooking.tentLength}م {detailModalBooking.tentCount && `(${detailModalBooking.tentCount})`}</span>
                  )}
                </div>

                <div className="date-range-box">
                  <div>
                    <span className="label">من</span>
                    <span className="val">{formatDateArabic(detailModalBooking.startDate)}</span>
                  </div>
                  <div>
                    <span className="label">إلى</span>
                    <span className="val">{formatDateArabic(detailModalBooking.endDate)}</span>
                  </div>
                </div>

                <div className="financial-summary" style={{marginBottom:"0.5rem"}}>
                  <div>
                    <span className="label">الإجمالي</span>
                    <span className="val">{formatCurrency(detailModalBooking.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="label">المدفوع</span>
                    <span className="val text-emerald">{formatCurrency(detailModalBooking.paidAmount)}</span>
                  </div>
                  <div className="fin-itemHighlight">
                    <span className="label">المتبقي</span>
                    <span className="val text-red">{formatCurrency(detailModalBooking.remainingAmount)}</span>
                  </div>
                </div>

                {detailModalBooking.notes && <div className="booking-notes">📝 {detailModalBooking.notes}</div>}

                {typeof detailModalBooking.customFields === "object" && detailModalBooking.customFields !== null && renderCustomFields(detailModalBooking)}

                {detailModalBooking.remainingAmount > 0 && detailModalBooking.status !== "ملغي" && detailModalBooking.status !== "مكتمل" && (
                  <div className="alert-warning" style={{marginBottom:0}}>
                    ⚠️ متبقي {formatCurrency(detailModalBooking.remainingAmount)}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn wa-btn" onClick={() => openWhatsApp(detailModalBooking)}>
                📞 واتساب
              </button>
              <button className="btn contract-btn" onClick={() => printCustomerStatement(detailModalBooking)}>
                🖨️ كشف حساب العميل
              </button>
              <button className="btn contract-btn" onClick={() => openFinanceDetail(detailModalBooking)}>
                📊 كشف الحساب
              </button>
              <button className="btn print-btn" onClick={() => handlePrint(detailModalBooking)}>
                🖨️ طباعة
              </button>
              <button className="btn items-btn" onClick={() => openItemsModal(detailModalBooking.bookingId)} disabled={loadingRentedItems === detailModalBooking.bookingId}>
                {loadingRentedItems === detailModalBooking.bookingId ? "..." : "📦 الأصناف"}
              </button>
              {detailModalBooking.status !== "ملغي" && (
                <button className="btn pay-btn" onClick={() => openPayModal(detailModalBooking)} disabled={detailModalBooking.status === "مكتمل"}>
                  💰 دفعة
                </button>
              )}
              {detailModalBooking.status !== "ملغي" && userRole === "admin" && (
                <button className="btn edit-btn" onClick={handleEditFromModal}>
                  ✏️ تعديل
                </button>
              )}
              {detailModalBooking.status !== "ملغي" && detailModalBooking.status !== "مكتمل" && userRole === "admin" && (
                <button className="btn cancel-btn" onClick={() => { setCancelConfirm(detailModalBooking); setCancelRefund(""); setCancelPenalty(""); setCancelExpensesTotal(0); fetchCancelExpenses(detailModalBooking.bookingId); }}>
                  🗑️ حذف الحجز
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finance Detail Modal */}
      {financeDetailBooking && (
        <div className="modal-overlay" onClick={() => setFinanceDetailBooking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"560px"}}>
            <div className="modal-header">
              <h2>🧾 كشف حساب الحجز {financeDetailBooking.bookingId}</h2>
              <button className="modal-close" onClick={() => setFinanceDetailBooking(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="selected-booking-info">
                <p><strong>العميل:</strong> {financeDetailBooking.customerName}</p>
                <p><strong>إجمالي الحجز:</strong> {formatCurrency(financeDetailBooking.totalAmount)} ريال</p>
                <p><strong>المدفوع:</strong> {formatCurrency(financeDetailBooking.paidAmount)} ريال</p>
                <p><strong>المتبقي:</strong> <span style={{color: financeDetailBooking.remainingAmount > 0 ? "#ff4444" : "#4caf50"}}>{formatCurrency(financeDetailBooking.remainingAmount)}</span> ريال</p>
              </div>
              {financeDetailLoading && <p style={{textAlign:"center",padding:"1rem",opacity:0.5}}>جاري التحميل...</p>}
              {!financeDetailLoading && financeDetailData.length === 0 && (
                <p style={{textAlign:"center",padding:"1rem",opacity:0.5}}>لا توجد عمليات مالية مسجلة لهذا الحجز</p>
              )}
              {!financeDetailLoading && financeDetailData.length > 0 && (
                <>
                  {(() => {
                    const incomes = financeDetailData.filter(e => e.entryType === "income");
                    const expenses = financeDetailData.filter(e => e.entryType === "expense");
                    const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);
                    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
                    return (
                      <>
                        {incomes.length > 0 && (
                          <div style={{marginTop:"0.75rem"}}>
                            <strong style={{color:"#4caf50"}}>💰 الدفعات والإيرادات</strong>
                            <div className="inv-table-wrapper" style={{marginTop:"0.25rem"}}>
                            <table className="inv-table">
                              <thead>
                                <tr>
                                  <th>التاريخ</th>
                                  <th>المبلغ</th>
                                  <th>الخزينة</th>
                                  <th>ملاحظات</th>
                                </tr>
                              </thead>
                              <tbody>
                                {incomes.map(e => (
                                  <tr key={e.journalId}>
                                    <td>{e.date}</td>
                                    <td style={{color:"#4caf50"}}>{formatCurrency(e.amount)}</td>
                                    <td>{acctName(e.cashAccountCode) || e.cashAccountCode}</td>
                                    <td style={{fontSize:"0.72rem",opacity:0.7}}>{(e.notes||"").replace(/🔗تحويلة:\d+/g,"")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )}
                        {expenses.length > 0 && (
                          <div style={{marginTop:"0.75rem"}}>
                            <strong style={{color:"#ff4444"}}>🔴 المصاريف التشغيلية</strong>
                            <div className="inv-table-wrapper" style={{marginTop:"0.25rem"}}>
                            <table className="inv-table">
                              <thead>
                                <tr>
                                  <th>التاريخ</th>
                                  <th>نوع المصروف</th>
                                  <th>المبلغ</th>
                                  <th>الخزينة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expenses.map(e => (
                                  <tr key={e.journalId}>
                                    <td>{e.date}</td>
                                    <td>{expenseTypeLabel(e)}</td>
                                    <td style={{color:"#ff4444"}}>{formatCurrency(e.amount)}</td>
                                    <td>{acctName(e.cashAccountCode) || e.cashAccountCode}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )}
                        <div style={{marginTop:"0.75rem",padding:"0.5rem",background:"rgba(255,255,255,0.05)",borderRadius:"8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          {userRole === "admin" && <span>إجمالي الإيرادات: <strong style={{color:"#4caf50"}}>{formatCurrency(totalIncome)}</strong></span>}
                          <span>إجمالي المصاريف: <strong style={{color:"#ff4444"}}>{formatCurrency(totalExpense)}</strong></span>
                          {userRole === "admin" && <span>صافي الربحية: <strong style={{color:totalIncome - totalExpense >= 0 ? "#4caf50" : "#ff4444"}}>{formatCurrency(totalIncome - totalExpense)}</strong></span>}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setFinanceDetailBooking(null)}>إغلاق</button>
              <button className="btn print-btn" onClick={() => {
                const incomes = financeDetailData.filter(e => e.entryType === "income");
                const expenses = financeDetailData.filter(e => e.entryType === "expense");
                const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);
                const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
                const rows = [];
                for (const e of incomes) rows.push({ cells: [e.date, "ايراد", formatCurrency(e.amount), acctName(e.cashAccountCode) || e.cashAccountCode, (e.notes||"").replace(/🔗تحويلة:\d+/g,"")], type: "income" });
                for (const e of expenses) rows.push({ cells: [e.date, `مصروف ${expenseTypeLabel(e)}`, formatCurrency(e.amount), acctName(e.cashAccountCode) || e.cashAccountCode, ""], type: "expense" });
                print("REPORT_TABLE", {
                  title: `كشف حساب ${financeDetailBooking.customerName}`,
                  dateHeader: new Date().toLocaleDateString("en-CA"),
                  subtitle: `الحجز: ${financeDetailBooking.bookingId} | ${financeDetailBooking.bookingType}`,
                  summary: [
                    { label: "إجمالي الحجز", value: `${formatCurrency(financeDetailBooking.totalAmount)}` },
                    { label: "المدفوع", value: `${formatCurrency(financeDetailBooking.paidAmount)}` },
                    { label: "المتبقي", value: `${formatCurrency(financeDetailBooking.remainingAmount)}` },
                  ],
                  headers: ["التاريخ", "النوع", "المبلغ", "الخزينة", "ملاحظات"],
                  rows,
                  totals: { income: formatCurrency(totalIncome), expense: formatCurrency(totalExpense), net: formatCurrency(totalIncome - totalExpense) },
                });
              }}>
                🖨️ طباعة كشف الحساب
              </button>
            </div>
          </div>
        </div>
      )}

      {openItemsBookingId && (
        <div className="modal-overlay" onClick={() => setOpenItemsBookingId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"600px"}}>
            <div className="modal-header">
              <h2>📦 الأصناف والمستلزمات</h2>
              <button className="modal-close" onClick={() => setOpenItemsBookingId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:"1rem", opacity:0.7}}><strong>{openItemsBookingId}</strong></p>
              {rentedItemsCache[openItemsBookingId]?.length > 0 ? (
                <div className="inv-table-wrapper">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>اسم الصنف</th>
                      <th>الكمية المحجوزة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentedItemsCache[openItemsBookingId].map((item) => (
                      <tr key={item.id || item.itemId}>
                        <td>{item.itemName}</td>
                        <td>{item.quantityRequested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className="text-muted">لا توجد أصناف مسجلة لهذا الحجز</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn print-btn" onClick={() => {
                const items = rentedItemsCache[openItemsBookingId] || [];
                print("REPORT_TABLE", {
                  title: `الأصناف والمستلزمات - ${openItemsBookingId}`,
                  headers: ["#", "اسم الصنف", "الكمية المحجوزة"],
                  rows: items.map((item, i) => [i + 1, item.itemName, item.quantityRequested]),
                  footer: `إجمالي الأصناف: ${items.length}`,
                });
              }}>
                🖨️ طباعة الأصناف
              </button>
            </div>
          </div>
        </div>
      )}

      {payModalBooking && !payReceipt && (
        <div className="modal-overlay" onClick={() => { setPayModalBooking(null); setPayModalAmount(""); setPayModalConfirmBooking(false); setPayModalCashAccount("1101"); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"480px"}}>
            <div className="modal-header">
              <h2>💰 تسجيل دفعة</h2>
              <button className="modal-close" onClick={() => { setPayModalBooking(null); setPayModalAmount(""); setPayModalConfirmBooking(false); setPayModalCashAccount("1101"); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="selected-booking-info">
                <p><strong>العميل:</strong> {payModalBooking.customerName}</p>
                <p><strong>رقم الحجز:</strong> {payModalBooking.bookingId}</p>
                <p><strong>الإجمالي:</strong> {payModalBooking.totalAmount} ريال</p>
                <p><strong>المدفوع:</strong> {payModalBooking.paidAmount} ريال</p>
                <p><strong>المتبقي:</strong> {payModalBooking.remainingAmount || "0"} ريال</p>
                <p><strong>الحالة:</strong> {payModalBooking.status}</p>
                {payModalBooking.status === "قيد الانتظار" && (
                  <label className="checkbox-label" style={{marginTop:"0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",cursor:"pointer"}}>
                    <input type="checkbox" checked={payModalConfirmBooking} onChange={(e) => setPayModalConfirmBooking(e.target.checked)} />
                    ✅ تأكيد الحجز (تغيير الحالة إلى "مؤكد")
                  </label>
                )}
              </div>
              <div className="form-group" style={{marginTop:"1rem"}}>
                <label>المبلغ المستلم (ريال) <span className="required">*</span></label>
                <input type="number" value={payModalAmount} onChange={(e) => setPayModalAmount(e.target.value)} placeholder="أدخل المبلغ المستلم..." className="form-control" />
              </div>
              <div className="form-group" style={{marginTop:"0.75rem"}}>
                <label>🏦 الخزينة المستلمة</label>
                <select className="form-control" value={payModalCashAccount} onChange={(e) => setPayModalCashAccount(e.target.value)}>
                  <option value="1101">💰 صندوق الصالة</option>
                  <option value="1102">📱 محفظة كريمي</option>
                  <option value="1103">📱 محفظة جوالي</option>
                  <option value="1104">📱 محفظة جيب</option>
                </select>
              </div>
              <div className="form-group" style={{marginTop:"0.75rem"}}>
                <label>🏷️ مركز التكلفة</label>
                <select className="form-control" value={payModalCostCenter} onChange={(e) => setPayModalCostCenter(e.target.value)}>
                  <option value="">— بدون —</option>
                  {costCenters.map(c => <option key={c.code} value={c.code}>{c.name} ({c.type})</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginTop:"0.75rem"}}>
                <label>🚚 نوع النقل</label>
                <select className="form-control" value={payModalTransportType} onChange={(e) => setPayModalTransportType(e.target.value)}>
                  <option value="">— بدون —</option>
                  <option value="company_vehicle">موتر الشركة</option>
                  <option value="hired_vehicle">موتر مستأجر</option>
                  <option value="client">الزبون</option>
                </select>
              </div>
              <div className="form-group" style={{marginTop:"0.75rem"}}>
                <label>🔗 رابط المستند (فاتورة/سند)</label>
                <input type="url" value={payModalInvoiceLink} onChange={(e) => setPayModalInvoiceLink(e.target.value)} className="form-control" placeholder="https://drive.google.com/..." />
              </div>
              <div style={{display:"flex",gap:"1rem",alignItems:"center",marginTop:"0.5rem"}}>
                {payModalAmount && parseFloat(payModalAmount) > 0 && (
                  parseFloat(payModalAmount) > parseFloat(payModalBooking.remainingAmount || 0)
                    ? <span className="pay-warning">⚠️ المبلغ المستلم أكبر من المبلغ المتبقي!</span>
                    : <span className="pay-valid">✅ المبلغ صحيح</span>
                )}
                {payModalAmount && parseFloat(payModalAmount) <= 0 && <span className="pay-warning">❌ المبلغ يجب أن يكون أكبر من صفر</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setPayModalBooking(null); setPayModalAmount(""); setPayModalConfirmBooking(false); setPayModalCashAccount("1101"); setPayModalCostCenter(""); setPayModalTransportType(""); setPayModalInvoiceLink(""); }}>إلغاء</button>
              <button className="btn btn-primary" disabled={payModalSubmitting || !payModalAmount || parseFloat(payModalAmount) <= 0 || parseFloat(payModalAmount) > parseFloat(payModalBooking.remainingAmount || 0)}
                onClick={async () => {
                  const amt = parseFloat(payModalAmount);
                  if (!amt || amt <= 0) return;
                  setPayModalSubmitting(true);
                  try {
                    const tk = localStorage.getItem("token");
                    const res = await fetch("/api/bookings/payment", {
                      method: "PATCH",
                      headers: {"Content-Type":"application/json", Authorization: `Bearer ${tk}`},
                      body: JSON.stringify({ bookingId: payModalBooking.bookingId, amount: payModalAmount, confirmBooking: payModalConfirmBooking, cashAccountCode: payModalCashAccount, costCenter: payModalCostCenter, transportType: payModalTransportType, invoiceLink: payModalInvoiceLink }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setPayReceipt({
                        booking: { ...payModalBooking, paidAmount: data.paidAmount, remainingAmount: data.remainingAmount, status: data.status },
                        amount: amt,
                        cashAccount: payModalCashAccount,
                      });
                      setPayModalAmount("");
                      setPayModalConfirmBooking(false);
                      fetchBookings();
                    } else {
                      setErrorMsg(data.error || "فشل تسجيل الدفعة");
                    }
                  } catch { setErrorMsg("خطأ في الاتصال بالخادم"); }
                  finally { setPayModalSubmitting(false); }
                }}
              >
                {payModalSubmitting ? "جاري التسجيل..." : "✅ تأكيد تسجيل الدفعة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt View */}
      {payReceipt && (
        <div className="modal-overlay" onClick={() => { setPayReceipt(null); setPayModalBooking(null); setPayModalCashAccount("1101"); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"520px"}}>
            <div className="modal-header">
              <h2>🧾 سند قبض</h2>
              <button className="modal-close" onClick={() => { setPayReceipt(null); setPayModalBooking(null); setPayModalCashAccount("1101"); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="receipt-card" style={{padding:"1rem",background:"rgba(255,255,255,0.03)",borderRadius:"12px",border:"1px solid rgba(255,215,0,0.15)"}}>
                <div style={{textAlign:"center",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"1.1rem",fontWeight:700,color:"var(--gold)"}}>🧾 سند قبض</div>
                  <div style={{fontSize:"0.78rem",opacity:0.6,marginTop:"0.15rem"}}>هابي لاند لتأجير الخيام</div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0",borderBottom:"1px dashed rgba(255,255,255,0.08)"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>رقم السند</span>
                  <strong style={{fontSize:"0.82rem"}}>RCP-{payReceipt.booking.bookingId}-{Date.now().toString().slice(-6)}</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0",borderBottom:"1px dashed rgba(255,255,255,0.08)"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>التاريخ</span>
                  <strong style={{fontSize:"0.82rem"}}>{formatDateArabic(getTodayString())}</strong>
                </div>
                <div style={{margin:"0.5rem 0",borderTop:"1px solid rgba(255,255,255,0.1)"}}></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>اسم العميل</span>
                  <strong style={{fontSize:"0.85rem"}}>{payReceipt.booking.customerName}</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>رقم الحجز</span>
                  <strong style={{fontSize:"0.85rem"}}>{payReceipt.booking.bookingId}</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>رقم الجوال</span>
                  <strong style={{fontSize:"0.85rem"}}>{payReceipt.booking.customerPhone}</strong>
                </div>
                <div style={{margin:"0.5rem 0",borderTop:"1px solid rgba(255,255,255,0.1)"}}></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.4rem 0"}}>
                  <span style={{fontSize:"0.85rem"}}>💰 المبلغ المستلم</span>
                  <strong style={{fontSize:"1rem",color:"var(--gold)"}}>{payReceipt.amount.toLocaleString()} ريال</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>إجمالي المدفوع</span>
                  <strong style={{fontSize:"0.85rem"}}>{payReceipt.booking.paidAmount} ريال</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>المتبقي</span>
                  <strong style={{fontSize:"0.85rem",color:payReceipt.booking.remainingAmount > 0 ? "#ff4444" : "#4caf50"}}>{payReceipt.booking.remainingAmount} ريال</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>حالة الحجز</span>
                  <strong style={{fontSize:"0.85rem"}}>{payReceipt.booking.status}</strong>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0.3rem 0"}}>
                  <span style={{fontSize:"0.82rem",opacity:0.6}}>الخزينة</span>
                  <strong style={{fontSize:"0.85rem"}}>{acctName(payReceipt.cashAccount) || payReceipt.cashAccount}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn wa-btn" onClick={() => {
                const r = payReceipt;
                const msg = `🧾 *سند قبض*\n🔖 رقم الحجز: ${r.booking.bookingId}\n💰 المبلغ المستلم: ${r.amount} ريال\n✅ إجمالي المدفوع: ${r.booking.paidAmount} ريال\n⏳ المتبقي: ${r.booking.remainingAmount} ريال\n📅 التاريخ: ${formatDateArabic(getTodayString())}\n\nشكراً لثقتكم 🙏`;
                const countryCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || '966';
                const phone = countryCode + (r.booking.customerPhone || "").replace(/^0/, '').replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
              }}>
                📞 واتساب
              </button>
              <button className="btn print-btn" onClick={() => {
                const r = payReceipt;
                print("REPORT_TABLE", {
                  title: `سند قبض - ${r.booking.bookingId}`,
                  headers: ["البيان", "المبلغ"],
                  rows: [
                    ["💰 المبلغ المستلم", `${r.amount} ريال`],
                    ["✅ إجمالي المدفوع", `${r.booking.paidAmount} ريال`],
                    ["⏳ المتبقي", `${r.booking.remainingAmount} ريال`],
                  ],
                  footer: `العميل: ${r.booking.customerName} | الحجز: ${r.booking.bookingId} | الحالة: ${r.booking.status}`,
                });
              }}>
                🖨️ طباعة السند
              </button>
              <button className="btn btn-gold" onClick={() => { setPayReceipt(null); setPayModalCashAccount("1101"); }}>
                ➕ تسجيل دفعة أخرى
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!cancelConfirm}
        title="🗑️ حذف الحجز"
        message={`هل أنت متأكد من حذف الحجز رقم ${cancelConfirm?.bookingId} للعميل ${cancelConfirm?.customerName}؟`}
        confirmLabel={cancelSubmitting ? "جاري الحذف..." : "نعم، حذف الحجز"}
        confirmClass="btn btn-danger"
        onConfirm={handleCancelBooking}
        disabled={cancelSubmitting}
        onCancel={() => { setCancelConfirm(null); setCancelRefund(""); setCancelPenalty(""); setCancelExpensesTotal(0); }}
      >
        {cancelConfirm && (
          <div className="financial-summary" style={{marginTop:"1rem",marginBottom:"0.75rem",padding:"0.75rem",background:"var(--card-bg)",borderRadius:"var(--radius)"}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"0.25rem 0"}}>
              <span style={{opacity:0.7}}>💰 الإجمالي</span>
              <span>{formatCurrency(cancelConfirm.totalAmount)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"0.25rem 0"}}>
              <span style={{opacity:0.7}}>💵 المدفوع</span>
              <span className="text-emerald">{formatCurrency(cancelConfirm.paidAmount)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"0.25rem 0"}}>
              <span style={{opacity:0.7}}>🔴 إجمالي المصاريف (تجهيز + تركيب + فك)</span>
              <span style={{color:"#ff6b35"}}>
                {cancelExpensesLoading ? "جاري التحميل..." : formatCurrency(cancelExpensesTotal)}
              </span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"0.25rem 0",borderTop:"1px solid var(--border)",marginTop:"0.25rem",paddingTop:"0.5rem"}}>
              <span style={{opacity:0.7}}>📊 صافي المدفوع بعد المصاريف</span>
              <span style={{fontWeight:600}}>{formatCurrency(Math.max(0, (parseFloat(cancelConfirm.paidAmount) || 0) - cancelExpensesTotal))}</span>
            </div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <div className="form-group">
            <label>💰 مبلغ الغرامة على العميل</label>
            <input type="number" min="0" step="0.01" value={cancelPenalty} onChange={(e) => setCancelPenalty(e.target.value)} className="form-control" placeholder="0" />
          </div>
          <div style={{padding:"0.75rem",background:"var(--card-bg)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:600,fontSize:"1rem"}}>💸 مبلغ الاسترداد للعميل</span>
              <span style={{fontSize:"1.2rem",fontWeight:700,color:"#4caf50"}}>{formatCurrency(cancelRefundAmount)}</span>
            </div>
            <div style={{fontSize:"0.75rem",opacity:0.6,marginTop:"0.25rem"}}>
              المدفوع - المصاريف - الغرامة = {formatCurrency(cancelConfirm?.paidAmount || 0)} - {formatCurrency(cancelExpensesTotal)} - {formatCurrency(parseFloat(cancelPenalty) || 0)} = {formatCurrency(cancelRefundAmount)}
            </div>
          </div>
        </div>
      </ConfirmModal>
    </>
  );
}