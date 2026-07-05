"use client";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import FieldCard from "@/views/FieldCard";
import ConfirmModal from "@/components/ConfirmModal";
import DualCalendarPicker from "@/components/DualCalendarPicker";

const FALLBACK_EXPENSE_ACCOUNTS = {
  preparation: [
    { code: "5101-01", label: "أجور تحميل" },
    { code: "5101-04", label: "مقدم عمال تركيب" },
    { code: "5101-05", label: "أجور تسليم" },
  ],
  installation: [
    { code: "5102-01", label: "أجور تركيب" },
    { code: "5102-02", label: "وجبات وضيافة عمال" },
    { code: "5102-03", label: "مشتريات طارئة" },
    { code: "5102-04", label: "نقل فرش إضافي" },
  ],
  removal: [
    { code: "5103-01", label: "أجور فك" },
    { code: "5103-04", label: "حراسة ونقطة" },
    { code: "5103-05", label: "تنظيف الموقع" },
  ],
};

const PARENT_MAP = { preparation: "5101", installation: "5102", removal: "5103" };

const DISTRIBUTION_PARTIES = [
  { key: "client", label: "🔴 على العميل", color: "#dc2626" },
  { key: "workers", label: "👷 على العمال", color: "#f59e0b" },
  { key: "driver", label: "🚛 على السواق", color: "#3b82f6" },
  { key: "guard", label: "🛡️ على الحارس", color: "#8b5cf6" },
  { key: "system", label: "🏢 على النظام", color: "#6b7280" },
];

const STAGE_LABELS = { preparation: "تجهيز", installation: "تركيب", removal: "فك" };

const CASH_ACCOUNTS = [
  { code: "1101", label: "💰 صندوق الصالة" },
  { code: "1102", label: "📱 محفظة كريمي" },
  { code: "1103", label: "📱 محفظة جوالي" },
  { code: "1104", label: "📱 محفظة جيب" },
];

