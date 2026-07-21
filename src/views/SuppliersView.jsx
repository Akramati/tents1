"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { amountInWords } from "@/lib/numberToWords";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
  const [inventoryItems, setInventoryItems] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([{ itemId: "", itemName: "", quantity: 1, unitCost: "", amount: "" }]);
  const [inventoryAction, setInventoryAction] = useState("add");
  const [viewInvoice, setViewInvoice] = useState(null);
  const [editInvoiceMode, setEditInvoiceMode] = useState(false);
  const [editInvoiceForm, setEditInvoiceForm] = useState({});
  const [editInvoiceSaving, setEditInvoiceSaving] = useState(false);
  const [shareModal, setShareModal] = useState(null);
  const shareContentRef = useRef(null);

  useEffect(() => {
    if (viewInvoice) {
      setEditInvoiceForm(viewInvoice);
      setEditInvoiceMode(false);
    }
  }, [viewInvoice]);

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
    fetch("/api/inventory").then(r => r.json()).then(d => {
      if (d.success) setInventoryItems(d.items || []);
    }).catch(() => {});
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
          inventoryItems: purchaseItems.filter(i => i.itemName && i.amount).map(i => ({
            itemId: i.itemId || undefined,
            itemName: i.itemName,
            quantity: parseInt(i.quantity) || 1,
            unitCost: parseFloat(i.unitCost) || 0,
            amount: parseFloat(i.amount) || 0,
          })),
          inventoryAction,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setShowPurchaseForm(false);
        setPurchaseForm({ description: "", totalAmount: "", notes: "", date: "", costCenter: "", accountCode: "" });
        setPurchaseImage(null);
        setPurchaseItems([{ itemId: "", itemName: "", quantity: 1, unitCost: "", amount: "" }]);
        setInventoryAction("add");

        fetchSuppliers();
        fetchPurchases(selectedSupplier.supplierId);
        fetchTransactions(selectedSupplier.supplierId);
        if (selectedSupplier) {
          const sup = suppliers.find(s => s.supplierId === selectedSupplier.supplierId);
          if (sup) setSelectedSupplier(prev => ({ ...prev, balance: sup.balance + parseFloat(purchaseForm.totalAmount) }));
        }

        // Open share modal after saving
        const supplier = suppliers.find(s => s.supplierId === selectedSupplier.supplierId);
        if (supplier?.phone) {
          setTimeout(() => {
            setShareModal({ type: "purchase", purchase: { ...purchaseForm, purchaseId: data.purchaseId, totalAmount: parseFloat(purchaseForm.totalAmount), notes: purchaseForm.notes }, supplier: selectedSupplier, transactions, purchases, phone: supplier.phone, afterSave: true });
          }, 300);
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

        setPayModal(null);
        setPayAmount("");
        setPayNotes("");
        fetchSuppliers();
        if (selectedSupplier?.supplierId === payModal.supplierId) {
          setSelectedSupplier(prev => ({ ...prev, balance: data.balance }));
          fetchTransactions(payModal.supplierId);
          if (payPurchaseId) fetchPurchases(payModal.supplierId);
        }

        // Open share modal after payment
        if (payModal.phone) {
          setTimeout(() => {
            setShareModal({ type: "payment", amount: amt, supplier: payModal, phone: payModal.phone, purchaseId: payPurchaseId, notes: payNotes, afterSave: true });
          }, 300);
        }
      } else setErrorMsg(data.error);
    } catch { setErrorMsg("فشل تسجيل الدفع"); }
    setPaySaving(false);
  };

  const printPurchaseStatement = (p) => {
    const paymentTransactions = transactions.filter(t =>
      t.type === "payment" && (t.notes?.includes(p.purchaseId) || t.purchaseId === p.purchaseId)
    );
    const totalPaid = paymentTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    const remaining = p.totalAmount - totalPaid;
    const supplier = suppliers.find(s => s.supplierId === p.supplierId);
    const supplierName = supplier?.supplierName || selectedSupplier?.supplierName || "";

    const items = [];

    // Invoice row — ما علينا للمورد (دائن)
    items.push({
      date: p.date || "-",
      type: "فاتورة توريد",
      number: p.purchaseId,
      description: p.description || "",
      debit: 0,
      credit: p.totalAmount,
    });

    // Inventory items
    const invItems = p.inventoryItems || [];
    for (const inv of invItems) {
      items.push({
        date: "-",
        type: "صنف",
        number: "",
        description: `${inv.itemName} × ${inv.quantity}${inv.unitCost > 0 ? ` @ ${inv.unitCost.toLocaleString()}` : ""}`,
        debit: 0,
        credit: inv.amount || 0,
      });
    }

    // Payments — ما دفعناه (مدين)
    for (const pt of paymentTransactions) {
      items.push({
        date: pt.date || "-",
        type: "تسديد",
        number: "",
        description: pt.notes || "تسديد",
        debit: pt.amount,
        credit: 0,
      });
    }

    const totalCredit = items.reduce((s, i) => s + i.credit, 0);
    const totalDebit = items.reduce((s, i) => s + i.debit, 0);
    const balance = totalCredit - totalDebit;
    const isPaid = balance <= 0;
    const netLabel = balance > 0 ? `الإجمالي علينا` : balance < 0 ? `الإجمالي لنا (عليكم)` : "مسددة";

    print("SUPPLIER_DOC", {
      title: `فاتورة توريد - ${p.purchaseId}`,
      date: p.date,
      partyName: supplierName,
      partyPhone: supplier?.phone || "",
      docNumber: p.purchaseId,
      items,
      totals: { credit: totalCredit, debit: totalDebit },
      totalLabels: { creditLabel: "لكم", debitLabel: "المسدد منّا", netLabel },
      balance: isPaid ? 0 : balance,
      balanceLabel: isPaid ? "مسدد بالكامل ✅" : `الإجمالي علينا`,
      amountInWords: isPaid ? "" : amountInWords(balance),
    });
  };

  const printSupplierStatement = (s) => {
    const paidTrans = transactions.filter(t => t.type === "payment");
    const activePurchases = purchases.filter(p => p.status !== "cancelled");
    const items = [];

    // Collect all carry records from transactions
    const carryTrans = transactions.filter(t => t.type === "carry");

    for (const p of activePurchases) {
      const payments = paidTrans.filter(t => t.purchaseId === p.purchaseId || t.notes?.includes(p.purchaseId));
      const totalPaid = payments.reduce((sum, pt) => sum + pt.amount, 0);

      // Invoice row — ما علينا للمورد (دائن)
      items.push({
        date: p.date || "-",
        type: p.status === "carried" ? "مرحلة" : "فاتورة",
        number: p.purchaseId,
        description: p.description || "",
        debit: 0,
        credit: p.totalAmount,
      });

      // Carry forward records for this invoice (if any) — reduce the balance (مدين)
      const carries = carryTrans.filter(t => t.notes?.includes(p.purchaseId));
      for (const c of carries) {
        items.push({
          date: c.date || "-",
          type: "ترحيل",
          number: "",
          description: c.notes || "",
          debit: c.amount,
          credit: 0,
        });
      }

      // Payment rows — ما دفعناه (مدين)
      for (const pt of payments) {
        items.push({
          date: pt.date || "-",
          type: "تسديد",
          number: "",
          description: pt.notes || "",
          debit: pt.amount,
          credit: 0,
        });
      }

      // Separator between invoices
      items.push({ date: "───", type: "", number: "", description: "───", debit: 0, credit: 0 });
    }

    // General payments — ما دفعناه بدون ربط (مدين)
    const linkedIds = new Set(purchases.map(p => p.purchaseId));
    const generalPayments = paidTrans.filter(t => !linkedIds.has(t.purchaseId) && !t.notes?.match(/PUR-\d+/));
    for (const pt of generalPayments) {
      items.push({
        date: pt.date || "-",
        type: "دفعة عامة",
        number: "",
        description: pt.notes || "",
        debit: pt.amount,
        credit: 0,
      });
    }
    if (generalPayments.length > 0) {
      items.push({ date: "───", type: "", number: "", description: "───", debit: 0, credit: 0 });
    }

    // Carry-forward transactions not linked to purchases — مدين
    for (const c of carryTrans) {
      if (!linkedIds.has(c.purchaseId) && !c.notes?.match(/PUR-\d+/)) {
        items.push({
          date: c.date || "-",
          type: "ترحيل",
          number: "",
          description: c.notes || "",
          debit: c.amount,
          credit: 0,
        });
      }
    }

    const totalCredit = items.reduce((s, i) => s + (i.credit || 0), 0);
    const totalDebit = items.reduce((s, i) => s + (i.debit || 0), 0);
    const net = totalCredit - totalDebit;
    const balAbs = Math.abs(s.balance);
    const netLabel = net > 0 ? `الإجمالي علينا` : net < 0 ? `الإجمالي لنا (عليكم)` : "مسددة";
    const balLabel = s.balance > 0 ? `الرصيد الحالي علينا (لكم)` : s.balance < 0 ? `الرصيد الحالي لنا (عليكم)` : "الرصيد الحالي متساوي";

    print("SUPPLIER_DOC", {
      title: `كشف حساب ${s.supplierName}`,
      date: new Date().toLocaleDateString("en-CA"),
      partyName: s.supplierName,
      partyPhone: s.phone || "",
      docNumber: s.supplierId,
      items: items.filter(i => i.date !== "───" || i.description !== "───"),
      totals: { credit: totalCredit, debit: totalDebit },
      totalLabels: { creditLabel: "لكم", debitLabel: "المسدد منّا", netLabel },
      balance: balAbs,
      balanceLabel: balLabel,
      amountInWords: balAbs > 0 ? amountInWords(balAbs) : "",
    });
  };

  const sendPurchaseWhatsApp = (p) => {
    const supplier = suppliers.find(s => s.supplierId === p.supplierId);
    if (!supplier?.phone) { setErrorMsg("لا يوجد رقم واتساب للمورد"); return; }
    const paymentTransactions = transactions.filter(t =>
      t.type === "payment" && (t.notes?.includes(p.purchaseId) || t.purchaseId === p.purchaseId)
    );
    const totalPaid = paymentTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    const remaining = p.totalAmount - totalPaid;
    const carriedInfo = p.carriedAmount > 0 ? `\n🔄 مرحّل: ${p.carriedAmount.toLocaleString()} ر.ي` : "";
    const paymentsList = paymentTransactions.map(pt => `  - ${pt.date}: ${pt.amount.toLocaleString()} ر.ي${pt.notes ? ` (${pt.notes})` : ""}`).join("\n");
    const amtWords = amountInWords(remaining > 0 ? remaining : p.totalAmount);
    const statusLine = remaining > 0
      ? `\nالمتبقي علينا: ${remaining.toLocaleString()} ر.ي\n(فقط ${amtWords})`
      : `\n✅ مسدد بالكامل`;
    const msg = encodeURIComponent(
      `شركة التعزي للمناسبات والتأجير\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📄 فاتورة توريد\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `الرقم: ${p.purchaseId}\n` +
      `التاريخ: ${p.date}\n` +
      `البيان: ${p.description}\n` +
      `الإجمالي علينا: ${p.totalAmount.toLocaleString()} ر.ي${carriedInfo}\n` +
      `المسدد منّا: ${totalPaid.toLocaleString()} ر.ي\n` +
      `${statusLine}\n` +
      `${paymentsList ? `\n💳 المدفوعات:\n${paymentsList}` : ""}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📥 المستند متاح للتحميل بصيغة PDF أو صورة`
    );
    window.open(`https://wa.me/${supplier.phone.replace(/^0+/, "967")}?text=${msg}`, "_blank");
  };

  const balanceColor = (b) => b > 0 ? "#059669" : "#dc2626";

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
              setPurchaseItems([{ itemId: "", itemName: "", quantity: 1, unitCost: "", amount: "" }]);
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
              <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{s.balance > 0 ? "دائن" : s.balance < 0 ? "مدين" : "متساوي"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#6366f1", borderColor: "#6366f1" }}
              onClick={() => printSupplierStatement(s)}>🖨️ طباعة كشف حساب</button>
            <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#6366f1", borderColor: "#6366f1" }}
              onClick={() => printSupplierStatement(s)}>📥 تحميل المستند</button>
            {s.phone && (
              <button className="card-btn" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#25D366", borderColor: "#25D366" }}
                onClick={() => setShareModal({ type: "statement", supplier: s, transactions, purchases, phone: s.phone, supplierName: s.supplierName })}>💬 واتساب</button>
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
                <th>المرحّل</th>
                <th>الجديد</th>
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
                  <td style={{ color: "#6366f1", fontSize: "0.75rem" }}>{p.carriedAmount > 0 ? p.carriedAmount.toLocaleString() : "-"}</td>
                  <td style={{ fontSize: "0.75rem" }}>{(p.totalAmount - (p.carriedAmount || 0)).toLocaleString()}</td>
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
                        onClick={() => setShareModal({ type: "purchase", purchase: p, supplier: selectedSupplier, transactions, purchases, phone: selectedSupplier?.phone })} title="واتساب">💬</button>
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#6366f1", borderColor: "#6366f1" }}
                        onClick={() => printPurchaseStatement(p)} title="تحميل">📥</button>
                      {!isCarried && remaining > 0 && (
                        <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#059669", borderColor: "#059669" }}
                          onClick={() => openPayModal(s, p)} title="تسديد">💰</button>
                      )}
                      <button className="card-btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#6366f1", borderColor: "#6366f1" }}
                        onClick={() => setViewInvoice(p)} title="عرض/تعديل">📋</button>
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
                <tr><td colSpan="12" style={{ textAlign: "center", padding: "0.75rem" }}>لا توجد فواتير</td></tr>
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

                    {p.costCenter && <div style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: "0.15rem" }}>📍 مركز التكلفة: {p.costCenter}</div>}

                    {/* Inventory items */}
                    {p.inventoryItems && p.inventoryItems.length > 0 && (
                      <div style={{ marginTop: "0.3rem", padding: "0.3rem", background: "rgba(99,102,241,0.06)", borderRadius: "6px" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "var(--accent)", marginBottom: "0.15rem" }}>📦 الأصناف:</div>
                        {p.inventoryItems.map((inv, invIdx) => (
                          <div key={invIdx} style={{ fontSize: "0.72rem", display: "flex", gap: "0.5rem", padding: "0.1rem 0" }}>
                            <span>{inv.itemName}</span>
                            <span style={{ color: "#6366f1" }}>× {inv.quantity}</span>
                            {inv.unitCost > 0 && <span style={{ color: "#6b7280" }}>{inv.unitCost} للوحدة</span>}
                            <span style={{ color: "#059669" }}>{inv.amount?.toLocaleString()} ر.ي</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Summary row */}
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.4rem", fontSize: "0.78rem" }}>
                      <span>الإجمالي: <strong>{p.totalAmount?.toLocaleString() || 0}</strong></span>
                      {p.carriedAmount > 0 && <span style={{ color: "#6366f1" }}>المرحّل: <strong>{p.carriedAmount.toLocaleString()}</strong></span>}
                      {p.carriedAmount > 0 && <span style={{ color: "#6b7280" }}>الجديد: <strong>{(p.totalAmount - p.carriedAmount).toLocaleString()}</strong></span>}
                      <span style={{ color: "#059669" }}>المدفوع: <strong>{totalPaid.toLocaleString()}</strong></span>
                      <span style={{ color: "#dc2626" }}>المتبقي: <strong>{remaining.toLocaleString()}</strong></span>
                    </div>

                    {p.notes && <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: "0.15rem" }}>📝 {p.notes}</div>}

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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <div className="modal-header"><h2>⚠️ تأكيد الحذف</h2><button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>✕</button></div>
              <div className="modal-body">
                <p>هل أنت متأكد من حذف المورد <strong>{s.supplierName}</strong>؟</p>
                {s.balance !== 0 ? (
                  <div style={{ background: "rgba(220,38,38,0.1)", borderRight: "3px solid #dc2626", padding: "0.75rem", borderRadius: "6px", marginTop: "0.5rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "#dc2626", margin: 0 }}>
                      ⚠️ المورد لديه رصيد <strong>{s.balance > 0 ? "دائن" : "مدين"}: {Math.abs(s.balance).toLocaleString()} ريال</strong>
                    </p>
                    <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.5rem 0 0 0" }}>
                      يجب تسوية الرصيد أولاً قبل حذف المورد.
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>سيتم إخفاء المورد مع الاحتفاظ بسجل المعاملات</p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>إلغاء</button>
                <button className="btn" style={{ background: s.balance !== 0 ? "#6b7280" : "#dc2626", color: "#fff" }}
                  onClick={() => s.balance === 0 && handleDelete(s.supplierId)} disabled={saving || s.balance !== 0}>
                  {saving ? "..." : s.balance !== 0 ? "الرصيد غير صفري" : "تأكيد الحذف"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Purchase Confirm */}
        {deletePurchConfirm && (() => {
          const purch = purchases.find(p => p.purchaseId === deletePurchConfirm);
          const hasPayments = purch && purch.paidAmount > 0;
          return (
          <div className="modal-overlay" onClick={() => setDeletePurchConfirm(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <div className="modal-header"><h2>⚠️ إلغاء الفاتورة</h2><button className="modal-close" onClick={() => setDeletePurchConfirm(null)}>✕</button></div>
              <div className="modal-body">
                <p>هل أنت متأكد من إلغاء الفاتورة <strong>{deletePurchConfirm}</strong>؟</p>
                {hasPayments ? (
                  <>
                    <div style={{ background: "rgba(220,38,38,0.1)", borderRight: "3px solid #dc2626", padding: "0.75rem", borderRadius: "6px", marginTop: "0.5rem" }}>
                      <p style={{ fontSize: "0.85rem", color: "#dc2626", margin: 0 }}>
                        ⚠️ هذه الفاتورة مسددة بـ <strong>{purch.paidAmount.toLocaleString()} ريال</strong>.
                      </p>
                      <p style={{ fontSize: "0.85rem", color: "#dc2626", margin: "0.5rem 0 0 0" }}>
                        إلغاؤها سيجعل المورد <strong>مديناً</strong> بهذا المبلغ (رصيد سالب).
                      </p>
                      <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "0.5rem 0 0 0" }}>
                        نصيحة: احذف الدفعات أولاً لتصفير الرصيد بالكامل.
                      </p>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>سيتم عكس المبلغ من رصيد المورد</p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDeletePurchConfirm(null)}>إلغاء</button>
                <button className="btn" style={{ background: "#dc2626", color: "#fff" }} onClick={() => handleDeletePurchase(deletePurchConfirm)} disabled={saving}>
                  {saving ? "..." : "تأكيد الإلغاء"}
                </button>
              </div>
            </div>
          </div>
          );
        })()}

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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px" }}>
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
                {/* Inventory action selector */}
                <div className="form-group" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  <label style={{ fontWeight: "bold", color: "var(--accent)", marginBottom: "0.4rem" }}>📦 الربط بالمخزون</label>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="invAction" value="add" checked={inventoryAction === "add"}
                        onChange={() => setInventoryAction("add")} /> إضافة أصناف جديدة
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="invAction" value="restock" checked={inventoryAction === "restock"}
                        onChange={() => setInventoryAction("restock")} /> تطوير المخزون (زيادة الكميات)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="invAction" value="none" checked={inventoryAction === "none"}
                        onChange={() => setInventoryAction("none")} /> توثيق فقط (بدون تغيير الكميات)
                    </label>
                  </div>
                  {inventoryAction === "restock" && (
                    <div style={{ fontSize: "0.75rem", color: "#6366f1", marginBottom: "0.4rem" }}>
                      💡 سيتم إضافة الكميات المدخلة إلى الأصناف الموجودة في المخزون
                    </div>
                  )}
                  {inventoryAction === "add" && (
                    <div style={{ fontSize: "0.75rem", color: "#059669", marginBottom: "0.4rem" }}>
                      💡 سيتم إنشاء أصناف جديدة في المخزون (الأصناف الموجودة لا تتأثر)
                    </div>
                  )}
                  {inventoryAction === "none" && (
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.4rem" }}>
                      💡 يتم توثيق الأصناف في الفاتورة فقط بدون تغيير كميات المخزون
                    </div>
                  )}
                </div>

                {/* Inventory items section */}
                <div className="form-group" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <label style={{ fontWeight: "bold", color: "var(--accent)", margin: 0 }}>📦 ربط بالمخزون</label>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
                      setPurchaseItems([...purchaseItems, { itemId: "", itemName: "", quantity: 1, unitCost: "", amount: "" }]);
                    }}>+ إضافة صنف</button>
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "0.4rem" }}>أدخل تكلفة الوحدة أو الإجمالي — يحسب الآخر تلقائياً</div>
                  {purchaseItems.map((item, idx) => {
                    const updateItem = (changes) => {
                      const n = [...purchaseItems];
                      n[idx] = { ...n[idx], ...changes };
                      // Auto-calculate: if unitCost changes or qty changes → recalc amount; if amount changes → recalc unitCost
                      if ("unitCost" in changes || "quantity" in changes) {
                        const q = parseInt(n[idx].quantity) || 1;
                        const uc = parseFloat(n[idx].unitCost);
                        if (uc > 0) n[idx].amount = (uc * q).toString();
                      } else if ("amount" in changes) {
                        const q = parseInt(n[idx].quantity) || 1;
                        const a = parseFloat(n[idx].amount);
                        if (a > 0 && q > 0) n[idx].unitCost = (a / q).toFixed(2);
                      }
                      setPurchaseItems(n);
                    };
                    return (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 45px 65px 65px 24px", gap: "0.3rem", marginBottom: "0.35rem", alignItems: "start" }}>
                      <div>
                        {item.isNew ? (
                          <div style={{ display: "flex", gap: "0.2rem", alignItems: "center" }}>
                            <input className="form-control" value={item.itemName}
                              onChange={e => { const n = [...purchaseItems]; n[idx] = { ...n[idx], itemName: e.target.value }; setPurchaseItems(n); }}
                              placeholder="اسم الصنف..." style={{ fontSize: "0.78rem", padding: "0.25rem 0.3rem", height: "auto" }} />
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
                              const n = [...purchaseItems]; n[idx] = { ...n[idx], isNew: false, itemId: "", itemName: "" }; setPurchaseItems(n);
                            }} style={{ fontSize: "0.6rem", padding: "0.15rem 0.25rem", whiteSpace: "nowrap" }}>← اختر</button>
                          </div>
                        ) : (
                          <select className="form-control" value={item.itemId || ""}
                            onChange={e => {
                              const val = e.target.value; const n = [...purchaseItems];
                              if (val === "__new__") { n[idx] = { ...n[idx], isNew: true, itemId: "", itemName: "" }; }
                              else { const s = inventoryItems.find(i => i.itemId === val); n[idx] = { ...n[idx], itemId: val, itemName: s ? s.itemName : "", isNew: false }; }
                              setPurchaseItems(n);
                            }}
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.3rem", height: "auto" }}>
                            <option value="">— اختر —</option>
                            <option value="__new__">➕ جديد</option>
                            {inventoryItems.map(i => (
                              <option key={i.itemId} value={i.itemId}>{i.itemName} ({i.availableQuantity}){inventoryAction === "restock" ? ` ↑ +${item.quantity || 0}` : ""}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <input type="number" min="1" className="form-control" value={item.quantity}
                          onChange={e => updateItem({ quantity: e.target.value })}
                          style={{ fontSize: "0.78rem", padding: "0.25rem 0.3rem", height: "auto" }} />
                        {inventoryAction === "restock" && item.itemId && (() => {
                          const inv = inventoryItems.find(i => i.itemId === item.itemId);
                          return inv ? <div style={{ fontSize: "0.65rem", color: "#6366f1", lineHeight: 1.2 }}>{inv.totalQuantity}←{inv.totalQuantity + (parseInt(item.quantity) || 1)}</div> : null;
                        })()}
                      </div>
                      <div>
                        <input type="number" min="0" step="0.01" className="form-control" value={item.unitCost}
                          onChange={e => updateItem({ unitCost: e.target.value })}
                          placeholder="سعر الوحدة" style={{ fontSize: "0.78rem", padding: "0.25rem 0.3rem", height: "auto" }} />
                      </div>
                      <div>
                        <input type="number" min="0" step="0.01" className="form-control" value={item.amount}
                          onChange={e => updateItem({ amount: e.target.value })}
                          placeholder="الإجمالي" style={{ fontSize: "0.78rem", padding: "0.25rem 0.3rem", height: "auto" }} />
                      </div>
                      <button type="button" onClick={() => { if (purchaseItems.length > 1) setPurchaseItems(purchaseItems.filter((_, i) => i !== idx)); }}
                        style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem", padding: "0.35rem 0 0" }}>✕</button>
                    </div>
                    );
                  })}
                  {purchaseItems.some(i => parseFloat(i.amount) > 0) && (
                    <div style={{ fontSize: "0.8rem", color: "var(--accent)", marginTop: "0.15rem", textAlign: "left" }}>
                      إجمالي الأصناف: {purchaseItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toLocaleString()} ر.ي
                    </div>
                  )}
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
                    {purchases.filter(p => p.remainingAmount > 0 && p.status !== "carried").map(p => (
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

        {/* View/Edit Invoice Modal */}
        {viewInvoice && (() => {
          const statusLabels = { open: "مفتوحة", closed: "مسددة", cancelled: "ملغاة", carried: "مرحلة" };
          const statusColors = { open: "#f59e0b", closed: "#059669", cancelled: "#dc2626", carried: "#6366f1" };
          const inv = editInvoiceForm?.purchaseId === viewInvoice.purchaseId ? editInvoiceForm : viewInvoice;

          const handleSave = async () => {
            setEditInvoiceSaving(true);
            try {
              const tk = localStorage.getItem("token");
              const res = await fetch("/api/finance/suppliers/purchases", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                body: JSON.stringify({
                  purchaseId: inv.purchaseId,
                  description: inv.description,
                  date: inv.date,
                  notes: inv.notes,
                  costCenter: inv.costCenter,
                  accountCode: inv.accountCode,
                  imageUrl: inv.imageUrl,
                  inventoryItems: inv.inventoryItems,
                  inventoryAction: "none",
                }),
              });
              const data = await res.json();
              if (data.success) {
                setSuccessMsg("تم تحديث الفاتورة");
                setViewInvoice(null);
                fetchPurchases(selectedSupplier.supplierId);
              } else setErrorMsg(data.error);
            } catch { setErrorMsg("فشل التحديث"); }
            setEditInvoiceSaving(false);
          };

          return (
          <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", maxHeight: "85vh", overflowY: "auto" }}>
              <div className="modal-header">
                <h2>📄 {inv.purchaseId}</h2>
                <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "4px", background: `${statusColors[inv.status]}22`, color: statusColors[inv.status], fontWeight: "bold" }}>
                  {statusLabels[inv.status] || inv.status}
                </span>
                <button className="modal-close" onClick={() => setViewInvoice(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Invoice info card */}
                <div className="card" style={{ padding: "0.75rem", marginBottom: "0.75rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
                    <div><strong>التاريخ:</strong> {editInvoiceMode
                      ? <input type="date" className="form-control" value={inv.date} onChange={e => setEditInvoiceForm({...inv, date: e.target.value})} style={{ fontSize: "0.8rem", padding: "0.2rem", height: "auto" }} />
                      : inv.date}</div>
                    <div><strong>المورد:</strong> {selectedSupplier?.supplierName || inv.supplierId}</div>
                    <div style={{ gridColumn: "span 2" }}><strong>البيان:</strong> {editInvoiceMode
                      ? <input className="form-control" value={inv.description} onChange={e => setEditInvoiceForm({...inv, description: e.target.value})} style={{ fontSize: "0.8rem", padding: "0.2rem", height: "auto", width: "100%" }} />
                      : inv.description}</div>
                    <div><strong>المبلغ الإجمالي:</strong> {inv.totalAmount.toLocaleString()} ر.ي</div>
                    <div><strong>المدفوع:</strong> {inv.paidAmount.toLocaleString()} ر.ي</div>
                    <div><strong>حساب المصروف:</strong> {editInvoiceMode
                      ? <select className="form-control" value={inv.accountCode} onChange={e => setEditInvoiceForm({...inv, accountCode: e.target.value})} style={{ fontSize: "0.8rem", padding: "0.2rem", height: "auto" }}>
                          <option value="">-- اختر --</option>
                          {accounts.filter(a => (a.accountType === "expense" || a.accountType === "asset") && !a.parentCode).map(ac => (
                            <optgroup key={ac.accountCode} label={`${ac.accountName} (${ac.accountCode})`}>
                              {accounts.filter(c => c.parentCode === ac.accountCode && (c.accountType === "expense" || c.accountType === "asset")).map(child => (
                                <option key={child.accountCode} value={child.accountCode}>{child.accountName} ({child.accountCode})</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      : (inv.accountCode ? `${getAccountName(inv.accountCode)} (${inv.accountCode})` : "-")}</div>
                    <div><strong>مركز التكلفة:</strong> {editInvoiceMode
                      ? <select className="form-control" value={inv.costCenter} onChange={e => setEditInvoiceForm({...inv, costCenter: e.target.value})} style={{ fontSize: "0.8rem", padding: "0.2rem", height: "auto" }}>
                          <option value="">-- اختر --</option>
                          {costCenters.filter(c => c.isActive !== false).map(cc => (
                            <option key={cc.code} value={cc.code}>{cc.name} ({cc.code})</option>
                          ))}
                        </select>
                      : inv.costCenter || "-"}</div>
                    <div style={{ gridColumn: "span 2" }}><strong>ملاحظات:</strong> {editInvoiceMode
                      ? <input className="form-control" value={inv.notes} onChange={e => setEditInvoiceForm({...inv, notes: e.target.value})} style={{ fontSize: "0.8rem", padding: "0.2rem", height: "auto", width: "100%" }} />
                      : inv.notes || "-"}</div>
                  </div>
                </div>

                {/* Inventory items */}
                {inv.inventoryItems && inv.inventoryItems.length > 0 && (
                  <div className="card" style={{ padding: "0.6rem", marginBottom: "0.75rem" }}>
                    <h5 style={{ margin: "0 0 0.4rem 0", fontSize: "0.85rem" }}>📦 الأصناف</h5>
                    <table className="inv-table" style={{ fontSize: "0.78rem" }}>
                      <thead><tr><th>الصنف</th><th>العدد</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                      <tbody>
                        {inv.inventoryItems.map((item, i) => (
                          <tr key={i}>
                            <td>{item.itemName}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unitCost ? item.unitCost.toLocaleString() : "-"}</td>
                            <td>{item.amount ? item.amount.toLocaleString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Transactions linked to this invoice */}
                {transactions.filter(t => t.purchaseId === inv.purchaseId && t.type === "payment").length > 0 && (
                  <div className="card" style={{ padding: "0.6rem", marginBottom: "0.75rem" }}>
                    <h5 style={{ margin: "0 0 0.4rem 0", fontSize: "0.85rem" }}>💰 عمليات الدفع</h5>
                    <table className="inv-table" style={{ fontSize: "0.78rem" }}>
                      <thead><tr><th>التاريخ</th><th>المبلغ</th><th>البيان</th></tr></thead>
                      <tbody>
                        {transactions.filter(t => t.purchaseId === inv.purchaseId && t.type === "payment").map((t, i) => (
                          <tr key={i}>
                            <td>{t.date}</td>
                            <td style={{ color: "#059669" }}>{t.amount.toLocaleString()}</td>
                            <td style={{ fontSize: "0.7rem" }}>{t.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Image */}
                {inv.imageUrl && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <img src={inv.imageUrl} alt="فاتورة" style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "6px" }} />
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-start" }}>
                {editInvoiceMode ? (
                  <>
                    <button className="btn btn-primary" onClick={handleSave} disabled={editInvoiceSaving}>{editInvoiceSaving ? "..." : "💾 حفظ"}</button>
                    <button className="btn btn-secondary" onClick={() => { setEditInvoiceMode(false); setEditInvoiceForm({ ...viewInvoice }); }}>إلغاء</button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={() => setEditInvoiceMode(true)}>✏️ تعديل</button>
                )}
                <button className="btn btn-secondary" style={{ marginRight: "auto" }} onClick={() => printPurchaseStatement(viewInvoice)}>🖨️ طباعة</button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Share Modal */}
        {shareModal && (() => {
          const { type, purchase, supplier: s, phone, supplierName, transactions: trans, purchases: purs, amount, purchaseId, notes, afterSave } = shareModal;
          const phoneClean = phone?.replace(/^0+/, "967") || "";
          const shareTitle = type === "purchase" ? `فاتورة توريد${purchase?.purchaseId ? ` - ${purchase.purchaseId}` : ""}` : type === "payment" ? "إشعار تسديد" : `كشف حساب ${s?.supplierName || supplierName || ""}`;

          const getTextMsg = () => {
            if (type === "purchase") {
              const p = purchase;
              const totalAmt = parseFloat(p?.totalAmount) || 0;
              const msg = `شركة التعزي للمناسبات والتأجير\n━━━━━━━━━━━━━━━━\n📄 فاتورة توريد\n━━━━━━━━━━━━━━━━\nالرقم: ${p?.purchaseId || ""}\nالبيان: ${p?.description || ""}\nالإجمالي علينا: ${totalAmt.toLocaleString()} ر.ي\nالتاريخ: ${p?.date || ""}`;
              return encodeURIComponent(msg);
            }
            if (type === "payment") {
              const amtVal = parseFloat(amount) || 0;
              const afterBal = (s?.balance || 0) - amtVal;
              const balTxt = afterBal > 0 ? `الباقي علينا: ${afterBal.toLocaleString()} ر.ي` : afterBal < 0 ? `الباقي لنا: ${Math.abs(afterBal).toLocaleString()} ر.ي` : "✅ تم تسديد كامل المبلغ";
              const msg = `شركة التعزي للمناسبات والتأجير\n━━━━━━━━━━━━━━━━\n💰 إشعار تسديد\n━━━━━━━━━━━━━━━━\nالمورد: ${s?.supplierName || ""}\nالمسدد منّا لكم: ${amtVal.toLocaleString()} ر.ي${purchaseId ? `\nفاتورة: ${purchaseId}` : ""}\n(فقط ${amountInWords(amtVal)})\n${notes ? `البيان: ${notes}\n` : ""}${balTxt}`;
              return encodeURIComponent(msg);
            }
            // statement
            const totalPurch = (purs || []).filter(p => p.status !== "cancelled").reduce((sum, p) => sum + p.totalAmount, 0);
            const totalPaid = (trans || []).filter(t => t.type === "payment").reduce((sum, t) => sum + t.amount, 0);
            const balTxt = (s?.balance || 0) > 0 ? `علينا: ${(s?.balance || 0).toLocaleString()} ر.ي` : (s?.balance || 0) < 0 ? `لنا: ${Math.abs(s?.balance || 0).toLocaleString()} ر.ي` : "متساوي";
            const msg = `شركة التعزي للمناسبات والتأجير\n━━━━━━━━━━━━━━━━\n📊 كشف حساب ${s?.supplierName || supplierName || ""}\n━━━━━━━━━━━━━━━━\nإجمالي المشتريات علينا: ${totalPurch.toLocaleString()} ر.ي\nإجمالي المسدد منّا: ${totalPaid.toLocaleString()} ر.ي\nالرصيد الحالي ${balTxt}`;
            return encodeURIComponent(msg);
          };

          const handleSendText = () => {
            window.open(`https://wa.me/${phoneClean}?text=${getTextMsg()}`, "_blank");
            setShareModal(null);
          };

          const handleSendDoc = async (format) => {
            if (!shareContentRef.current) return;
            const el = shareContentRef.current;
            el.style.display = "block";
            el.style.position = "absolute";
            el.style.left = "-9999px";
            el.style.top = "0";
            el.style.width = "794px";
            el.style.background = "#fff";
            el.style.color = "#111";
            el.style.direction = "rtl";
            el.style.fontFamily = "sans-serif";
            el.style.padding = "1.5rem";
            await new Promise(r => setTimeout(r, 300));

            try {
              const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
              el.style.display = "none";

              if (format === "pdf") {
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
                pdf.save(`${shareTitle}.pdf`);
                setSuccessMsg(`✅ تم تحميل ملف PDF: ${shareTitle}.pdf`);
              } else {
                const link = document.createElement("a");
                link.download = `${shareTitle}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                setSuccessMsg(`✅ تم تحميل الصورة: ${shareTitle}.png`);
              }
            } catch (err) {
              setErrorMsg("فشل إنشاء المستند: " + err.message);
              el.style.display = "none";
            }
            setShareModal(null);
          };

          const renderDocContent = () => {
            if (type === "purchase") {
              const p = purchase;
              const totalAmt = parseFloat(p?.totalAmount) || 0;
              const paidTrans = (trans || []).filter(t => t.type === "payment" && (t.notes?.includes(p?.purchaseId) || t.purchaseId === p?.purchaseId));
              const totalPaid = paidTrans.reduce((s, t) => s + (t.amount || 0), 0);
              const remaining = totalAmt - totalPaid;
              const isPaid = remaining <= 0;
              const carriedNotes = p?.notes?.match(/\[مرحل من:.*?\]/)?.[0] || "";
              return (
                <div>
                  <div style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>شركة التعزي للمناسبات والتأجير</div>
                  <div style={{ textAlign: "center", fontSize: "1rem", fontWeight: "bold", marginBottom: "0.8rem", color: "#1a5c3e" }}>فاتورة توريد - {p?.purchaseId}</div>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>المورد: {s?.supplierName || ""}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", marginBottom: "0.8rem" }}>
                    <thead><tr style={{ background: "#1a5c3e", color: "#fff" }}>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>التاريخ</th>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>النوع</th>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>الرقم</th>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>البيان</th>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>مدين</th>
                      <th style={{ padding: "0.3rem", border: "1px solid #ccc" }}>دائن</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>{p?.date || "-"}</td>
                        <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>فاتورة توريد</td>
                        <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>{p?.purchaseId || ""}</td>
                        <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>{p?.description || ""}</td>
                        <td style={{ padding: "0.3rem", border: "1px solid #ccc", textAlign: "center" }}>-</td>
                        <td style={{ padding: "0.3rem", border: "1px solid #ccc", textAlign: "center", color: "#dc2626", fontWeight: "bold" }}>{totalAmt.toLocaleString()}</td>
                      </tr>
                      {paidTrans.map(pt => (
                        <tr key={pt.transId}><td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>{pt.date}</td>
                          <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>تسديد</td>
                          <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>-</td>
                          <td style={{ padding: "0.3rem", border: "1px solid #ccc" }}>{pt.notes || "تسديد"}</td>
                          <td style={{ padding: "0.3rem", border: "1px solid #ccc", textAlign: "center", color: "#059669", fontWeight: "bold" }}>{pt.amount.toLocaleString()}</td>
                          <td style={{ padding: "0.3rem", border: "1px solid #ccc", textAlign: "center" }}>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ borderTop: "2px solid #1a5c3e", padding: "0.5rem 0", marginTop: "0.3rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}><span>لكم:</span><span>{totalAmt.toLocaleString()}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}><span>المسدد منّا:</span><span>{totalPaid.toLocaleString()}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: "bold", color: "#1a5c3e", marginTop: "0.2rem" }}>
                      <span>{isPaid ? "مسددة" : "الإجمالي علينا"}:</span><span>{isPaid ? "0" : remaining.toLocaleString()}</span>
                    </div>
                    {!isPaid && <div style={{ fontSize: "0.75rem", textAlign: "center", marginTop: "0.2rem" }}>(فقط {amountInWords(remaining)})</div>}
                  </div>
                  <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ccc", paddingTop: "0.5rem" }}>
                    <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>توقيع المدير</div></div>
                    <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>الختم</div></div>
                  </div>
                </div>
              );
            }
            if (type === "payment") {
              const amtVal = parseFloat(amount) || 0;
              const afterBal = (s?.balance || 0) - amtVal;
              return (
                <div>
                  <div style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>شركة التعزي للمناسبات والتأجير</div>
                  <div style={{ textAlign: "center", fontSize: "1rem", fontWeight: "bold", marginBottom: "0.8rem", color: "#1a5c3e" }}>إشعار تسديد</div>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>المورد: {s?.supplierName || ""}</div>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>المسدد منّا لكم: {amtVal.toLocaleString()} ر.ي</div>
                  <div style={{ fontSize: "0.8rem" }}>(فقط {amountInWords(amtVal)})</div>
                  <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                    {afterBal > 0 ? `الباقي علينا: ${afterBal.toLocaleString()} ر.ي` : afterBal < 0 ? `الباقي لنا: ${Math.abs(afterBal).toLocaleString()} ر.ي` : "✅ تم تسديد كامل المبلغ"}
                  </div>
                  <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ccc", paddingTop: "0.5rem" }}>
                    <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>توقيع المدير</div></div>
                    <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>الختم</div></div>
                  </div>
                </div>
              );
            }
            // statement
            const activePurs = (purs || []).filter(p => p.status !== "cancelled");
            const paidTrans = (trans || []).filter(t => t.type === "payment");
            return (
              <div>
                <div style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>شركة التعزي للمناسبات والتأجير</div>
                <div style={{ textAlign: "center", fontSize: "1rem", fontWeight: "bold", marginBottom: "0.8rem", color: "#1a5c3e" }}>كشف حساب {s?.supplierName || supplierName || ""}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", marginBottom: "0.8rem" }}>
                  <thead><tr style={{ background: "#1a5c3e", color: "#fff" }}>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>التاريخ</th>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>النوع</th>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>الرقم</th>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>البيان</th>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>مدين</th>
                    <th style={{ padding: "0.25rem", border: "1px solid #ccc" }}>دائن</th>
                  </tr></thead>
                  <tbody>
                    {activePurs.map(p => (
                      <tr key={p.purchaseId}>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{p.date}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{p.status === "carried" ? "مرحلة" : "فاتورة"}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{p.purchaseId}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{p.description}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc", textAlign: "center" }}>-</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc", textAlign: "center" }}>{p.totalAmount?.toLocaleString()}</td>
                      </tr>
                    ))}
                    {paidTrans.map(pt => (
                      <tr key={pt.transId}>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{pt.date}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>تسديد</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>-</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc" }}>{pt.notes || ""}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc", textAlign: "center", color: "#059669" }}>{pt.amount?.toLocaleString()}</td>
                        <td style={{ padding: "0.25rem", border: "1px solid #ccc", textAlign: "center" }}>-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: "0.85rem" }}>
                  {(s?.balance || 0) > 0 ? `الرصيد الحالي علينا: ${(s?.balance || 0).toLocaleString()} ر.ي` : (s?.balance || 0) < 0 ? `الرصيد الحالي لنا: ${Math.abs(s?.balance || 0).toLocaleString()} ر.ي` : "الرصيد متساوي"}
                </div>
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ccc", paddingTop: "0.5rem" }}>
                  <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>توقيع المدير</div></div>
                  <div><div style={{ width: "120px", borderBottom: "1px solid #000", marginBottom: "0.2rem" }}></div><div style={{ fontSize: "0.75rem", textAlign: "center" }}>الختم</div></div>
                </div>
              </div>
            );
          };

          return (
            <div className="modal-overlay" onClick={() => setShareModal(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                <div className="modal-header">
                  <h2>📤 إرسال عبر واتساب</h2>
                  <button className="modal-close" onClick={() => setShareModal(null)}>✕</button>
                </div>
                <div className="modal-body" style={{ textAlign: "center" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "1rem", fontSize: "0.9rem" }}>{shareTitle}</p>
                  <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "1rem" }}>إلى: {s?.supplierName || supplierName || phone}</p>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-gold" onClick={handleSendText} style={{ minWidth: "100px" }}>
                      💬 إرسال نص
                    </button>
                    <button className="btn" style={{ background: "#059669", color: "#fff", minWidth: "100px" }} onClick={() => handleSendDoc("pdf")}>
                      📄 إرسال PDF
                    </button>
                    <button className="btn" style={{ background: "#6366f1", color: "#fff", minWidth: "100px" }} onClick={() => handleSendDoc("image")}>
                      🖼️ إرسال صورة
                    </button>
                  </div>
                  <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: "0.75rem" }}>
                    PDF/صورة: يتم تحميل الملف تلقائياً، يمكنك إرساله عبر واتساب
                  </div>
                </div>
                {/* Hidden render target */}
                <div ref={shareContentRef} style={{ display: "none" }}>{renderDocContent()}</div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
