"use client";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import ConfirmModal from "@/components/ConfirmModal";
import DualCalendarPicker from "@/components/DualCalendarPicker";

export default function ExpensesView() {
  const { print, formatCurrency, setSuccessMsg, setErrorMsg, getTodayString } = useApp();
  const [tab, setTab] = useState("entry");

  const [accounts, setAccounts] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [fromDate, setFromDate] = useState(() => {
    const today = getTodayString?.() || new Date().toISOString().split("T")[0];
    return today.slice(0, 8) + "01";
  });
  const [toDate, setToDate] = useState(getTodayString?.() || new Date().toISOString().split("T")[0]);
  const [filterAccountCode, setFilterAccountCode] = useState("");
  const [filterAccountQuery, setFilterAccountQuery] = useState("");

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCashAccount, setSelectedCashAccount] = useState("1101");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayString?.() || new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [linkedBookingId, setLinkedBookingId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAcctCode, setEditingAcctCode] = useState(null);
  const [acctForm, setAcctForm] = useState({ accountCode: "", accountName: "", accountType: "expense", parentCode: "", linkedBookingType: "", costCenterCode: "" });

  const [editEntry, setEditEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [filterCashAccount, setFilterCashAccount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");
  const [accountPath, setAccountPath] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [showBookingSearch, setShowBookingSearch] = useState(false);
  const [bookingSearchTerm, setBookingSearchTerm] = useState("");
  const [bookingSearchDate, setBookingSearchDate] = useState("");
  const [bookingSearchResults, setBookingSearchResults] = useState([]);
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [transferFrom, setTransferFrom] = useState("1101");
  const [transferTo, setTransferTo] = useState("1102");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(getTodayString?.() || new Date().toISOString().split("T")[0]);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [cumulativeBalances, setCumulativeBalances] = useState({});
  const [adjustBalances, setAdjustBalances] = useState({});
  const [adjustDate, setAdjustDate] = useState(getTodayString?.() || new Date().toISOString().split("T")[0]);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [bookingTypeMap, setBookingTypeMap] = useState({});
  const [bookingTypes, setBookingTypes] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [entryBranch, setEntryBranch] = useState("");
  const [entryCostCenter, setEntryCostCenter] = useState("");
  const [entryTransportType, setEntryTransportType] = useState("");
  const [invoiceLink, setInvoiceLink] = useState("");
  const [branches, setBranches] = useState([]);
  const [ledgerCostCenterFilter, setLedgerCostCenterFilter] = useState("");
  const [ledgerBranchFilter, setLedgerBranchFilter] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [purchaseItemId, setPurchaseItemId] = useState("");
  const [purchaseItemName, setPurchaseItemName] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false);
  const [bulkAcctCode, setBulkAcctCode] = useState("");
  const [bulkAction, setBulkAction] = useState("delete");
  const [bulkTargetAcct, setBulkTargetAcct] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchAccounts = async () => {
    try { const r = await fetch(`/api/finance/accounts?includeInactive=${showHiddenAccounts}`); const d = await r.json(); if (d.success) setAccounts(d.accounts || []); } catch {}
  };
  const fetchLedger = async (from, to) => {
    const fromVal = from !== undefined ? from : fromDate;
    const toVal = to !== undefined ? to : (from !== undefined ? from : toDate);
    try { const p = new URLSearchParams(); if (fromVal) p.set("from", fromVal); if (toVal) p.set("to", toVal); const r = await fetch(`/api/finance/ledger?${p}`); const d = await r.json(); if (d.success) { setLedger(d.entries || []); setCumulativeBalances(d.cumulativeBalances || {}); } } catch {}
  };
  const fetchCostCenters = async () => {
    try { const r = await fetch("/api/finance/cost-centers"); const d = await r.json(); if (d.success) setCostCenters(d.centers || []); } catch {}
  };
  const fetchBookingTypeMap = async () => {
    try { const r = await fetch("/api/config/types"); const d = await r.json(); if (d.success) { const types = d.types || []; setBookingTypes(types); const m = {}; for (const t of types) if (t.accountCode) m[t.typeName] = t.accountCode; setBookingTypeMap(m); } } catch {}
  };

  useEffect(() => { fetchAccounts(); }, [showHiddenAccounts]);
  useEffect(() => { fetchLedger(fromDate, toDate); fetchCostCenters(); fetchBookingTypeMap(); fetch("/api/bookings?limit=500").then(r => r.json()).then(d => { if (d.success) setAllBookings(d.bookings || []); }).catch(() => {}); fetch("/api/finance/branches").then(r => r.json()).then(d => { if (d.success) setBranches(d.branches || []); }).catch(() => {}); fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setInventoryItems(d.items || []); }).catch(() => {}); }, []);

  const searchBookings = async (term, date) => {
    setBookingSearchLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (term) params.set("search", term);
      if (date) params.set("date", date);
      const r = await fetch(`/api/bookings?${params}`);
      const d = await r.json();
      setBookingSearchResults(d.success ? (d.bookings || []) : []);
    } catch { setBookingSearchResults([]); }
    setBookingSearchLoading(false);
  };

  useEffect(() => {
    if (!showBookingSearch) return;
    const t = setTimeout(() => searchBookings(bookingSearchTerm, bookingSearchDate), 300);
    return () => clearTimeout(t);
  }, [bookingSearchTerm, bookingSearchDate, showBookingSearch]);

  useEffect(() => {
    if (linkedBookingId && allBookings.length > 0 && !selectedBooking) {
      const b = allBookings.find(bb => bb.bookingId === linkedBookingId);
      if (b) setSelectedBooking(b);
    }
  }, [linkedBookingId, allBookings]);

  // Auto-populate cost center when a booking is linked or branch changes
  useEffect(() => {
    if (!selectedBooking || !selectedBooking.bookingType || !bookingTypes.length) return;
    const bt = bookingTypes.find(t => t.typeName === selectedBooking.bookingType);
    const branch = entryBranch || "DHM";
    if (bt?.costCenterCode) {
      setEntryCostCenter(bt.costCenterCode);
    } else {
      const typeCode = bt?.typeCode || "";
      const expected = `CC-${branch}-${typeCode}`;
      if (costCenters.find(c => c.code === expected)) {
        setEntryCostCenter(expected);
      }
    }
  }, [selectedBooking, bookingTypes, costCenters, entryBranch]);

  const accountTree = useMemo(() => {
    const seen = new Set();
    const deduped = accounts.filter(a => {
      if (seen.has(a.accountCode)) return false;
      seen.add(a.accountCode);
      return true;
    });
    const build = (parents, depth = 0) => {
      const result = [];
      for (const p of parents) {
        result.push({ ...p, depth });
        const children = deduped.filter(a => a.parentCode === p.accountCode);
        if (children.length > 0) result.push(...build(children, depth + 1));
      }
      return result;
    };
    const types = [
      { label: "🏦 الأصول", type: "asset" },
      { label: "💳 المطلوبات", type: "liability" },
      { label: "👑 حقوق الملكية", type: "equity" },
      { label: "🟢 الإيرادات", type: "income" },
      { label: "🔴 المصروفات", type: "expense" },
    ];
    return types.map(t => ({ ...t, items: build(deduped.filter(a => a.accountType === t.type && !a.parentCode)) }));
  }, [accounts]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    let filtered = accounts.filter(a => a.accountName.toLowerCase().includes(q) && a.isActive !== false);
    if (entryTypeFilter !== "all") filtered = filtered.filter(a => a.accountType === entryTypeFilter);
    return filtered.sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [accounts, searchQuery, entryTypeFilter]);

  const rootAccounts = useMemo(() => {
    let filtered = accounts.filter(a => !a.parentCode && a.isActive !== false);
    if (entryTypeFilter !== "all") filtered = filtered.filter(a => a.accountType === entryTypeFilter);
    return filtered;
  }, [accounts, entryTypeFilter]);

  const currentChildren = useMemo(() => {
    if (accountPath.length === 0) return [];
    const parentCode = accountPath[accountPath.length - 1].code;
    return accounts.filter(a => a.parentCode === parentCode && a.isActive !== false);
  }, [accounts, accountPath]);

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    if (!selectedAccount) { alert("اختر الحساب من دليل الحسابات"); return; }
    if (!amount || parseFloat(amount) <= 0) { alert("المبلغ يجب أن يكون أكبر من صفر"); return; }
    if (selectedAccount.accountType === "income" && !linkedBookingId) { alert("الإيرادات يجب ربطها بحجز — اختر الحجز أولاً"); return; }
    if (selectedAccount.accountType === "income" && linkedBookingId && selectedBooking) {
      const expectedAcct = bookingTypeMap[selectedBooking.bookingType];
      if (expectedAcct && selectedAccount.accountCode !== expectedAcct && !selectedAccount.accountCode.startsWith(expectedAcct + "-") && !expectedAcct.startsWith(selectedAccount.accountCode + "-")) {
        const btName = selectedBooking.bookingType || "غير معروف";
        alert(`نوع الحجز "${btName}" لا يتوافق مع الحساب "${selectedAccount.accountName}".\nالحساب المتوقع: ${accounts.find(a => a.accountCode === expectedAcct)?.accountName || expectedAcct}`);
        return;
      }
    }
    if (isPurchaseAccount && !purchaseItemName) { alert("اختر الصنف أو أدخل اسم الصنف الجديد"); return; }
    setSubmitting(true);
    const tk = localStorage.getItem("token");
    const invNote = purchaseItemName ? ` [invId:${purchaseItemId || "new"}|${purchaseItemName}]` : "";
    try {
      if (isPurchaseAccount) {
        const res = await fetch("/api/finance/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            date: entryDate,
            accountCode: selectedAccount.accountCode,
            amount: parseFloat(amount),
            cashAccountCode: selectedCashAccount,
            notes: [invoiceNumber ? `فاتورة #${invoiceNumber}` : "", invoiceLink ? `رابط: ${invoiceLink}` : "", notes].filter(Boolean).join(" | ") + invNote,
            itemId: purchaseItemId || undefined,
            itemName: purchaseItemName,
            quantity: parseInt(purchaseQuantity) || 1,
            branch: entryBranch || "DHM",
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(data.message);
          fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setInventoryItems(d.items || []); }).catch(() => {});
        } else { setErrorMsg(data.error || "فشل"); setSubmitting(false); return; }
      } else {
        const res = await fetch("/api/finance/ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            date: entryDate,
            accountCode: selectedAccount.accountCode,
            entryType: selectedAccount.accountType,
            amount: parseFloat(amount),
            linkedBookingId,
            cashAccountCode: selectedCashAccount,
            branch: entryBranch || "DHM",
            costCenter: entryCostCenter || undefined,
            costCenterType: entryCostCenter ? "vehicle" : undefined,
            transportType: entryTransportType || undefined,
            notes: [invoiceNumber ? `فاتورة #${invoiceNumber}` : "", invoiceLink ? `رابط: ${invoiceLink}` : "", notes].filter(Boolean).join(" | "),
          }),
        });
        const data = await res.json();
        if (!data.success) { setErrorMsg(data.error || "فشل"); setSubmitting(false); return; }
      }
      setSuccessMsg("تم تسجيل القيد");
      setAmount(""); setNotes(""); setLinkedBookingId(""); setInvoiceNumber(""); setInvoiceLink(""); setEntryCostCenter(""); setEntryTransportType("");
      setPurchaseItemId(""); setPurchaseItemName(""); setPurchaseQuantity("1"); setShowNewItemInput(false);
      setSelectedAccount(null); setSelectedBooking(null);
      fetchLedger(fromDate, toDate);
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleAcctSubmit = async (e) => {
    e.preventDefault();
    try {
      const tk = localStorage.getItem("token");
      const method = editingAcctCode ? "PUT" : "POST";
      const body = editingAcctCode ? { originalCode: editingAcctCode, ...acctForm } : acctForm;
      const res = await fetch("/api/finance/accounts", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { setSuccessMsg(data.message); fetchAccounts(); setAcctForm({ accountCode: "", accountName: "", accountType: "expense", parentCode: "", linkedBookingType: "", costCenterCode: "" }); setEditingAcctCode(null); setShowAccountForm(false); }
      else setErrorMsg(data.error || "فشل");
    } catch { setErrorMsg("خطأ"); }
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    setSubmitting(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/finance/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          journalId: editEntry.journalId, date: editEntry.date,
          accountCode: editEntry.accountCode, entryType: editEntry.entryType,
          amount: editEntry.amount, linkedBookingId,
          notes: editEntry.notes, cashAccountCode: editEntry.cashAccountCode,
        }),
      });
      const data = await res.json();
      if (data.success) { setSuccessMsg("تم"); setEditEntry(null); setLinkedBookingId(""); setSelectedBooking(null); fetchLedger(fromDate, toDate); }
      else setErrorMsg(data.error || "فشل");
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch(`/api/finance/ledger?journalId=${deleteConfirm.journalId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
      const data = await res.json();
      if (data.success) { setDeleteConfirm(null); setSuccessMsg("تم"); setEditEntry(null); setLinkedBookingId(""); setSelectedBooking(null); fetchLedger(fromDate, toDate); }
    } catch { setErrorMsg("خطأ"); }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferAmount || parseFloat(transferAmount) <= 0) { alert("المبلغ يجب أن يكون أكبر من صفر"); return; }
    setTransferSubmitting(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/finance/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          fromAccount: transferFrom,
          toAccount: transferTo,
          amount: parseFloat(transferAmount),
          date: transferDate,
          notes: transferNotes,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setSuccessMsg(`تم التحويل: ${d.journalIds?.length || 0} قيد`);
        setTransferAmount(""); setTransferNotes(""); fetchLedger(fromDate, toDate);
      } else setErrorMsg(d.error || "فشل التحويل");
    } catch { setErrorMsg("خطأ"); }
    setTransferSubmitting(false);
  };

  const hasChildren = (acct) => accounts.some(a => a.parentCode === acct.accountCode && a.isActive !== false);

  const handleAccountSelect = (acct) => {
    const children = accounts.filter(a => a.parentCode === acct.accountCode && a.isActive !== false);
    if (children.length > 0) {
      setAccountPath(prev => [...prev, { code: acct.accountCode, name: acct.accountName }]);
      setSearchQuery(""); setSelectedAccount(null); setShowDropdown(false);
    } else {
      setSelectedAccount(acct); setSearchQuery(""); setShowDropdown(false); setAccountPath([]);
      // Auto-populate cost center from account if not linked to a booking
      if (!selectedBooking && acct.costCenterCode) {
        setEntryCostCenter(acct.costCenterCode);
      }
    }
  };

  const handleBreadcrumbClick = (index) => {
    setAccountPath(prev => prev.slice(0, index + 1));
    setSelectedAccount(null);
  };

  const handleExportCSV = (entries) => {
    const headers = ["JournalID", "التاريخ", "الحساب", "النوع", "المبلغ", "ربط حجز", "مركز التكلفة", "نوع النقل", "الخزينة", "البيان"];
    const rows = entries.map(e => [
      e.journalId, e.date, acctName(e.accountCode), e.entryType === "income" ? "إيراد" : e.entryType === "liability" ? "مطلوبات" : "مصروف",
      e.amount, e.linkedBookingId || "",
      costCenterLabel(e), e.transportType || "",
      acctName(e.cashAccountCode), (e.notes || "").replace(/,/g, "،")
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ledger_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const isPurchaseAccount = selectedAccount?.accountCode?.startsWith("5015");

  const clearSelection = () => {
    setSelectedAccount(null); setAccountPath([]); setSearchQuery("");
  };

  const filteredLedger = useMemo(() => {
    let items = ledger;
    if (filterCashAccount) items = items.filter(e => e.cashAccountCode === filterCashAccount);
    if (ledgerBranchFilter) {
      items = items.filter(e => (e.branch || "DHM") === ledgerBranchFilter);
    }
    if (ledgerCostCenterFilter) items = items.filter(e => e.costCenter === ledgerCostCenterFilter);
    if (filterAccountCode) items = items.filter(e => e.accountCode === filterAccountCode);
    if (filterAccountQuery) {
      const q = filterAccountQuery.toLowerCase().trim();
      const matchingAccts = accounts.filter(a =>
        (a.accountName || "").toLowerCase().includes(q) ||
        (a.accountCode || "").toLowerCase().includes(q)
      ).map(a => a.accountCode);
      items = items.filter(e =>
        matchingAccts.includes(e.accountCode) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }
    return [...items].sort((a, b) => b.date.localeCompare(a.date) || parseInt(b.journalId) - parseInt(a.journalId));
  }, [ledger, filterCashAccount, ledgerCostCenterFilter, ledgerBranchFilter, filterAccountCode, filterAccountQuery, accounts]);

  const totals = useMemo(() => {
    const income = filteredLedger.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
    const expense = filteredLedger.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0);
    const liability = filteredLedger.filter(e => e.entryType === "liability").reduce((s, e) => s + e.amount, 0);
    return { income, expense, liability, net: income - expense };
  }, [filteredLedger]);

  const cashAccounts = useMemo(() => {
    return accounts.filter(a => a.accountType === "asset" && a.parentCode === "1100").sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }, [accounts]);

  const cashTotals = useMemo(() => {
    const result = {};
    for (const entry of filteredLedger) {
      const code = entry.cashAccountCode || "other";
      if (!result[code]) result[code] = { in: 0, out: 0 };
      if (entry.entryType === "income" || entry.entryType === "liability") result[code].in += entry.amount;
      else result[code].out += entry.amount;
    }
    return result;
  }, [filteredLedger]);

  const acctName = (code) => { const a = accounts.find(a => a.accountCode === code); return a ? a.accountName : code; };
  const costCenterLabel = (entry) => {
    const parts = [];
    if (entry.costCenter) parts.push(entry.costCenter);
    if (entry.costCenterType) parts.push({ vehicle: "🚛", booking: "📋", branch: "🏢", administrative: "🏛️" }[entry.costCenterType] || "");
    if (entry.transportType) parts.push({ company_vehicle: "شركة", hired_vehicle: "مستأجر", client: "زبون" }[entry.transportType] || "");
    return parts.length > 0 ? parts.join(" ") : "-";
  };
  const bookingInfo = (id) => { const b = allBookings.find(b => b.bookingId === id); return b ? `${b.customerName} (${b.bookingId})` : id; };

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>📊 النظام المحاسبي</h2>
        <div className="btn-group">
          <button className="btn btn-sm btn-gold" onClick={() => setShowAccountForm(!showAccountForm)}>📋 دليل الحسابات</button>
          <button className="btn btn-gold" onClick={() => {
            if (!filteredLedger.length) return;
            const enrichNotes = (entry) => {
              if (!entry.notes) return "-";
              let n = entry.notes;
              if (entry.linkedBookingId) {
                const b = allBookings.find(bk => bk.bookingId === entry.linkedBookingId);
                if (b) n = `${b.customerName} - ${n}`;
              }
              return n || "-";
            };
            print("REPORT_TABLE", {
              title: "دفتر اليومية",
              dateHeader: (fromDate === toDate) ? (fromDate || new Date().toLocaleDateString("en-CA")) : `${fromDate || "البداية"} إلى ${toDate || "النهاية"}`,
              headers: ["التاريخ", "من (دائن)", "إلى (مدين)", "المبلغ", "الخزينة", "البيان"],
              rows: filteredLedger.map(e => ({
                cells: [e.date || "-", e.entryType === "income" || e.entryType === "liability" ? acctName(e.accountCode) : acctName(e.cashAccountCode) || "-", e.entryType === "expense" ? acctName(e.accountCode) : acctName(e.cashAccountCode) || "-", formatCurrency(e.amount), acctName(e.cashAccountCode) || "-", enrichNotes(e)],
                type: e.entryType === "income" ? "income" : e.entryType === "expense" ? "expense" : "liability",
              })),
              totals: { income: formatCurrency(totals.income), expense: formatCurrency(totals.expense), liability: totals.liability > 0 ? formatCurrency(totals.liability) : undefined, net: formatCurrency(totals.net) },
            });
          }}>🖨️</button>
          <button className="btn btn-gold" onClick={() => handleExportCSV(filteredLedger)}>📥 CSV</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="fin-summary-cards">
        <div className="fin-summary-card">
          <div className="label">إجمالي الإيرادات</div>
          <div className="value income">{formatCurrency(totals.income)}</div>
        </div>
        <div className="fin-summary-card">
          <div className="label">إجمالي المصروفات</div>
          <div className="value expense">{formatCurrency(totals.expense)}</div>
        </div>
        {totals.liability > 0 && <div className="fin-summary-card">
          <div className="label">👑 عربون / مطلوبات</div>
          <div className="value" style={{ color: "#f59e0b" }}>{formatCurrency(totals.liability)}</div>
        </div>}
        <div className="fin-summary-card">
          <div className="label">صافي الربح</div>
          <div className={`value ${totals.net >= 0 ? "profit" : "loss"}`}>{formatCurrency(totals.net)}</div>
        </div>
        <div className="fin-summary-card">
          <div className="label">عدد القيود</div>
          <div className="value" style={{ color: "var(--text)" }}>{filteredLedger.length}</div>
        </div>
      </div>

      {/* Cash Balances — تراكمي */}
      {Object.keys(cumulativeBalances).length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {Object.entries(cumulativeBalances).map(([code, balance]) => (
            <div key={code} style={{ padding: "0.35rem 0.75rem", background: balance < 0 ? "rgba(255,0,0,0.1)" : "rgba(255,255,255,0.05)", borderRadius: "8px", fontSize: "0.78rem", border: balance < 0 ? "1px solid rgba(255,0,0,0.3)" : "none" }}>
              {balance < 0 && <span style={{marginLeft:"0.25rem"}}>⚠️</span>}
              <strong>{acctName(code) || code}</strong>: <span style={{color: balance < 0 ? "#ff4444" : balance > 0 ? "#4caf50" : "inherit", fontWeight:600}}>{formatCurrency(balance)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mini-tabs">
        <button className={`mini-tab ${tab === "entry" ? "active" : ""}`} onClick={() => setTab("entry")}>➕ تسجيل قيد</button>
        <button className={`mini-tab ${tab === "transfer" ? "active" : ""}`} onClick={() => setTab("transfer")}>🔄 تحويل داخلي</button>
        <button className={`mini-tab ${tab === "ledger" ? "active" : ""}`} onClick={() => setTab("ledger")}>📋 دفتر اليومية</button>
        <button className={`mini-tab ${tab === "accounts" ? "active" : ""}`} onClick={() => setTab("accounts")}>📘 شجرة الحسابات</button>
        <button className={`mini-tab ${tab === "adjust" ? "active" : ""}`} onClick={() => setTab("adjust")}>🎯 ضبط الأرصدة</button>
      </div>

      {tab === "entry" && (
        <div className="inv-form">
          {/* Row: type filter + add account toggle */}
          <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="entry-type-filter">
              {[
                { key: "all", label: "📋 الكل" },
                { key: "asset", label: "🏦 أصل" },
                { key: "liability", label: "💳 مطلوبات" },
                { key: "equity", label: "👑 حقوق ملكية" },
                { key: "expense", label: "🔴 مصروف" },
                { key: "income", label: "🟢 إيراد" },
              ].map(t => (
                <button key={t.key} className={`type-filter-btn ${entryTypeFilter === t.key ? "active" : ""}`}
                  onClick={() => { setEntryTypeFilter(t.key); setSelectedAccount(null); setAccountPath([]); setSearchQuery(""); }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowAccountForm(!showAccountForm)}>
              {showAccountForm ? "❌" : "📋"} إضافة حساب
            </button>
          </div>

           {showAccountForm && (
            <form onSubmit={handleAcctSubmit} style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--hover-bg)", borderRadius: "var(--radius)" }}>
              <h4 style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>{editingAcctCode ? "✏️ تعديل حساب" : "📋 إضافة حساب جديد"}</h4>
              <div className="account-form-grid">
                <div className="form-group">
                  <label>كود الحساب *</label>
                  <input type="text" value={acctForm.accountCode} onChange={(e) => setAcctForm({ ...acctForm, accountCode: e.target.value })} className="form-control" placeholder="مثال: 5001" required disabled={!!editingAcctCode} />
                </div>
                <div className="form-group">
                  <label>اسم الحساب *</label>
                  <input type="text" value={acctForm.accountName} onChange={(e) => setAcctForm({ ...acctForm, accountName: e.target.value })} className="form-control" placeholder="مثال: كهرباء" required />
                </div>
                <div className="form-group">
                  <label>النوع</label>
                  <select value={acctForm.accountType} onChange={(e) => setAcctForm({ ...acctForm, accountType: e.target.value })} className="form-control">
                    <option value="expense">🔴 مصروف</option>
                    <option value="income">🟢 إيراد</option>
                    <option value="asset">🏦 أصل</option>
                    <option value="liability">💳 مطلوبات</option>
                    <option value="equity">👑 حقوق ملكية</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>حساب أب</label>
                  <select value={acctForm.parentCode} onChange={(e) => {
                    const parent = e.target.value;
                    if (!editingAcctCode) {
                      const siblings = accounts.filter(a => a.parentCode === parent && a.isActive !== false);
                      const existing = siblings.map(a => a.accountCode.replace(parent ? `${parent}-` : "", "")).filter(s => /^\d+$/.test(s)).map(Number);
                      const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
                      const nextCode = parent ? `${parent}-${String(next).padStart(2, "0")}` : String(Math.max(...accounts.filter(a => !a.parentCode && /^\d+$/.test(a.accountCode)).map(a => Number(a.accountCode)), 0) + 1);
                      setAcctForm({ ...acctForm, parentCode: parent, accountCode: nextCode });
                    } else {
                      setAcctForm({ ...acctForm, parentCode: parent });
                    }
                  }} className="form-control">
                    <option value="">-- بدون --</option>
                    {(() => {
                      const type = acctForm.accountType;
                      const filtered = accounts.filter(a => a.accountType === type && a.isActive !== false)
                        .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
                      const depth = {};
                      for (const a of filtered) {
                        depth[a.accountCode] = a.parentCode ? (depth[a.parentCode] ?? 0) + 1 : 0;
                      }
                      return filtered.map(a => (
                        <option key={a.accountCode} value={a.accountCode}>
                          {"–".repeat(depth[a.accountCode] || 0)}{depth[a.accountCode] > 0 ? " " : ""}{a.accountCode} - {a.accountName}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div className="form-group">
                  <label>مرتبط بنوع حجز</label>
                  <select value={acctForm.linkedBookingType} onChange={(e) => setAcctForm({ ...acctForm, linkedBookingType: e.target.value })} className="form-control">
                    <option value="">-- غير مرتبط --</option>
                    {[...new Set(allBookings.map(b => b.bookingType).filter(Boolean))].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>مركز التكلفة</label>
                  <select value={acctForm.costCenterCode} onChange={(e) => setAcctForm({ ...acctForm, costCenterCode: e.target.value })} className="form-control">
                    <option value="">-- بدون --</option>
                    {costCenters.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary btn-sm">{editingAcctCode ? "💾 حفظ التعديلات" : "➕ إضافة"}</button>
                {editingAcctCode && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingAcctCode(null); setAcctForm({ accountCode: "", accountName: "", accountType: "expense", parentCode: "", linkedBookingType: "", costCenterCode: "" }); }}>إلغاء</button>}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowAccountForm(false); setEditingAcctCode(null); setAcctForm({ accountCode: "", accountName: "", accountType: "expense", parentCode: "", linkedBookingType: "", costCenterCode: "" }); }}>إغلاق</button>
              </div>
            </form>
          )}

          {/* Search input with autocomplete */}
          <div className="acct-search-section">
            <div className="acct-search-wrapper">
              <input type="text" className="form-control acct-search-input"
                placeholder={selectedAccount
                  ? `✅ ${selectedAccount.accountName} (${selectedAccount.accountCode}) — اضغط للتغيير`
                  : "🔍 اكتب اسم الحساب (مثال: ك + ه ← كهرباء)..."}
                value={selectedAccount ? "" : searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); if (selectedAccount) clearSelection(); }}
                onFocus={() => { if (!selectedAccount) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 250)} />
              {showDropdown && searchQuery.trim() && searchResults.length > 0 && (
                <div className="acct-search-dropdown">
                  {searchResults.slice(0, 20).map(acct => (
                    <div key={acct.accountCode} className={`acct-search-item ${acct.accountType}`}
                      onMouseDown={() => handleAccountSelect(acct)}>
                      <span className="asi-name">{acct.accountName}</span>
                      <span className="asi-code">{acct.accountCode}</span>
                      <span className="asi-type">{acct.accountType === "income" ? "🟢" : acct.accountType === "asset" ? "🏦" : acct.accountType === "liability" ? "💳" : acct.accountType === "equity" ? "👑" : "🔴"}</span>
                      {hasChildren(acct) && <span className="asi-children">▶ {accounts.filter(a => a.parentCode === acct.accountCode && a.isActive !== false).length}</span>}
                    </div>
                  ))}
                </div>
              )}
              {showDropdown && searchQuery.trim() && searchResults.length === 0 && (
                <div className="acct-search-dropdown">
                  <div className="acct-search-empty">لا توجد نتائج لـ "{searchQuery}"</div>
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumb */}
          {accountPath.length > 0 && (
            <div className="acct-breadcrumb">
              <span className="breadcrumb-item root" onClick={() => { setAccountPath([]); setSelectedAccount(null); }}>📋 الجذور</span>
              {accountPath.map((acct, i) => (
                <span key={acct.code} className="breadcrumb-item"
                  onClick={() => handleBreadcrumbClick(i)}>
                  {acct.name}
                </span>
              )).reduce((prev, curr) => {
                if (!prev) return [curr];
                return [...(Array.isArray(prev) ? prev : [prev]), <span key={curr.key + "-sep"} className="breadcrumb-sep"> › </span>, curr];
              })}
            </div>
          )}

          {/* Children list (drill-down level) */}
          {accountPath.length > 0 && !selectedAccount && (
            <div className="acct-children-list">
              {currentChildren.length === 0 && <p className="no-data">لا توجد حسابات فرعية</p>}
              {currentChildren.map(acct => (
                <div key={acct.accountCode} className={`acct-child-card ${acct.accountType}`}
                  onClick={() => handleAccountSelect(acct)}>
                  <span className="acc-card-icon">{acct.accountType === "income" ? "🟢" : acct.accountType === "asset" ? "🏦" : acct.accountType === "liability" ? "💳" : acct.accountType === "equity" ? "👑" : "🔴"}</span>
                  <div className="acc-card-info">
                    <div className="acc-card-name">{acct.accountName}</div>
                    <div className="acc-card-code">{acct.accountCode}</div>
                  </div>
                  <span className="acc-card-arrow">
                    {hasChildren(acct) ? "▶" : "✓"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Root level accounts (when no path and no search) */}
          {accountPath.length === 0 && !searchQuery && !selectedAccount && (
            <div className="acct-children-list">
              {rootAccounts.length === 0 && <p className="no-data">لا توجد حسابات من هذا النوع</p>}
              {rootAccounts.map(acct => (
                <div key={acct.accountCode} className={`acct-child-card ${acct.accountType}`}
                  onClick={() => handleAccountSelect(acct)}>
                  <span className="acc-card-icon">{acct.accountType === "income" ? "🟢" : acct.accountType === "asset" ? "🏦" : acct.accountType === "liability" ? "💳" : acct.accountType === "equity" ? "👑" : "🔴"}</span>
                  <div className="acc-card-info">
                    <div className="acc-card-name">{acct.accountName}</div>
                    <div className="acc-card-code">{acct.accountCode}</div>
                  </div>
                  <span className="acc-card-arrow">
                    {hasChildren(acct) ? "▶" : "✓"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Selected leaf account + entry form */}
          {selectedAccount && (
            <div className="selected-entry-form">
              <div className="selected-acct-banner">
                <div className="sab-info">
                  <span className="sab-icon">{selectedAccount.accountType === "income" ? "🟢" : selectedAccount.accountType === "asset" ? "🏦" : selectedAccount.accountType === "liability" ? "💳" : selectedAccount.accountType === "equity" ? "👑" : "🔴"}</span>
                  <span className="sab-name">{selectedAccount.accountName}</span>
                  <span className="sab-code">({selectedAccount.accountCode})</span>
                  <span className={`sab-type ${selectedAccount.accountType}`}>
                    {selectedAccount.accountType === "income" ? "إيراد" : selectedAccount.accountType === "asset" ? "أصل" : selectedAccount.accountType === "liability" ? "مطلوبات" : selectedAccount.accountType === "equity" ? "حقوق ملكية" : "مصروف"}
                  </span>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={clearSelection}>✕ تغيير</button>
              </div>

              <form onSubmit={handleEntrySubmit} className="entry-fields-grid">
                <div className="form-group">
                  <label>🏦 الخزينة</label>
                  <select className="form-control" value={selectedCashAccount} onChange={e => setSelectedCashAccount(e.target.value)}>
                    {cashAccounts.map(a => (
                      <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>المبلغ <span className="required">*</span></label>
                  <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="form-control" required />
                </div>
                <div className="form-group">
                  <label>التاريخ</label>
                  <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
                </div>
                <div className="form-group">
                  <label>رقم الفاتورة/السند</label>
                  <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="form-control" placeholder="اختياري" />
                </div>
                <div className="form-group full-width">
                  <label>ربط بحجز {linkedBookingId ? <span style={{fontSize:"0.75rem",opacity:0.6}}>(اختياري — للربط اتركه)</span> : <span style={{fontSize:"0.75rem",opacity:0.6}}>(اختياري)</span>}</label>
                  {linkedBookingId && selectedBooking ? (
                  <div className="linked-booking-card" style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,215,0,0.1)",borderRadius:"8px",border:"1px solid rgba(255,215,0,0.2)"}}>
                    <span style={{fontSize:"1.1rem"}}>🔗</span>
                    <div style={{flex:1,display:"flex",gap:"1rem",alignItems:"center"}}>
                      <span style={{fontWeight:600,fontSize:"0.85rem"}}>{selectedBooking.customerName}</span>
                      <span style={{fontSize:"0.75rem",opacity:0.7}}>#{selectedBooking.bookingId}</span>
                    </div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setLinkedBookingId(""); setSelectedBooking(null); }}>✕</button>
                  </div>
                ) : (
                  <div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setShowBookingSearch(true); setBookingSearchTerm(""); setBookingSearchDate(""); setBookingSearchResults([]); }}>🔍 ربط بحجز</button>
                    <span style={{marginRight:"0.5rem",opacity:0.5,fontSize:"0.75rem"}}>أو</span>
                    <button type="button" className="btn btn-sm btn-ghost" style={{opacity:0.6}} onClick={() => setLinkedBookingId("")}>لا يوجد (مصروف عام)</button>
                  </div>
                )}
                </div>
                <div className="form-group">
                  <label>🏢 الفرع</label>
                  <select className="form-control" value={entryBranch || "DHM"} onChange={e => { setEntryBranch(e.target.value); if (!selectedBooking) setEntryCostCenter(""); }}>
                    {branches.length > 0 ? branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>) : <option value="DHM">ذمار</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>🚛 مركز التكلفة {selectedBooking ? <span style={{fontSize:"0.7rem",opacity:0.6}}>(تلقائي من الحجز)</span> : "(الموتر)"}</label>
                  <select className="form-control" value={entryCostCenter} onChange={e => setEntryCostCenter(e.target.value)} disabled={!!selectedBooking}>
                    <option value="">-- بدون --</option>
                    {costCenters.filter(c => c.type === "vehicle" || c.type === "administrative" || (c.type === "booking" && (!entryBranch || c.code.startsWith(`CC-${entryBranch}`)))).map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>🚚 نوع النقل</label>
                  <select className="form-control" value={entryTransportType} onChange={e => setEntryTransportType(e.target.value)}>
                    <option value="">-- بدون --</option>
                    <option value="company_vehicle">موتر الشركة</option>
                    <option value="hired_vehicle">موتر مستأجر</option>
                    <option value="client">الزبون</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>🔗 رابط المستند (فاتورة/سند)</label>
                  <input type="url" value={invoiceLink} onChange={e => setInvoiceLink(e.target.value)} className="form-control" placeholder="https://drive.google.com/..." />
                </div>
                <div className="form-group full-width">
                  <label>البيان</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} className="form-control" rows="2" placeholder="شرح القيد..." />
                </div>

                {isPurchaseAccount && (
                  <div className="purchase-section full-width" style={{ gridColumn: "1 / -1", padding: "0.75rem", background: "rgba(99,102,241,0.06)", borderRadius: "var(--radius)", border: "1px solid rgba(99,102,241,0.12)" }}>
                    <h4 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-muted)" }}>📦 ربط بصنف من المخزون</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "0.75rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>الصنف</label>
                        {showNewItemInput ? (
                          <input type="text" className="form-control" value={purchaseItemName}
                            onChange={e => setPurchaseItemName(e.target.value)} placeholder="اسم الصنف الجديد..." autoFocus />
                        ) : (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <select className="form-control" value={purchaseItemId} onChange={e => {
                              const selected = inventoryItems.find(i => i.itemId === e.target.value);
                              setPurchaseItemId(e.target.value);
                              setPurchaseItemName(selected ? selected.itemName : "");
                            }} style={{ flex: 1 }}>
                              <option value="">— بدون —</option>
                              {inventoryItems.map(i => <option key={i.itemId} value={i.itemId}>{i.itemName} ({i.availableQuantity} متاح)</option>)}
                            </select>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setShowNewItemInput(true); setPurchaseItemId(""); setPurchaseItemName(""); }}>➕ جديد</button>
                          </div>
                        )}
                        {showNewItemInput && (
                          <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: "0.25rem" }} onClick={() => { setShowNewItemInput(false); setPurchaseItemName(""); }}>← اختر من القائمة</button>
                        )}
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>الكمية</label>
                        <input type="number" min="1" className="form-control" value={purchaseQuantity}
                          onChange={e => setPurchaseQuantity(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="journal-hint">
                  {parseFloat(amount) > 0 && (
                    selectedAccount.accountType === "income" ? (
                      <span>🧾 <strong>{acctName(selectedCashAccount)}</strong> ← مدين  |  <strong>{selectedAccount.accountName}</strong> ← دائن  |  {formatCurrency(amount)}</span>
                    ) : (
                      <span>🧾 <strong>{selectedAccount.accountName}</strong> ← مدين  |  <strong>{acctName(selectedCashAccount)}</strong> ← دائن  |  {formatCurrency(amount)}</span>
                    )
                  )}
                </div>

                <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className={`btn ${selectedAccount.accountType === "income" ? "btn-success" : "btn-danger"}`}
                    disabled={submitting || !amount || parseFloat(amount) <= 0}>
                    {submitting ? "..." : selectedAccount.accountType === "income" ? "🟢 تسجيل إيراد" : "🔴 تسجيل مصروف"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Empty state hint */}
          {!selectedAccount && accountPath.length === 0 && !searchQuery && (
            <div className="entry-empty-hint">
              <p>👈 اختر نوع القيد (مصروف/إيراد) ثم اكتب أول حرف من اسم الحساب للبحث</p>
            </div>
          )}
        </div>
      )}

      {tab === "transfer" && (
        <div className="inv-form">
          <h4 style={{ marginBottom: "0.75rem" }}>🔄 تحويل داخلي بين الخزائن</h4>
          <form onSubmit={handleTransfer}>
            <div className="form-grid mini-grid">
              <div className="form-group">
                <label>من حساب</label>
                <select className="form-control" value={transferFrom} onChange={e => setTransferFrom(e.target.value)}>
                  {accounts.filter(a => a.accountType === "asset" && a.parentCode === "1100").map(a => (
                    <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>إلى حساب</label>
                <select className="form-control" value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                  {accounts.filter(a => a.accountType === "asset" && a.parentCode === "1100").map(a => (
                    <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>المبلغ <span className="required">*</span></label>
                <input type="number" step="0.01" min="0.01" className="form-control" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>التاريخ</label>
                <DualCalendarPicker value={transferDate} onChange={val => setTransferDate(val)} />
              </div>
            </div>
            <div className="form-group full-width" style={{ marginTop: "0.5rem" }}>
              <label>البيان (اختياري)</label>
              <input type="text" className="form-control" value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="سبب التحويل..." />
            </div>
            {parseFloat(transferAmount) > 0 && (
              <div className="journal-hint" style={{ marginTop: "0.5rem" }}>
                🧾 <strong>{accounts.find(a => a.accountCode === transferFrom)?.accountName || transferFrom}</strong> ← دائن  |  <strong>{accounts.find(a => a.accountCode === transferTo)?.accountName || transferTo}</strong> ← مدين  |  {formatCurrency(parseFloat(transferAmount))}
              </div>
            )}
            <div className="form-actions" style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="btn btn-primary" disabled={transferSubmitting || !transferAmount || parseFloat(transferAmount) <= 0}>
                {transferSubmitting ? "..." : "🔄 تنفيذ التحويل"}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "ledger" && (
        <div className="inv-table-wrapper">
          <div className="section-title-row" style={{ marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem" }}>📋 دفتر اليومية</h3>
          </div>

          <div className="glass" style={{ padding: "1rem", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", display: "block" }}>الفترة الزمنية</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.7rem", opacity: 0.6, display: "block", marginBottom: "0.1rem" }}>من تاريخ:</span>
                    <DualCalendarPicker value={fromDate} onChange={(val) => { setFromDate(val); fetchLedger(val, toDate); }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.7rem", opacity: 0.6, display: "block", marginBottom: "0.1rem" }}>إلى تاريخ:</span>
                    <DualCalendarPicker value={toDate} onChange={(val) => { setToDate(val); fetchLedger(fromDate, val); }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }} onClick={() => {
                    const today = getTodayString?.() || new Date().toISOString().split("T")[0];
                    setFromDate(today); setToDate(today); fetchLedger(today, today);
                  }}>اليوم</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }} onClick={() => {
                    const today = getTodayString?.() || new Date().toISOString().split("T")[0];
                    const firstDay = today.slice(0, 8) + "01";
                    setFromDate(firstDay); setToDate(today); fetchLedger(firstDay, today);
                  }}>هذا الشهر</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }} onClick={() => {
                    const today = getTodayString?.() || new Date().toISOString().split("T")[0];
                    const firstDay = today.slice(0, 4) + "-01-01";
                    setFromDate(firstDay); setToDate(today); fetchLedger(firstDay, today);
                  }}>هذا العام</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }} onClick={() => {
                    setFromDate(""); setToDate(""); fetchLedger("", "");
                  }}>الكل</button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", display: "block" }}>البحث في الحسابات أو البيان</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="مثال: ديزل، عمال، إيجار..."
                  value={filterAccountQuery}
                  onChange={(e) => setFilterAccountQuery(e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.55rem 0.75rem" }}
                />
                {filterAccountQuery && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", marginTop: "0.25rem", color: "#ef4444" }}
                    onClick={() => setFilterAccountQuery("")}
                  >✕ مسح البحث</button>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", display: "block" }}>تصفية بحساب معين</label>
                <select
                  className="form-control"
                  value={filterAccountCode}
                  onChange={(e) => setFilterAccountCode(e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.55rem" }}
                >
                  <option value="">كل الحسابات</option>
                  <optgroup label="المصاريف">
                    {accounts.filter(a => a.accountType === "expense").sort((a, b) => a.accountCode.localeCompare(b.accountCode)).map(a => (
                      <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.25rem", display: "block" }}>خيارات إضافية</label>
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  <select className="form-control" style={{ width: "auto", maxWidth: "140px", fontSize: "0.8rem" }} value={filterCashAccount} onChange={(e) => setFilterCashAccount(e.target.value)}>
                    <option value="">كل الخزائن</option>
                    {cashAccounts.map(a => (
                      <option key={a.accountCode} value={a.accountCode}>{a.accountName}</option>
                    ))}
                  </select>
                  <select className="form-control" style={{ width: "auto", maxWidth: "110px", fontSize: "0.8rem" }} value={ledgerBranchFilter} onChange={(e) => { const v = e.target.value; setLedgerBranchFilter(v); if (v && ledgerCostCenterFilter && !ledgerCostCenterFilter.startsWith(`CC-${v}`)) setLedgerCostCenterFilter(""); }}>
                    <option value="">كل الفروع</option>
                    {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                  <select className="form-control" style={{ width: "auto", maxWidth: "150px", fontSize: "0.8rem" }} value={ledgerCostCenterFilter} onChange={(e) => setLedgerCostCenterFilter(e.target.value)}>
                    <option value="">كل المراكز</option>
                    {costCenters.filter(c => {
                      if (c.type !== "booking" && c.type !== "administrative") return false;
                      if (ledgerBranchFilter && !c.code.startsWith(`CC-${ledgerBranchFilter}`)) return false;
                      return true;
                    }).map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {(filterAccountCode || filterAccountQuery || ledgerCostCenterFilter || fromDate !== toDate) && (
            <div className="glass" style={{ padding: "1rem", borderRadius: "12px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h4 style={{ margin: 0, color: "#d97706", fontSize: "1rem", fontWeight: "bold" }}>📊 ملخص التقرير</h4>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", opacity: 0.85 }}>
                  {filterAccountCode ? `حساب: ${acctName(filterAccountCode)} ` : ""}{filterAccountQuery ? `بحث: "${filterAccountQuery}" ` : ""}{ledgerCostCenterFilter ? `مركز تكلفة: ${ledgerCostCenterFilter} ` : ""}
                  للفترة من <span style={{ direction: "ltr", display: "inline-block" }}>{fromDate || "البداية"}</span> إلى <span style={{ direction: "ltr", display: "inline-block" }}>{toDate || "النهاية"}</span>
                </p>
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.7, display: "block" }}>إجمالي المصروف المطابق</span>
                <span style={{ fontSize: "1.6rem", fontWeight: "900", color: "#d97706" }}>
                  {formatCurrency(filteredLedger.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
            </div>
          )}

          {editEntry && (
            <div className="inv-form" style={{ marginBottom: "1rem" }}>
              <h4 style={{ marginBottom: "0.75rem" }}>✏️ تعديل قيد</h4>
              <div className="form-grid mini-grid">
                <div className="form-group">
                  <label>التاريخ</label>
                  <DualCalendarPicker value={editEntry.date} onChange={(val) => setEditEntry(prev => ({ ...prev, date: val }))} />
                </div>
                <div className="form-group">
                  <label>الحساب</label>
                  <select value={editEntry.accountCode} onChange={(e) => setEditEntry({ ...editEntry, accountCode: e.target.value, entryType: accounts.find(a => a.accountCode === e.target.value)?.accountType || "expense" })} className="form-control">
                    {accounts.map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountCode} - {a.accountName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>الخزينة</label>
                  <select value={editEntry.cashAccountCode || ""} onChange={(e) => setEditEntry({ ...editEntry, cashAccountCode: e.target.value })} className="form-control">
                    <option value="">--</option>
                    {accounts.filter(a => a.accountType === "asset" && (a.parentCode === "1100" || a.accountCode === "1100")).map(a => (
                      <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>المبلغ</label>
                  <input type="number" step="0.01" value={editEntry.amount} onChange={(e) => setEditEntry({ ...editEntry, amount: e.target.value })} className="form-control" />
                </div>
              </div>
              <div className="form-group full-width" style={{ marginTop: "0.5rem" }}>
                <label>ربط بحجز</label>
                {linkedBookingId && selectedBooking ? (
                  <div className="linked-booking-card" style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,215,0,0.1)",borderRadius:"8px",border:"1px solid rgba(255,215,0,0.2)"}}>
                    <span style={{fontSize:"1.1rem"}}>🔗</span>
                    <div style={{flex:1,display:"flex",gap:"1rem",alignItems:"center"}}>
                      <span style={{fontWeight:600,fontSize:"0.85rem"}}>{selectedBooking.customerName}</span>
                      <span style={{fontSize:"0.75rem",opacity:0.7}}>#{selectedBooking.bookingId}</span>
                    </div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditEntry({...editEntry, linkedBookingId: ""}); setLinkedBookingId(""); setSelectedBooking(null); }}>✕</button>
                  </div>
                ) : linkedBookingId ? (
                  <div className="linked-booking-card" style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,215,0,0.1)",borderRadius:"8px",border:"1px solid rgba(255,215,0,0.2)"}}>
                    <span style={{fontSize:"1.1rem"}}>🔗</span>
                    <div style={{flex:1,display:"flex",gap:"1rem",alignItems:"center"}}>
                      <span style={{fontWeight:600,fontSize:"0.85rem"}}>{linkedBookingId}</span>
                    </div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditEntry({...editEntry, linkedBookingId: ""}); setLinkedBookingId(""); setSelectedBooking(null); }}>✕</button>
                  </div>
                ) : (
                  <div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setShowBookingSearch(true); setBookingSearchTerm(""); setBookingSearchDate(""); setBookingSearchResults([]); }}>🔍 ربط بحجز</button>
                    <span style={{marginRight:"0.5rem",opacity:0.5,fontSize:"0.75rem"}}>أو</span>
                    <button type="button" className="btn btn-sm btn-ghost" style={{opacity:0.6}} onClick={() => { setLinkedBookingId(""); setSelectedBooking(null); }}>لا يوجد</button>
                  </div>
                )}
              </div>
              <div className="form-group full-width" style={{ marginTop: "0.5rem" }}>
                <label>البيان</label>
                <input type="text" value={editEntry.notes} onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })} className="form-control" />
              </div>
              <div className="form-actions" style={{ marginTop: "0.75rem" }}>
                <button className="btn btn-primary" onClick={handleEditSave} disabled={submitting}>💾 تعديل</button>
                <button className="btn btn-secondary" onClick={() => { setEditEntry(null); setLinkedBookingId(""); setSelectedBooking(null); }}>إلغاء</button>
                <button className="btn btn-danger" style={{marginRight:"auto"}} onClick={() => { setDeleteConfirm(editEntry); }}>🗑️ حذف</button>
              </div>
            </div>
          )}

          {filteredLedger.length === 0 ? (
            <p className="no-data">لا توجد قيود مالية</p>
          ) : (
            <table className="inv-table sortable-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ</th>
                  <th>طرف القيد</th>
                  <th>الخزينة</th>
                  <th>مدين</th>
                  <th>دائن</th>
                  <th>الحجز</th>
                  <th>مركز التكلفة</th>
                  <th>البيان</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry) => (
                  <tr key={entry.journalId} style={{cursor:"pointer"}} onClick={() => { setLinkedBookingId(entry.linkedBookingId || ""); setSelectedBooking(allBookings.find(b => b.bookingId === entry.linkedBookingId) || null); setEditEntry(entry); }}>
                    <td className="cell-mono">{entry.journalId}</td>
                    <td>{entry.date || "-"}</td>
                    <td><span className="pkg-item-tag">{acctName(entry.accountCode)}</span></td>
                    <td><span className="pkg-item-tag" style={{ background: "rgba(255,215,0,0.15)" }}>{acctName(entry.cashAccountCode) || "-"}</span></td>
                    <td className={entry.entryType === "expense" ? "text-gold" : "text-muted"}>{entry.entryType === "expense" ? formatCurrency(entry.amount) : "-"}</td>
                    <td className={entry.entryType === "income" || entry.entryType === "liability" ? "text-emerald" : "text-muted"}>{entry.entryType === "income" || entry.entryType === "liability" ? formatCurrency(entry.amount) : "-"}</td>
                    <td style={{ fontSize: "0.75rem", opacity: 0.7 }}>{entry.linkedBookingId ? bookingInfo(entry.linkedBookingId) : "-"}</td>
                    <td style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>{costCenterLabel(entry)}</td>
                    <td className="text-muted" style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <th colSpan="4">الإجمالي</th>
                  <th className="text-gold">{formatCurrency(filteredLedger.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0))}</th>
                  <th className="text-emerald">{formatCurrency(filteredLedger.filter(e => e.entryType === "income" || e.entryType === "liability").reduce((s, e) => s + e.amount, 0))}</th>
                  <th colSpan="3"></th>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {tab === "accounts" && (
        <div className="inv-form">
          <div className="section-title-row" style={{ marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem" }}>📘 شجرة الحسابات</h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button className={`btn btn-sm ${showHiddenAccounts ? "btn-warning" : "btn-ghost"}`} onClick={() => { setShowHiddenAccounts(!showHiddenAccounts); }}>
                {showHiddenAccounts ? "👁️ إخفاء المخفي" : "👁️ إظهار المخفي"}
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setShowAccountForm(!showAccountForm)}>
                {showAccountForm ? "❌ إغلاق" : "➕ إضافة حساب"}
              </button>
            </div>
          </div>
          {showAccountForm && (
            <form onSubmit={handleAcctSubmit} style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--hover-bg)", borderRadius: "var(--radius)" }}>
              <div className="account-form-grid">
                <div className="form-group">
                  <label>كود الحساب *</label>
                  <input type="text" value={acctForm.accountCode} onChange={(e) => setAcctForm({ ...acctForm, accountCode: e.target.value })} className="form-control" placeholder="مثال: 5001" required disabled={!!editingAcctCode} />
                </div>
                <div className="form-group">
                  <label>اسم الحساب *</label>
                  <input type="text" value={acctForm.accountName} onChange={(e) => setAcctForm({ ...acctForm, accountName: e.target.value })} className="form-control" placeholder="مثال: كهرباء" required />
                </div>
                <div className="form-group">
                  <label>النوع</label>
                  <select value={acctForm.accountType} onChange={(e) => setAcctForm({ ...acctForm, accountType: e.target.value })} className="form-control">
                    <option value="expense">🔴 مصروف</option>
                    <option value="income">🟢 إيراد</option>
                    <option value="asset">🏦 أصل</option>
                    <option value="liability">💳 مطلوبات</option>
                    <option value="equity">👑 حقوق ملكية</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>حساب أب</label>
                  <select value={acctForm.parentCode} onChange={(e) => {
                    const parent = e.target.value;
                    if (!editingAcctCode) {
                      const siblings = accounts.filter(a => a.parentCode === parent && a.isActive !== false);
                      const existing = siblings.map(a => a.accountCode.replace(parent ? `${parent}-` : "", "")).filter(s => /^\d+$/.test(s)).map(Number);
                      const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
                      const nextCode = parent ? `${parent}-${String(next).padStart(2, "0")}` : String(Math.max(...accounts.filter(a => !a.parentCode && /^\d+$/.test(a.accountCode)).map(a => Number(a.accountCode)), 0) + 1);
                      setAcctForm({ ...acctForm, parentCode: parent, accountCode: nextCode });
                    } else {
                      setAcctForm({ ...acctForm, parentCode: parent });
                    }
                  }} className="form-control">
                    <option value="">-- بدون --</option>
                    {(() => {
                      const type = acctForm.accountType;
                      const filtered = accounts.filter(a => a.accountType === type && a.isActive !== false)
                        .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
                      const depth = {};
                      for (const a of filtered) {
                        depth[a.accountCode] = a.parentCode ? (depth[a.parentCode] ?? 0) + 1 : 0;
                      }
                      return filtered.map(a => (
                        <option key={a.accountCode} value={a.accountCode}>
                          {"–".repeat(depth[a.accountCode] || 0)}{depth[a.accountCode] > 0 ? " " : ""}{a.accountCode} - {a.accountName}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div className="form-group">
                  <label>مركز التكلفة</label>
                  <select value={acctForm.costCenterCode} onChange={(e) => setAcctForm({ ...acctForm, costCenterCode: e.target.value })} className="form-control">
                    <option value="">-- بدون --</option>
                    {costCenters.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: "0.5rem" }}>
                <button type="submit" className="btn btn-primary btn-sm">{editingAcctCode ? "💾 حفظ التعديلات" : "➕ إضافة"}</button>
                {editingAcctCode && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingAcctCode(null); setAcctForm({ accountCode: "", accountName: "", accountType: "expense", parentCode: "", linkedBookingType: "", costCenterCode: "" }); }}>إلغاء</button>}
              </div>
            </form>
          )}
          <div className="account-tree full-tree">
            {accountTree.map(section => section.items.length > 0 && (
              <div key={section.type} style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", padding: "0.25rem 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>{section.label}</div>
                {section.items.map(acct => (
                  <div key={acct.accountCode} className="account-node" style={{ padding: "0.2rem 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "4px", cursor: "default", opacity: acct.isActive === false ? 0.45 : 1 }}>
                    <span className="node-indent" style={{ width: `${acct.depth * 1.2}rem` }} />
                    <span className="node-code" style={{ fontWeight: acct.depth === 0 ? 700 : 400 }}>{acct.accountCode}</span>
                    <span className="node-name">{acct.accountName}{acct.isActive === false ? <span style={{ color: "#ff6b35", fontSize: "0.65rem", marginRight: "0.35rem" }}>(مخفي)</span> : null}</span>
                    <span className={`node-type ${acct.accountType}`} style={{ fontSize: "0.65rem" }}>
                      {acct.accountType === "income" ? "🟢" : acct.accountType === "expense" ? "🔴" : "🏦"}
                    </span>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem", marginRight: "auto" }} onClick={() => {
                      setEditingAcctCode(acct.accountCode);
                      setAcctForm({ accountCode: acct.accountCode, accountName: acct.accountName, accountType: acct.accountType, parentCode: acct.parentCode || "", linkedBookingType: acct.linkedBookingType || "", costCenterCode: acct.costCenterCode || "" });
                      setShowAccountForm(true);
                    }}>✏️</button>
                    {acct.isActive === false ? (
                      <button className="btn btn-sm btn-ghost text-emerald" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={async () => {
                        try {
                          const tk = localStorage.getItem("token");
                          const r = await fetch("/api/finance/accounts", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ accountCode: acct.accountCode, isActive: true }) });
                          const d = await r.json();
                          if (d.success) { setSuccessMsg(d.message); fetchAccounts(); } else setErrorMsg(d.error);
                        } catch { setErrorMsg("خطأ"); }
                      }}>↩️ استرجاع</button>
                    ) : (
                      <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={async () => {
                        const action = confirm(`⚠️ ${acct.accountName}\n\n"OK" = حذف نهائي\n"إلغاء" = إخفاء فقط`);
                        const tk = localStorage.getItem("token");
                        if (action) {
                          if (!confirm(`⛔ تأكيد الحذف النهائي ${acct.accountCode}؟\nقد يؤثر على القيود المحاسبية السابقة.`)) return;
                          const r = await fetch(`/api/finance/accounts?code=${encodeURIComponent(acct.accountCode)}&permanent=true`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
                          const d = await r.json();
                          if (d.success) { setSuccessMsg(d.message); fetchAccounts(); } else setErrorMsg(d.error);
                        } else {
                          const r = await fetch("/api/finance/accounts", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ accountCode: acct.accountCode, isActive: false }) });
                          const d = await r.json();
                          if (d.success) { setSuccessMsg(d.message); fetchAccounts(); } else setErrorMsg(d.error);
                        }
                      }}>🗑️</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <details style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: 0.8 }}>🧹 أدوات تصفير حسابات الاختبار</summary>
            <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--hover-bg)", borderRadius: "var(--radius)" }}>
              <div className="form-grid" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>الحساب المطلوب</label>
                  <select value={bulkAcctCode} onChange={(e) => setBulkAcctCode(e.target.value)} className="form-control">
                    <option value="">-- اختر حساب --</option>
                    {accounts.map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountCode} - {a.accountName}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: "1 1 180px" }}>
                  <label>الإجراء</label>
                  <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="form-control">
                    <option value="delete">🗑️ مسح القيود</option>
                    <option value="transfer">🔀 تحويل إلى حساب آخر</option>
                  </select>
                </div>
                {bulkAction === "transfer" && (
                  <div className="form-group" style={{ flex: "1 1 200px" }}>
                    <label>الحساب الهدف</label>
                    <select value={bulkTargetAcct} onChange={(e) => setBulkTargetAcct(e.target.value)} className="form-control">
                      <option value="">-- اختر حساب --</option>
                      {accounts.filter(a => a.accountCode !== bulkAcctCode).map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountCode} - {a.accountName}</option>)}
                    </select>
                  </div>
                )}
                <button className="btn btn-danger btn-sm" disabled={!bulkAcctCode || (bulkAction === "transfer" && !bulkTargetAcct) || bulkProcessing} onClick={async () => {
                  const acct = accounts.find(a => a.accountCode === bulkAcctCode);
                  if (bulkAction === "delete") {
                    if (!confirm(`⛔ مسح جميع قيود الحساب ${bulkAcctCode} - ${acct?.accountName}؟\nهذا لا يمكن التراجع عنه.`)) return;
                  } else {
                    const target = accounts.find(a => a.accountCode === bulkTargetAcct);
                    if (!confirm(`🔀 نقل جميع قيود ${bulkAcctCode} إلى ${bulkTargetAcct}؟`)) return;
                  }
                  setBulkProcessing(true);
                  try {
                    const tk = localStorage.getItem("token");
                    const r = await fetch("/api/finance/accounts/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                      body: JSON.stringify({
                        accountCodes: [bulkAcctCode],
                        action: bulkAction,
                        targetAccount: bulkAction === "transfer" ? bulkTargetAcct : undefined,
                      }),
                    });
                    const d = await r.json();
                    if (d.success) { setSuccessMsg(d.message); fetchLedger(fromDate, toDate); } else setErrorMsg(d.error);
                  } catch { setErrorMsg("خطأ"); }
                  setBulkProcessing(false);
                }}>{bulkProcessing ? "جاري..." : "🧹 تنفيذ"}</button>
              </div>
            </div>
          </details>
        </div>
      )}

      {tab === "adjust" && (
        <div className="inv-form">
          <div className="section-title-row" style={{ marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem" }}>🎯 ضبط أرصدة الخزينة</h3>
            <span style={{ fontSize: "0.78rem", opacity: 0.6 }}>حدد الرصيد الصحيح لكل خزينة — سيتم إنشاء قيد تسوية تلقائي</span>
          </div>
          <div className="entry-fields-grid" style={{ marginBottom: "0.75rem" }}>
            <div className="form-group">
              <label>التاريخ</label>
              <DualCalendarPicker value={adjustDate} onChange={val => setAdjustDate(val)} />
            </div>
            <div className="form-group full-width">
              <label>ملاحظات (اختياري)</label>
              <input type="text" className="form-control" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="" />
            </div>
          </div>
          {cashAccounts.map(a => {
            const current = cumulativeBalances[a.accountCode] || 0;
            const desired = adjustBalances[a.accountCode] !== undefined ? adjustBalances[a.accountCode] : current;
            return (
              <div key={a.accountCode} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--hover-bg)", borderRadius: "var(--radius)", marginBottom: "0.4rem" }}>
                <div style={{ flex: "0 0 180px", fontWeight: 600, fontSize: "0.85rem" }}>{a.accountName}</div>
                <div style={{ flex: "0 0 100px", fontSize: "0.78rem", opacity: 0.7 }}>الرصيد الحالي: <strong style={{ color: current < 0 ? "#ff4444" : "#4caf50" }}>{formatCurrency(current)}</strong></div>
                <div style={{ flex: "0 0 80px", textAlign: "center", fontSize: "0.78rem", opacity: 0.5 }}>→</div>
                <div style={{ flex: "0 0 150px" }}>
                  <input type="number" step="0.01" className="form-control" value={desired} onChange={e => setAdjustBalances(prev => ({ ...prev, [a.accountCode]: parseFloat(e.target.value) || 0 }))} style={{ fontSize: "0.85rem" }} />
                </div>
                <div style={{ fontSize: "0.78rem", opacity: 0.7 }}>
                  {desired !== current && (
                    <span style={{ color: desired > current ? "#4caf50" : "#ff4444" }}>
                      {desired > current ? "+" : ""}{formatCurrency(desired - current)}
                    </span>
                  )}
                  {desired === current && <span style={{ opacity: 0.4 }}>—</span>}
                </div>
              </div>
            );
          })}
          <div className="form-actions" style={{ marginTop: "0.75rem" }}>
            <button className="btn btn-primary" disabled={adjustSubmitting || Object.keys(adjustBalances).length === 0} onClick={async () => {
              setAdjustSubmitting(true);
              try {
                const tk = localStorage.getItem("token");
                const changed = cashAccounts.filter(a => {
                  const desired = adjustBalances[a.accountCode];
                  return desired !== undefined && Math.abs(desired - (cumulativeBalances[a.accountCode] || 0)) > 0.01;
                });
                if (changed.length === 0) { setErrorMsg("لا توجد تغييرات"); setAdjustSubmitting(false); return; }
                let ok = 0;
                for (const a of changed) {
                  const r = await fetch("/api/finance/adjust-balance", {
                    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                    body: JSON.stringify({ cashAccountCode: a.accountCode, correctBalance: adjustBalances[a.accountCode], date: adjustDate, notes: adjustNotes || undefined }),
                  });
                  const d = await r.json();
                  if (d.success) ok++;
                }
                if (ok > 0) { setSuccessMsg(`تم ضبط ${ok} خزينة`); setAdjustBalances({}); fetchLedger(fromDate, toDate); }
                else setErrorMsg("فشل الضبط");
              } catch { setErrorMsg("خطأ"); }
              setAdjustSubmitting(false);
            }}>{adjustSubmitting ? "..." : "💾 تطبيق التسويات"}</button>
          </div>
        </div>
      )}

      {showBookingSearch && (
        <div className="modal-overlay" onClick={() => setShowBookingSearch(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:"560px"}}>
            <div className="modal-header">
              <h2>🔍 ربط القيد بحجز</h2>
              <button className="modal-close" onClick={() => setShowBookingSearch(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
                <div className="form-group" style={{flex:1,minWidth:"180px",marginBottom:0}}>
                  <label style={{fontSize:"0.75rem",marginBottom:"0.25rem"}}>بحث بالاسم أو الرقم أو الجوال</label>
                  <input type="text" className="form-control" placeholder="..."
                    value={bookingSearchTerm}
                    onChange={e => setBookingSearchTerm(e.target.value)}
                    autoFocus />
                </div>
                <div className="form-group" style={{width:"auto",marginBottom:0}}>
                  <label style={{fontSize:"0.75rem",marginBottom:"0.25rem"}}>أو بالتاريخ</label>
                  <DualCalendarPicker value={bookingSearchDate} onChange={val => setBookingSearchDate(val)} />
                </div>
              </div>
              {bookingSearchLoading ? (
                <p className="text-muted" style={{textAlign:"center",padding:"1rem"}}>جاري البحث...</p>
              ) : bookingSearchResults.length === 0 && (bookingSearchTerm || bookingSearchDate) ? (
                <p className="text-muted" style={{textAlign:"center",padding:"1rem"}}>لا توجد نتائج</p>
              ) : bookingSearchResults.length === 0 ? (
                <p className="text-muted" style={{textAlign:"center",padding:"1rem"}}>اكتب للبحث أو اختر تاريخاً</p>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",maxHeight:"320px",overflowY:"auto"}}>
                  {bookingSearchResults.map(b => (
                    <div key={b.bookingId} className="booking-card glass"
                      style={{cursor:"pointer",padding:"0.6rem",border:"1px solid var(--card-border)",borderRadius:"var(--radius)"}}
                      onClick={() => {
                        setLinkedBookingId(b.bookingId);
                        setSelectedBooking(b);
                        setShowBookingSearch(false);
                      }}>
                      <div className="booking-card-header" style={{marginBottom:"0.25rem"}}>
                        <span className="booking-id">{b.bookingId}</span>
                        <span className={`status-badge ${b.status === "ملغي" ? "status-cancelled" : b.status === "مكتمل" ? "status-completed" : b.status === "منتهي" ? "status-expired" : b.status === "قيد الانتظار" ? "status-pending" : "status-active"}`}>{b.status}</span>
                      </div>
                      <h4 style={{margin:"0.15rem 0",fontSize:"0.9rem"}}>{b.customerName}</h4>
                      <p style={{margin:0,fontSize:"0.78rem",opacity:0.7}}>📞 {b.customerPhone}</p>
                      <div style={{display:"flex",gap:"0.75rem",marginTop:"0.25rem",fontSize:"0.72rem",opacity:0.6}}>
                        <span>من {b.startDate || "-"}</span>
                        <span>إلى {b.endDate || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBookingSearch(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal show={!!deleteConfirm} title="🗑️ حذف قيد" message={`حذف قيد رقم ${deleteConfirm?.journalId}؟${(deleteConfirm?.notes || "").includes("🔗تحويلة:") ? "\n⚠️ هذا القيد مرتبط بتحويلة داخلية — سيتم حذف القيدين معًا." : ""}`}
        confirmLabel="نعم" confirmClass="btn btn-danger" onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />
    </section>
  );
}
