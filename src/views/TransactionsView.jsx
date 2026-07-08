"use client";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import DualCalendarPicker from "@/components/DualCalendarPicker";

const CATEGORIES = [
  { key: "expense", label: "🔴 صرف", desc: "دفع نقدي أو تسديد" },
  { key: "income", label: "🟢 تحصيل", desc: "قبض نقدي" },
  { key: "transfer", label: "🔄 تحويل", desc: "تحويل بين الخزائن" },
];

const OP_TYPES = {
  expense: [
    { id: "withdrawal", label: "مسحوبات المالك", icon: "👤", desc: "سحب نقدي من صاحب المؤسسة", debitAuto: "2203", entryType: "expense" },
    { id: "rent", label: "إيجار", icon: "🏢", desc: "إيجار منشأة أو أرض", debitAuto: "5005", entryType: "expense" },
    { id: "salaries", label: "رواتب", icon: "👥", desc: "صرف رواتب الموظفين", debitAuto: "5004", entryType: "expense" },
    { id: "general", label: "مصروف عام", icon: "📋", desc: "اختر حساب المصروف", entryType: "expense" },
  ],
  income: [
    { id: "customer", label: "تحصيل من عميل", icon: "👤", desc: "تسديد ذمم عميل", creditAuto: "1202", entryType: "income" },
    { id: "debtors", label: "قائمة المديونيات", icon: "📋", desc: "عرض وطباعة واتصال" },
  ],
};

