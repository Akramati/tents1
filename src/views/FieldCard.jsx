"use client";
import { useState, useEffect } from "react";

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

const TRANSPORT_ACCOUNTS = {
  preparation: { company: ["5101-02", "5101-03"], rented: ["5101-08"] },
  removal:    { company: ["5103-02", "5103-03"], rented: ["5103-08"] },
};

const CUSTOM_ACCOUNTS = {
  preparation: "5101-06",
  installation: "5102-05",
  removal: "5103-06",
};

const CASH_ACCOUNTS = [
  { code: "1101", label: "💰 صندوق الصالة" },
  { code: "1102", label: "📱 محفظة كريمي" },
  { code: "1103", label: "📱 محفظة جوالي" },
  { code: "1104", label: "📱 محفظة جيب" },
];

export default function FieldCard({ booking, onMove, onComplete, onExpense, onTransfer, onExtend, onRefresh, costCenters, fieldAccounts, onPrintItems, onPayment }) {
  const [expanded, setExpanded] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({});
  const [customDesc, setCustomDesc] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [transportType, setTransportType] = useState("company");
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [cashAccount, setCashAccount] = useState("1101");

  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [inventoryList, setInventoryList] = useState([]);
  const [newItemId, setNewItemId] = useState("");

  useEffect(() => {
    if (editingItems && inventoryList.length === 0) {
      fetch("/api/inventory")
        .then(r => r.json())
        .then(d => { if (d.success) setInventoryList(d.items || []); })
        .catch(() => {});
    }
  }, [editingItems, inventoryList.length]);

  const startEditingItems = () => {
    setEditItems((booking.rentedItems || []).map(i => ({ ...i })));
    setEditingItems(true);
    setNewItemId("");
  };

  const handleEditQty = (idx, val) => {
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], quantityRequested: parseInt(val) || 0 };
    setEditItems(updated);
  };

  const handleRemoveEditItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddInventoryItem = () => {
    if (!newItemId) return;
    const inv = inventoryList.find(i => i.itemId === newItemId);
    if (!inv) return;
    setEditItems(prev => {
      const exists = prev.find(i => i.itemId === newItemId);
      if (exists) {
        return prev.map(i => i.itemId === newItemId ? { ...i, quantityRequested: i.quantityRequested + 1 } : i);
      }
      return [...prev, { itemId: inv.itemId, itemName: inv.itemName, quantityRequested: 1, unitPrice: 0 }];
    });
    setNewItemId("");
  };

  const saveEditedItems = async () => {
    setEditSaving(true);
    try {
      const tk = localStorage.getItem("token");
      const res = await fetch("/api/bookings/field/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ bookingId: booking.bookingId, items: editItems }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingItems(false);
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || "فشل الحفظ");
      }
    } catch { alert("خطأ في الاتصال"); }
    setEditSaving(false);
  };

  const items = booking.rentedItems || [];
  const stage = booking.fieldStatus || "pending";
  const expenseAccounts = fieldAccounts?.[stage] || FALLBACK_EXPENSE_ACCOUNTS[stage] || [];
  const accounts = expenseAccounts;
  const customCode = CUSTOM_ACCOUNTS[stage];

  const handleQuickExpense = async () => {
    if (saving) return;
    const entries = Object.entries(expenseForm).filter(([_, v]) => parseFloat(v) > 0);
    const hasCustom = customDesc && parseFloat(customAmount) > 0;
    if (entries.length === 0 && !hasCustom) return;

    setSaving(true);
    const transportVal = transportType === "company" ? "company_vehicle" : transportType === "rented" ? "hired_vehicle" : transportType === "customer" ? "client" : "";
    const ccType = selectedCostCenter ? "vehicle" : "";
    const tk = localStorage.getItem("token");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${tk}` };
    let count = 0;
    for (const [code, amt] of entries) {
      try {
        const r = await fetch("/api/bookings/field/expense", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ bookingId: booking.bookingId, stage, accountCode: code, amount: parseFloat(amt), costCenter: selectedCostCenter || undefined, costCenterType: ccType || undefined, transportType: transportVal || undefined, cashAccountCode: cashAccount }),
        });
        const d = await r.json();
        if (d.success) count++;
      } catch {}
    }
    if (hasCustom) {
      try {
        const r = await fetch("/api/bookings/field/expense", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ bookingId: booking.bookingId, stage, accountCode: customCode, amount: parseFloat(customAmount), description: customDesc, costCenter: selectedCostCenter || undefined, costCenterType: ccType || undefined, transportType: transportVal || undefined, cashAccountCode: cashAccount }),
        });
        const d = await r.json();
        if (d.success) count++;
      } catch {}
    }
    setSaving(false);
    if (count > 0) {
      setExpenseForm({});
      setCustomDesc("");
      setCustomAmount("");
      setShowExpense(false);
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="field-card" draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("bookingId", booking.bookingId);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="field-card-header">
        <span className="card-id">{booking.bookingId}</span>
        <span className={`card-type type-${(booking.bookingType || "عادية").replace(/\s/g, "")}`}>
          {booking.bookingType || "عادية"}
        </span>
      </div>

      <div className="field-card-body">
        <p className="card-customer">
          {booking.customerName}
          {(booking.notes || "").includes("تمديد:") && (
            <span className="extended-badge" style={{display:"inline-block",fontSize:"0.6rem",background:"#f59e0b",color:"#fff",padding:"0.1rem 0.35rem",borderRadius:"0.25rem",marginRight:"0.35rem",verticalAlign:"middle"}}>ممدد</span>
          )}
        </p>
        <p className="card-date">📅 {booking.startDate} → {booking.endDate || "?"}</p>
        {items.length > 0 && !editingItems && (
          <button className="card-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? "▲ إخفاء المواد" : "▼ المواد المطلوبة"} ({items.length})
          </button>
        )}
        {expanded && !editingItems && (
          <ul className="card-items">
            {items.map((item) => (
              <li key={item.id || item.itemId} className="card-item-row">
                <span className="card-item-name">{item.itemName}</span>
                <span className="card-item-qty">× {item.quantityRequested}</span>
                {item.transferAction === "inherit" && <span className="pkg-item-tag" style={{fontSize:"0.65rem",background:"rgba(76,175,80,0.15)",color:"#4caf50",padding:"0.05rem 0.3rem",borderRadius:"0.25rem",marginRight:"0.3rem"}}>✓ منقول</span>}
                {item.transferAction === "pick" && <span className="pkg-item-tag" style={{fontSize:"0.65rem",background:"rgba(255,215,0,0.15)",color:"#f59e0b",padding:"0.05rem 0.3rem",borderRadius:"0.25rem",marginRight:"0.3rem"}}>📥 استلام {item.quantityRequested}</span>}
                {item.transferAction === "return" && <span className="pkg-item-tag" style={{fontSize:"0.65rem",background:"rgba(255,68,68,0.15)",color:"#ef4444",padding:"0.05rem 0.3rem",borderRadius:"0.25rem",marginRight:"0.3rem"}}>📤 إرجاع {item.quantityRequested}</span>}
              </li>
            ))}
          </ul>
        )}

        {/* Inline item editing for installed stage */}
        {editingItems && (
          <div style={{padding:"0.25rem 0",borderTop:"1px dashed var(--border)",marginTop:"0.25rem"}}>
            <p style={{fontSize:"0.7rem",fontWeight:600,marginBottom:"0.3rem"}}>✏️ تعديل الأصناف في الموقع:</p>
            {(editItems || []).map((item, idx) => (
              <div key={idx} style={{display:"flex",gap:"0.25rem",alignItems:"center",marginBottom:"0.2rem",fontSize:"0.7rem"}}>
                <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.itemName}</span>
                <input type="number" min="0" value={item.quantityRequested}
                  onChange={(e) => handleEditQty(idx, e.target.value)}
                  style={{width:"50px",fontSize:"0.7rem",padding:"0.1rem 0.2rem",textAlign:"center"}} />
                <button onClick={() => handleRemoveEditItem(idx)}
                  style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:"0.8rem",padding:"0 0.2rem"}}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",gap:"0.25rem",alignItems:"center",marginTop:"0.3rem",borderTop:"1px dashed var(--border)",paddingTop:"0.3rem"}}>
              <select value={newItemId} onChange={(e) => setNewItemId(e.target.value)}
                style={{flex:1,fontSize:"0.7rem",padding:"0.1rem 0.2rem"}}>
                <option value="">➕ إضافة صنف...</option>
                {inventoryList.map(inv => (
                  <option key={inv.itemId} value={inv.itemId}>{inv.itemName}</option>
                ))}
              </select>
              <button onClick={handleAddInventoryItem} disabled={!newItemId}
                style={{padding:"0.1rem 0.4rem",fontSize:"0.7rem",cursor:"pointer"}}>➕</button>
            </div>
            <div style={{display:"flex",gap:"0.25rem",marginTop:"0.3rem",justifyContent:"flex-end"}}>
              <button onClick={() => setEditingItems(false)}
                style={{padding:"0.15rem 0.5rem",fontSize:"0.7rem",background:"transparent",border:"1px solid var(--border)",borderRadius:"0.3rem",cursor:"pointer"}}>إلغاء</button>
              <button onClick={saveEditedItems} disabled={editSaving}
                style={{padding:"0.15rem 0.5rem",fontSize:"0.7rem",background:"#4caf50",color:"#fff",border:"none",borderRadius:"0.3rem",cursor:"pointer"}}>
                {editSaving ? "...حفظ" : "💾 حفظ"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="field-card-actions">
        {stage === "pending" && onMove && (
          <button className="card-btn prep-btn" onClick={() => onMove(booking.bookingId, "preparation")}>➡️ تجهيز</button>
        )}
        {stage === "preparation" && (
          <>
            {onExpense && <button className="card-btn expense-btn" onClick={() => onExpense(booking, "preparation")}>💰 مصاريف تجهيز</button>}
            {onPayment && <button className="card-btn pay-btn" onClick={() => onPayment(booking)}>💵 دفعة</button>}
            {onMove && <button className="card-btn install-btn" onClick={() => onMove(booking.bookingId, "installed")}>➡️ تثبيت</button>}
            {onPrintItems && <button className="card-btn" style={{color:"#6366f1",borderColor:"#6366f1"}} onClick={() => onPrintItems(booking)}>🖨️ طباعة الأصناف</button>}
          </>
        )}
        {stage === "installed" && (
          <>
            {onExpense && <button className="card-btn expense-btn" onClick={() => onExpense(booking, "installation")}>💰 مصاريف تركيب</button>}
            {onPayment && <button className="card-btn pay-btn" onClick={() => onPayment(booking)}>💵 دفعة</button>}
            <button className="card-btn" style={{color:"#3b82f6",borderColor:"#3b82f6"}} onClick={startEditingItems}>✏️ تعديل الأصناف</button>
            {onTransfer && <button className="card-btn transfer-btn" onClick={() => onTransfer(booking)}>🔄 نقل مباشر</button>}
            {onExtend && <button className="card-btn" style={{color:"#f59e0b",borderColor:"#f59e0b"}} onClick={() => onExtend(booking)}>⏱ تمديد</button>}
            {onComplete && <button className="card-btn complete-btn" onClick={() => onComplete(booking)}>📋 إتمام الجرد</button>}
            {onPrintItems && <button className="card-btn" style={{color:"#6366f1",borderColor:"#6366f1"}} onClick={() => onPrintItems(booking)}>🖨️ طباعة الأصناف</button>}
          </>
        )}
        {stage === "completed" && (
          <>
            {onPayment && <button className="card-btn pay-btn" onClick={() => onPayment(booking)}>💵 دفعة</button>}
            {onTransfer && <button className="card-btn transfer-btn" onClick={() => onTransfer(booking)}>🔄 نقل مباشر</button>}
            {onExtend && <button className="card-btn" style={{color:"#f59e0b",borderColor:"#f59e0b"}} onClick={() => onExtend(booking)}>⏱ تمديد</button>}
            {onComplete && <button className="card-btn complete-btn" onClick={() => onComplete(booking)}>📋 إتمام الجرد</button>}
            {onPrintItems && <button className="card-btn" style={{color:"#6366f1",borderColor:"#6366f1"}} onClick={() => onPrintItems(booking)}>🖨️ طباعة الأصناف</button>}
            {onMove && <button className="card-btn" style={{color:"#ef4444",borderColor:"#ef4444"}} onClick={() => onMove(booking.bookingId, "archived")}>🗑️ إخفاء</button>}
          </>
        )}
      </div>

      {/* Quick inline expense form */}
      {accounts.length > 0 && (
        <div className="card-inline-expense">
          <button className="card-toggle" onClick={() => setShowExpense(!showExpense)} style={{ width: "100%", textAlign: "center", fontSize: "0.75rem", padding: "0.25rem" }}>
            {showExpense ? "▲ إخفاء" : "💰 إضافة مصروف سريع"}
          </button>
          {showExpense && (
            <div className="inline-expense-form" style={{ padding: "0.25rem 0.5rem" }}>
              {accounts.map((acct) => (
                <div key={acct.code} className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.7rem", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</span>
                  <input type="number" min="0" step="0.01" value={expenseForm[acct.code] || ""}
                    onChange={(e) => setExpenseForm({ ...expenseForm, [acct.code]: e.target.value })}
                    placeholder="0" style={{ width: "60px", fontSize: "0.7rem", padding: "0.15rem 0.3rem" }} />
                </div>
              ))}
              {/* Transport section for preparation/removal */}
              {["preparation", "removal"].includes(stage) && (
                <>
                  <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.3rem" }}>
                    <span style={{ fontSize: "0.7rem", flex: 1 }}>🚛 نوع النقل</span>
                    <select value={transportType} onChange={(e) => setTransportType(e.target.value)}
                      style={{ fontSize: "0.7rem", padding: "0.15rem 0.3rem", flex: 1 }}>
                      <option value="company">موتر الشركة</option>
                      <option value="rented">موتر مستأجر</option>
                      <option value="customer">الزبون</option>
                    </select>
                  </div>
                  {transportType === "company" && (
                    <>
                      <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.15rem" }}>
                        <span style={{ fontSize: "0.7rem", flex: 1 }}>الموتر</span>
                        <select value={selectedCostCenter} onChange={(e) => setSelectedCostCenter(e.target.value)}
                          style={{ fontSize: "0.7rem", padding: "0.15rem 0.3rem", flex: 1 }}>
                          <option value="">اختر</option>
                          {(costCenters || []).map((cc) => (
                            <option key={cc.code} value={cc.code}>{cc.code}</option>
                          ))}
                        </select>
                      </div>
                      <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.15rem" }}>
                        <span style={{ fontSize: "0.7rem", flex: 1 }}>أجور سواق</span>
                        <input type="number" min="0" step="0.01"
                          value={expenseForm[TRANSPORT_ACCOUNTS[stage].company[0]] || ""}
                          onChange={(e) => setExpenseForm({ ...expenseForm, [TRANSPORT_ACCOUNTS[stage].company[0]]: e.target.value })}
                          placeholder="0" style={{ width: "60px", fontSize: "0.7rem", padding: "0.15rem 0.3rem" }} />
                      </div>
                      <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", flex: 1 }}>ديزل</span>
                        <input type="number" min="0" step="0.01"
                          value={expenseForm[TRANSPORT_ACCOUNTS[stage].company[1]] || ""}
                          onChange={(e) => setExpenseForm({ ...expenseForm, [TRANSPORT_ACCOUNTS[stage].company[1]]: e.target.value })}
                          placeholder="0" style={{ width: "60px", fontSize: "0.7rem", padding: "0.15rem 0.3rem" }} />
                      </div>
                    </>
                  )}
                  {transportType === "rented" && (
                    <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.15rem" }}>
                      <span style={{ fontSize: "0.7rem", flex: 1 }}>تكلفة النقل</span>
                      <input type="number" min="0" step="0.01"
                        value={expenseForm[TRANSPORT_ACCOUNTS[stage].rented[0]] || ""}
                        onChange={(e) => setExpenseForm({ ...expenseForm, [TRANSPORT_ACCOUNTS[stage].rented[0]]: e.target.value })}
                        placeholder="0" style={{ width: "60px", fontSize: "0.7rem", padding: "0.15rem 0.3rem" }} />
                    </div>
                  )}
                </>
              )}
              {/* Cash account select */}
              <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.3rem", borderTop: "1px dashed var(--border)", paddingTop: "0.3rem" }}>
                <span style={{ fontSize: "0.7rem", flex: 1 }}>🏦 الخزينة</span>
                <select value={cashAccount} onChange={(e) => setCashAccount(e.target.value)}
                  style={{ fontSize: "0.7rem", padding: "0.15rem 0.3rem", flex: 1 }}>
                  {CASH_ACCOUNTS.map((ca) => (
                    <option key={ca.code} value={ca.code}>{ca.label}</option>
                  ))}
                </select>
              </div>
              {/* Custom expense row */}
              <div className="inline-expense-row" style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.3rem", borderTop: "1px dashed var(--border)", paddingTop: "0.3rem" }}>
                <input type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="مصروف مخصص" style={{ flex: 1, fontSize: "0.7rem", padding: "0.15rem 0.3rem", minWidth: 0 }} />
                <input type="number" min="0" step="0.01" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0" style={{ width: "60px", fontSize: "0.7rem", padding: "0.15rem 0.3rem" }} />
              </div>
              <button className="card-btn" onClick={handleQuickExpense} disabled={saving}
                style={{ width: "100%", padding: "0.2rem", fontSize: "0.7rem", marginTop: "0.3rem" }}>
                {saving ? "...حفظ" : "💾 حفظ"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
