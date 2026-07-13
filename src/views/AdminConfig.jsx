"use client";
import React, { useState, useEffect } from "react";

export default function AdminConfig({ embedded }) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);
  const [fields, setFields] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [typeForm, setTypeForm] = useState({ typeName: "", behavior: "individual", icon: "📦", accountCode: "", costCenterCode: "" });
  const [editingType, setEditingType] = useState(null);
  const [fieldForm, setFieldForm] = useState({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false });
  const [editingField, setEditingField] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [msgTemplate, setMsgTemplate] = useState("");
  const [placeholders, setPlaceholders] = useState([]);
  const [tab, setTab] = useState("types"); // types | message | field-accounts | system
  const [settings, setSettings] = useState({});
  const [editSettingKey, setEditSettingKey] = useState("");
  const [editSettingVal, setEditSettingVal] = useState("");
  const [msgType, setMsgType] = useState("bookingConfirm"); // bookingConfirm | paymentReceipt
  const [acctForm, setAcctForm] = useState({ accountCode: "", accountName: "", parentCode: "5101", costCenterCode: "" });
  const [editingAcct, setEditingAcct] = useState(null);

  useEffect(() => {
    if (embedded) { setAuthorized(true); loadData(); return; }
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.success || d.user?.role !== "admin") {
          window.location.href = "/";
          return;
        }
        setAuthorized(true);
        loadData();
      });
  }, [embedded]);

  const loadData = async (type) => {
    const t = type || msgType;
    try {
      const [tRes, fRes, aRes, cRes, sRes] = await Promise.all([
        fetch("/api/config/types?all=true"),
        fetch("/api/config/fields?all=true"),
        fetch("/api/finance/accounts"),
        fetch("/api/finance/cost-centers"),
        fetch("/api/finance/settings"),
      ]);
      const tData = await tRes.json();
      const fData = await fRes.json();
      const aData = await aRes.json();
      const cData = await cRes.json();
      const sData = await sRes.json();
      if (tData.success) setTypes(tData.types || []);
      if (fData.success) setFields(fData.fields || []);
      if (aData.success) setAccounts(aData.accounts || []);
      if (cData.success) setCostCenters(cData.centers || []);
      if (sData.success) setSettings(sData.settings || {});
    } catch (err) {
      setError("فشل تحميل البيانات");
    }
    loadMessage(t);
    setLoading(false);
  };

  const loadMessage = async (type) => {
    const t = type || msgType;
    try {
      const mRes = await fetch(`/api/config/message?type=${t}`);
      const mData = await mRes.json();
      if (mData.success) { setMsgTemplate(mData.template); setPlaceholders(mData.placeholders || []); }
    } catch { setError("فشل تحميل القالب"); }
  };

  const handleSaveMessage = async (template) => {
    try {
      const res = await fetch("/api/config/message", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, type: msgType }),
      });
      const data = await res.json();
      if (data.success) { setMsg("✅ تم حفظ القالب"); setError(null); } else { setError(data.error); }
    } catch { setError("خطأ في حفظ القالب"); }
  };

  const fieldsForSelected = fields.filter((f) => f.typeName === selectedType);

  const handleAddType = async () => {
    if (!typeForm.typeName.trim()) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch("/api/config/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeForm),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        setTypeForm({ typeName: "", behavior: "individual", icon: "📦", accountCode: "", costCenterCode: "" });
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const handleUpdateType = async () => {
    if (!editingType || !typeForm.typeName.trim()) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch("/api/config/types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: editingType, ...typeForm }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        setEditingType(null);
        setTypeForm({ typeName: "", behavior: "individual", icon: "📦", accountCode: "", costCenterCode: "" });
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const handleDeleteType = async (name) => {
    if (!confirm(`هل أنت متأكد من إخفاء النوع "${name}"؟`)) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch(`/api/config/types?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        if (selectedType === name) setSelectedType("");
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const startEditType = (t) => {
    setEditingType(t.typeName);
    setTypeForm({ typeName: t.typeName, behavior: t.behavior, icon: t.icon || "📦", accountCode: t.accountCode || "", costCenterCode: t.costCenterCode || "" });
  };

  const handleAddField = async () => {
    if (!fieldForm.fieldKey.trim() || !fieldForm.fieldLabel.trim() || !selectedType) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch("/api/config/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fieldForm, typeName: selectedType }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        setFieldForm({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false });
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const handleUpdateField = async () => {
    if (!editingField || !fieldForm.fieldLabel.trim() || !selectedType) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch("/api/config/fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fieldForm, typeName: selectedType, fieldKey: editingField }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        setEditingField(null);
        setFieldForm({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false });
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const handleDeleteField = async (key) => {
    if (!confirm(`هل أنت متأكد من حذف الحقل "${key}"؟`)) return;
    setMsg(null); setError(null);
    try {
      const res = await fetch(`/api/config/fields?type=${encodeURIComponent(selectedType)}&key=${encodeURIComponent(key)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message);
        loadData();
      } else {
        setError(data.error);
      }
    } catch { setError("خطأ في الاتصال"); }
  };

  const startEditField = (f) => {
    setEditingField(f.fieldKey);
    setFieldForm({ fieldKey: f.fieldKey, fieldLabel: f.fieldLabel, fieldType: f.fieldType, options: (f.options || []).join(","), required: f.required });
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  }

  if (!authorized && !embedded) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>⛔ غير مصرح</h2>
        <p>هذه الصفحة مخصصة للمدير فقط.</p>
        <a href="/" style={{ color: "#059669", fontWeight: "bold" }}>← العودة للوحة الرئيسية</a>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${tab === "types" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("types")} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none" }}>📋 الأنواع والحقول</button>
        <button className={`btn btn-sm ${tab === "message" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("message")} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none" }}>💬 قالب الرسالة</button>
        <button className={`btn btn-sm ${tab === "field-accounts" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("field-accounts")} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none" }}>🚛 المصاريف الميدانية</button>
        <button className={`btn btn-sm ${tab === "system" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("system")} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none" }}>⚙️ إعدادات النظام</button>
      </div>

      {tab === "types" && (
        <div className="config-layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {/* Left panel: Types */}
          <section className="glass config-panel" style={{ padding: "1.25rem", borderRadius: "16px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>📋 أنواع الحجوزات</h2>
            <div className="type-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem", maxHeight: "350px", overflowY: "auto" }}>
              {types.map((t) => (
                <div key={t.typeName} className={`type-item ${selectedType === t.typeName ? "selected" : ""}`} onClick={() => { setSelectedType(t.typeName); setEditingField(null); setFieldForm({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false }); }} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", background: selectedType === t.typeName ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)", borderRadius: "10px", border: selectedType === t.typeName ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                  <span className="type-icon" style={{ fontSize: "1.5rem" }}>{t.icon || "📦"}</span>
                  <div className="type-info" style={{ flex: 1 }}>
                    <strong style={{ display: "block" }}>{t.typeName}</strong>
                    <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                      <span className={`behavior-badge behavior-${t.behavior}`} style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>{t.behavior === "packages" ? "باقات" : t.behavior === "hall" ? "صالة" : "مفردات"}</span>
                      {t.accountCode && <span className="behavior-badge" style={{ background:"rgba(16,185,129,0.15)", color:"#10b981", fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>{t.accountCode}</span>}
                    </div>
                  </div>
                  <div className="type-actions">
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); startEditType(t); }} style={{ padding: "0.25rem" }}>✏️</button>
                    <button className="btn btn-sm btn-ghost text-red" onClick={(e) => { e.stopPropagation(); handleDeleteType(t.typeName); }} style={{ padding: "0.25rem" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="add-form" style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>{editingType ? "تعديل النوع" : "إضافة نوع جديد"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input type="text" className="form-control" placeholder="اسم النوع" value={typeForm.typeName} onChange={(e) => setTypeForm({ ...typeForm, typeName: e.target.value })} />
                <select className="form-control" value={typeForm.behavior} onChange={(e) => setTypeForm({ ...typeForm, behavior: e.target.value })}>
                  <option value="individual">تأجير مفردات (individual)</option>
                  <option value="packages">حجز باقات (packages)</option>
                  <option value="hall">صالة (hall)</option>
                </select>
                <input type="text" className="form-control" placeholder="رمز الأيقونة (مثال: 🪑)" value={typeForm.icon} onChange={(e) => setTypeForm({ ...typeForm, icon: e.target.value })} />
                <select className="form-control" value={typeForm.accountCode} onChange={(e) => setTypeForm({ ...typeForm, accountCode: e.target.value })}>
                  <option value="">-- اختر حساب الإيراد --</option>
                  {accounts.filter((a) => a.accountType === "income").map((a) => (
                    <option key={a.accountCode} value={a.accountCode}>{a.accountCode} {a.accountName}</option>
                  ))}
                </select>
                <select className="form-control" value={typeForm.costCenterCode} onChange={(e) => setTypeForm({ ...typeForm, costCenterCode: e.target.value })}>
                  <option value="">-- اختر مركز التكلفة --</option>
                  {costCenters.filter(c => c.type === "booking" || c.type === "administrative").map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button className="btn btn-primary" onClick={editingType ? handleUpdateType : handleAddType}>{editingType ? "💾 حفظ" : "➕ إضافة"}</button>
                  {editingType && <button className="btn btn-secondary" onClick={() => { setEditingType(null); setTypeForm({ typeName: "", behavior: "individual", icon: "📦", accountCode: "", costCenterCode: "" }); }}>إلغاء</button>}
                </div>
              </div>
            </div>
          </section>

          {/* Right panel: Fields */}
          <section className="glass config-panel" style={{ padding: "1.25rem", borderRadius: "16px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>🔧 الحقول المخصصة</h2>
            {!selectedType ? (
              <p className="no-data">اختر نوع حجز من اليسار لعرض حقوله</p>
            ) : (
              <>
                <h3 style={{ color: "var(--gold)", fontSize: "1.1rem", marginBottom: "1rem" }}>حقول نوع: {types.find((t) => t.typeName === selectedType)?.icon} {selectedType}</h3>
                <div className="field-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem", maxHeight: "250px", overflowY: "auto" }}>
                  {fieldsForSelected.length === 0 && <p className="no-data">لا توجد حقول مخصصة بعد</p>}
                  {fieldsForSelected.map((f) => (
                    <div key={f.fieldKey} className="field-item" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="field-info" style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: "0.95rem" }}>{f.fieldLabel}</strong>
                        <span className="field-meta" style={{ fontSize: "0.75rem", opacity: 0.6 }}>{f.fieldKey} · {f.fieldType} {f.required ? "· إجباري" : ""} {f.isActive === false ? "· مخفي" : ""} {f.options?.length > 0 ? `· [${f.options.join(", ")}]` : ""}</span>
                      </div>
                      <div className="field-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => startEditField(f)}>✏️</button>
                        <button className="btn btn-sm btn-ghost text-red" onClick={() => handleDeleteField(f.fieldKey)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="add-form" style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>{editingField ? "تعديل الحقل" : "إضافة حقل جديد"}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <input type="text" className="form-control" placeholder="المفتاح (مثال: eventLocation)" value={fieldForm.fieldKey} onChange={(e) => setFieldForm({ ...fieldForm, fieldKey: e.target.value })} disabled={!!editingField} />
                    <input type="text" className="form-control" placeholder="التسمية (مثال: موقع الفعالية)" value={fieldForm.fieldLabel} onChange={(e) => setFieldForm({ ...fieldForm, fieldLabel: e.target.value })} />
                    <select className="form-control" value={fieldForm.fieldType} onChange={(e) => setFieldForm({ ...fieldForm, fieldType: e.target.value })}>
                      <option value="text">نص (text)</option>
                      <option value="number">رقم (number)</option>
                      <option value="select">قائمة منسدلة (select)</option>
                      <option value="checkbox">خانة اختيار (checkbox)</option>
                      <option value="date">تاريخ (date)</option>
                      <option value="textarea">نص طويل (textarea)</option>
                      <option value="image">صورة (image)</option>
                    </select>
                    {fieldForm.fieldType === "select" && (
                      <input type="text" className="form-control" placeholder="الخيارات مفصولة بفواصل (مثال: بسيط,متوسط,فاخر)" value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} />
                    )}
                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", cursor: "pointer" }}>
                      <input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} />
                      <span style={{ fontSize: "0.85rem" }}>حقل إجباري</span>
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button className="btn btn-primary" onClick={editingField ? handleUpdateField : handleAddField}>{editingField ? "💾 حفظ" : "➕ إضافة"}</button>
                      {editingField && <button className="btn btn-secondary" onClick={() => { setEditingField(null); setFieldForm({ fieldKey: "", fieldLabel: "", fieldType: "text", options: "", required: false }); }}>إلغاء</button>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "message" && (
        <section className="glass config-panel" style={{ maxWidth: "800px", margin: "0 auto", padding: "1.25rem", borderRadius: "16px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>💬 قوالب رسائل واتساب</h2>

          {/* Sub-tabs for template types */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button className={`btn btn-sm ${msgType === "bookingConfirm" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setMsgType("bookingConfirm"); loadMessage("bookingConfirm"); }} style={{ padding: "0.4rem 1rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none", fontSize: "0.85rem" }}>
              📋 تأكيد الحجز
            </button>
            <button className={`btn btn-sm ${msgType === "paymentReceipt" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setMsgType("paymentReceipt"); loadMessage("paymentReceipt"); }} style={{ padding: "0.4rem 1rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none", fontSize: "0.85rem" }}>
              🧾 سند قبض
            </button>
          </div>

          <p style={{ opacity: 0.8, marginBottom: "1rem", fontSize: "0.9rem" }}>{msgType === "bookingConfirm" ? "قم بتخصيص الرسالة التي ترسل للعميل عند تأكيد الحجز." : "قم بتخصيص الرسالة التي ترسل للعميل عند تسجيل دفعة."} استخدم المتغيرات بين `{"{ }"}` لإدراج البيانات.</p>

          <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <strong style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>🟢 المتغيرات المتاحة:</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {placeholders.map((p) => (
                <code key={p.key} style={{ background: "rgba(16,185,129,0.1)", padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.85rem", cursor: "pointer", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}
                  onClick={() => { const ta = document.getElementById("template-textarea"); if (ta) { const start = ta.selectionStart; const end = ta.selectionEnd; const newVal = msgTemplate.substring(0, start) + `{${p.key}}` + msgTemplate.substring(end); setMsgTemplate(newVal); setTimeout(() => { ta.focus(); ta.setSelectionRange(start + p.key.length + 2, start + p.key.length + 2); }, 10); } }}>
                  {`{${p.key}}`} ← {p.label}
                </code>
              ))}
            </div>
          </div>

          <textarea id="template-textarea" value={msgTemplate} onChange={(e) => setMsgTemplate(e.target.value)} rows="14" className="form-control" style={{ width: "100%", fontFamily: "monospace", fontSize: "0.9rem", lineHeight: "1.6", resize: "vertical" }} dir="ltr" />

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button className="btn btn-primary" onClick={() => handleSaveMessage(msgTemplate)}>💾 حفظ القالب</button>
            <button className="btn btn-secondary" onClick={() => loadMessage()}>🔄 إعادة تحميل</button>
          </div>

          {/* Preview */}
          {msgTemplate && (
            <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "12px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
              <strong style={{ display: "block", marginBottom: "0.5rem", color: "#25d366" }}>📱 معاينة:</strong>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0, fontFamily: "inherit" }} dir="ltr">
                {msgTemplate.replace(/\{(\w+)\}/g, '[$1]')}
              </pre>
            </div>
          )}
        </section>
      )}

      {tab === "field-accounts" && (
        <div className="config-layout" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {["5101", "5102", "5103", "5104"].map((parentCode) => {
            const stageAccounts = accounts.filter((a) => a.parentCode === parentCode);
            const stageNames = { "5101": "تجهيز", "5102": "تركيب", "5103": "فك", "5104": "توالف" };
            const stageIcons = { "5101": "📦", "5102": "🔧", "5103": "🔨", "5104": "🔴" };
            return (
              <section key={parentCode} className="glass config-panel" style={{ padding: "1.25rem", borderRadius: "16px" }}>
                <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>{stageIcons[parentCode]} تكاليف {stageNames[parentCode]} (الرمز {parentCode})</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  {stageAccounts.map((a) => (
                    <div key={a.accountCode} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.9rem" }}>
                      <div>
                        <strong>{a.accountName}</strong>
                        <span className="text-muted" style={{ fontSize: "0.75rem", marginRight: "0.5rem" }}>({a.accountCode})</span>
                      </div>
                      <button className="btn btn-sm btn-ghost" onClick={() => {
                        setEditingAcct(a.accountCode);
                        setAcctForm({ accountCode: a.accountCode, accountName: a.accountName, parentCode, costCenterCode: a.costCenterCode || "" });
                      }} style={{ padding: "0.2rem" }}>✏️</button>
                      <button className="btn btn-sm btn-ghost text-red" onClick={async () => {
                        if (!confirm(`إخفاء ${a.accountName}?`)) return;
                        try {
                          const r = await fetch(`/api/finance/accounts?code=${encodeURIComponent(a.accountCode)}`, { method: "DELETE" });
                          const d = await r.json();
                          if (d.success) { setMsg(d.message); loadData(); } else setError(d.error);
                        } catch { setError("خطأ"); }
                      }} style={{ padding: "0.2rem" }}>🗑️</button>
                    </div>
                  ))}
                  {stageAccounts.length === 0 && <p className="text-muted" style={{ fontSize: "0.85rem" }}>لا توجد حسابات</p>}
                </div>

                <div className="add-form" style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>{editingAcct && acctForm.parentCode === parentCode ? "تعديل حساب" : "إضافة حساب جديد"}</h3>
                  {(!editingAcct || acctForm.parentCode === parentCode) && (
                    <>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        <input type="text" className="form-control" placeholder="كود الحساب (مثال: 5101-07)" value={editingAcct && acctForm.parentCode === parentCode ? acctForm.accountCode : acctForm.accountCode} onChange={(e) => setAcctForm({ ...acctForm, accountCode: e.target.value })}
                          disabled={!!editingAcct} style={{ flex: 1, minWidth: "150px" }} />
                        <input type="text" className="form-control" placeholder="اسم المصروف" value={editingAcct && acctForm.parentCode === parentCode ? acctForm.accountName : acctForm.accountName} onChange={(e) => setAcctForm({ ...acctForm, accountName: e.target.value, parentCode })} style={{ flex: 2, minWidth: "200px" }} />
                        <select className="form-control" value={acctForm.costCenterCode} onChange={(e) => setAcctForm({ ...acctForm, costCenterCode: e.target.value })} style={{ flex: 1, minWidth: "150px" }}>
                          <option value="">-- مركز تكلفة --</option>
                          {costCenters.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {editingAcct && acctForm.parentCode === parentCode ? (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={async () => {
                              if (!acctForm.accountName.trim()) return;
                              try {
                                const r = await fetch("/api/finance/accounts", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ originalCode: editingAcct, accountCode: acctForm.accountCode, accountName: acctForm.accountName, costCenterCode: acctForm.costCenterCode || "" }),
                                });
                                const d = await r.json();
                                if (d.success) { setMsg(d.message); setEditingAcct(null); loadData(); } else setError(d.error);
                              } catch { setError("خطأ"); }
                            }}>💾 حفظ</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingAcct(null)}>إلغاء</button>
                          </>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={async () => {
                            if (!acctForm.accountCode.trim() || !acctForm.accountName.trim()) return;
                            try {
                              const r = await fetch("/api/finance/accounts", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ accountCode: acctForm.accountCode, accountName: acctForm.accountName, accountType: "expense", parentCode, costCenterCode: acctForm.costCenterCode || "" }),
                              });
                              const d = await r.json();
                              if (d.success) { setMsg(d.message); setAcctForm({ accountCode: "", accountName: "", parentCode: "5101", costCenterCode: "" }); loadData(); } else setError(d.error);
                            } catch { setError("خطأ"); }
                          }}>➕ إضافة</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "system" && (
        <div className="config-layout" style={{ display: "flex", flexDirection: "column" }}>
          <section className="glass config-panel" style={{ padding: "1.25rem", borderRadius: "16px" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>⚙️ إعدادات النظام</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(settings).map(([key, val]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: "0.85rem" }}>{key}</strong>
                    <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      {editSettingKey === key ? (
                        <select className="form-control" value={editSettingVal} onChange={(e) => setEditSettingVal(e.target.value)} style={{ padding: "0.25rem", fontSize: "0.8rem" }}>
                          {accounts.filter((a) => a.accountType === "asset" && a.parentCode === "1100").map((a) => (
                            <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>
                          ))}
                          {accounts.filter((a) => a.accountType === "asset" && a.parentCode === "1100").length === 0 && (
                            <option value="">لا توجد حسابات خزينة</option>
                          )}
                        </select>
                      ) : (
                        <span>{val}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {editSettingKey === key ? (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={async () => {
                          try {
                            const r = await fetch("/api/finance/settings", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key, value: editSettingVal }),
                            });
                            const d = await r.json();
                            if (d.success) { setMsg(d.message); setEditSettingKey(""); loadData(); } else setError(d.error);
                          } catch { setError("خطأ"); }
                        }}>💾 حفظ</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditSettingKey("")}>إلغاء</button>
                      </>
                    ) : (
                      <button className="btn btn-sm btn-ghost" onClick={() => { setEditSettingKey(key); setEditSettingVal(val); }}>✏️</button>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(settings).length === 0 && <p className="text-muted">لا توجد إعدادات</p>}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}