const isFixedExpense = (t) => t === "withdrawal" || t === "salaries";
export default function TransactionsView() {
  const { formatCurrency, setSuccessMsg, setErrorMsg, getTodayString, print, userRole } = useApp();
  const [category, setCategory] = useState("expense");
  const [opType, setOpType] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayString?.() || new Date().toLocaleDateString("en-CA"));
  const [cashAccount, setCashAccount] = useState("1101");
  const [expenseAccount, setExpenseAccount] = useState(null);
  const [fromAccount, setFromAccount] = useState("1101");
  const [toAccount, setToAccount] = useState("1102");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [allBookings, setAllBookings] = useState([]);

  // Expense account search
  const [expenseSearch, setExpenseSearch] = useState("");
  const [showExpenseDropdown, setShowExpenseDropdown] = useState(false);

  // Withdrawal sub-account (hierarchical)
  const [wdPath, setWdPath] = useState([{ code: "2203", name: "مسحوبات المالك" }]);
  const [wdAccount, setWdAccount] = useState("2203");

  // Debtor management
  const [debtorSearch, setDebtorSearch] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [debtorPayBooking, setDebtorPayBooking] = useState(null);
  const [debtorPayAmount, setDebtorPayAmount] = useState("");
  const [debtorPayDate, setDebtorPayDate] = useState(getTodayString?.() || new Date().toLocaleDateString("en-CA"));
  const [debtorPaySaving, setDebtorPaySaving] = useState(false);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [msgSending, setMsgSending] = useState(false);
  const msgNote = "نرجو تسديد ما تبقى عندكم. ولكم جزيل الشكر.";
  const composeMsg = (name, amount) => `عزيزي ${name}،\nالمبلغ المتبقي في ذمتكم: ${amount.toLocaleString()} ريال.\n${msgNote}`;

  // Customer booking payment
  const [custPayBooking, setCustPayBooking] = useState(null);
  const [custPayAmount, setCustPayAmount] = useState("");
  const [custPaySaving, setCustPaySaving] = useState(false);

  // Recent transactions log
  const [recentEntries, setRecentEntries] = useState([]);

  // Rent management
  const rentAccounts = useMemo(() => accounts.filter(a => a.parentCode === "5005" && a.isActive !== false), [accounts]);
  const [rentAccountCode, setRentAccountCode] = useState("5005-01");
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [rentPeriodVal, setRentPeriodVal] = useState("");
  const [rentViewMode, setRentViewMode] = useState("دفع");
  const [rentEntries, setRentEntries] = useState([]);
  const [showRentConfig, setShowRentConfig] = useState(false);
  const [rentConfigs, setRentConfigs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rentConfigs") || "{}"); } catch { return {}; }
  });
  const saveRentConfigs = (cfg) => {
    setRentConfigs(cfg);
    localStorage.setItem("rentConfigs", JSON.stringify(cfg));
  };
  const [editConfigAcct, setEditConfigAcct] = useState("5005-01");
  const [editConfigType, setEditConfigType] = useState("ربع سنوي");
  const [editConfigAmount, setEditConfigAmount] = useState("");
  const [editConfigLessorName, setEditConfigLessorName] = useState("");
  const [editConfigLessorPhone, setEditConfigLessorPhone] = useState("");
  const periodTypes = [
    { id: "سنوي", label: "سنوي", values: ["السنة كاملة"] },
    { id: "ثلث سنوي", label: "ثلث سنوي", values: ["الثلث الأول (1-4)", "الثلث الثاني (5-8)", "الثلث الثالث (9-12)"] },
    { id: "ربع سنوي", label: "ربع سنوي", values: ["الربع الأول (1-3)", "الربع الثاني (4-6)", "الربع الثالث (7-9)", "الربع الرابع (10-12)"] },
    { id: "شهري", label: "شهري", values: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] },
  ];
  const currentRentConfig = rentConfigs[rentAccountCode];
  const rentAcct = useMemo(() => accounts.find(a => a.accountCode === rentAccountCode), [accounts, rentAccountCode]);
  const effectiveRentPeriodType = currentRentConfig?.periodType || "ربع سنوي";
  const rentPeriodLabel = currentRentConfig ? `${rentYear} - ${currentRentConfig.periodType} - ${rentPeriodVal}` : "";

  const fetchRecent = async () => {
    try {
      const r = await fetch("/api/finance/ledger?limit=10");
      const d = await r.json();
      if (d.success) setRecentEntries(d.entries || []);
    } catch {}
  };

  useEffect(() => {
    fetchAccounts();
    fetchRecent();
    fetch("/api/bookings?limit=1000").then(r => r.json()).then(d => {
      if (d.success) setAllBookings(d.bookings || []);
    }).catch(() => {});
  }, []);

  const fetchAccounts = async () => {
    try {
      const r = await fetch("/api/finance/accounts?includeInactive=false");
      const d = await r.json();
      if (d.success) setAccounts(d.accounts || []);
    } catch {}
  };

  const cashAccounts = useMemo(() => {
    return accounts.filter(a => a.accountType === "asset" && a.parentCode === "1100").sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }, [accounts]);

  const expenseAccounts = useMemo(() => {
    return accounts.filter(a => a.accountType === "expense" && a.isActive !== false);
  }, [accounts]);

  const wdChildren = (parentCode) => {
    return accounts.filter(a => a.parentCode === parentCode && a.isActive !== false)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  };
  const wdCurrentChildren = useMemo(() => {
    return wdChildren(wdPath[wdPath.length - 1].code);
  }, [accounts, wdPath]);

  const debtorData = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      const remaining = (b.remainingAmount || 0);
      if (remaining <= 0) continue;
      if (b.status !== "مكتمل" && b.status !== "منتهي") continue;
      const key = `${(b.customerName || "").trim()}|${(b.customerPhone || "").trim()}`;
      if (!map[key]) {
        map[key] = { customerName: b.customerName || "", customerPhone: b.customerPhone || "", bookings: [], totalRemaining: 0, totalAmount: 0, totalPaid: 0 };
      }
      map[key].bookings.push(b);
      map[key].totalRemaining += remaining;
      map[key].totalAmount += b.totalAmount || 0;
      map[key].totalPaid += b.paidAmount || 0;
    }
    return Object.values(map).sort((a, b) => b.totalRemaining - a.totalRemaining);
  }, [allBookings]);

  const filteredDebtors = useMemo(() => {
    if (!debtorSearch.trim()) return debtorData;
    const q = debtorSearch.trim().toLowerCase();
    return debtorData.filter(d =>
      d.customerName.toLowerCase().includes(q) ||
      (d.customerPhone || "").includes(q)
    );
  }, [debtorData, debtorSearch]);

  const filteredExpense = useMemo(() => {
    if (!expenseSearch.trim()) return expenseAccounts;
    const q = expenseSearch.trim().toLowerCase();
    return expenseAccounts.filter(a => a.accountName.toLowerCase().includes(q) || a.accountCode.includes(q));
  }, [expenseAccounts, expenseSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.trim().toLowerCase();
    const seen = new Set();
    const unique = [];
    for (const b of allBookings) {
      const key = `${b.customerName}|${b.customerPhone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = (b.customerName || "").toLowerCase();
      const phone = (b.customerPhone || "").toLowerCase();
      if (name.includes(q) || phone.includes(q)) {
        unique.push({ customerName: b.customerName, customerPhone: b.customerPhone });
      }
    }
    return unique.slice(0, 20);
  }, [allBookings, customerSearch]);

  const customerActiveBookings = useMemo(() => {
    if (!selectedCustomer) return [];
    const name = selectedCustomer.customerName;
    const phone = selectedCustomer.customerPhone || "";
    return allBookings.filter(b =>
      b.customerName === name &&
      (b.customerPhone || "") === phone &&
      b.status !== "مكتمل" &&
      b.status !== "ملغي"
    );
  }, [allBookings, selectedCustomer]);

  const operTypes = OP_TYPES[category] || [];

  const selectOpType = (id) => {
    setOpType(id);
    setAmount("");
    setNotes("");
    setExpenseAccount(null);
    setExpenseSearch("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setWdPath([{ code: "2203", name: "مسحوبات المالك" }]);
    setWdAccount("2203");
    setDebtorSearch("");
    setSelectedDebtor(null);
    setDebtorPayAmount("");
    setCustPayBooking(null);
    setCustPayAmount("");
    if (id === "rent") fetchRentEntries();
  };

  const acctName = (code) => {
    const a = accounts.find(a => a.accountCode === code);
    return a ? a.accountName : code;
  };

  const getPreview = () => {
    if (!opType || !amount || parseFloat(amount) <= 0) return null;
    const amt = parseFloat(amount);
    const op = operTypes.find(o => o.id === opType);
    if (!op) return null;

    if (opType === "withdrawal") {
      const wa = accounts.find(a => a.accountCode === wdAccount);
      return { debit: { code: wdAccount, name: wa?.accountName || "مسحوبات المالك" }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "rent") {
      return { debit: { code: rentAccountCode, name: acctName(rentAccountCode) }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "salaries") {
      return { debit: { code: op.debitAuto, name: acctName(op.debitAuto) }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "general") {
      if (!expenseAccount) return null;
      return { debit: { code: expenseAccount.accountCode, name: expenseAccount.accountName }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "customer") {
      return { debit: { code: cashAccount, name: acctName(cashAccount) }, credit: { code: "1202", name: "ذمم مدينة - عملاء" }, amount: amt };
    }
    return null;
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    if (fromAccount === toAccount) { setErrorMsg("لا يمكن التحويل إلى نفس الحساب"); return; }
    setSubmitting(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/finance/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ fromAccount, toAccount, amount: parseFloat(amount), date: entryDate, notes }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`تم التحويل: ${parseFloat(amount).toLocaleString()} ريال`);
        setAmount(""); setNotes(""); fetchRecent();
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleDebtorPayment = async (booking) => {
    if (!debtorPayAmount || parseFloat(debtorPayAmount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    if (!selectedDebtor) return;
    const amt = parseFloat(debtorPayAmount);
    if (amt > (booking.remainingAmount || 0)) { setErrorMsg("المبلغ أكبر من المتبقي"); return; }
    setDebtorPaySaving(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/bookings/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          amount: amt,
          cashAccountCode: cashAccount,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`✅ تم تسجيل ${amt.toLocaleString()} ريال من ${selectedDebtor.customerName}`);
        setDebtorPayAmount("");
        // Refresh bookings
        const res = await fetch("/api/bookings?limit=1000");
        const data = await res.json();
        if (data.success) setAllBookings(data.bookings || []);
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ في الاتصال"); }
    setDebtorPaySaving(false);
  };

  const sendDebtorMsg = (debtor, mode) => {
    const phone = debtor.customerPhone;
    if (!phone) { setErrorMsg("لا يوجد رقم جوال للعميل"); return; }
    const msg = encodeURIComponent(composeMsg(debtor.customerName, debtor.totalRemaining));
    const cleanPhone = phone.replace(/^0+/, "966");
    if (mode === "whatsapp") {
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    } else {
      window.location.href = `sms:${phone}?body=${msg}`;
    }
  };

  const sendBulkMsg = async (mode) => {
    const list = filteredDebtors.filter(d => d.customerPhone);
    if (list.length === 0) { setErrorMsg("لا يوجد عملاء بأرقام جوال"); return; }
    setMsgSending(true);
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const phone = d.customerPhone;
      const msg = encodeURIComponent(composeMsg(d.customerName, d.totalRemaining));
      const cleanPhone = phone.replace(/^0+/, "966");
      if (mode === "whatsapp") {
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
      } else {
        window.open(`sms:${phone}?body=${msg}`, "_self");
      }
      // Small delay between opens
      await new Promise(r => setTimeout(r, 800));
    }
    setMsgSending(false);
    setShowMsgMenu(false);
  };

  const sendFallbackMsg = async () => {
    const list = filteredDebtors.filter(d => d.customerPhone);
    if (list.length === 0) { setErrorMsg("لا يوجد عملاء بأرقام جوال"); return; }
    setMsgSending(true);
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const phone = d.customerPhone;
      const msg = encodeURIComponent(composeMsg(d.customerName, d.totalRemaining));
      const cleanPhone = phone.replace(/^0+/, "966");
      // Try WhatsApp first
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
      await new Promise(r => setTimeout(r, 300));
      // Then SMS
      window.open(`sms:${phone}?body=${msg}`, "_self");
      await new Promise(r => setTimeout(r, 800));
    }
    setMsgSending(false);
    setShowMsgMenu(false);
  };

  const handleCustomerPayment = async (booking) => {
    if (!custPayAmount || parseFloat(custPayAmount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    if (!selectedCustomer) return;
    const amt = parseFloat(custPayAmount);
    if (amt > (booking.remainingAmount || 0)) { setErrorMsg("المبلغ أكبر من المتبقي"); return; }
    setCustPaySaving(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/bookings/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          amount: amt,
          cashAccountCode: cashAccount,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`✅ تم تحصيل ${amt.toLocaleString()} ريال من ${selectedCustomer.customerName}`);
        setCustPayAmount("");
        setNotes("");
        setCustPayBooking(null);
        fetchRecent();
        // Refresh bookings
        const res = await fetch("/api/bookings?limit=1000");
        const data = await res.json();
        if (data.success) setAllBookings(data.bookings || []);
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ في الاتصال"); }
    setCustPaySaving(false);
  };

  const handleEntrySubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    const op = operTypes.find(o => o.id === opType);
    if (!op) return;

    if (opType === "general" && !expenseAccount) { setErrorMsg("اختر حساب المصروف"); return; }

    let accountCode;
    if (opType === "withdrawal") accountCode = wdAccount;
    else if (opType === "rent") accountCode = rentAccountCode;
    else if (opType === "salaries") accountCode = op.debitAuto;
    else accountCode = expenseAccount.accountCode;
    const entryType = op.entryType;

    setSubmitting(true);
    const tk = localStorage.getItem("token");

    const makeEntry = async (entryAmount, periodValOverride) => {
      const pv = periodValOverride || rentPeriodVal;
      const notesStr = opType === "rent" ? `إيجار - ${rentYear} - ${effectiveRentPeriodType} - ${pv} - ${notes}` : notes;
      const r = await fetch("/api/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          date: entryDate,
          accountCode,
          entryType,
          amount: entryAmount,
          cashAccountCode: cashAccount,
          branch: "DHM",
          notes: notesStr,
        }),
      });
      return r.json();
    };

    const doRentSplit = async (totalAmount) => {
      const perPeriod = currentRentConfig?.amountPerPeriod || 0;
      if (perPeriod <= 0) {
        const d = await makeEntry(totalAmount);
        if (!d.success) throw new Error(d.error);
        return d;
      }
      const vals = periodTypes.find(p => p.id === currentRentConfig.periodType)?.values || [];
      const curIdx = vals.indexOf(rentPeriodVal);
      if (curIdx < 0) {
        const d = await makeEntry(totalAmount);
        if (!d.success) throw new Error(d.error);
        return d;
      }

      let remaining = totalAmount;
      let lastResult = null;
      const splitEntries = [];

      for (let i = curIdx; i < vals.length && remaining > 0; i++) {
        const pk = `${rentYear} - ${currentRentConfig.periodType} - ${vals[i]}`;
        const paidSoFar = rentEntries.filter(e => (e.notes || "").includes(pk)).reduce((s, e) => s + (e.amount || 0), 0);
        const need = Math.max(0, perPeriod - paidSoFar);
        if (need <= 0) continue;
        const payNow = Math.min(remaining, need);
        splitEntries.push({ periodVal: vals[i], amount: payNow });
        remaining -= payNow;
      }
      if (remaining > 0 && splitEntries.length > 0) {
        splitEntries[splitEntries.length - 1].amount += remaining;
        remaining = 0;
      }

      for (const se of splitEntries) {
        lastResult = await makeEntry(se.amount, se.periodVal);
        if (!lastResult.success) throw new Error(lastResult.error);
      }
      return lastResult;
    };

    try {
      let d;
      if (opType === "rent" && parseFloat(amount) > 0) {
        d = await doRentSplit(parseFloat(amount));
      } else {
        const r = await fetch("/api/finance/ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            date: entryDate,
            accountCode,
            entryType,
            amount: parseFloat(amount),
            cashAccountCode: cashAccount,
            branch: "DHM",
            notes: opType === "rent" ? `إيجار - ${rentYear} - ${effectiveRentPeriodType} - ${rentPeriodVal} - ${notes}` : notes,
          }),
        });
        d = await r.json();
      }
      if (d.success) {
        setSuccessMsg(`✅ ${op.label}: ${parseFloat(amount).toLocaleString()} ريال`);
        setAmount(""); setNotes(""); setExpenseAccount(null); fetchRecent();
        if (opType === "rent" && (rentAcct?.lessorPhone || currentRentConfig?.lessorPhone)) {
          const phone = rentAcct?.lessorPhone || currentRentConfig?.lessorPhone || "";
          const cleanPhone = phone.replace(/^0+/, "966");
          const msg = encodeURIComponent(`السلام عليكم، تم تسديد دفعة إيجار ${rentPeriodVal} لمبلغ ${parseFloat(amount).toLocaleString()} ريال.`);
          setTimeout(() => window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank"), 500);
        }
        if (opType === "rent") {
          // Refresh entries then auto-advance to next unpaid period
          setTimeout(async () => {
            await fetchRentEntries();
            if (currentRentConfig) {
              const vals = periodTypes.find(p => p.id === currentRentConfig.periodType)?.values || [];
              const curIdx = vals.indexOf(rentPeriodVal);
              if (curIdx >= 0 && curIdx < vals.length - 1) {
                // Check if current period is now fully paid
                const r2 = await fetch(`/api/finance/ledger?accountCode=${rentAccountCode}&limit=200`);
                const d2 = await r2.json();
                const updatedEntries = (d2.entries || []).filter(e => (e.notes || "").includes(rentYear));
                setRentEntries(updatedEntries);
                const curKey = `${rentYear} - ${currentRentConfig.periodType} - ${rentPeriodVal}`;
                const curPaid = updatedEntries.filter(e => (e.notes || "").includes(curKey)).reduce((s, e) => s + (e.amount || 0), 0);
                if (curPaid >= (currentRentConfig.amountPerPeriod || 0)) {
                  for (let i = curIdx + 1; i < vals.length; i++) {
                    const nk = `${rentYear} - ${currentRentConfig.periodType} - ${vals[i]}`;
                    const np = updatedEntries.filter(e => (e.notes || "").includes(nk)).reduce((s, e) => s + (e.amount || 0), 0);
                    if (np < (currentRentConfig.amountPerPeriod || 0)) {
                      setRentPeriodVal(vals[i]);
                      break;
                    }
                  }
                }
              }
            }
          }, 300);
        }
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleSubmit = (e) => {
    if (category === "transfer") return handleTransferSubmit(e);
    return handleEntrySubmit(e);
  };

  const preview = getPreview();
  const currentOp = operTypes.find(o => o.id === opType);

  const fetchRentEntries = async (acctOverride, yearOverride) => {
    try {
      const acct = acctOverride || rentAccountCode;
      const yr = yearOverride || rentYear;
      const r = await fetch(`/api/finance/ledger?accountCode=${acct}&limit=200`);
      const d = await r.json();
      if (d.success) {
        const filtered = (d.entries || []).filter(e => {
          const notes = e.notes || "";
          return notes.includes(yr);
        });
        setRentEntries(filtered);
      }
    } catch {}
  };

  // Auto-select first unpaid period based on current entries
  const getFirstUnpaidPeriod = (entries, config, year) => {
    if (!config) return "";
    const vals = periodTypes.find(p => p.id === config.periodType)?.values || [];
    const target = config.amountPerPeriod || 0;
    for (const v of vals) {
      const key = `${year} - ${config.periodType} - ${v}`;
      const paid = entries.filter(e => (e.notes || "").includes(key)).reduce((s, e) => s + (e.amount || 0), 0);
      if (paid < target) return v;
    }
    return vals[vals.length - 1] || "";
  };

  // Auto-detect unpaid period when entries or account/year/config change
  useEffect(() => {
    const unpaid = getFirstUnpaidPeriod(rentEntries, currentRentConfig, rentYear);
    if (unpaid && unpaid !== rentPeriodVal) setRentPeriodVal(unpaid);
  }, [rentEntries, rentAccountCode, rentYear, currentRentConfig]);

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>💰 العمليات المالية</h2>
      </div>

      {/* Category selector */}
      <div className="tx-category-row">
        {CATEGORIES.map(c => (
          <button key={c.key} className={`tx-cat-btn ${category === c.key ? "active" : ""}`}
            onClick={() => { setCategory(c.key); setOpType(null); }}>
            <span className="tx-cat-icon">{c.label.split(" ")[0]}</span>
            <span className="tx-cat-label">{c.label.split(" ").slice(1).join(" ")}</span>
            <span className="tx-cat-desc">{c.desc}</span>
          </button>
        ))}
      </div>

      {/* Operation type selector */}
      {operTypes.length > 0 && (
        <div className="tx-op-grid">
          {operTypes.map(op => (
            <button key={op.id} className={`tx-op-btn ${opType === op.id ? "active" : ""}`}
              onClick={() => selectOpType(op.id)}>
              <span className="tx-op-icon">{op.icon}</span>
              <span className="tx-op-label">{op.label}</span>
              <span className="tx-op-desc">{op.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      {opType && opType !== "debtors" && category !== "transfer" && (
        <form onSubmit={handleSubmit} className="tx-form">
          {opType === "withdrawal" && (
            <div className="form-group full-width">
              <label>📂 تصنيف المسحوبات</label>
              <div className="tx-wd-tree">
                {/* Breadcrumb */}
                <div className="tx-wd-bc">
                  {wdPath.map((p, i) => (
                    <span key={p.code}>
                      {i > 0 && <span className="tx-wd-bc-sep"> › </span>}
                      <button type="button" className={`tx-wd-bc-btn ${i === wdPath.length - 1 ? "active" : ""}`}
                        onClick={() => {
                          if (i < wdPath.length - 1) {
                            const newPath = wdPath.slice(0, i + 1);
                            setWdPath(newPath);
                            setWdAccount(newPath[i].code);
                          }
                        }}>
                        {p.name}
                      </button>
                    </span>
                  ))}
                </div>
                {/* Current level accounts */}
                {wdCurrentChildren.length > 0 ? (
                  <div className="tx-wd-level">
                    {wdCurrentChildren.map(acct => {
                      const hasKids = accounts.some(a => a.parentCode === acct.accountCode && a.isActive !== false);
                      return (
                        <button key={acct.accountCode} type="button"
                          className={`tx-wd-card ${wdAccount === acct.accountCode ? "active" : ""}`}
                          onClick={() => {
                            if (hasKids) {
                              setWdPath([...wdPath, { code: acct.accountCode, name: acct.accountName }]);
                            }
                            setWdAccount(acct.accountCode);
                          }}>
                          <span className="tx-wd-code">{acct.accountCode}</span>
                          <span className="tx-wd-name">{acct.accountName}</span>
                          {hasKids && <span className="tx-wd-arrow">◀</span>}
                          {wdAccount === acct.accountCode && <span className="tx-wd-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tx-wd-leaf">
                    ✅ تم الاختيار: <strong>{wdPath[wdPath.length - 1].name}</strong> ({wdPath[wdPath.length - 1].code})
                  </div>
                )}
              </div>
            </div>
          )}
          {(isFixedExpense(opType) || opType === "general") && (
            <>
              <div className="tx-form-grid">
                {(opType === "general") && (
                  <div className="form-group">
                    <label>🔴 حساب المصروف <span className="required">*</span></label>
                    <div style={{ position: "relative" }}>
                      <input type="text" className="form-control"
                        placeholder={expenseAccount ? `✅ ${expenseAccount.accountName}` : "ابحث عن حساب مصروف..."}
                        value={expenseAccount ? "" : expenseSearch}
                        onChange={e => { setExpenseSearch(e.target.value); setShowExpenseDropdown(true); if (expenseAccount) setExpenseAccount(null); }}
                        onFocus={() => setShowExpenseDropdown(true)}
                        onBlur={() => setTimeout(() => setShowExpenseDropdown(false), 250)} />
                      {showExpenseDropdown && expenseSearch.trim() && filteredExpense.length > 0 && (
                        <div className="acct-search-dropdown">
                          {filteredExpense.slice(0, 15).map(a => (
                            <div key={a.accountCode} className="acct-search-item expense"
                              onMouseDown={() => { setExpenseAccount(a); setShowExpenseDropdown(false); setExpenseSearch(""); }}>
                              <span className="asi-name">{a.accountName}</span>
                              <span className="asi-code">{a.accountCode}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {showExpenseDropdown && expenseSearch.trim() && filteredExpense.length === 0 && (
                        <div className="acct-search-dropdown">
                          <div className="acct-search-empty">لا توجد نتائج</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(opType === "rent" || opType === "salaries") && (
                  <div className="tx-auto-banner" style={{ gridColumn: "1 / -1" }}>
                    <span>🏦 حساب تلقائي: </span>
                    <strong>{currentOp?.debitAuto} — {acctName(currentOp?.debitAuto)}</strong>
                  </div>
                )}
                <div className="form-group">
                  <label>🏦 الخزينة</label>
                  <select className="form-control" value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
                    {cashAccounts.map(a => (
                      <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>💰 المبلغ <span className="required">*</span></label>
                  <input type="number" step="0.01" min="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
                </div>
                <div className="form-group">
                  <label>📅 التاريخ</label>
                  <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
                </div>
                <div className="form-group full-width">
                  <label>📝 البيان</label>
                  <textarea className="form-control" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder={opType === "withdrawal" ? "سحب شخصي" : "سبب العملية..."} />
                </div>
              </div>
              {/* Journal preview */}
              {preview && (
                <div className="tx-preview">
                  <div className="tx-preview-title">🧾 معاينة القيد</div>
                  <div className="tx-preview-rows">
                    <div className="tx-preview-row debit">
                      <span className="tx-pr-side">مدين</span>
                      <span className="tx-pr-acct">{preview.debit.code} — {preview.debit.name}</span>
                      <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                    </div>
                    <div className="tx-preview-row credit">
                      <span className="tx-pr-side">دائن</span>
                      <span className="tx-pr-acct">{preview.credit.code} — {preview.credit.name}</span>
                      <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="form-actions" style={{ marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !amount || parseFloat(amount) <= 0}>
                  {submitting ? "..." : opType === "withdrawal" ? "👤 تسجيل مسحوبات" : opType === "salaries" ? "👥 تسجيل رواتب" : "🔴 تسجيل مصروف عام"}
                </button>
              </div>
            </>
          )}

          {opType === "rent" && (
            <div className="tx-customer-pay">
              {/* View mode tabs */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className={`btn ${rentViewMode === "دفع" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => { setRentViewMode("دفع"); fetchRentEntries(); }}>💰 دفع إيجار</button>
                <button type="button" className={`btn ${rentViewMode === "كشف" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => { setRentViewMode("كشف"); fetchRentEntries(); }}>📋 كشف الإيجار</button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setEditConfigAcct(rentAccountCode);
                  setEditConfigType(currentRentConfig?.periodType || "ربع سنوي");
                  setEditConfigAmount(currentRentConfig?.amountPerPeriod || "");
                  setEditConfigLessorName(rentAcct?.lessorName || currentRentConfig?.lessorName || "");
                  setEditConfigLessorPhone(rentAcct?.lessorPhone || currentRentConfig?.lessorPhone || "");
                  setShowRentConfig(true);
                }}>⚙️ {currentRentConfig ? "تعديل الإعدادات" : "إعدادات"}</button>
                {currentRentConfig && (
                  <div className="tx-rent-config-info">
                    <span className="tx-rent-config-label">
                      {currentRentConfig.periodType === "سنوي" ? "سنوي" : currentRentConfig.periodType === "ثلث سنوي" ? "ثلث سنوي" : currentRentConfig.periodType === "ربع سنوي" ? "ربع سنوي" : "شهري"}
                      {' | '}{formatCurrency(currentRentConfig.amountPerPeriod)} ريال/الفترة
                      {currentRentConfig.lessorName && <span style={{ marginRight: "0.75rem" }}>| 👤 {currentRentConfig.lessorName}</span>}
                      {currentRentConfig.lessorPhone && <span style={{ marginRight: "0.75rem" }}>| 📞 {currentRentConfig.lessorPhone}</span>}
                    </span>
                  </div>
                )}
              </div>

              {/* Config modal */}
              {showRentConfig && (
                <div className="tx-modal-overlay" onClick={() => setShowRentConfig(false)}>
                  <div className="tx-modal-box" onClick={e => e.stopPropagation()}>
                    <div className="tx-modal-header">
                      <strong>⚙️ إعداد الإيجار — {acctName(editConfigAcct)}</strong>
                      <button type="button" className="tx-modal-close" onClick={() => setShowRentConfig(false)}>✕</button>
                    </div>
                    <div className="tx-modal-body">
                      <div className="form-group">
                        <label>🏢 الحساب</label>
                        <select className="form-control" value={editConfigAcct} onChange={e => setEditConfigAcct(e.target.value)}>
                          {rentAccounts.map(a => (
                            <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <label>📆 نوع الفترة</label>
                        <select className="form-control" value={editConfigType} onChange={e => setEditConfigType(e.target.value)}>
                          {periodTypes.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <label>💰 قيمة الإيجار لكل فترة</label>
                        <input type="number" step="0.01" min="0.01" className="form-control" value={editConfigAmount}
                          onChange={e => setEditConfigAmount(e.target.value)} placeholder="مثلاً: 10000" />
                      </div>
                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <label>👤 اسم المؤجر</label>
                        <input type="text" className="form-control" value={editConfigLessorName}
                          onChange={e => setEditConfigLessorName(e.target.value)} placeholder="اسم صاحب العقار" />
                      </div>
                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <label>📞 رقم جوال المؤجر (واتساب)</label>
                        <input type="text" className="form-control" value={editConfigLessorPhone}
                          onChange={e => setEditConfigLessorPhone(e.target.value)} placeholder="05xxxxxxxx" />
                      </div>
                    </div>
                    <div className="tx-modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowRentConfig(false)}>إلغاء</button>
                      <button type="button" className="btn btn-primary" onClick={async () => {
                        const cfg = { ...rentConfigs };
                        cfg[editConfigAcct] = { periodType: editConfigType, amountPerPeriod: parseFloat(editConfigAmount) || 0 };
                        saveRentConfigs(cfg);
                        // Save lessor info to Google Sheets
                        try {
                          const tk = localStorage.getItem("token");
                          await fetch("/api/finance/accounts", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                            body: JSON.stringify({
                              originalCode: editConfigAcct,
                              lessorName: editConfigLessorName,
                              lessorPhone: editConfigLessorPhone,
                            }),
                          });
                          await fetchAccounts();
                        } catch {}
                        if (editConfigAcct === rentAccountCode) {
                          fetchRentEntries();
                        }
                        setShowRentConfig(false);
                        setSuccessMsg(`✅ تم حفظ إعداد ${acctName(editConfigAcct)}`);
                      }}>💾 حفظ الإعدادات</button>
                    </div>
                  </div>
                </div>
              )}

              {rentViewMode === "دفع" && (
                <>
                  {/* Account/Year selector + period cards */}
                  <div className="tx-form-grid" style={{ marginBottom: "1rem" }}>
                    <div className="form-group">
                      <label>🏢 الحساب</label>
                      <select className="form-control" value={rentAccountCode} onChange={e => { const v = e.target.value; setRentAccountCode(v); fetchRentEntries(v, rentYear); }}>
                        {rentAccounts.map(a => (
                          <option key={a.accountCode} value={a.accountCode}>
                            {a.accountName} ({a.accountCode}){rentConfigs[a.accountCode] ? ` - ${rentConfigs[a.accountCode].amountPerPeriod?.toLocaleString()} ريال/${rentConfigs[a.accountCode].periodType}` : " - بدون إعداد"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>📅 السنة</label>
                      <select className="form-control" value={rentYear} onChange={e => { const v = e.target.value; setRentYear(v); fetchRentEntries(rentAccountCode, v); }}>
                        {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i)).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentRentConfig ? (
                    <>
                      {/* Period progress cards */}
                      <div className="tx-rent-periods">
                        {periodTypes.find(p => p.id === currentRentConfig.periodType)?.values.map((pv, pi) => {
                          const periodKey = `${rentYear} - ${currentRentConfig.periodType} - ${pv}`;
                          const paid = rentEntries.filter(e => (e.notes || "").includes(periodKey)).reduce((s, e) => s + (e.amount || 0), 0);
                          const target = currentRentConfig.amountPerPeriod || 0;
                          const pct = target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0;
                          const isFullyPaid = target > 0 && paid >= target;
                          const isActive = pv === rentPeriodVal;
                          return (
                            <div key={pv} className={`tx-rp-card ${isActive ? "active" : ""} ${isFullyPaid ? "paid" : ""}`}
                              onClick={() => { if (isFullyPaid) return; setRentPeriodVal(pv); }}>
                              <div className="tx-rp-header">
                                <span className="tx-rp-name">{pv}</span>
                                {isFullyPaid && <span className="tx-rp-badge">✅ مدفوع</span>}
                                {isActive && !isFullyPaid && target > 0 && <span className="tx-rp-badge" style={{ background: "rgba(255,193,7,0.2)", color: "#ffc107" }}>الحالي</span>}
                              </div>
                              <div className="tx-rp-bar-wrap">
                                <div className="tx-rp-bar" style={{ width: `${pct}%` }}></div>
                              </div>
                              <div className="tx-rp-footer">
                                <span>مدفوع: {formatCurrency(paid)}</span>
                                <span>المطلوب: {formatCurrency(target)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Payment form for active period */}
                      {!periodTypes.find(p => p.id === currentRentConfig.periodType)?.values.every(pv => {
                        const pk = `${rentYear} - ${currentRentConfig.periodType} - ${pv}`;
                        return rentEntries.filter(e => (e.notes || "").includes(pk)).reduce((s, e) => s + (e.amount || 0), 0) >= (currentRentConfig.amountPerPeriod || 0) && (currentRentConfig.amountPerPeriod || 0) > 0;
                      }) ? (
                        <div className="tx-form" style={{ maxWidth: "100%", marginTop: "1rem" }}>
                          <div className="tx-auto-banner">
                            <span>💳 تسديد: </span>
                            <strong>{rentPeriodLabel}</strong>
                            {currentRentConfig.amountPerPeriod > 0 && (
                              <span style={{ marginRight: "1rem", opacity: 0.7 }}>
                                — المتبقي: {formatCurrency(Math.max(0, currentRentConfig.amountPerPeriod - rentEntries.filter(e => (e.notes || "").includes(rentPeriodLabel)).reduce((s, e) => s + (e.amount || 0), 0)))}
                              </span>
                            )}
                          </div>
                          <div className="tx-form-grid">
                            <div className="form-group">
                              <label>🏦 الخزينة</label>
                              <select className="form-control" value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
                                {cashAccounts.map(a => (
                                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>💰 المبلغ <span className="required">*</span></label>
                              <input type="number" step="0.01" min="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
                            </div>
                            <div className="form-group">
                              <label>📅 التاريخ</label>
                              <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
                            </div>
                            <div className="form-group full-width">
                              <label>📝 البيان</label>
                              <textarea className="form-control" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..." />
                            </div>
                          </div>
                          {preview && (
                            <div className="tx-preview">
                              <div className="tx-preview-title">🧾 معاينة القيد</div>
                              <div className="tx-preview-rows">
                                <div className="tx-preview-row debit">
                                  <span className="tx-pr-side">مدين</span>
                                  <span className="tx-pr-acct">{preview.debit.code} — {preview.debit.name}</span>
                                  <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                                </div>
                                <div className="tx-preview-row credit">
                                  <span className="tx-pr-side">دائن</span>
                                  <span className="tx-pr-acct">{preview.credit.code} — {preview.credit.name}</span>
                                  <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="form-actions" style={{ marginTop: "1rem" }}>
                            <button type="button" className="btn btn-primary btn-lg"
                              onClick={handleEntrySubmit}
                              disabled={submitting || !amount || parseFloat(amount) <= 0}>
                              {submitting ? "..." : `💰 تسديد ${rentPeriodVal}`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="tx-rent-complete">
                          <p>✅ تم إكمال جميع فترات {rentYear} في {acctName(rentAccountCode)} بنجاح.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tx-empty" style={{ padding: "1rem" }}>
                      <p>⚠️ لم يتم إعداد هذا الحساب بعد. اضغط ⚙️ إعدادات لتحديد نوع الفترة وقيمة الإيجار.</p>
                    </div>
                  )}
                </>
              )}

              {rentViewMode === "كشف" && (
                <div className="tx-rent-statement">
                  <div className="tx-form-grid" style={{ marginBottom: "1rem" }}>
                    <div className="form-group">
                      <label>🏢 الحساب</label>
                      <select className="form-control" value={rentAccountCode} onChange={e => { const v = e.target.value; setRentAccountCode(v); fetchRentEntries(v, rentYear); }}>
                        {rentAccounts.map(a => (
                          <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>📅 السنة</label>
                      <select className="form-control" value={rentYear} onChange={e => { const v = e.target.value; setRentYear(v); fetchRentEntries(rentAccountCode, v); }}>
                        {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i)).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>🗓️ الفترة</label>
                      <select className="form-control" value={rentPeriodVal} onChange={e => setRentPeriodVal(e.target.value)}>
                        {(currentRentConfig ? periodTypes.find(p => p.id === currentRentConfig.periodType)?.values : periodTypes[1].values)?.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {rentEntries.length === 0 ? (
                    <div className="tx-empty" style={{ padding: "1rem" }}><p>لا توجد دفعات إيجار لهذا الحساب</p></div>
                  ) : (
                    <>
                      <div style={{ overflowX: "auto" }}>
                        <table className="tx-recent-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center" }}>التاريخ</th>
                              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center" }}>الفترة</th>
                              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center" }}>المبلغ</th>
                              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center" }}>الخزينة</th>
                              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center" }}>البيان</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rentEntries.filter(e => (e.notes || "").includes(rentPeriodVal)).map((e, i) => {
                              const noteParts = (e.notes || "").split(" - ");
                              const noteClean = noteParts.length > 2 ? noteParts.slice(2).join(" - ") : "—";
                              return (
                                <tr key={e.journalId || i}>
                                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center" }}>{e.date || "—"}</td>
                                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem" }}>{rentPeriodVal}</td>
                                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontWeight: 700, color: "#ef4444" }}>{formatCurrency(e.amount)}</td>
                                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem" }}>{acctName(e.cashAccountCode)}</td>
                                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem" }}>{noteClean}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <strong>مدفوع لهذه الفترة: {formatCurrency(rentEntries.filter(e => (e.notes || "").includes(rentPeriodVal)).reduce((s, e) => s + (e.amount || 0), 0))}</strong>
                        <strong>إجمالي {rentYear}: {formatCurrency(rentEntries.reduce((s, e) => s + (e.amount || 0), 0))}</strong>
                      </div>
                      <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
                        <button type="button" className="btn btn-gold" onClick={() => {
                          const periodFiltered = rentEntries.filter(e => (e.notes || "").includes(rentPeriodVal));
                          print("REPORT_TABLE", {
                            title: `📋 كشف إيجار - ${acctName(rentAccountCode)}`,
                            dateHeader: `${rentYear} - ${rentPeriodVal}`,
                            headers: ["التاريخ", "الفترة", "المبلغ", "الخزينة", "البيان"],
                            rows: periodFiltered.map(e => ({
                              cells: [e.date || "—", rentPeriodVal, formatCurrency(e.amount), acctName(e.cashAccountCode), ((e.notes || "").split(" - ").slice(2).join(" - ")) || "—"],
                              type: "expense",
                            })),
                            totalLabels: { expense: `إجمالي ${rentPeriodVal}` },
                            totals: { expense: formatCurrency(periodFiltered.reduce((s, e) => s + (e.amount || 0), 0)) },
                          });
                        }}>🖨️ طباعة كشف الفترة</button>
                        <button type="button" className="btn btn-gold" style={{ marginRight: "0.5rem" }} onClick={() => {
                          print("REPORT_TABLE", {
                            title: `📋 كشف إيجار سنوي - ${acctName(rentAccountCode)}`,
                            dateHeader: rentYear,
                            headers: ["التاريخ", "الفترة", "المبلغ", "الخزينة", "البيان"],
                            rows: rentEntries.map(e => {
                              const noteParts = (e.notes || "").split(" - ");
                              return {
                                cells: [e.date || "—", noteParts[1] || "—", formatCurrency(e.amount), acctName(e.cashAccountCode), (noteParts.slice(2).join(" - ")) || "—"],
                                type: "expense",
                              };
                            }),
                            totalLabels: { expense: `إجمالي الإيجار ${rentYear}` },
                            totals: { expense: formatCurrency(rentEntries.reduce((s, e) => s + (e.amount || 0), 0)) },
                          });
                        }}>🖨️ طباعة الكشف السنوي</button>
                        {(rentAcct?.lessorPhone || currentRentConfig?.lessorPhone) && (
                          <a href={`https://wa.me/${(rentAcct?.lessorPhone || currentRentConfig?.lessorPhone || "").replace(/^0+/, "966")}?text=${encodeURIComponent(`السلام عليكم، كشف إيجار ${acctName(rentAccountCode)} لفترات ${rentYear}`)}`}
                            target="_blank" rel="noopener noreferrer" className="btn btn-success" style={{ textDecoration: "none" }}>
                            📱 إرسال كشف للمؤجر
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {opType === "customer" && (
            <div className="tx-customer-pay">
              {/* Customer search */}
              <div className="form-group">
                <label>👥 العميل <span className="required">*</span></label>
                <div style={{ position: "relative" }}>
                  <input type="text" className="form-control"
                    placeholder={selectedCustomer ? `✅ ${selectedCustomer.customerName}${selectedCustomer.customerPhone ? ` (${selectedCustomer.customerPhone})` : ""}` : "ابحث باسم العميل..."}
                    value={selectedCustomer ? "" : customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (selectedCustomer) { setSelectedCustomer(null); setCustPayBooking(null); } }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 250)} />
                  {showCustomerDropdown && customerSearch.trim() && filteredCustomers.length > 0 && (
                    <div className="acct-search-dropdown">
                      {filteredCustomers.map((c, i) => (
                        <div key={i} className="acct-search-item"
                          onMouseDown={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(""); }}>
                          <span className="asi-name">{c.customerName}</span>
                          {c.customerPhone && <span className="asi-code">{c.customerPhone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && customerSearch.trim() && filteredCustomers.length === 0 && (
                    <div className="acct-search-dropdown">
                      <div className="acct-search-empty">لا توجد نتائج</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer booking details */}
              {selectedCustomer && customerActiveBookings.length > 0 && (
                <div className="tx-cust-books">
                  <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.9rem", color: "var(--foreground)" }}>
                    📋 حجوزات {selectedCustomer.customerName}
                  </h4>
                  <div className="tx-cust-books-grid">
                    {customerActiveBookings.map(b => (
                      <div key={b.bookingId}
                        className={`tx-cust-book-card ${custPayBooking?.bookingId === b.bookingId ? "active" : ""}`}
                        onClick={() => {
                          if ((b.remainingAmount || 0) > 0) {
                            setCustPayBooking(custPayBooking?.bookingId === b.bookingId ? null : b);
                            setCustPayAmount("");
                          }
                        }}>
                        <div className="tx-cb-header">
                          <span className="tx-cb-id">{b.bookingId}</span>
                          <span className={`tx-cb-status status-${b.status === "مؤكد" ? "confirmed" : b.status === "قيد الانتظار" ? "pending" : b.status === "مدفوع" ? "paid" : ""}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="tx-cb-body">
                          <span className="tx-cb-type">{b.bookingType || "—"}</span>
                          <div className="tx-cb-amounts">
                            <span>المتفق عليه: <strong>{formatCurrency(b.totalAmount || 0)}</strong></span>
                            <span className="cb-paid">المُسدّد: <strong>{formatCurrency(b.paidAmount || 0)}</strong></span>
                            <span className="cb-remain">المتبقي: <strong>{formatCurrency(b.remainingAmount || 0)}</strong></span>
                          </div>
                        </div>
                        {/* Payment input when selected */}
                        {custPayBooking?.bookingId === b.bookingId && (b.remainingAmount || 0) > 0 && (
                          <div className="tx-cb-pay" onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ flex: 1, minWidth: 120 }}>
                                <label style={{ fontSize: "0.75rem", opacity: 0.6 }}>المبلغ</label>
                                <input type="number" step="0.01" min="0.01" max={b.remainingAmount}
                                  className="form-control" style={{ fontSize: "0.85rem" }}
                                  value={custPayAmount}
                                  onChange={e => setCustPayAmount(e.target.value)}
                                  placeholder={`أقل من ${formatCurrency(b.remainingAmount)}`} />
                              </div>
                              <div style={{ flex: 1, minWidth: 120 }}>
                                <label style={{ fontSize: "0.75rem", opacity: 0.6 }}>التاريخ</label>
                                <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
                              </div>
                              <div style={{ flex: 1, minWidth: 120 }}>
                                <label style={{ fontSize: "0.75rem", opacity: 0.6 }}>الخزينة</label>
                                <select className="form-control" style={{ fontSize: "0.85rem" }} value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
                                  {cashAccounts.map(a => (
                                    <option key={a.accountCode} value={a.accountCode}>{a.accountName}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div style={{ marginTop: "0.5rem" }}>
                              <label style={{ fontSize: "0.75rem", opacity: 0.6 }}>البيان</label>
                              <textarea className="form-control" rows="1" value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="سبب الدفع..." style={{ fontSize: "0.85rem" }} />
                            </div>
                            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}
                              disabled={custPaySaving || !custPayAmount || parseFloat(custPayAmount) <= 0 || parseFloat(custPayAmount) > (b.remainingAmount || 0)}
                              onClick={async () => {
                                await handleCustomerPayment(b);
                              }}>
                              {custPaySaving ? "..." : "💰 تأكيد الدفع"}
                            </button>
                            {custPayAmount && parseFloat(custPayAmount) > 0 && parseFloat(custPayAmount) > (b.remainingAmount || 0) && (
                              <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>⚠️ المبلغ أكبر من المتبقي</p>
                            )}
                          </div>
                        )}
                        {(b.remainingAmount || 0) <= 0 && (
                          <div className="tx-cb-paid-badge">✅ مدفوع بالكامل</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedCustomer && customerActiveBookings.length === 0 && (
                <div className="tx-empty" style={{ padding: "1rem" }}>
                  <p>لا توجد حجوزات نشطة لهذا العميل</p>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {/* Transfer form */}
      {category === "transfer" && (
        <form onSubmit={handleTransferSubmit} className="tx-form">
          <div className="tx-form-grid">
            <div className="form-group">
              <label>من خزينة</label>
              <select className="form-control" value={fromAccount} onChange={e => setFromAccount(e.target.value)}>
                {cashAccounts.map(a => (
                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>إلى خزينة</label>
              <select className="form-control" value={toAccount} onChange={e => setToAccount(e.target.value)}>
                {cashAccounts.map(a => (
                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>💰 المبلغ <span className="required">*</span></label>
              <input type="number" step="0.01" min="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label>📅 التاريخ</label>
              <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
            </div>
            <div className="form-group full-width">
              <label>📝 البيان</label>
              <textarea className="form-control" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="سبب التحويل..." />
            </div>
          </div>

          {parseFloat(amount) > 0 && (
            <div className="tx-preview">
              <div className="tx-preview-title">🧾 معاينة القيد</div>
              <div className="tx-preview-rows">
                <div className="tx-preview-row debit">
                  <span className="tx-pr-side">مدين</span>
                  <span className="tx-pr-acct">{toAccount} — {acctName(toAccount)}</span>
                  <span className="tx-pr-amt">{formatCurrency(parseFloat(amount))}</span>
                </div>
                <div className="tx-preview-row credit">
                  <span className="tx-pr-side">دائن</span>
                  <span className="tx-pr-acct">{fromAccount} — {acctName(fromAccount)}</span>
                  <span className="tx-pr-amt">{formatCurrency(parseFloat(amount))}</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-gold" disabled={submitting || !amount || parseFloat(amount) <= 0 || fromAccount === toAccount}>
              {submitting ? "..." : "🔄 تنفيذ التحويل"}
            </button>
          </div>
        </form>
      )}

      {/* Debtor dashboard */}
      {opType === "debtors" && (
        <div className="tx-debtors-dash">
          {/* Summary cards */}
          <div className="tx-debtors-summary">
            <div className="tx-debtor-stat">
              <span className="tx-ds-label">إجمالي المديونيات</span>
              <span className="tx-ds-val">{formatCurrency(debtorData.reduce((s, d) => s + d.totalRemaining, 0))}</span>
            </div>
            <div className="tx-debtor-stat">
              <span className="tx-ds-label">عدد العملاء</span>
              <span className="tx-ds-val">{debtorData.length}</span>
            </div>
            <div className="tx-debtor-stat">
              <span className="tx-ds-label">إجمالي المستحق</span>
              <span className="tx-ds-val">{formatCurrency(debtorData.reduce((s, d) => s + d.totalAmount, 0))}</span>
            </div>
          </div>

          {/* Search + actions */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" className="form-control" style={{ maxWidth: 350, flex: 1, minWidth: 200 }}
              placeholder="🔍 ابحث باسم العميل أو رقم الجوال..."
              value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)} />
            <div style={{ position: "relative" }}>
              <button type="button" className="btn btn-gold" onClick={() => setShowMsgMenu(!showMsgMenu)} disabled={msgSending}>
                {msgSending ? "جاري الإرسال..." : "📨 مراسلة"}
              </button>
              {showMsgMenu && (
                <div className="tx-msg-dropdown" onMouseLeave={() => setShowMsgMenu(false)}>
                  <button type="button" className="tx-msg-opt"
                    onClick={() => { setShowMsgMenu(false); sendBulkMsg("whatsapp"); }}>
                    📱 واتساب للجميع
                  </button>
                  <button type="button" className="tx-msg-opt"
                    onClick={() => { setShowMsgMenu(false); sendBulkMsg("sms"); }}>
                    💬 SMS للجميع
                  </button>
                  <button type="button" className="tx-msg-opt"
                    onClick={() => { setShowMsgMenu(false); sendFallbackMsg(); }}>
                    🔁 واتساب + SMS (محاولة)
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-gold" onClick={() => {
              if (filteredDebtors.length === 0) { setErrorMsg("لا توجد بيانات للطباعة"); return; }
              print("REPORT_TABLE", {
                title: "📋 تقرير المديونيات",
                dateHeader: new Date().toLocaleDateString("en-CA"),
                headers: ["#", "العميل", "الجوال", "الإجمالي", "المدفوع", "المتبقي"],
                rows: filteredDebtors.map((d, i) => ({
                  cells: [String(i + 1), d.customerName || "—", d.customerPhone || "—", formatCurrency(d.totalAmount), formatCurrency(d.totalPaid), formatCurrency(d.totalRemaining)],
                  type: "liability",
                })),
                totalLabels: { liability: "إجمالي المديونيات" },
                totals: {
                  liability: formatCurrency(filteredDebtors.reduce((s, d) => s + d.totalRemaining, 0)),
                },
              });
            }}>🖨️ طباعة</button>
          </div>

          {/* Table */}
          {filteredDebtors.length === 0 ? (
            <div className="tx-empty"><p>✨ لا توجد مديونيات</p></div>
          ) : (
            <div className="tx-debtors-table-wrap">
              <table className="tx-debtors-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العميل</th>
                    <th>الجوال</th>
                    <th>الإجمالي</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebtors.map((d, idx) => (
                    <tr key={idx}
                      className={selectedDebtor === d ? "tx-dr-active" : ""}
                      onClick={() => setSelectedDebtor(selectedDebtor === d ? null : d)}>
                      <td>{idx + 1}</td>
                      <td><strong>{d.customerName || "—"}</strong></td>
                      <td dir="ltr">
                        {d.customerPhone ? (
                          <a href={`tel:${d.customerPhone}`} style={{ color: "inherit", textDecoration: "none", direction: "ltr", display: "inline-block" }}>{d.customerPhone}</a>
                        ) : "—"}
                      </td>
                      <td>{formatCurrency(d.totalAmount)}</td>
                      <td className="tx-ds-paid">{formatCurrency(d.totalPaid)}</td>
                      <td className="tx-ds-remain">{formatCurrency(d.totalRemaining)}</td>
                      <td className="tx-dr-actions" onClick={e => e.stopPropagation()}>
                        {d.customerPhone && (
                          <>
                            <a href={`https://wa.me/${d.customerPhone.replace(/^0+/, "966")}?text=${encodeURIComponent(composeMsg(d.customerName, d.totalRemaining))}`}
                              target="_blank" rel="noopener noreferrer"
                              className="tx-debtor-wa" title="واتساب">📱</a>
                            <a href={`sms:${d.customerPhone}?body=${encodeURIComponent(composeMsg(d.customerName, d.totalRemaining))}`}
                              className="tx-debtor-wa" title="SMS">💬</a>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Expanded bookings per selected debtor */}
              {selectedDebtor && (
                <div className="tx-debtor-detail">
                  <div className="tx-dd-header">
                    <strong>{selectedDebtor.customerName}</strong>
                    <span>المتبقي: {formatCurrency(selectedDebtor.totalRemaining)}</span>
                    {selectedDebtor.customerPhone && (
                      <>
                        <a href={`https://wa.me/${selectedDebtor.customerPhone.replace(/^0+/, "966")}?text=${encodeURIComponent(composeMsg(selectedDebtor.customerName, selectedDebtor.totalRemaining))}`}
                          target="_blank" rel="noopener noreferrer" className="tx-debtor-wa">📱 واتساب</a>
                        <a href={`sms:${selectedDebtor.customerPhone}?body=${encodeURIComponent(composeMsg(selectedDebtor.customerName, selectedDebtor.totalRemaining))}`}
                          className="tx-debtor-wa">💬 SMS</a>
                      </>
                    )}
                  </div>
                  <table className="tx-debtor-bks">
                    <thead>
                      <tr>
                        <th>الحجز</th>
                        <th>التاريخ</th>
                        <th>المبلغ</th>
                        <th>المتبقي</th>
                        <th>تسديد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDebtor.bookings.map(b => (
                        <tr key={b.bookingId}>
                          <td>{b.bookingId}</td>
                          <td>{b.startDate || "—"}</td>
                          <td>{formatCurrency(b.totalAmount || 0)}</td>
                          <td className="tx-ds-remain">{formatCurrency(b.remainingAmount || 0)}</td>
                          <td>
                            <button type="button" className="btn btn-sm btn-primary"
                              onClick={() => {
                                setDebtorPayBooking(b);
                                setDebtorPayAmount("");
                                setDebtorPayDate(getTodayString?.() || new Date().toLocaleDateString("en-CA"));
                              }}>💰</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payment modal for debtor */}
      {debtorPayBooking && (
        <div className="tx-modal-overlay" onClick={() => setDebtorPayBooking(null)}>
          <div className="tx-modal-box" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-header">
              <strong>💰 تسديد {selectedDebtor?.customerName || debtorPayBooking.customerName}</strong>
              <button type="button" className="tx-modal-close" onClick={() => setDebtorPayBooking(null)}>✕</button>
            </div>
            <div className="tx-modal-body">
              <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "0.75rem" }}>
                الحجز: {debtorPayBooking.bookingId} — المتبقي: {formatCurrency(debtorPayBooking.remainingAmount || 0)}
              </p>
              <div className="form-group">
                <label>📅 التاريخ</label>
                <DualCalendarPicker value={debtorPayDate} onChange={val => setDebtorPayDate(val)} />
              </div>
              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label>💰 المبلغ</label>
                <input type="number" step="0.01" min="0.01" className="form-control" value={debtorPayAmount}
                  onChange={e => setDebtorPayAmount(e.target.value)} placeholder="أدخل المبلغ" />
              </div>
            </div>
            <div className="tx-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDebtorPayBooking(null)}>إلغاء</button>
              <button type="button" className="btn btn-primary"
                disabled={debtorPaySaving || !debtorPayAmount || parseFloat(debtorPayAmount) <= 0}
                onClick={async () => {
                  await handleDebtorPayment(debtorPayBooking);
                  setDebtorPayBooking(null);
                }}>
                {debtorPaySaving ? "..." : "تأكيد الدفع"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {recentEntries.length > 0 && (
        <div className="tx-recent" style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--foreground)" }}>📋 سجل آخر العمليات</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="tx-recent-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>التاريخ</th>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>الحساب</th>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>النوع</th>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>المبلغ</th>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>البيان</th>
                  <th style={{ padding: "0.4rem 0.5rem", borderBottom: "2px solid var(--card-border)", textAlign: "center", fontWeight: 600 }}>الخزينة</th>
                </tr>
              </thead>
              <tbody>
                {[...recentEntries].reverse().map((e, i) => (
                  <tr key={e.journalId || i}>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center" }}>{e.date || "—"}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem" }}>{acctName(e.accountCode)} ({e.accountCode})</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center" }}>
                      <span style={{
                        padding: "0.15rem 0.4rem", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600,
                        background: e.entryType === "income" ? "rgba(34,197,94,0.2)" : e.entryType === "expense" ? "rgba(239,68,68,0.2)" : "rgba(255,193,7,0.2)",
                        color: e.entryType === "income" ? "#22c55e" : e.entryType === "expense" ? "#ef4444" : "#ffc107",
                      }}>
                        {e.entryType === "income" ? "ايراد" : e.entryType === "expense" ? "مصروف" : e.entryType === "liability" ? "مطلوبات" : e.entryType === "transfer" ? "تحويل" : e.entryType}
                      </span>
                    </td>
                    <td style={{
                      padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontWeight: 700,
                      color: e.entryType === "income" ? "#22c55e" : e.entryType === "expense" ? "#ef4444" : "inherit",
                    }}>{formatCurrency(e.amount)}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--card-border)", textAlign: "center", fontSize: "0.75rem" }}>{acctName(e.cashAccountCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!opType && (
        <div className="tx-empty">
          <p>👈 اختر نوع العملية أعلاه للبدء</p>
        </div>
      )}

      <style jsx>{`
        .tx-category-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .tx-cat-btn {
          flex: 1;
          min-width: 120px;
          padding: 0.75rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          color: var(--foreground);
        }
        .tx-cat-btn.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-cat-btn:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-cat-icon { font-size: 1.5rem; }
        .tx-cat-label { font-weight: 700; font-size: 0.95rem; }
        .tx-cat-desc { font-size: 0.7rem; opacity: 0.6; }
        .tx-op-grid {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .tx-op-btn {
          padding: 0.6rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          flex: 1;
          min-width: 140px;
          color: var(--foreground);
        }
        .tx-op-btn.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-op-btn:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-op-icon { font-size: 1.3rem; display: block; }
        .tx-op-label { font-weight: 600; font-size: 0.85rem; display: block; margin-top: 0.15rem; }
        .tx-op-desc { font-size: 0.68rem; opacity: 0.5; display: block; }
        .tx-form { max-width: 600px; margin: 0 auto; }
        .tx-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .tx-form-grid .full-width { grid-column: 1 / -1; }
        .tx-auto-banner {
          padding: 0.5rem 0.75rem;
          background: rgba(212, 168, 67, 0.1);
          border: 1px solid rgba(212, 168, 67, 0.2);
          border-radius: var(--radius);
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
          text-align: center;
          color: var(--foreground);
        }
        .tx-preview {
          margin-top: 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .tx-preview-title {
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
          color: var(--foreground);
        }
        .tx-preview-rows { padding: 0.5rem 0.75rem; }
        .tx-preview-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0;
          font-size: 0.85rem;
          color: var(--foreground);
        }
        .tx-pr-side {
          display: inline-block;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          min-width: 40px;
          text-align: center;
        }
        .tx-preview-row.debit .tx-pr-side { background: rgba(233, 69, 96, 0.2); color: #ef4444; }
        .tx-preview-row.credit .tx-pr-side { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .tx-pr-acct { flex: 1; color: var(--foreground); }
        .tx-pr-amt { font-weight: 700; direction: ltr; text-align: left; min-width: 80px; color: var(--foreground); }
        .tx-wd-tree {
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .tx-wd-bc {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
          flex-wrap: wrap;
          font-size: 0.85rem;
        }
        .tx-wd-bc-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: var(--foreground);
          opacity: 0.6;
        }
        .tx-wd-bc-btn:hover { opacity: 1; background: var(--hover-bg); }
        .tx-wd-bc-btn.active { opacity: 1; font-weight: 700; color: var(--gold); }
        .tx-wd-bc-sep { opacity: 0.3; margin: 0 0.15rem; color: var(--foreground); }
        .tx-wd-level {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.5rem;
          padding: 0.75rem;
        }
        .tx-wd-card {
          position: relative;
          padding: 0.6rem 0.75rem;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          color: var(--foreground);
        }
        .tx-wd-card:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-wd-card.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-wd-code { font-size: 0.7rem; opacity: 0.5; color: var(--foreground); }
        .tx-wd-name { font-weight: 600; font-size: 0.85rem; color: var(--foreground); }
        .tx-wd-arrow {
          position: absolute;
          left: 0.4rem;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.3;
          font-size: 0.8rem;
          color: var(--foreground);
        }
        .tx-wd-check {
          position: absolute;
          right: 0.4rem;
          top: 0.3rem;
          font-size: 0.8rem;
        }
        .tx-wd-leaf {
          padding: 1rem;
          text-align: center;
          font-size: 0.9rem;
        }
        .tx-empty {
          text-align: center;
          padding: 2rem;
          opacity: 0.5;
        }
        .tx-debtors-dash { max-width: 100%; }
        .tx-debtors-summary {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .tx-debtor-stat {
          flex: 1;
          min-width: 140px;
          padding: 0.75rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          text-align: center;
        }
        .tx-ds-label { display: block; font-size: 0.75rem; opacity: 0.6; margin-bottom: 0.25rem; }
        .tx-ds-val { display: block; font-size: 1.25rem; font-weight: 700; }
        .tx-debtors-table-wrap { overflow-x: auto; }
        .tx-debtors-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .tx-debtors-table th {
          padding: 0.5rem 0.6rem;
          text-align: center;
          border-bottom: 2px solid var(--card-border);
          font-weight: 600;
          white-space: nowrap;
          color: var(--foreground);
        }
        .tx-debtors-table td {
          padding: 0.5rem 0.6rem;
          text-align: center;
          border-bottom: 1px solid var(--card-border);
          color: var(--foreground);
        }
        .tx-debtors-table tr:hover td { background: var(--hover-bg); }
        .tx-debtors-table tr.tx-dr-active td { background: rgba(212,168,67,0.08); }
        .tx-ds-paid { color: #22c55e; }
        .tx-ds-remain { color: #ef4444; font-weight: 700; }
        .tx-dr-actions { white-space: nowrap; }
        .tx-debtor-wa {
          text-decoration: none;
          font-size: 1.1rem;
          cursor: pointer;
          padding: 0.25rem 0.4rem;
          border-radius: 4px;
          display: inline-block;
        }
        .tx-debtor-wa:hover { background: rgba(255,255,255,0.1); }
        .tx-msg-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          z-index: 100;
          min-width: 200px;
          overflow: hidden;
        }
        .tx-msg-opt {
          display: block;
          width: 100%;
          padding: 0.6rem 1rem;
          border: none;
          background: none;
          color: var(--foreground);
          text-align: right;
          font-size: 0.85rem;
          cursor: pointer;
          border-bottom: 1px solid var(--card-border);
        }
        .tx-msg-opt:last-child { border-bottom: none; }
        .tx-msg-opt:hover { background: var(--hover-bg); }
        .tx-debtor-detail {
          margin-top: 0.75rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .tx-dd-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.6rem 0.75rem;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
          font-size: 0.9rem;
          flex-wrap: wrap;
        }
        .tx-debtor-bks { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .tx-debtor-bks th {
          padding: 0.4rem 0.6rem;
          border-bottom: 1px solid var(--card-border);
          font-weight: 600;
          text-align: center;
          color: var(--foreground);
        }
        .tx-debtor-bks td {
          padding: 0.4rem 0.6rem;
          text-align: center;
          border-bottom: 1px solid var(--card-border);
          color: var(--foreground);
        }
        .tx-debtor-bks tr:last-child td { border-bottom: none; }
        .tx-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .tx-modal-box {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          width: 90%;
          max-width: 420px;
          color: var(--foreground);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .tx-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--card-border);
        }
        .tx-modal-close {
          background: none;
          border: none;
          color: var(--foreground);
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.6;
        }
        .tx-modal-close:hover { opacity: 1; }
        .tx-modal-body { padding: 1rem; }
        .tx-modal-footer {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          padding: 0.75rem 1rem;
          border-top: 1px solid var(--card-border);
        }
        .tx-customer-pay { max-width: 700px; margin: 0 auto; }
        .tx-cust-books-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .tx-cust-book-card {
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tx-cust-book-card:hover { border-color: var(--gold); }
        .tx-cust-book-card.active { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .tx-cb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--card-border);
          background: rgba(0,0,0,0.15);
        }
        .tx-cb-id { font-weight: 700; font-size: 0.85rem; color: var(--foreground); }
        .tx-cb-status {
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .status-confirmed { background: rgba(34,197,94,0.2); color: #22c55e; }
        .status-pending { background: rgba(255,193,7,0.2); color: #ffc107; }
        .status-paid { background: rgba(13,202,240,0.2); color: #0dcaf0; }
        .tx-cb-body { padding: 0.5rem 0.75rem; }
        .tx-cb-type { font-size: 0.8rem; opacity: 0.6; display: block; margin-bottom: 0.25rem; color: var(--foreground); }
        .tx-cb-amounts {
          display: flex;
          gap: 0.75rem;
          font-size: 0.8rem;
          flex-wrap: wrap;
          color: var(--foreground);
        }
        .tx-cb-amounts .cb-paid { color: #22c55e; }
        .tx-cb-amounts .cb-remain { color: #ef4444; }
        .tx-cb-pay {
          padding: 0.5rem 0.75rem;
          border-top: 1px solid var(--card-border);
          background: rgba(255,255,255,0.03);
        }
        .tx-cb-paid-badge {
          padding: 0.4rem 0.75rem;
          text-align: center;
          font-size: 0.8rem;
          color: #22c55e;
          border-top: 1px solid var(--card-border);
        }
        .tx-rent-periods {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.6rem;
          margin-bottom: 1rem;
        }
        .tx-rp-card {
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          padding: 0.6rem 0.75rem;
          background: var(--hover-bg);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tx-rp-card:hover { border-color: var(--gold); }
        .tx-rp-card.active { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        .tx-rp-card.paid { opacity: 0.6; cursor: default; border-color: #22c55e; }
        .tx-rp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.4rem;
        }
        .tx-rp-name { font-weight: 600; font-size: 0.8rem; color: var(--foreground); }
        .tx-rp-badge { font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600; background: rgba(34,197,94,0.2); color: #22c55e; }
        .tx-rp-bar-wrap {
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.35rem;
        }
        .tx-rp-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--gold), #d4a843);
          border-radius: 3px;
          transition: width 0.3s;
        }
        .tx-rp-card.paid .tx-rp-bar { background: linear-gradient(90deg, #22c55e, #16a34a); }
        .tx-rp-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.68rem;
          color: var(--foreground);
          opacity: 0.7;
        }
        .tx-rent-complete {
          text-align: center;
          padding: 2rem;
          border: 2px solid #22c55e;
          border-radius: var(--radius);
          background: rgba(34,197,94,0.05);
          color: #22c55e;
          font-size: 1rem;
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}