export default function FieldOpsView() {
  const { print, setErrorMsg, setSuccessMsg } = useApp();

  const [fieldBookings, setFieldBookings] = useState([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [expenseModal, setExpenseModal] = useState(null); // { booking, stage }
  const [submittingExpenses, setSubmittingExpenses] = useState(false);
  const [transportType, setTransportType] = useState("company");
  const [expenseCashAccount, setExpenseCashAccount] = useState("1101");
  const [completionModal, setCompletionModal] = useState(null);
  const [damageForm, setDamageForm] = useState({});
  const [distributionForm, setDistributionForm] = useState({});
  const [completing, setCompleting] = useState(false);
  const [completionExpenses, setCompletionExpenses] = useState([]);
  const [completionSelectedAcct, setCompletionSelectedAcct] = useState("");
  const [completionSelectedAmt, setCompletionSelectedAmt] = useState("");
  const [completionSelectedDesc, setCompletionSelectedDesc] = useState("");
  const [transferModal, setTransferModal] = useState(null);
  const [transferType, setTransferType] = useState("installed");
  const [targetBookingId, setTargetBookingId] = useState("");
  const [transferComparison, setTransferComparison] = useState(null);
  const [transferTargetBooking, setTransferTargetBooking] = useState(null);
  const [transferChecking, setTransferChecking] = useState(false);

  const [extendModal, setExtendModal] = useState(null);
  const [extendEndDate, setExtendEndDate] = useState("");
  const [extendAmount, setExtendAmount] = useState("");
  const [extendPaid, setExtendPaid] = useState("");
  const [extendNotes, setExtendNotes] = useState("");
  const [extendConflicts, setExtendConflicts] = useState([]);
  const [extendSaving, setExtendSaving] = useState(false);
  const [extendCashAccount, setExtendCashAccount] = useState("1101");
  const [selectedExpenseAcct, setSelectedExpenseAcct] = useState("");
  const [selectedExpenseAmt, setSelectedExpenseAmt] = useState("");
  const [selectedExpenseDesc, setSelectedExpenseDesc] = useState("");

  const CASH_ACCOUNTS = [
    { code: "1101", label: "💰 صندوق الصالة" },
    { code: "1102", label: "📱 محفظة كريمي" },
    { code: "1103", label: "📱 محفظة جوالي" },
    { code: "1104", label: "📱 محفظة جيب" },
  ];
  const [costCenters, setCostCenters] = useState([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [bookingExpenses, setBookingExpenses] = useState([]);
  const [deleteExpenseConfirm, setDeleteExpenseConfirm] = useState(null);
  const [fieldAccounts, setFieldAccounts] = useState(FALLBACK_EXPENSE_ACCOUNTS);

  const [payModalBooking, setPayModalBooking] = useState(null);
  const [payModalAmount, setPayModalAmount] = useState("");
  const [payModalCashAccount, setPayModalCashAccount] = useState("1101");
  const [payModalCostCenter, setPayModalCostCenter] = useState("");
  const [payModalTransportType, setPayModalTransportType] = useState("");
  const [payModalInvoiceLink, setPayModalInvoiceLink] = useState("");
  const [payModalConfirmBooking, setPayModalConfirmBooking] = useState(false);
  const [payModalSubmitting, setPayModalSubmitting] = useState(false);
  const [payReceipt, setPayReceipt] = useState(null);

  const formatCurrency = (n) => { if (n === undefined || n === null) return "0"; return Number(n).toLocaleString(); };

  const closePayModal = () => { setPayModalBooking(null); setPayModalAmount(""); setPayModalConfirmBooking(false); setPayModalCashAccount("1101"); setPayModalCostCenter(""); setPayModalTransportType(""); setPayModalInvoiceLink(""); };

  const accountLookup = useMemo(() => {
    const map = {};
    Object.values(fieldAccounts).forEach(arr => arr.forEach(a => { map[a.code] = a.label; }));
    return map;
  }, [fieldAccounts]);

  useEffect(() => { fetchFieldBookings(); fetchCostCenters(); loadFieldAccounts(); }, []);

  const loadFieldAccounts = async () => {
    try {
      const res = await fetch("/api/finance/accounts");
      const data = await res.json();
      if (data.success && data.accounts.length > 0) {
        const grouped = {};
        for (const [stage, parentCode] of Object.entries(PARENT_MAP)) {
          grouped[stage] = data.accounts
            .filter((a) => a.parentCode === parentCode)
            .map((a) => ({ code: a.accountCode, label: a.accountName }));
        }
        if (grouped.preparation?.length > 0) setFieldAccounts(grouped);
      }
    } catch {}
  };

  const fetchCostCenters = async () => {
    try {
      const res = await fetch("/api/finance/cost-centers");
      const data = await res.json();
      if (data.success) setCostCenters(data.centers);
    } catch {}
  };

  const fetchFieldBookings = async () => {
    setFieldLoading(true);
    try {
      const res = await fetch("/api/bookings/field");
      const data = await res.json();
      if (data.success) setFieldBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
      setErrorMsg("فشل تحميل بيانات الميدان");
    }
    setFieldLoading(false);
  };

  const moveFieldCard = async (bookingId, newStatus) => {
    try {
      const res = await fetch("/api/bookings/field", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, fieldStatus: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setFieldBookings((prev) =>
          prev.map((b) => (b.bookingId === bookingId ? { ...b, fieldStatus: newStatus } : b))
        );
      } else {
        setErrorMsg(data.error || "فشل نقل البطاقة");
      }
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم");
    }
  };

  // Auto-compare source and target booking when targetBookingId changes
  useEffect(() => {
    if (!transferModal || !targetBookingId || targetBookingId.length < 5) {
      setTransferTargetBooking(null);
      setTransferComparison(null);
      return;
    }
    setTransferChecking(true);
    const tgt = fieldBookings.find((b) => b.bookingId === targetBookingId);
    if (!tgt) {
      setTransferTargetBooking(null);
      setTransferComparison({ error: "الحجز المستهدف غير موجود" });
      setTransferChecking(false);
      return;
    }
    setTransferTargetBooking(tgt);
    const src = transferModal;
    const srcItems = src.rentedItems || [];
    const tgtItems = tgt.rentedItems || [];
    const srcMap = {};
    srcItems.forEach((i) => { srcMap[i.itemId] = { qty: i.quantityRequested, name: i.itemName }; });
    const tgtMap = {};
    tgtItems.forEach((i) => { tgtMap[i.itemId] = { qty: i.quantityRequested, name: i.itemName }; });
    const allIds = [...new Set([...Object.keys(srcMap), ...Object.keys(tgtMap)])];
    const items = allIds
      .map((id) => {
        const srcQty = srcMap[id]?.qty || 0;
        const tgtQty = tgtMap[id]?.qty || 0;
        const diff = tgtQty - srcQty;
        let status = "transfer";
        if (diff > 0) status = "pick";
        else if (diff < 0) status = "return";
        else if (srcQty === 0 && tgtQty === 0) status = "none";
        return {
          itemId: id,
          itemName: srcMap[id]?.name || tgtMap[id]?.name || id,
          sourceQty: srcQty,
          targetQty: tgtQty,
          diff,
          status,
        };
      })
      .filter((i) => i.status !== "none");
    const typeMatch = (src.bookingType || "") === (tgt.bookingType || "");
    const dimsMatch =
      (src.tentLength || "") === (tgt.tentLength || "") &&
      (src.tentWidth || "") === (tgt.tentWidth || "") &&
      (src.tentCount || "1") === (tgt.tentCount || "1");
    const hasDiffs = items.some((i) => i.status !== "transfer");
    const isFullMatch = typeMatch && dimsMatch && !hasDiffs;
    setTransferComparison({ isFullMatch, typeMatch, dimsMatch, hasDiffs, items, sourceBooking: src, targetBooking: tgt });
    setTransferChecking(false);
  }, [targetBookingId, transferModal, fieldBookings]);

  const openExpenseModal = async (booking, stage) => {
    setExpenseModal({ booking, stage, pendingExpenses: [] });
    setSelectedExpenseAcct("");
    setSelectedExpenseAmt("");
    setSelectedExpenseDesc("");
    setBookingExpenses([]);
    // Fetch existing expenses for this booking
    try {
      const r = await fetch(`/api/bookings/field/expense?bookingId=${encodeURIComponent(booking.bookingId)}`);
      const d = await r.json();
      if (d.success) setBookingExpenses(d.all || []);
    } catch {}
  };

  const handleExpenseSubmit = async () => {
    if (!expenseModal || submittingExpenses) return;
    setSubmittingExpenses(true);
    const { booking, stage, pendingExpenses } = expenseModal;
    const allEntries = pendingExpenses || [];
    if (allEntries.length === 0) {
      setErrorMsg("أضف مصروفًا واحدًا على الأقل");
      setSubmittingExpenses(false);
      return;
    }

    let successCount = 0;
    const tk = localStorage.getItem("token");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${tk}` };

    const stageCustomCodes = { preparation: "5101-06", installation: "5102-05", removal: "5103-06" };
    for (const e of allEntries) {
      const accountCode = e.accountCode === "_custom" ? (stageCustomCodes[stage] || "5100") : e.accountCode;
      try {
        const body = { bookingId: booking.bookingId, stage, accountCode, amount: e.amount, cashAccountCode: expenseCashAccount };
        if (e.accountCode === "_custom" && e.desc) body.description = e.desc;
        const res = await fetch("/api/bookings/field/expense", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch {}
    }

    setSubmittingExpenses(false);
    if (successCount > 0) {
      setSuccessMsg(`تم تسجيل ${successCount} مصروف`);
      fetchFieldBookings();
      setExpenseModal(null);
    } else {
      setErrorMsg("فشل تسجيل المصاريف");
      setSubmittingExpenses(false);
    }
  };

  const handleDeleteExpense = async (journalId) => {
    setDeleteExpenseConfirm(journalId);
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseConfirm) return;
    const journalId = deleteExpenseConfirm;
    setDeleteExpenseConfirm(null);
    try {
      const tk = localStorage.getItem("token");
      const r = await fetch(`/api/finance/ledger?journalId=${journalId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg("تم الحذف");
        setBookingExpenses((prev) => prev.filter((e) => e.journalId !== journalId));
        fetchFieldBookings();
      } else setErrorMsg(d.error || "فشل الحذف");
    } catch { setErrorMsg("خطأ"); }
  };

  const openCompletionModal = (booking) => {
    setCompletionModal(booking);
    setTransportType("company");
    setSelectedCostCenter("");
    const initialDamages = {};
    const initialDist = {};
    for (const ri of booking.rentedItems || []) {
      initialDamages[ri.itemId] = 0;
      initialDist[ri.itemId] = { client: "", workers: "", driver: "", guard: "", system: "" };
    }
    setDamageForm(initialDamages);
    setDistributionForm(initialDist);
    setCompletionExpenses([]);
    setCompletionSelectedAcct("");
    setCompletionSelectedAmt("");
    setCompletionSelectedDesc("");
  };

  const handleDistributionChange = (itemId, party, value) => {
    setDistributionForm((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [party]: value },
    }));
  };

  const handleCompleteField = async () => {
    if (!completionModal) return;
    setCompleting(true);
    try {
      const damagedItems = Object.entries(damageForm)
        .filter(([_, qty]) => parseInt(qty) > 0)
        .map(([itemId, damagedQuantity]) => {
          const item = completionModal.rentedItems.find((r) => r.itemId === itemId);
          return {
            itemId,
            itemName: item?.itemName || "",
            damagedQuantity,
            distribution: distributionForm[itemId] || {},
          };
        });

      const actualRemoval = {};
      const customExpenseNotes = {};
      const customCode = "5103-06";
      for (const e of completionExpenses) {
        const code = e.accountCode === "_custom" ? customCode : e.accountCode;
        actualRemoval[code] = e.amount;
        if (e.accountCode === "_custom" && e.desc) customExpenseNotes[code] = e.desc;
      }

      const tk = localStorage.getItem("token");
      const res = await fetch("/api/bookings/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          bookingId: completionModal.bookingId,
          damagedItems,
          removalExpenses: actualRemoval,
          customExpenseNotes,
          cashAccountCode: expenseCashAccount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("تم إتمام الجرد وتسوية التوالف");
        setCompletionModal(null);
        fetchFieldBookings();
      } else {
        setErrorMsg(data.error || "فشل إتمام الجرد");
      }
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم");
    }
    setCompleting(false);
  };

  const openTransferModal = (booking) => {
    setTransferModal(booking);
    setTargetBookingId("");
    setTransferType("installed");
    setTransferComparison(null);
    setTransferTargetBooking(null);
  };

  const handlePrintItems = (booking) => {
    print("FIELD_ITEMS", {
      bookingId: booking.bookingId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerAddress: booking.customerAddress,
      bookingType: booking.bookingType,
      tentLength: booking.tentLength,
      tentWidth: booking.tentWidth,
      tentCount: booking.tentCount,
      startDate: booking.startDate,
      endDate: booking.endDate,
      items: booking.rentedItems || [],
      notes: booking.notes,
    });
  };

  const addCompletionExpense = () => {
    if (!completionSelectedAcct || !parseFloat(completionSelectedAmt)) return;
    const acct = (fieldAccounts.removal || []).find(a => a.code === completionSelectedAcct);
    setCompletionExpenses(prev => [...prev, {
      accountCode: completionSelectedAcct,
      accountName: acct?.label || (completionSelectedAcct === "_custom" ? (completionSelectedDesc || "مصروف مخصص") : completionSelectedAcct),
      amount: parseFloat(completionSelectedAmt),
      desc: completionSelectedAcct === "_custom" ? completionSelectedDesc : "",
    }]);
    setCompletionSelectedAcct("");
    setCompletionSelectedAmt("");
    setCompletionSelectedDesc("");
  };

  const addPendingExpense = () => {
    if (!selectedExpenseAcct || !parseFloat(selectedExpenseAmt)) return;
    const stage = expenseModal?.stage;
    const displayFields = stage ? fieldAccounts[stage] || [] : [];
    const acct = displayFields.find(a => a.code === selectedExpenseAcct);
    const entry = {
      accountCode: selectedExpenseAcct,
      accountName: acct?.label || selectedExpenseAcct,
      amount: parseFloat(selectedExpenseAmt),
      desc: selectedExpenseAcct === "_custom" ? selectedExpenseDesc : "",
    };
    setExpenseModal(prev => ({
      ...prev,
      pendingExpenses: [...(prev.pendingExpenses || []), entry],
    }));
    setSelectedExpenseAcct("");
    setSelectedExpenseAmt("");
    setSelectedExpenseDesc("");
  };

  const removePendingExpense = (idx) => {
    setExpenseModal(prev => ({
      ...prev,
      pendingExpenses: (prev.pendingExpenses || []).filter((_, i) => i !== idx),
    }));
  };

  const openExtendModal = (booking) => {
    setExtendModal(booking);
    setExtendEndDate(booking.endDate || "");
    setExtendAmount("");
    setExtendPaid("");
    setExtendNotes("");
    setExtendConflicts([]);
    setExtendCashAccount("1101");
  };

  const openPayModal = (booking) => {
    setPayModalBooking(booking);
    setPayModalAmount("");
    setPayModalConfirmBooking(false);
    setPayModalCashAccount("1101");
    setPayModalCostCenter("");
    setPayModalTransportType("");
    setPayModalInvoiceLink("");
  };

  const handleExtend = async () => {
    if (!extendModal || !extendEndDate) {
      setErrorMsg("أدخل تاريخ النهاية الجديد");
      return;
    }
    setExtendSaving(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/bookings/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          bookingId: extendModal.bookingId,
          newEndDate: extendEndDate,
          additionalAmount: extendAmount || "0",
          paidAmount: extendPaid || "0",
          notes: extendNotes,
          cashAccountCode: extendCashAccount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.conflicts ? "تم التمديد مع وجود تعارض في الأصناف" : "تم تمديد الحجز");
        setExtendConflicts(data.conflicts || []);
        if (!data.conflicts || data.conflicts.length === 0) {
          setExtendModal(null);
          fetchFieldBookings();
        }
      } else {
        setErrorMsg(data.error || "فشل التمديد");
      }
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم");
    }
    setExtendSaving(false);
  };

  const handleTransfer = async () => {
    if (!transferModal || !targetBookingId) {
      setErrorMsg("أدخل رقم الحجز المستهدف");
      return;
    }
    if (!transferTargetBooking) {
      setErrorMsg("الحجز المستهدف غير موجود في قاعدة البيانات");
      return;
    }
    try {
      const isFullMatch = transferComparison?.isFullMatch || false;
      const targetStatus = isFullMatch ? "installed" : "preparation";
      // Build the full transfer items (all compared items) for the API
      const transferItems = transferComparison?.items?.map(i => ({
        itemId: i.itemId,
        itemName: i.itemName,
        diff: i.diff,
        sourceQty: i.sourceQty,
        targetQty: i.targetQty,
      })) || [];
      const res = await fetch("/api/bookings/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          sourceBookingId: transferModal.bookingId,
          targetBookingId,
          transferType,
          isFullMatch,
          targetStatus,
          transferItems,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          isFullMatch
            ? "✅ نقل مباشر — الأصناف مطابقة، الحجز المستهدف في الموقع"
            : "✅ تم النقل — الحجز المستهدف قيد التجهيز، راجع جدول الفروق"
        );
        setTransferModal(null);
        setTransferComparison(null);
        setTransferTargetBooking(null);
        fetchFieldBookings();
      } else {
        setErrorMsg(data.error || "فشل النقل");
      }
    } catch (err) {
      setErrorMsg("فشل الاتصال بالخادم");
    }
  };

  const totalExpenseFor = (bookingId) => {
    const b = fieldBookings.find((fb) => fb.bookingId === bookingId);
    return b?.expenseTotal || 0;
  };

  const kanbanColumns = [
    { key: "preparation", label: "قيد التجهيز والتحميل", icon: "📦", className: "prep" },
    { key: "installed", label: "مثبت في الموقع", icon: "🏗️", className: "installed" },
    { key: "completed", label: "منتهي", icon: "✅", className: "completed" },
  ];

  const pendingCount = fieldBookings.filter((b) => (b.fieldStatus || "pending") === "pending").length;

  return (
    <>
      <section className="field-ops-section">
        <div className="section-title-row">
          <h2>🚛 لوحة التحكم الميدانية
            {pendingCount > 0 && <span className="pending-badge">📅 {pendingCount} حجز قادم</span>}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={fetchFieldBookings} disabled={fieldLoading}>
              {fieldLoading ? "جاري التحميل..." : "🔄 تحديث"}
            </button>
            <button className="btn btn-gold" onClick={() => print('REPORT_TABLE', {
              title: 'تقرير العمليات الميدانية',
              headers: ['الحالة', 'رقم الحجز', 'العميل', 'النوع', 'التاريخ', 'إجمالي المصاريف'],
              rows: fieldBookings.map(b => [
                b.fieldStatus === 'preparation' ? 'تجهيز' : b.fieldStatus === 'installed' ? 'تركيب' : b.fieldStatus === 'completed' ? 'مكتمل' : b.fieldStatus || 'انتظار',
                b.bookingId, b.customerName || '', b.bookingType || '', b.startDate || '',
                totalExpenseFor(b.bookingId) ? `💰 ${totalExpenseFor(b.bookingId)}` : '',
              ]),
            })}>
              🖨️ طباعة
            </button>
          </div>
        </div>

        {fieldLoading ? (
          <p className="loading-text">جاري تحميل بيانات الميدان...</p>
        ) : (
          <div className="kanban-board">
            {kanbanColumns.map((col) => (
              <div key={col.key} className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("bookingId");
                  if (id) {
                    if (col.key === "completed") {
                      const booking = fieldBookings.find((b) => b.bookingId === id);
                      if (booking) openCompletionModal(booking);
                    } else {
                      moveFieldCard(id, col.key);
                    }
                  }
                }}
              >
                <div className={`kanban-col-header ${col.className}`}>
                  <span className="col-icon">{col.icon}</span>
                  <h3>{col.label}</h3>
                  <span className="col-count">{fieldBookings.filter((b) => (b.fieldStatus || "pending") === col.key).length}</span>
                </div>
                <div className="kanban-cards">
                  {fieldBookings.filter((b) => (b.fieldStatus || "pending") === col.key).map((b) => (
                    <FieldCard
                      key={b.bookingId}
                      booking={b}
                      onMove={moveFieldCard}
                      onComplete={["installed", "completed"].includes(col.key) ? openCompletionModal : null}
                      onExpense={["preparation", "installed"].includes(col.key) ? openExpenseModal : null}
                      onPayment={["preparation", "installed", "completed"].includes(col.key) ? openPayModal : null}
                      onTransfer={["installed", "completed"].includes(col.key) ? openTransferModal : null}
                      onExtend={["installed", "completed"].includes(col.key) ? openExtendModal : null}
                      onPrintItems={["preparation", "installed", "completed"].includes(col.key) ? handlePrintItems : null}
                      onRefresh={fetchFieldBookings}
                      costCenters={costCenters}
                      fieldAccounts={fieldAccounts}
                    />
                  ))}
                  {fieldBookings.filter((b) => (b.fieldStatus || "pending") === col.key).length === 0 && (
                    <p className="kanban-empty">لا توجد حجوزات</p>
                  )}
                </div>
                {["preparation", "installed", "completed"].includes(col.key) && (
                  <div className="kanban-col-footer">
                    {fieldBookings.filter((b) => (b.fieldStatus || "pending") === col.key).map((b) => {
                      const total = totalExpenseFor(b.bookingId);
                      return total > 0 ? (
                        <small key={b.bookingId} className="expense-indicator">💰 {b.bookingId}: {total.toLocaleString()} ر.ي</small>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Expense Modal */}
      {expenseModal && (
        <div className="modal-overlay" onClick={() => setExpenseModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 مصاريف {STAGE_LABELS[expenseModal.stage]} — {expenseModal.booking.bookingId}</h2>
              <button className="modal-close" onClick={() => setExpenseModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="subtitle">{expenseModal.booking.customerName} — {expenseModal.booking.bookingType}</p>
              {/* Expense type picker — dropdown + amount + add */}
              <div className="expense-stage-form">
                {(() => {
                  const stage = expenseModal.stage;
                  const displayFields = fieldAccounts[stage] || [];
                  return (
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div style={{ flex: 2, minWidth: "160px" }}>
                        <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>نوع المصروف</label>
                        <select className="form-control" value={selectedExpenseAcct} onChange={(e) => { setSelectedExpenseAcct(e.target.value); setSelectedExpenseDesc(""); }}>
                          <option value="">— اختر —</option>
                          {displayFields.map((acct) => (
                            <option key={acct.code} value={acct.code}>{acct.label}</option>
                          ))}
                          <option value="_custom">➕ مصروف مخصص...</option>
                        </select>
                      </div>
                      {selectedExpenseAcct === "_custom" && (
                        <div style={{ flex: 2, minWidth: "140px" }}>
                          <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>الوصف</label>
                          <input type="text" className="form-control" value={selectedExpenseDesc}
                            onChange={(e) => setSelectedExpenseDesc(e.target.value)} placeholder="وصف المصروف" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: "80px" }}>
                        <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>المبلغ</label>
                        <input type="number" min="0" step="0.01" className="form-control" value={selectedExpenseAmt}
                          onChange={(e) => setSelectedExpenseAmt(e.target.value)} placeholder="0" />
                      </div>
                      <button type="button" className="btn btn-sm btn-primary" onClick={addPendingExpense}
                        disabled={!selectedExpenseAcct || !parseFloat(selectedExpenseAmt)}
                        style={{ padding: "0.35rem 0.75rem", whiteSpace: "nowrap" }}>
                        ➕ إضافة
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Pending expenses list */}
              {(expenseModal.pendingExpenses || []).length > 0 && (
                <div style={{ marginTop: "0.75rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                  {(expenseModal.pendingExpenses || []).map((e, i) => (
                    <div key={i} className="expense-row" style={{ marginBottom: "0.3rem" }}>
                      <span style={{ flex: 1, fontSize: "0.8rem" }}>{e.accountCode === "_custom" ? `📝 ${e.desc}` : e.accountName}</span>
                      <span className="text-gold" style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}>{e.amount.toLocaleString()}</span>
                      <button type="button" className="card-btn" style={{ color: "#ef4444", borderColor: "#ef4444", flex: 0, padding: "0.15rem 0.4rem", fontSize: "0.7rem" }}
                        onClick={() => removePendingExpense(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Cash account (خزينة) */}
              <div className="completion-section" style={{ marginTop: "1rem" }}>
                <h4 className="section-title" style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>🏦 الخزينة</h4>
                <div className="expense-row">
                  <label>من أي خزينة</label>
                  <select className="form-control" value={expenseCashAccount} onChange={(e) => setExpenseCashAccount(e.target.value)}>
                    {CASH_ACCOUNTS.map((ca) => (
                      <option key={ca.code} value={ca.code}>{ca.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/*
                Custom expenses are now handled via the dropdown with "_custom" option
              */}
            </div>

            {/* Existing expenses for this booking */}
            {bookingExpenses.length > 0 && (
              <div className="modal-body" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                <h4 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-muted)" }}>📋 المصروفات المسجلة</h4>
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {bookingExpenses.map((e) => (
                    <div key={e.journalId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ flex: 1 }}>{e.notes?.replace(/^\[.*?\]\s*/, '').trim() || accountLookup[e.accountCode] || e.accountCode} <small style={{ opacity: 0.5 }}>{e.notes?.match(/^\[(.+?)\]/)?.[1]}</small></span>
                      <span className="text-gold">{e.amount.toLocaleString()}</span>
                      <button className="btn btn-sm btn-ghost" style={{ color: "#ef4444", padding: "0.1rem 0.4rem", fontSize: "0.7rem" }} onClick={() => setDeleteExpenseConfirm(e.journalId)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setExpenseModal(null)} disabled={submittingExpenses}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleExpenseSubmit} disabled={submittingExpenses}>
                {submittingExpenses ? "جاري الحفظ..." : "💾 حفظ المصاريف"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal with Damage Distribution */}
      {completionModal && (
        <div className="modal-overlay" onClick={() => setCompletionModal(null)}>
          <div className="modal-content wide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧾 إتمام الجرد — {completionModal.bookingId}</h2>
              <button className="modal-close" onClick={() => setCompletionModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="completion-booking-info">
                <p><strong>العميل:</strong> {completionModal.customerName} | <strong>النوع:</strong> {completionModal.bookingType}</p>
                <p><strong>التاريخ:</strong> {completionModal.startDate} → {completionModal.endDate}</p>
              </div>

              {/* Removal expenses — dropdown + add */}
              <div className="completion-section">
                <h3 className="section-title expenses">💰 مصاريف الفك</h3>
                <div className="expense-stage-form">
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 2, minWidth: "160px" }}>
                      <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>نوع المصروف</label>
                      <select className="form-control" value={completionSelectedAcct} onChange={(e) => { setCompletionSelectedAcct(e.target.value); setCompletionSelectedDesc(""); }}>
                        <option value="">— اختر —</option>
                        {(fieldAccounts.removal || []).map((acct) => (
                          <option key={acct.code} value={acct.code}>{acct.label}</option>
                        ))}
                        <option value="_custom">➕ مصروف مخصص...</option>
                      </select>
                    </div>
                    {completionSelectedAcct === "_custom" && (
                      <div style={{ flex: 2, minWidth: "140px" }}>
                        <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>الوصف</label>
                        <input type="text" className="form-control" value={completionSelectedDesc}
                          onChange={(e) => setCompletionSelectedDesc(e.target.value)} placeholder="وصف المصروف" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: "80px" }}>
                      <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem" }}>المبلغ</label>
                      <input type="number" min="0" step="0.01" className="form-control" value={completionSelectedAmt}
                        onChange={(e) => setCompletionSelectedAmt(e.target.value)} placeholder="0" />
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addCompletionExpense}
                      disabled={!completionSelectedAcct || !parseFloat(completionSelectedAmt)}
                      style={{ padding: "0.35rem 0.75rem", whiteSpace: "nowrap" }}>
                      ➕ إضافة
                    </button>
                  </div>
                </div>
                {completionExpenses.length > 0 && (
                  <div style={{ marginTop: "0.5rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                    {completionExpenses.map((e, i) => (
                      <div key={i} className="expense-row" style={{ marginBottom: "0.3rem" }}>
                        <span style={{ flex: 1, fontSize: "0.8rem" }}>{e.accountName}</span>
                        <span className="text-gold" style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}>{e.amount.toLocaleString()}</span>
                        <button type="button" className="card-btn" style={{ color: "#ef4444", borderColor: "#ef4444", flex: 0, padding: "0.15rem 0.4rem", fontSize: "0.7rem" }}
                          onClick={() => {
                            setCompletionExpenses(prev => prev.filter((_, j) => j !== i));
                          }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cash account (خزينة) */}
              <div className="completion-section">
                <h3 className="section-title" style={{ fontSize: "0.9rem" }}>🏦 الخزينة</h3>
                <div className="expense-row">
                  <label>من أي خزينة</label>
                  <select className="form-control" value={expenseCashAccount} onChange={(e) => setExpenseCashAccount(e.target.value)}>
                    {CASH_ACCOUNTS.map((ca) => (
                      <option key={ca.code} value={ca.code}>{ca.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Damages with Distribution */}
              <div className="completion-section">
                <h3 className="section-title damages">🔴 التوالف والمفقودات — توزيع المسؤولية</h3>
                <p className="section-desc">حدد الكمية التالفة لكل صنف، ثم وزع قيمتها على الأطراف المسؤولة</p>
                <table className="inv-table damages-table">
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>المستأجر</th>
                      <th>التالف</th>
                      {DISTRIBUTION_PARTIES.map((p) => (
                        <th key={p.key} style={{ color: p.color, fontSize: "0.7rem" }}>{p.label}</th>
                      ))}
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(completionModal.rentedItems || []).map((item) => (
                      <tr key={item.id || item.itemId}>
                        <td>{item.itemName}</td>
                        <td>{item.quantityRequested}</td>
                        <td>
                          <input type="number" min="0" max={item.quantityRequested}
                            value={damageForm[item.itemId] ?? 0}
                            onChange={(e) => setDamageForm({ ...damageForm, [item.itemId]: e.target.value })}
                            className="form-control damage-input" />
                        </td>
                        {DISTRIBUTION_PARTIES.map((p) => {
                          const distVal = parseFloat(distributionForm[item.itemId]?.[p.key] || 0) || 0;
                          const qty = parseInt(damageForm[item.itemId] || 0);
                          return (
                            <td key={p.key}>
                              <input type="number" min="0" step="0.01"
                                value={distributionForm[item.itemId]?.[p.key] || ""}
                                onChange={(e) => handleDistributionChange(item.itemId, p.key, e.target.value)}
                                className="form-control dist-input"
                                disabled={!qty} placeholder="0" />
                            </td>
                          );
                        })}
                        <td style={{ fontWeight: "bold" }}>
                          {Object.values(distributionForm[item.itemId] || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {(completionModal.rentedItems || []).length === 0 && (
                      <tr><td colSpan="9" className="text-muted">لا توجد أصناف مسجلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Current expenses summary */}
              {completionModal.expenseTotal > 0 && (
                <div className="completion-section">
                  <h3 className="section-title">📊 إجمالي مصاريف الحجز</h3>
                  <div className="expense-summary-grid">
                    <div className="expense-summary-card">
                      <span className="label">إجمالي المصاريف المسجلة</span>
                      <span className="value">{completionModal.expenseTotal.toLocaleString()} ر.ي</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCompletionModal(null)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleCompleteField} disabled={completing}>
                {completing ? "جاري الحفظ..." : "✅ حفظ وإغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendModal && (
        <div className="modal-overlay" onClick={() => setExtendModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⏱ تمديد الحجز {extendModal.bookingId}</h2>
              <button className="modal-close" onClick={() => setExtendModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>{extendModal.customerName}</strong> — {extendModal.bookingType}</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                الحالي: {extendModal.startDate} → {extendModal.endDate}
              </p>
              <div className="form-group" style={{ marginTop: "1rem" }}>
                <label>تاريخ النهاية الجديد</label>
                <DualCalendarPicker value={extendEndDate} onChange={val => setExtendEndDate(val)} />
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>المبلغ الإضافي</label>
                <input type="number" min="0" step="0.01" value={extendAmount}
                  onChange={(e) => setExtendAmount(e.target.value)}
                  className="form-control" placeholder="0" />
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>المبلغ المدفوع الآن</label>
                <input type="number" min="0" step="0.01" value={extendPaid}
                  onChange={(e) => setExtendPaid(e.target.value)}
                  className="form-control" placeholder="0" />
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>ملاحظة</label>
                <input type="text" value={extendNotes}
                  onChange={(e) => setExtendNotes(e.target.value)}
                  className="form-control" placeholder="سبب التمديد (اختياري)" />
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>🏦 الخزينة</label>
                <select value={extendCashAccount} onChange={(e) => setExtendCashAccount(e.target.value)}
                  className="form-control">
                  {CASH_ACCOUNTS.map((ca) => (
                    <option key={ca.code} value={ca.code}>{ca.label}</option>
                  ))}
                </select>
              </div>
              {extendConflicts.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: "1rem", padding: "0.75rem", background: "#fef3c7", borderRadius: "0.5rem", fontSize: "0.8rem" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>⚠️ تعارض أصناف مع حجوزات أخرى:</p>
                  {extendConflicts.map((c, i) => (
                    <p key={i} style={{ marginBottom: "0.25rem" }}>
                      • {c.bookingId} — {c.customerName} ({c.period})
                      <br /><span style={{ color: "#92400e" }}>الأصناف: {c.items}</span>
                    </p>
                  ))}
                  <button className="btn btn-primary" onClick={() => { setExtendModal(null); setExtendConflicts([]); fetchFieldBookings(); }}
                    style={{ marginTop: "0.5rem" }}>
                    ✓ تم التمديد رغم التعارض
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setExtendModal(null)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleExtend} disabled={extendSaving}>
                {extendSaving ? "...حفظ" : "⏱ تأكيد التمديد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div className="modal-overlay" onClick={() => setTransferModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"600px"}}>
            <div className="modal-header">
              <h2>🔄 نقل الحجز {transferModal.bookingId}</h2>
              <button className="modal-close" onClick={() => setTransferModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:"0.5rem"}}>نقل من <strong>{transferModal.customerName}</strong> — {transferModal.bookingType}</p>
              <p style={{fontSize:"0.8rem",opacity:0.6}}>{transferModal.tentLength && `${transferModal.tentLength}×${transferModal.tentWidth}م`} {transferModal.tentCount && `(${transferModal.tentCount} خيمة)`}</p>

              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>نوع النقل</label>
                <select value={transferType} onChange={(e) => setTransferType(e.target.value)} className="form-control">
                  <option value="installed">منصوب — بدون فك (نقل مباشر)</option>
                  <option value="dismantled">مفكوك — فك + نقل مباشر</option>
                </select>
              </div>
              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <label>رقم الحجز المستهدف</label>
                <input type="text" value={targetBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                  className="form-control"
                  placeholder="مثال: HL-843886" />
              </div>

              {/* Comparison result */}
              {transferChecking && (
                <p style={{marginTop:"0.75rem",fontSize:"0.85rem",opacity:0.6}}>جاري فحص الحجز المستهدف...</p>
              )}

              {transferComparison?.error && (
                <p style={{marginTop:"0.75rem",color:"#ef4444",fontSize:"0.85rem"}}>❌ {transferComparison.error}</p>
              )}

              {transferComparison && !transferComparison.error && !transferChecking && (
                <div style={{marginTop:"0.75rem",padding:"0.75rem",background:"var(--hover-bg)",borderRadius:"var(--radius)"}}>
                  {/* Target booking summary */}
                  <div style={{marginBottom:"0.5rem",fontSize:"0.85rem"}}>
                    <strong>الهدف:</strong> {transferComparison.targetBooking.customerName} — {transferComparison.targetBooking.bookingType}
                    <span style={{fontSize:"0.75rem",opacity:0.6,marginRight:"0.5rem"}}>
                      ({transferComparison.targetBooking.tentLength || "?"}×{transferComparison.targetBooking.tentWidth || "?"}م)
                    </span>
                  </div>

                  {/* Match summary badges */}
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.5rem"}}>
                    <span className={`pkg-item-tag ${transferComparison.typeMatch ? "text-emerald" : "text-red"}`}
                      style={{fontSize:"0.75rem",background:transferComparison.typeMatch ? "rgba(76,175,80,0.15)" : "rgba(255,68,68,0.15)"}}>
                      {transferComparison.typeMatch ? "✅ النوع متطابق" : "❌ نوع مختلف"}
                    </span>
                    <span className={`pkg-item-tag ${transferComparison.dimsMatch ? "text-emerald" : "text-red"}`}
                      style={{fontSize:"0.75rem",background:transferComparison.dimsMatch ? "rgba(76,175,80,0.15)" : "rgba(255,68,68,0.15)"}}>
                      {transferComparison.dimsMatch ? "✅ المقاسات متطابقة" : "❌ مقاسات مختلفة"}
                    </span>
                    <span className={`pkg-item-tag ${!transferComparison.hasDiffs ? "text-emerald" : "text-gold"}`}
                      style={{fontSize:"0.75rem",background:!transferComparison.hasDiffs ? "rgba(76,175,80,0.15)" : "rgba(255,215,0,0.15)"}}>
                      {!transferComparison.hasDiffs ? "✅ الأصناف متطابقة" : "⚠️ اختلاف في الأصناف"}
                    </span>
                  </div>

                  {/* Full match message */}
                  {transferComparison.isFullMatch && (
                    <div style={{padding:"0.5rem",background:"rgba(76,175,80,0.1)",borderRadius:"8px",border:"1px solid rgba(76,175,80,0.2)",marginTop:"0.5rem"}}>
                      <p style={{fontSize:"0.85rem",margin:0}}>
                        ✅ كل شيء مطابق — الحجز المستهدف سينتقل مباشرة إلى <strong>مثبت في الموقع</strong>
                        {transferType === "dismantled" && " (يحتاج تركيب)"}
                      </p>
                    </div>
                  )}

                  {/* Differences table */}
                  {transferComparison.hasDiffs && (
                    <div style={{marginTop:"0.5rem"}}>
                      <p style={{fontSize:"0.8rem",fontWeight:600,marginBottom:"0.4rem"}}>📋 جدول الفروق — الأصناف المختلفة فقط:</p>
                      <table className="inv-table" style={{fontSize:"0.75rem"}}>
                        <thead>
                          <tr>
                            <th>الصنف</th>
                            <th>الموجود</th>
                            <th>المطلوب</th>
                            <th>الفرق</th>
                            <th>الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transferComparison.items
                            .filter(i => i.status !== "transfer")
                            .map(i => (
                              <tr key={i.itemId}>
                                <td>{i.itemName}</td>
                                <td style={{textAlign:"center"}}>{i.sourceQty}</td>
                                <td style={{textAlign:"center"}}>{i.targetQty}</td>
                                <td style={{textAlign:"center",direction:"ltr"}}>
                                  <span className={i.diff > 0 ? "text-emerald" : "text-red"}>
                                    {i.diff > 0 ? `+${i.diff}` : i.diff}
                                  </span>
                                </td>
                                <td>
                                  <span className={`pkg-item-tag ${i.status === "pick" ? "text-emerald" : "text-red"}`}
                                    style={{fontSize:"0.7rem",background:i.status === "pick" ? "rgba(76,175,80,0.15)" : "rgba(255,68,68,0.15)"}}>
                                    {i.status === "pick" ? `📥 استلام ${i.diff} من المخزن` : `📤 إرجاع ${-i.diff} للمخزن`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      <p style={{fontSize:"0.78rem",opacity:0.6,marginTop:"0.4rem"}}>
                        سيتم نقل الحجز المستهدف إلى <strong>قيد التجهيز</strong> لاستكمال الأصناف الناقصة قبل التركيب.
                      </p>
                    </div>
                  )}

                  {/* Matching items summary */}
                  {transferComparison.items.filter(i => i.status === "transfer").length > 0 && (
                    <div style={{marginTop:"0.5rem",fontSize:"0.78rem",opacity:0.7}}>
                      ✅ {transferComparison.items.filter(i => i.status === "transfer").length} صنف متطابق ينتقل مباشرة مع الخيمة
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTransferModal(null)}>إلغاء</button>
              {transferComparison && (
                <button className="btn btn-gold" onClick={() => {
                  const pickItems = (transferComparison.items || [])
                    .filter(i => i.diff > 0)
                    .map(i => ({ name: i.itemName, quantity: i.diff }));
                  const returnItems = (transferComparison.items || [])
                    .filter(i => i.diff < 0)
                    .map(i => ({ name: i.itemName, quantity: -i.diff }));
                  const inheritItems = (transferComparison.items || [])
                    .filter(i => i.diff === 0)
                    .map(i => ({ name: i.itemName, quantity: i.sourceQty }));
                  print("TRANSFER_ITEMS", {
                    sourceBookingId: transferModal.bookingId,
                    targetBookingId,
                    sourceCustomer: transferModal.customerName,
                    targetCustomer: transferTargetBooking?.customerName || "",
                    transferDate: new Date().toLocaleDateString("ar-EG"),
                    transferType,
                    pickItems,
                    returnItems,
                    inheritItems,
                  });
                }}>
                  🖨️ طباعة الفروق
                </button>
              )}
              <button className="btn btn-primary" onClick={handleTransfer}
                disabled={!transferTargetBooking || transferChecking}>
                {transferChecking ? "..." : "🔄 تأكيد النقل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModalBooking && !payReceipt && (
        <div className="modal-overlay" onClick={closePayModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"480px"}}>
            <div className="modal-header">
              <h2>💰 تسجيل دفعة</h2>
              <button className="modal-close" onClick={closePayModal}>✕</button>
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
                  {CASH_ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
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
              <button className="btn btn-secondary" onClick={closePayModal}>إلغاء</button>
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
                      fetchFieldBookings();
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

      {/* Payment Receipt */}
      {payReceipt && (
        <div className="modal-overlay" onClick={() => { setPayReceipt(null); closePayModal(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"520px"}}>
            <div className="modal-header">
              <h2>🧾 سند قبض</h2>
              <button className="modal-close" onClick={() => { setPayReceipt(null); closePayModal(); }}>✕</button>
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
                  <strong style={{fontSize:"0.82rem"}}>{new Date().toLocaleDateString("ar-SA", { year:"numeric", month:"long", day:"numeric" })}</strong>
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
                  <strong style={{fontSize:"1rem",color:"var(--gold)"}}>{formatCurrency(payReceipt.amount)} ريال</strong>
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
                  <strong style={{fontSize:"0.85rem"}}>{CASH_ACCOUNTS.find(a => a.code === payReceipt.cashAccount)?.label || payReceipt.cashAccount}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setPayReceipt(null); closePayModal(); }}>إغلاق</button>
              <button className="btn btn-gold" onClick={() => { setPayReceipt(null); closePayModal(); setPayModalCashAccount("1101"); }}>
                ➕ تسجيل دفعة أخرى
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!deleteExpenseConfirm}
        title="🗑️ حذف مصروف"
        message={`حذف هذا المصروف من القيد رقم ${deleteExpenseConfirm}؟`}
        confirmLabel="🗑️ حذف"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setDeleteExpenseConfirm(null)}
      />
    </>
  );
}
