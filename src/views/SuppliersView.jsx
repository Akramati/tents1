"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "@/contexts/AppContext";

export default function SuppliersView() {
  const { print, setView, setPaymentRedirect, setErrorMsg, setSuccessMsg, userRole } = useApp();
  const fileInputRef = useRef(null);

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ supplierName: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [payNotes, setPayNotes] = useState("");
  const [payPurchaseId, setPayPurchaseId] = useState("");
  const [payCashAccountCode, setPayCashAccountCode] = useState("1101");
  const [payCostCenter, setPayCostCenter] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ description: "", totalAmount: "", notes: "", date: "", costCenter: "", accountCode: "" });
  const [purchaseImage, setPurchaseImage] = useState(null);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deletePurchConfirm, setDeletePurchConfirm] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [openPurchases, setOpenPurchases] = useState([]);
  const [carryPurchases, setCarryPurchases] = useState([]);

  // Customer receivables state
  const [activeTab, setActiveTab] = useState("suppliers");
  const [allBookings, setAllBookings] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Lookup account name from code (recursive through hierarchy)
  const getAccountName = useMemo(() => (code) => {
    if (!code || !accounts.length) return code || "-";
    const find = (list) => {
      for (const ac of list) {
        if (ac.accountCode === code) return ac.accountName;
        if (ac.children) { const r = find(ac.children); if (r) return r; }
      }
      return null;
    };
    return find(accounts) || code;
  }, [accounts]);

  const formatPaymentParty = useMemo(() => (code) => {
    if (!code) return "-";
    if (code === "2101") return "موردون (ذمم دائنة)";
    return getAccountName(code);
  }, [getAccountName]);

  useEffect(() => {
    fetch("/api/finance/cost-centers").then(r => r.json()).then(d => { if (d.success) setCostCenters(d.centers); }).catch(() => {});
    fetch("/api/finance/accounts").then(r => r.json()).then(d => { if (d.success) setAccounts(d.accounts || []); }).catch(() => {});
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/suppliers");
      const data = await res.json();
      if (data.success) setSuppliers(data.suppliers || []);
    } catch { setErrorMsg("فشل تحميل الموردين"); }
    setLoading(false);
  };

  const fetchTransactions = async (supplierId) => {
    try {
      const res = await fetch(`/api/finance/suppliers/transactions?supplierId=${supplierId}`);
      const data = await res.json();
      if (data.success) setTransactions(data.transactions || []);
    } catch {}
  };

  const fetchPurchases = async (supplierId) => {
    try {
      const res = await fetch(`/api/finance/suppliers/purchases?supplierId=${supplierId}`);
      const data = await res.json();
      if (data.success) setPurchases(data.purchases || []);
    } catch {}
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ supplierName: "", phone: "", address: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditId(s.supplierId);
    setForm({ supplierName: s.supplierName, phone: s.phone, address: s.address, notes: s.notes });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.supplierName.trim()) { setErrorMsg("اسم المورد مطلوب"); return; }
    setSaving(true);
    try {
      const tk = localStorage.getItem("token");
      const url = "/api/finance/suppliers";
      const method = editId ? "PUT" : "POST";
      const body = editId ? { ...form, supplierId: editId } : form;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editId ? "تم تحديث المورد" : "تم إضافة المورد");
        setShowForm(false);
        fetchSuppliers();
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل الحفظ"); }
    setSaving(false);
  };

  const handleDelete = async (supplierId) => {
    setSaving(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch(`/api/finance/suppliers?supplierId=${supplierId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${tk}` },
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setShowDeleteConfirm(null);
        if (selectedSupplier?.supplierId === supplierId) setSelectedSupplier(null);
        fetchSuppliers();
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل الحذف"); }
    setSaving(false);
  };

  const handleDeletePurchase = async (purchaseId) => {
    setSaving(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch(`/api/finance/suppliers/purchases?purchaseId=${purchaseId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${tk}` },
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setDeletePurchConfirm(null);
        fetchPurchases(selectedSupplier.supplierId);
        fetchTransactions(selectedSupplier.supplierId);
        fetchSuppliers();
        if (selectedSupplier) {
          const sup = suppliers.find(s => s.supplierId === selectedSupplier.supplierId);
          if (sup) setSelectedSupplier(prev => ({ ...prev, balance: sup.balance }));
        }
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل الإلغاء"); }
    setSaving(false);
  };

  const viewSupplier = (s) => {
    setSelectedSupplier(s);
    fetchTransactions(s.supplierId);
    fetchPurchases(s.supplierId);
  };

  const backToList = () => {
    setSelectedSupplier(null);
    setTransactions([]);
    setPurchases([]);
  };

  const openPayModal = (s, purchase) => {
    setPayModal(s);
    setPayAmount("");
    setPayDate(new Date().toLocaleDateString("en-CA"));
    setPayNotes("");
    setPayPurchaseId(purchase?.purchaseId || "");
    setPayCostCenter("");
    setPayCashAccountCode("1101");
  };

  const handleImageUpload = async (file) => {
    if (!file) return "";
    const formData = new FormData();
    formData.append("file", file);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/upload", {
        method: "POST", headers: { Authorization: `Bearer ${tk}` }, body: formData,
      });
      const data = await res.json();
      return data.url || "";
    } catch { return ""; }
  };

  const handlePurchaseSave = async () => {
    if (!purchaseForm.description.trim() || !parseFloat(purchaseForm.totalAmount)) {
      setErrorMsg("الوصف والمبلغ مطلوبان"); return;
    }
    if (!purchaseForm.costCenter) {
      setErrorMsg("مركز التكلفة مطلوب"); return;
    }
    setPurchaseSaving(true);
    try {
      let imageUrl = "";
      if (purchaseImage) {
        imageUrl = await handleImageUpload(purchaseImage);
      }
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/finance/suppliers/purchases", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          supplierId: selectedSupplier.supplierId,
          description: purchaseForm.description,
          totalAmount: parseFloat(purchaseForm.totalAmount),
          notes: purchaseForm.notes,
          date: purchaseForm.date || undefined,
          costCenter: purchaseForm.costCenter,
          imageUrl: imageUrl || undefined,
          accountCode: purchaseForm.accountCode || undefined,
          carryFrom: carryPurchases.length > 0 ? carryPurchases : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setShowPurchaseForm(false);
        setPurchaseForm({ description: "", totalAmount: "", notes: "", date: "", costCenter: "", accountCode: "" });
        setPurchaseImage(null);

        // Send WhatsApp to supplier
        const supplier = suppliers.find(s => s.supplierId === selectedSupplier.supplierId);
        if (supplier?.phone) {
          const msg = encodeURIComponent(
            `شركة التعزي للمناسبات والتأجير\n` +
            `فاتورة توريد جديدة\n` +
            `الرقم: ${data.purchaseId}\n` +
            `البيان: ${purchaseForm.description}\n` +
            `المبلغ: ${parseFloat(purchaseForm.totalAmount).toLocaleString()} ر.ي\n` +
            `التاريخ: ${purchaseForm.date || new Date().toLocaleDateString("en-CA")}\n` +
            `مركز التكلفة: ${purchaseForm.costCenter}`
          );
          window.open(`https://wa.me/${supplier.phone.replace(/^0+/, "967")}?text=${msg}`, "_blank");
        }

        fetchSuppliers();
        fetchPurchases(selectedSupplier.supplierId);
        fetchTransactions(selectedSupplier.supplierId);
        if (selectedSupplier) {
          const sup = suppliers.find(s => s.supplierId === selectedSupplier.supplierId);
          if (sup) setSelectedSupplier(prev => ({ ...prev, balance: sup.balance + parseFloat(purchaseForm.totalAmount) }));
        }
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل التسجيل"); }
    setPurchaseSaving(false);
  };

  const handlePay = async () => {
    if (!payModal || !parseFloat(payAmount) || parseFloat(payAmount) <= 0) {
      setErrorMsg("أدخل مبلغ الدفع"); return;
    }
    setPaySaving(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/finance/suppliers/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                body: JSON.stringify({
                    supplierId: payModal.supplierId,
                    amount: parseFloat(payAmount),
                    date: payDate,
                    notes: payNotes,
          accountCode: "2101",
          cashAccountCode: payCashAccountCode,
          costCenter: payCostCenter,
          purchaseId: payPurchaseId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم تسديد ${parseFloat(payAmount)} ريال للمورد ${payModal.supplierName}`);
        const amt = parseFloat(payAmount);

        // Send WhatsApp to supplier
        if (payModal.phone) {
          const purchaseInfo = payPurchaseId
            ? `\nفاتورة: ${payPurchaseId}`
            : "";
          const msg = encodeURIComponent(
            `شركة التعزي للمناسبات والتأجير\n` +
            `إشعار تسديد\n` +
            `المورد: ${payModal.supplierName}\n` +
            `المبلغ: ${amt.toLocaleString()} ر.ي${purchaseInfo}\n` +
            `${payNotes ? `البيان: ${payNotes}\n` : ""}` +
            `التاريخ: ${new Date().toLocaleDateString("en-CA")}`
          );
          window.open(`https://wa.me/${payModal.phone.replace(/^0+/, "967")}?text=${msg}`, "_blank");
        }

        setPayModal(null);
        setPayAmount("");
        setPayNotes("");
        fetchSuppliers();
        if (selectedSupplier?.supplierId === payModal.supplierId) {
          setSelectedSupplier(prev => ({ ...prev, balance: data.balance }));
          fetchTransactions(payModal.supplierId);
          if (payPurchaseId) fetchPurchases(payModal.supplierId);
        }
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل تسجيل الدفع"); }
    setPaySaving(false);
  };

  const printPurchaseStatement = (p) => {
    const paymentTransactions = transactions.filter(t =>
      t.type === "payment" && (t.notes?.includes(p.purchaseId) || t.purchaseId === p.purchaseId)
    );
    const rows = paymentTransactions.map(t => [
      t.date || "-",
      (t.amount || 0).toLocaleString(),
      formatPaymentParty(t.cashAccountCode),
      t.notes || "-",
    ]);
    const paidTotal = paymentTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    rows.push(["", p.totalAmount.toLocaleString(), "إجمالي الفاتورة", ""]);
    print("REPORT_TABLE", {
      title: `فاتورة ${p.purchaseId}`,
      subtitle: `${p.description || ""} | ${p.date}`,
      headers: ["التاريخ", "المبلغ", "جهة الدفع", "البيان"],
      rows,
      footer: `المدفوع: ${paidTotal.toLocaleString()} ر.ي | المتبقي: ${(p.totalAmount - paidTotal).toLocaleString()} ر.ي | ${paidTotal >= p.totalAmount ? "مسددة ✅" : "مفتوحة 🔴"}`,
    });
  };

  const printSupplierStatement = (s) => {
    const paidTrans = transactions.filter(t => t.type === "payment");
    const activePurchases = purchases.filter(p => p.status !== "cancelled");
    const rows = [];
    for (const p of activePurchases) {
      const payments = paidTrans.filter(t => t.purchaseId === p.purchaseId || t.notes?.includes(p.purchaseId));
      const totalPaid = payments.reduce((sum, pt) => sum + pt.amount, 0);
      // Invoice header row
      rows.push([`فاتورة: ${p.purchaseId}`, p.description || "", p.date, p.totalAmount.toLocaleString(), totalPaid.toLocaleString(), (p.totalAmount - totalPaid).toLocaleString(), p.status === "closed" ? "مسددة" : "مفتوحة"]);
      // Payment rows
      for (const pt of payments) {
        rows.push(["  ↳ دفعة", pt.date, pt.amount.toLocaleString(), formatPaymentParty(pt.cashAccountCode), pt.notes || "", "", ""]);
      }
      // Empty separator
      rows.push(["", "", "", "", "", "", ""]);
    }
    // General payments
    const linkedIds = new Set(purchases.map(p => p.purchaseId));
    const generalPayments = paidTrans.filter(t => !linkedIds.has(t.purchaseId) && !t.notes?.match(/PUR-\d+/));
    for (const pt of generalPayments) {
      rows.push([`دفعة عامة`, pt.date, pt.amount.toLocaleString(), formatPaymentParty(pt.cashAccountCode), pt.notes || "", "", ""]);
    }
    if (generalPayments.length > 0) rows.push(["", "", "", "", "", "", ""]);

    const totalPurchases = activePurchases.reduce((s, p) => s + p.totalAmount, 0);
    const totalPaidAll = paidTrans.reduce((s, pt) => s + pt.amount, 0);
    print("REPORT_TABLE", {
      title: `كشف حساب ${s.supplierName}`,
      subtitle: `${s.supplierName} | ${s.phone || ""}${s.address ? ` | ${s.address}` : ""}`,
      headers: ["البيان", "التاريخ", "المبلغ", "جهة الدفع", "", "", ""],
      rows,
      footer: `إجمالي المشتريات: ${totalPurchases.toLocaleString()} ر.ي | إجمالي المدفوع: ${totalPaidAll.toLocaleString()} ر.ي | الرصيد الحالي: ${s.balance.toLocaleString()} ر.ي`,
    });
  };

  const sendPurchaseWhatsApp = (p) => {
    const supplier = suppliers.find(s => s.supplierId === p.supplierId);
    if (!supplier?.phone) { setErrorMsg("لا يوجد رقم واتساب للمورد"); return; }
    const msg = encodeURIComponent(
      `شركة التعزي للمناسبات والتأجير\n` +
      `فاتورة توريد\n` +
      `الرقم: ${p.purchaseId}\n` +
      `البيان: ${p.description}\n` +
      `الإجمالي: ${p.totalAmount.toLocaleString()} ر.ي\n` +
      `المدفوع: ${p.paidAmount.toLocaleString()} ر.ي\n` +
      `المتبقي: ${p.remainingAmount.toLocaleString()} ر.ي\n` +
      `الحالة: ${p.status === "closed" ? "مسددة" : "مفتوحة"}\n` +
      `التاريخ: ${p.date}`
    );
    window.open(`https://wa.me/${supplier.phone.replace(/^0+/, "967")}?text=${msg}`, "_blank");
  };

  const balanceColor = (b) => b > 0 ? "#dc2626" : "#059669";

  // ─── Customer receivables ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "customers" && allBookings.length === 0) {
      setBookingsLoading(true);
      fetch("/api/bookings?limit=10000").then(r => r.json()).then(d => {
        if (d.success) setAllBookings(d.bookings || []);
      }).catch(() => setErrorMsg("فشل تحميل الحجوزات")).finally(() => setBookingsLoading(false));
    }
  }, [activeTab]);

  const customerData = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      const key = `${(b.customerName || "").trim()}|${(b.customerPhone || "").trim()}`;
      if (!map[key]) {
        map[key] = { customerName: b.customerName || "", customerPhone: b.customerPhone || "", bookings: [], totalAmount: 0, totalPaid: 0, totalRemaining: 0 };
      }
      map[key].bookings.push(b);
      map[key].totalAmount += b.totalAmount || 0;
      map[key].totalPaid += b.paidAmount || 0;
      map[key].totalRemaining += b.remainingAmount || 0;
    }
    return Object.values(map);
  }, [allBookings]);

  const filteredCustomers = useMemo(() => {
    let list = customerData;
    if (customerSearch) {
      const term = customerSearch.toLowerCase();
      list = list.filter(c => c.customerName.toLowerCase().includes(term) || (c.customerPhone || "").includes(term));
    }
    if (onlyDebtors) list = list.filter(c => c.totalRemaining > 0);
    return list.sort((a, b) => b.totalRemaining - a.totalRemaining || b.totalAmount - a.totalAmount);
  }, [customerData, customerSearch, onlyDebtors]);

  const viewCustomer = (c) => setSelectedCustomer(c);
  const backToCustomers = () => setSelectedCustomer(null);

  const filteredSuppliers = suppliers.filter(s => s.isActive).filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.supplierName.toLowerCase().includes(term) ||
           s.supplierId.toLowerCase().includes(term) ||
           (s.phone || "").includes(term);
  });

  // ─── Supplier Detail View ──────────────────────────────────────────────
  const renderSupplierDetail = () => {
    const s = selectedSupplier;
    if (!s) return null;
    return (
      <section className="field-ops-section">
        <div className="section-title-row">
          <h2>📦 {s.supplierName}</h2>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button className="btn btn-secondary" onClick={backToList}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>← العودة للقائمة</button>
            <button className="btn btn-primary" onClick={() => {
              setShowPurchaseForm(true);
              setPurchaseForm({ description: "", totalAmount: "", notes: "", date: new Date().toLocaleDateString("en-CA"), costCenter: "", accountCode: "" });
              setCarryPurchases([]);
              fetch(`/api/finance/suppliers/purchases?supplierId=${s.supplierId}`).then(r => r.json()).then(d => {
                if (d.success) setOpenPurchases(d.purchases.filter(p => p.status === "open" && p.remainingAmount > 0));
              }).catch(() => {});
            }}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>+ فاتورة توريد</button>
            <button className="btn btn-gold" onClick={() => openPayModal(s)}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>💰 تسديد</button>
          </div>
        </div>

        {/* Supplier Info Card */}
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{s.supplierId}</div>
              {s.phone && <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>📞 {s.phone}</div>}
              {s.address && <div style={{ fontSize: "0.85rem", marginTop: "0.15rem" }}>📍 {s.address}</div>}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: balanceColor(s.balance) }}>
                {s.balance.toLocaleString()} ر.ي
              </div>
              <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{s.balance > 0 ? "مدين" : "رصيد دائن"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#6366f1", borderColor: "#6366f1" }}
              onClick={() => printSupplierStatement(s)}>🖨️ طباعة كشف حساب</button>
            {s.phone && (
              <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#25D366", borderColor: "#25D366" }}
                onClick={() => {
                  const msg = encodeURIComponent(
                    `شركة التعزي للمناسبات والتأجير\nكشف حساب ${s.supplierName}\n` +
                    `الرصيد الحالي: ${s.balance.toLocaleString()} ر.ي\n` +
                    `آخر المعاملات:\n` +
                    transactions.slice(0, 5).map(t => `- ${t.date}: ${t.type === "purchase" ? "توريد" : "تسديد"} ${t.amount.toLocaleString()} ر.ي`).join("\n")
                  );
                  window.open(`https://wa.me/${s.phone.replace(/^0+/, "967")}?text=${msg}`, "_blank");
                }}>💬 واتساب</button>
            )}
            <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#dc2626", borderColor: "#dc2626" }}
              onClick={() => setShowDeleteConfirm(s.supplierId)}>🗑️ حذف المورد</button>
          </div>
        </div>

        {/* Purchases Table */}
        <h5 style={{ marginBottom: "0.5rem" }}>📄 فواتير المشتريات</h5>
        <div className="table-responsive">
          <table className="inv-table" style={{ fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th>التاريخ</th>
                <th>البيان</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>مركز التكلفة</th>
                <th>الحالة</th>
                <th>الصورة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {purchases.filter(p => p.status !== "cancelled").map((p) => {
                const isCarried = p.status === "carried";
                const rowBg = p.status === "closed" ? "rgba(76,175,80,0.08)" : isCarried ? "rgba(99,102,241,0.06)" : "";
                const remaining = isCarried ? p.totalAmount - p.paidAmount : p.remainingAmount;
                return (
                <tr key={p.purchaseId} style={{ background: rowBg, opacity: isCarried ? 0.85 : 1 }}>
                  <td style={{ fontWeight: "bold", fontSize: "0.75rem" }}>{p.purchaseId}</td>
                  <td style={{ fontSize: "0.75rem" }}>{p.date}</td>
                  <td>{p.description}{isCarried && <span style={{ fontSize: "0.65rem", opacity: 0.5, marginRight: "0.3rem" }}>(مرحلة)</span>}</td>
                  <td style={{ fontWeight: "bold" }}>{p.totalAmount.toLocaleString()}</td>
                  <td style={{ color: "#059669" }}>{p.paidAmount.toLocaleString()}</td>
                  <td style={{ fontWeight: "bold", color: remaining > 0 ? "#dc2626" : "#059669" }}>{remaining.toLocaleString()}</td>
                  <td style={{ fontSize: "0.75rem" }}>{p.costCenter || "-"}</td>
                  <td>
                    {isCarried ? (
                      <span className="pkg-item-tag" style={{ fontSize: "0.7rem", background: "rgba(99,102,241,0.15)", color: "#6366f1" }}>
                        مرحلة
                      </span>
                    ) : (
                      <span className={`pkg-item-tag ${p.status === "closed" ? "text-emerald" : "text-amber"}`}
                        style={{ fontSize: "0.7rem", background: p.status === "closed" ? "rgba(76,175,80,0.15)" : "rgba(255,193,7,0.15)" }}>
                        {p.status === "closed" ? "مسددة" : "مفتوحة"}
                      </span>
                    )}
                  </td>
                  <td>
                    {p.imageUrl ? (
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.7rem" }}
                        onClick={() => setExpandedImage(p.imageUrl)}>🖼️</button>
                    ) : "-"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.2rem" }}>
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem" }}
                        onClick={() => printPurchaseStatement(p)} title="طباعة">🖨️</button>
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#25D366", borderColor: "#25D366" }}
                        onClick={() => sendPurchaseWhatsApp(p)} title="واتساب">💬</button>
                      {remaining > 0 && (
                        <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#059669", borderColor: "#059669" }}
                          onClick={() => openPayModal(s, p)} title="تسديد">💰</button>
                      )}
                      {!isCarried && userRole === "admin" && (
                        <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#dc2626", borderColor: "#dc2626" }}
                          onClick={() => setDeletePurchConfirm(p.purchaseId)} title="إلغاء">✕</button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {purchases.filter(p => p.status !== "cancelled").length === 0 && (
                <tr><td colSpan="10" style={{ textAlign: "center", padding: "0.75rem" }}>لا توجد فواتير</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cancelled Purchases */}
        {purchases.filter(p => p.status === "cancelled").length > 0 && (
          <>
            <details style={{ marginTop: "1rem", opacity: 0.6 }}>
              <summary style={{ cursor: "pointer", fontSize: "0.8rem" }}>
                فواتير ملغاة ({purchases.filter(p => p.status === "cancelled").length})
              </summary>
              <table className="inv-table" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
                <tbody>
                  {purchases.filter(p => p.status === "cancelled").map(p => (
                    <tr key={p.purchaseId}><td>{p.purchaseId}</td><td>{p.date}</td><td>{p.description}</td><td>{p.totalAmount.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}

        {/* ===== كشف حساب تفصيلي ===== */}
        <h5 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>📊 كشف حساب تفصيلي</h5>

        {(() => {
          // Group payments by purchase
          const grouped = [];
          const activePurchases = purchases.filter(p => p.status !== "cancelled" && p.status !== "carried");
          const carriedPurchases = purchases.filter(p => p.status === "carried");
          const paidTrans = transactions.filter(t => t.type === "payment");

          for (const p of activePurchases) {
            const payments = paidTrans.filter(t => t.purchaseId === p.purchaseId || t.notes?.includes(p.purchaseId));
            grouped.push({ type: "purchase", purchase: p, payments });
          }

          // Carried invoices
          for (const p of carriedPurchases) {
            const payments = paidTrans.filter(t => t.purchaseId === p.purchaseId || t.notes?.includes(p.purchaseId));
            grouped.push({ type: "carried", purchase: p, payments });
          }

          // General payments (not linked to any purchase)
          const linkedPurchaseIds = new Set(purchases.map(p => p.purchaseId));
          const generalPayments = paidTrans.filter(t => !linkedPurchaseIds.has(t.purchaseId) && !t.notes?.match(/PUR-\d+/));

          // Invoices from transactions without a purchase record
          const transOnlyInvoices = [];
          const allLinkedIds = new Set(purchases.map(p => p.purchaseId));
          for (const t of transactions) {
            if (t.type === "purchase" && !allLinkedIds.has(t.purchaseId)) {
              const payments = paidTrans.filter(pt => pt.purchaseId === t.purchaseId || pt.notes?.includes(t.purchaseId));
              transOnlyInvoices.push({ type: "purchase", purchase: { purchaseId: t.purchaseId || "", date: t.date, description: t.notes || "", totalAmount: t.amount, paidAmount: payments.reduce((s, pt) => s + pt.amount, 0), remainingAmount: t.amount - payments.reduce((s, pt) => s + pt.amount, 0), status: "" }, payments });
            }
          }

          const allGroups = [...grouped, ...transOnlyInvoices];

          return (
            <>
              {allGroups.length === 0 && generalPayments.length === 0 && (
                <p style={{ textAlign: "center", padding: "1rem", opacity: 0.5 }}>لا توجد معاملات</p>
              )}

              {allGroups.map((g) => {
                const p = g.purchase;
                const totalPaid = g.payments.reduce((s, pt) => s + pt.amount, 0);
                const remaining = p.totalAmount - totalPaid;
                const invStatus = remaining <= 0 ? "مسددة" : "مفتوحة";
                return (
                  <div key={p.purchaseId} className="matched-booking-card" style={{ marginBottom: "0.75rem", borderColor: remaining <= 0 ? "#059669" : "#dc2626" }}>
                    {/* Invoice Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: "0.9rem" }}>{p.purchaseId}</strong>
                        <span style={{ fontSize: "0.72rem", opacity: 0.6, marginRight: "0.5rem" }}>{p.date}</span>
                      </div>
                      <div>
                        {g.type === "carried" && <span className="pkg-item-tag" style={{ fontSize: "0.65rem", background: "rgba(99,102,241,0.15)", color: "#6366f1", marginLeft: "0.3rem" }}>مرحلة</span>}
                        <span className={`pkg-item-tag`} style={{ fontSize: "0.65rem", background: remaining <= 0 ? "rgba(76,175,80,0.15)" : "rgba(255,193,7,0.15)", color: remaining <= 0 ? "#059669" : "#d97706" }}>{invStatus}</span>
                      </div>
                    </div>
                    {p.description && <div style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: "0.2rem" }}>{p.description}</div>}

                    {/* Summary row */}
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.4rem", fontSize: "0.78rem" }}>
                      <span>الإجمالي: <strong>{p.totalAmount?.toLocaleString() || 0}</strong></span>
                      <span style={{ color: "#059669" }}>المدفوع: <strong>{totalPaid.toLocaleString()}</strong></span>
                      <span style={{ color: "#dc2626" }}>المتبقي: <strong>{remaining.toLocaleString()}</strong></span>
                    </div>

                    {/* Payments Table */}
                    {g.payments.length > 0 && (
                      <table className="inv-table" style={{ fontSize: "0.72rem", marginTop: "0.5rem", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>التاريخ</th><th>المبلغ</th><th>جهة الدفع</th><th>البيان</th>
                            {userRole === "admin" && <th>إجراءات</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {g.payments.map(pt => (
                            <tr key={pt.transId}>
                              <td>{pt.date}</td>
                              <td style={{ color: "#059669", fontWeight: "bold" }}>{pt.amount.toLocaleString()}</td>
                              <td>{formatPaymentParty(pt.cashAccountCode)}</td>
                              <td style={{ fontSize: "0.7rem", opacity: 0.7 }}>{pt.notes || "-"}</td>
                              {userRole === "admin" && (
                                <td>
                                  <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.55rem", padding: "0.1rem 0.25rem" }}
                                    onClick={() => {
                                      const newAmt = prompt("المبلغ الجديد:", pt.amount);
                                      if (!newAmt || isNaN(parseFloat(newAmt))) return;
                                      const newNotes = prompt("البيان الجديد:", pt.notes || "");
                                      const newDate = prompt("التاريخ الجديد (YYYY-MM-DD):", pt.date);
                                      if (!newDate) return;
                                      const tk = localStorage.getItem("token");
                                      fetch("/api/finance/suppliers/pay", {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                                        body: JSON.stringify({ transId: pt.transId, amount: parseFloat(newAmt), notes: newNotes || "", date: newDate, cashAccountCode: pt.cashAccountCode, purchaseId: pt.purchaseId }),
                                      }).then(r => r.json()).then(d => {
                                        if (d.success) { setSuccessMsg("تم تعديل الدفع"); fetchSuppliers(); }
                                        else setErrorMsg(d.error);
                                      }).catch(() => setErrorMsg("خطأ"));
                                    }}>✏️</button>
                                  <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.55rem", padding: "0.1rem 0.25rem" }}
                                    onClick={async () => {
                                      if (!confirm(`حذف دفعة ${pt.amount.toLocaleString()} ريال؟`)) return;
                                      if (!confirm(`⛔ تأكيد حذف الدفع؟`)) return;
                                      const tk = localStorage.getItem("token");
                                      try {
                                        const r = await fetch(`/api/finance/suppliers/pay?transId=${pt.transId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
                                        const d = await r.json();
                                        if (d.success) { setSuccessMsg("تم حذف الدفع وعكس القيود"); fetchSuppliers(); }
                                        else setErrorMsg(d.error);
                                      } catch { setErrorMsg("خطأ"); }
                                    }}>🗑️</button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}

              {/* General Payments */}
              {generalPayments.length > 0 && (
                <div className="matched-booking-card" style={{ marginBottom: "0.75rem", borderColor: "#6366f1" }}>
                  <strong style={{ fontSize: "0.85rem" }}>💰 مدفوعات عامة</strong>
                  <table className="inv-table" style={{ fontSize: "0.72rem", marginTop: "0.5rem", width: "100%" }}>
                    <thead>
                      <tr>
                        <th>التاريخ</th><th>المبلغ</th><th>جهة الدفع</th><th>البيان</th>
                        {userRole === "admin" && <th>إجراءات</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {generalPayments.map(pt => (
                        <tr key={pt.transId}>
                          <td>{pt.date}</td>
                          <td style={{ color: "#059669", fontWeight: "bold" }}>{pt.amount.toLocaleString()}</td>
                          <td>{formatPaymentParty(pt.cashAccountCode)}</td>
                          <td style={{ fontSize: "0.7rem", opacity: 0.7 }}>{pt.notes || "-"}</td>
                          {userRole === "admin" && (
                            <td>
                              <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.55rem", padding: "0.1rem 0.25rem" }}
                                onClick={() => {
                                  const newAmt = prompt("المبلغ الجديد:", pt.amount);
                                  if (!newAmt || isNaN(parseFloat(newAmt))) return;
                                  const newNotes = prompt("البيان الجديد:", pt.notes || "");
                                  const newDate = prompt("التاريخ الجديد (YYYY-MM-DD):", pt.date);
                                  if (!newDate) return;
                                  const tk = localStorage.getItem("token");
                                  fetch("/api/finance/suppliers/pay", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                                    body: JSON.stringify({ transId: pt.transId, amount: parseFloat(newAmt), notes: newNotes || "", date: newDate, cashAccountCode: pt.cashAccountCode, purchaseId: pt.purchaseId }),
                                  }).then(r => r.json()).then(d => {
                                    if (d.success) { setSuccessMsg("تم تعديل الدفع"); fetchSuppliers(); }
                                    else setErrorMsg(d.error);
                                  }).catch(() => setErrorMsg("خطأ"));
                                }}>✏️</button>
                              <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.55rem", padding: "0.1rem 0.25rem" }}
                                onClick={async () => {
                                  if (!confirm(`حذف دفعة ${pt.amount.toLocaleString()} ريال؟`)) return;
                                  if (!confirm(`⛔ تأكيد حذف الدفع؟`)) return;
                                  const tk = localStorage.getItem("token");
                                  try {
                                    const r = await fetch(`/api/finance/suppliers/pay?transId=${pt.transId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
                                    const d = await r.json();
                                    if (d.success) { setSuccessMsg("تم حذف الدفع وعكس القيود"); fetchSuppliers(); }
                                    else setErrorMsg(d.error);
                                  } catch { setErrorMsg("خطأ"); }
                                }}>🗑️</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}

        {/* Old Transactions (collapsed) */}
        <details style={{ marginTop: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.8rem", opacity: 0.6 }}>📋 عرض سجل المعاملات (قديم)</summary>
          <div className="table-responsive" style={{ marginTop: "0.5rem" }}>
            <table className="inv-table" style={{ fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الفاتورة</th><th>جهة الدفع</th><th>البيان</th>
                </tr>
              </thead>
              <tbody>
                {[...transactions].reverse().map((t) => {
                  const typeLabel = t.type === "purchase" ? "توريد" : t.type === "cancel" ? "إلغاء" : "تسديد";
                  const typeColor = t.type === "purchase" ? "#dc2626" : t.type === "cancel" ? "#6b7280" : "#059669";
                  const typeBg = t.type === "purchase" ? "rgba(76,175,80,0.15)" : t.type === "cancel" ? "rgba(107,114,128,0.15)" : "rgba(255,68,68,0.15)";
                  return (
                    <tr key={t.transId} style={t.type === "cancel" ? { opacity: 0.6 } : {}}>
                      <td>{t.date}</td>
                      <td><span className="pkg-item-tag" style={{ fontSize: "0.7rem", background: typeBg, color: typeColor }}>{typeLabel}</span></td>
                      <td style={{ fontWeight: "bold", color: typeColor }}>{t.amount.toLocaleString()} ر.ي</td>
                      <td style={{ fontSize: "0.75rem" }}>{t.purchaseId || (t.notes?.includes("PUR-") ? t.notes.match(/PUR-\d+/)?.[0] || "-" : "-")}</td>
                      <td style={{ fontSize: "0.75rem" }}>{formatPaymentParty(t.cashAccountCode)}</td>
                      <td>{t.notes || "-"}</td>
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: "0.75rem" }}>لا توجد معاملات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>

        {/* Delete Supplier Confirm */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "350px" }}>
              <div className="modal-header"><h2>⚠️ تأكيد الحذف</h2><button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>✕</button></div>
              <div className="modal-body">
                <p>هل أنت متأكد من حذف المورد <strong>{s.supplierName}</strong>؟</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>سيتم إخفاء المورد مع الاحتفاظ بسجل المعاملات</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>إلغاء</button>
                <button className="btn" style={{ background: "#dc2626", color: "#fff" }} onClick={() => handleDelete(s.supplierId)} disabled={saving}>
                  {saving ? "..." : "تأكيد الحذف"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Purchase Confirm */}
        {deletePurchConfirm && (
          <div className="modal-overlay" onClick={() => setDeletePurchConfirm(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "350px" }}>
              <div className="modal-header"><h2>⚠️ إلغاء الفاتورة</h2><button className="modal-close" onClick={() => setDeletePurchConfirm(null)}>✕</button></div>
              <div className="modal-body">
                <p>هل أنت متأكد من إلغاء الفاتورة <strong>{deletePurchConfirm}</strong>؟</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>سيتم عكس المبلغ من رصيد المورد</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeletePurchConfirm(null)}>إلغاء</button>
                <button className="btn" style={{ background: "#dc2626", color: "#fff" }} onClick={() => handleDeletePurchase(deletePurchConfirm)} disabled={saving}>
                  {saving ? "..." : "تأكيد الإلغاء"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {expandedImage && (
          <div className="modal-overlay" onClick={() => setExpandedImage(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", textAlign: "center" }}>
              <div className="modal-header"><h2>🖼️ صورة الفاتورة</h2><button className="modal-close" onClick={() => setExpandedImage(null)}>✕</button></div>
              <div className="modal-body">
                <img src={expandedImage} alt="فاتورة" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "8px" }} />
              </div>
            </div>
          </div>
        )}

        {/* Purchase Form Modal */}
        {showPurchaseForm && (
          <div className="modal-overlay" onClick={() => setShowPurchaseForm(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
              <div className="modal-header"><h2>📄 فاتورة توريد جديدة</h2><button className="modal-close" onClick={() => setShowPurchaseForm(false)}>✕</button></div>
              <div className="modal-body">
                <div style={{ fontSize: "0.85rem", marginBottom: "0.75rem", color: "var(--text-secondary)" }}>المورد: {s.supplierName}</div>
                <div className="form-group">
                  <label>التاريخ</label>
                  <input type="date" className="form-control" value={purchaseForm.date}
                    onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>بيان التوريد *</label>
                  <input className="form-control" value={purchaseForm.description}
                    onChange={e => setPurchaseForm({ ...purchaseForm, description: e.target.value })} placeholder="وصف المواد أو الخدمات" />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>المبلغ الإجمالي *</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={purchaseForm.totalAmount}
                    onChange={e => setPurchaseForm({ ...purchaseForm, totalAmount: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>مركز التكلفة *</label>
                  <select className="form-control" value={purchaseForm.costCenter}
                    onChange={e => setPurchaseForm({ ...purchaseForm, costCenter: e.target.value })}>
                    <option value="">-- اختر مركز التكلفة --</option>
                    {costCenters.filter(c => c.isActive !== false).map(cc => (
                      <option key={cc.code} value={cc.code}>{cc.name} ({cc.code})</option>
                    ))}
                  </select>
                </div>
                {/* Carry Forward Section */}
                {openPurchases.length > 0 && (
                  <div className="form-group" style={{ marginTop: "0.5rem", padding: "0.5rem", background: "rgba(99,102,241,0.08)", borderRadius: "6px" }}>
                    <label style={{ color: "#6366f1", fontWeight: "bold" }}>🔄 ترحيل رصيد من فواتير سابقة</label>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "0.3rem" }}>
                      اختر الفواتير التي تريد ترحيل رصيدها المتبقي وإغلاقها
                    </div>
                    {openPurchases.map(op => (
                      <label key={op.purchaseId} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0", cursor: "pointer", fontSize: "0.8rem" }}>
                        <input type="checkbox" checked={carryPurchases.includes(op.purchaseId)}
                          onChange={e => {
                            if (e.target.checked) setCarryPurchases([...carryPurchases, op.purchaseId]);
                            else setCarryPurchases(carryPurchases.filter(id => id !== op.purchaseId));
                          }} />
                        <span>{op.purchaseId} - {op.description} — <strong style={{ color: "#dc2626" }}>{op.remainingAmount.toLocaleString()} ر.ي</strong></span>
                      </label>
                    ))}
                    {carryPurchases.length > 0 && (
                      <div style={{ fontSize: "0.8rem", marginTop: "0.3rem", color: "#6366f1" }}>
                        ✅ إجمالي المرحّل: {carryPurchases.reduce((sum, id) => sum + (openPurchases.find(o => o.purchaseId === id)?.remainingAmount || 0), 0).toLocaleString()} ر.ي
                      </div>
                    )}
                  </div>
                )}
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>حساب المصروف/الأصل *</label>
                  <select className="form-control" value={purchaseForm.accountCode}
                    onChange={e => setPurchaseForm({ ...purchaseForm, accountCode: e.target.value })}>
                    <option value="">-- اختر حساب المصروف أو الأصل --</option>
                    {accounts.filter(a => (a.accountType === "expense" || a.accountType === "asset") && !a.parentCode).map(ac => (
                      <optgroup key={ac.accountCode} label={`${ac.accountName} (${ac.accountCode}) - ${ac.accountType === "asset" ? "🏦 أصل" : "🔴 مصروف"}`}>
                        {accounts.filter(c => c.parentCode === ac.accountCode && (c.accountType === "expense" || c.accountType === "asset")).map(child => (
                          <option key={child.accountCode} value={child.accountCode}>{child.accountName} ({child.accountCode})</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>صورة الفاتورة</label>
                  <input type="file" ref={fileInputRef} accept="image/*"
                    onChange={e => setPurchaseImage(e.target.files[0])} className="form-control" style={{ padding: "0.3rem" }} />
                  {purchaseImage && <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.2rem" }}>✅ {purchaseImage.name}</div>}
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>ملاحظات</label>
                  <input className="form-control" value={purchaseForm.notes}
                    onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="اختياري" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowPurchaseForm(false)}>إلغاء</button>
                <button className="btn btn-primary" onClick={handlePurchaseSave} disabled={purchaseSaving}>
                  {purchaseSaving ? "..." : "💾 تسجيل وإرسال واتساب"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {payModal && (
          <div className="modal-overlay" onClick={() => setPayModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
              <div className="modal-header"><h2>💰 تسديد مورد</h2><button className="modal-close" onClick={() => setPayModal(null)}>✕</button></div>
              <div className="modal-body">
                <p style={{ fontWeight: "bold" }}>{payModal.supplierName}</p>
                <p style={{ fontSize: "0.85rem", color: "#dc2626" }}>الرصيد الحالي: {payModal.balance.toLocaleString()} ر.ي</p>
                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label>التاريخ</label>
                  <input type="date" className="form-control" value={payDate}
                    onChange={e => setPayDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>المبلغ</label>
                  <input type="number" min="0" step="0.01" className="form-control" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>ربط بالفاتورة (اختياري)</label>
                  <select className="form-control" value={payPurchaseId}
                    onChange={e => { setPayPurchaseId(e.target.value); if (!e.target.value) setPayCostCenter(""); }}>
                    <option value="">— بدون —</option>
                    {purchases.filter(p => p.remainingAmount > 0).map(p => (
                      <option key={p.purchaseId} value={p.purchaseId}>{p.purchaseId} - {p.description} ({p.remainingAmount.toLocaleString()} ر.ي)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>ملاحظات</label>
                  <input className="form-control" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="سبب الدفع (اختياري)" />
                </div>
                {!payPurchaseId && (
                  <div className="form-group" style={{ marginTop: "0.5rem" }}>
                    <label>مركز التكلفة</label>
                    <select className="form-control" value={payCostCenter} onChange={e => setPayCostCenter(e.target.value)}>
                      <option value="">— عام —</option>
                      {costCenters.filter(c => c.isActive !== false).map(cc => (
                        <option key={cc.code} value={cc.code}>{cc.name} ({cc.code})</option>
                      ))}
                    </select>
                  </div>
                )}
                {payPurchaseId && (
                  <div className="form-group" style={{ marginTop: "0.5rem" }}>
                    <label>مركز التكلفة</label>
                    <input className="form-control" value={purchases.find(p => p.purchaseId === payPurchaseId)?.costCenter || ""} disabled style={{ opacity: 0.7 }} />
                    <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "0.2rem" }}>يُتبع مركز تكلفة الفاتورة تلقائياً</div>
                  </div>
                )}
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
                  <label>حساب السداد</label>
                  <select className="form-control" value={payCashAccountCode} onChange={e => setPayCashAccountCode(e.target.value)}>
                    {accounts.filter(a => a.accountCode.startsWith("11")).map(ac => (
                      <option key={ac.accountCode} value={ac.accountCode}>{ac.accountName} ({ac.accountCode})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setPayModal(null)}>إلغاء</button>
                <button className="btn btn-primary" onClick={handlePay} disabled={paySaving}>
                  {paySaving ? "..." : "💾 تأكيد وإرسال واتساب"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .table-responsive { overflow-x: auto; }
        `}</style>
      </section>
    );
  };

  // ─── Customer Detail View ─────────────────────────────────────────
  const renderCustomerDetail = () => {
    const c = selectedCustomer;
    if (!c) return null;
    const totalBookingsCount = c.bookings.length;
    const formatCurrency = (v) => (v || 0).toLocaleString();
    return (
      <section className="field-ops-section">
        <div className="section-title-row">
          <h2>👤 {c.customerName}</h2>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button className="btn btn-secondary" onClick={backToCustomers} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>← العودة للقائمة</button>
          </div>
        </div>
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              {c.customerPhone && <div style={{ fontSize: "0.85rem" }}>📞 {c.customerPhone}</div>}
              <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.25rem" }}>{totalBookingsCount} حجز{c.totalRemaining > 0 ? ` | ذمة: ${formatCurrency(c.totalRemaining)} ر.ي` : ""}</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: c.totalRemaining > 0 ? "#dc2626" : "#059669" }}>
                {formatCurrency(c.totalRemaining)} ر.ي
              </div>
              <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{c.totalRemaining > 0 ? "المتبقي" : "مسدد بالكامل ✅"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#6366f1", borderColor: "#6366f1" }}
              onClick={() => {
                print("REPORT_TABLE", {
                  title: `كشف حساب ${c.customerName}`,
                  subtitle: `${c.customerPhone || ""}`,
                  headers: ["رقم الحجز", "التاريخ", "النوع", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
                  rows: c.bookings.map(b => [
                    b.bookingId || "",
                    b.startDate || "",
                    b.bookingType || "",
                    formatCurrency(b.totalAmount || 0),
                    formatCurrency(b.paidAmount || 0),
                    formatCurrency(b.remainingAmount || 0),
                    b.status || "",
                  ]),
                  footer: `الإجمالي: ${formatCurrency(c.totalAmount)} | المدفوع: ${formatCurrency(c.totalPaid)} | المتبقي: ${formatCurrency(c.totalRemaining)}`,
                });
              }}>🖨️ طباعة كشف حساب</button>
            {c.totalRemaining > 0 && (
              <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#059669", borderColor: "#059669" }}
                onClick={() => {
                  setView("payment");
                  setPaymentRedirect(c.bookings.find(b => b.remainingAmount > 0));
                }}>💰 تسجيل دفعة</button>
            )}
          </div>
        </div>
        <div className="table-responsive">
          <table className="inv-table" style={{ fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th>رقم الحجز</th><th>النوع</th><th>من</th><th>إلى</th><th>الفترة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {c.bookings.map(b => (
                <tr key={b.bookingId} style={b.remainingAmount > 0 ? { background: "rgba(220,38,38,0.05)" } : {}}>
                  <td style={{ fontWeight: "bold", fontSize: "0.75rem" }}>{b.bookingId}</td>
                  <td style={{ fontSize: "0.75rem" }}>{b.bookingType || "-"}</td>
                  <td style={{ fontSize: "0.75rem" }}>{b.startDate || "-"}</td>
                  <td style={{ fontSize: "0.75rem" }}>{b.endDate || "-"}</td>
                  <td style={{ fontSize: "0.75rem" }}>{b.shift === "صباح" ? "🌅 نهاري" : b.shift === "مساء" ? "🌙 ليلي" : b.shift === "كامل" ? "☀️🌙 يوم كامل" : b.shift || ""}</td>
                  <td style={{ fontWeight: "bold" }}>{formatCurrency(b.totalAmount)}</td>
                  <td style={{ color: "#059669" }}>{formatCurrency(b.paidAmount)}</td>
                  <td style={{ fontWeight: "bold", color: (b.remainingAmount || 0) > 0 ? "#dc2626" : "#059669" }}>{formatCurrency(b.remainingAmount)}</td>
                  <td>
                    <span className={`pkg-item-tag`} style={{
                      fontSize: "0.7rem",
                      background: b.status === "مكتمل" ? "rgba(99,102,241,0.15)" : b.status === "مدفوع" ? "rgba(76,175,80,0.15)" : b.status === "منتهي" ? "rgba(139,92,246,0.15)" : b.status === "مؤكد" ? "rgba(255,193,7,0.15)" : "rgba(107,114,128,0.15)",
                      color: b.status === "مكتمل" ? "#6366f1" : b.status === "مدفوع" ? "#059669" : b.status === "منتهي" ? "#6d28d9" : b.status === "مؤكد" ? "#d97706" : "#6b7280",
                    }}>{b.status || "-"}</span>
                  </td>
                  <td>
                    {(b.remainingAmount || 0) > 0 && (
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#059669", borderColor: "#059669" }}
                        onClick={() => {
                          setView("payment");
                          setPaymentRedirect(b);
                        }}>💰</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  // ─── Tabbed Main View ──────────────────────────────────────────────────
  return (
    <section className="field-ops-section">
      <div className="section-title-row">
        <div style={{ display: "flex", gap: "0" }}>
          <button className={`tab-btn ${activeTab === "customers" ? "active" : ""}`}
            onClick={() => { setActiveTab("customers"); setSelectedCustomer(null); }}
            style={{ borderRadius: "8px 0 0 8px", borderRight: "none" }}>
            👥 العملاء
          </button>
          <button className={`tab-btn ${activeTab === "suppliers" ? "active" : ""}`}
            onClick={() => { setActiveTab("suppliers"); setSelectedSupplier(null); }}
            style={{ borderRadius: "0 8px 8px 0" }}>
            📦 الموردون
          </button>
        </div>
      </div>

      {/* ─── Suppliers Tab ──────────────────────────────────────────── */}
      {activeTab === "suppliers" && (selectedSupplier ? renderSupplierDetail() : (
        <>
          <div className="section-title-row">
            <h2>📦 إدارة الموردين</h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary" onClick={fetchSuppliers} disabled={loading}>
                {loading ? "..." : "🔄 تحديث"}
              </button>
              <button className="btn btn-gold" onClick={openAdd}>➕ إضافة مورد</button>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: "0.75rem" }}>
            <input className="form-control" type="search" placeholder="🔍 بحث باسم المورد أو رقم الجوال..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: "350px" }} />
          </div>

          {/* Supplier Form */}
          {showForm && (
            <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
              <h4 style={{ marginBottom: "0.75rem" }}>{editId ? "✏️ تعديل مورد" : "➕ إضافة مورد جديد"}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div className="form-group">
                  <label>اسم المورد *</label>
                  <input className="form-control" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} placeholder="اسم المورد" />
                </div>
                <div className="form-group">
                  <label>الجوال</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="رقم الجوال" />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>العنوان</label>
                  <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="العنوان" />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>ملاحظات</label>
                  <input className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "...حفظ" : "💾 حفظ"}</button>
              </div>
            </div>
          )}

          {/* Supplier Table */}
          <div className="table-responsive">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>#</th><th>الاسم</th><th>الجوال</th><th>العنوان</th><th>الرصيد</th><th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s, i) => (
                  <tr key={s.supplierId}>
                    <td>{i + 1}</td>
                    <td>
                      <button className="link-btn" onClick={() => viewSupplier(s)} style={{ fontWeight: "bold" }}>
                        {s.supplierName}
                      </button>
                    </td>
                    <td>{s.phone || "-"}</td>
                    <td style={{ fontSize: "0.8rem" }}>{s.address || "-"}</td>
                    <td style={{ color: balanceColor(s.balance), fontWeight: "bold" }}>
                      {s.balance.toLocaleString()} ر.ي
                      {s.balance > 0 && <span style={{ fontSize: "0.7rem", marginRight: "0.3rem" }}>🟢</span>}
                    </td>
                    <td>
                      <button className="card-btn" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }} onClick={() => openEdit(s)}>✏️</button>
                      <button className="card-btn" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", color: "#059669", borderColor: "#059669", marginRight: "0.25rem" }}
                        onClick={() => openPayModal(s)}>💰</button>
                      {s.phone && <button className="card-btn" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", color: "#25D366", borderColor: "#25D366", marginRight: "0.25rem" }}
                        onClick={() => window.open(`https://wa.me/${s.phone.replace(/^0+/, "967")}`, "_blank")}>💬</button>}
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: "1rem" }}>
                    {searchTerm ? "لا توجد نتائج للبحث" : "لا يوجد موردون"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem", textAlign: "center" }}>
            إجمالي الموردين: {suppliers.filter(s => s.isActive).length}
            {searchTerm && ` | نتائج البحث: ${filteredSuppliers.length}`}
          </div>
        </>
      ))}

      {/* ─── Customers / Receivables Tab ──────────────────────────────── */}
      {activeTab === "customers" && (selectedCustomer ? renderCustomerDetail() : (
        <>
          <div className="section-title-row">
            <h2>👥 متابعة العملاء والذمم</h2>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <input className="form-control" type="search" placeholder="🔍 بحث باسم العميل أو رقم الجوال..."
              value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              style={{ maxWidth: "300px" }} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={onlyDebtors} onChange={e => setOnlyDebtors(e.target.checked)} />
              🔴 فقط المدينة (باقي عليهم)
            </label>
            <button className="btn btn-primary" onClick={() => { setBookingsLoading(true); fetch("/api/bookings?limit=10000").then(r => r.json()).then(d => { if (d.success) setAllBookings(d.bookings || []); }).catch(() => setErrorMsg("فشل التحميل")).finally(() => setBookingsLoading(false)); }} disabled={bookingsLoading}>
              {bookingsLoading ? "..." : "🔄 تحديث"}
            </button>
          </div>

          {bookingsLoading ? (
            <div className="loading-screen" style={{ textAlign: "center", padding: "2rem" }}>جاري تحميل الحجوزات...</div>
          ) : (
            <div className="table-responsive">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>#</th><th>العميل</th><th>الجوال</th><th>عدد الحجوزات</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, i) => (
                    <tr key={`${c.customerName}|${c.customerPhone}`} style={c.totalRemaining > 0 ? { background: "rgba(220,38,38,0.04)" } : {}}>
                      <td>{i + 1}</td>
                      <td>
                        <button className="link-btn" onClick={() => viewCustomer(c)} style={{ fontWeight: "bold" }}>
                          {c.customerName || "بدون اسم"}
                        </button>
                      </td>
                      <td>{c.customerPhone || "-"}</td>
                      <td style={{ textAlign: "center" }}>{c.bookings.length}</td>
                      <td style={{ fontWeight: "bold" }}>{c.totalAmount.toLocaleString()}</td>
                      <td style={{ color: "#059669" }}>{c.totalPaid.toLocaleString()}</td>
                      <td style={{ fontWeight: "bold", color: c.totalRemaining > 0 ? "#dc2626" : "#059669" }}>
                        {c.totalRemaining.toLocaleString()}
                        {c.totalRemaining > 0 && <span style={{ fontSize: "0.7rem", marginRight: "0.3rem" }}>🔴</span>}
                      </td>
                      <td>
                        <button className="card-btn" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", color: "#6366f1", borderColor: "#6366f1" }}
                          onClick={() => viewCustomer(c)}>👤</button>
                        {c.totalRemaining > 0 && (
                          <button className="card-btn" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", color: "#059669", borderColor: "#059669", marginRight: "0.25rem" }}
                            onClick={() => {
                              setView("payment");
                              setPaymentRedirect(c.bookings.find(b => b.remainingAmount > 0));
                            }}>💰</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "1rem" }}>
                      {customerSearch || onlyDebtors ? "لا توجد نتائج" : "لا توجد حجوزات"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem", textAlign: "center", display: "flex", justifyContent: "center", gap: "1rem" }}>
            <span>إجمالي العملاء: {customerData.length}</span>
            <span>العملاء المدينة: {customerData.filter(c => c.totalRemaining > 0).length}</span>
            <span>إجمالي الذمم: {customerData.reduce((s, c) => s + c.totalRemaining, 0).toLocaleString()} ر.ي</span>
          </div>
        </>
      ))}

      <style>{` .table-responsive { overflow-x: auto; } .link-btn { background: none; border: none; color: var(--link); cursor: pointer; text-align: right; padding: 0; font-size: inherit; } .link-btn:hover { text-decoration: underline; } .tab-btn { padding: 0.5rem 1.2rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text); font-weight: bold; transition: all 0.2s; } .tab-btn.active { background: var(--gold); color: #000; border-color: var(--gold); } .tab-btn:not(.active):hover { background: rgba(255,255,255,0.1); } `}</style>
    </section>
  );
}
