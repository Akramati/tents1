"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { TENT_WIDTHS } from "@/lib/utils";
import ConfirmModal from "@/components/ConfirmModal";

export default function PackagesView() {
  const { print, setErrorMsg } = useApp();
  const [activeTab, setActiveTab] = useState("tent");
  const [packages, setPackages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedPkg, setExpandedPkg] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ packageName: "", widths: {} });
  const [editMode, setEditMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeWidth, setActiveWidth] = useState("6");
  const [invItems, setInvItems] = useState([]);
  const [bookingTypes, setBookingTypes] = useState([]);

  // Flexible packages state
  const [flexPackages, setFlexPackages] = useState([]);
  const [flexForm, setFlexForm] = useState({
    typeName: "", packageName: "", mode: "dim", dims: [], widths: [], items: [],
  });
  const [flexEditPkg, setFlexEditPkg] = useState(null);
  const [activeFlexWidth, setActiveFlexWidth] = useState("");

  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/packages");
      const data = await res.json();
      if (data.success) setPackages(data.packages || []);
    } catch (err) { console.error(err); }
  };

  const fetchFlexPackages = async () => {
    try {
      const res = await fetch("/api/packages/flexible");
      const data = await res.json();
      if (data.success) setFlexPackages(data.packages || []);
    } catch (err) { console.error(err); }
  };

  const fetchInv = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.success) setInvItems(data.items || []);
    } catch (err) { console.error(err); }
  };

  const fetchTypes = async () => {
    try {
      const res = await fetch("/api/config/types");
      const data = await res.json();
      if (data.success) setBookingTypes(data.types || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPackages(); fetchInv(); fetchTypes(); fetchFlexPackages(); }, []);

  const flexTypes = bookingTypes.filter((t) => t.behavior === "packages" && t.typeName !== "حجز خيام وباقات");

  // ---- Tent package handlers ----
  const addPkgItem = () => {
    const widths = { ...form.widths };
    const items = [...(widths[activeWidth] || [])];
    items.push({ itemId: "", baseQty: 0, step5Qty: 0, step10Qty: 0 });
    widths[activeWidth] = items;
    setForm({ ...form, widths });
  };

  const updatePkgItem = (idx, field, val) => {
    const widths = { ...form.widths };
    const items = [...(widths[activeWidth] || [])];
    items[idx] = { ...items[idx], [field]: val };
    widths[activeWidth] = items;
    setForm({ ...form, widths });
  };

  const removePkgItem = (idx) => {
    const widths = { ...form.widths };
    let items = [...(widths[activeWidth] || [])];
    items = items.filter((_, i) => i !== idx);
    widths[activeWidth] = items;
    setForm({ ...form, widths });
  };

  const handleTentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { packageName: form.packageName, widths: form.widths };
      const res = await fetch(`/api/packages${editMode ? `?packageName=${encodeURIComponent(editMode)}` : ""}`, {
        method: editMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setForm({ packageName: "", widths: {} });
        setShowForm(false);
        setEditMode(null);
        await fetchPackages();
      }
    } catch (err) { console.error(err); }
    setSubmitting(false);
  };

  const editPackage = (pkg) => {
    setForm({ packageName: pkg.packageName, widths: JSON.parse(JSON.stringify(pkg.widths || {})) });
    setEditMode(pkg.packageName);
    setShowForm(true);
  };

  const deletePackage = async (name) => {
    try {
      const res = await fetch(`/api/packages?packageName=${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) return data.error || "فشل الحذف";
      await fetchPackages();
      return null;
    } catch (err) { console.error(err); return "خطأ في الاتصال"; }
  };

  // ---- Flexible package handlers ----
  const resetFlexForm = () => {
    setFlexForm({ typeName: "", packageName: "", mode: "dim", dims: [], widths: [], items: [] });
    setFlexEditPkg(null);
    setActiveFlexWidth("");
  };

  const addFlexWidth = () => {
    const newWidth = prompt("أدخل العرض الجديد (متر):", "");
    if (!newWidth || isNaN(parseFloat(newWidth))) return;
    if (flexForm.widths.includes(newWidth)) { setErrorMsg(`العرض ${newWidth}م موجود مسبقًا`); return; }
    const widths = [...flexForm.widths, newWidth].sort((a, b) => parseFloat(a) - parseFloat(b));
    const items = flexForm.items.map((item) => ({ ...item, widthQtys: { ...item.widthQtys, [newWidth]: 0 } }));
    setFlexForm({ ...flexForm, widths, items });
    setActiveFlexWidth(newWidth);
  };

  const removeFlexWidth = (w) => {
    const widths = flexForm.widths.filter((x) => x !== w);
    const items = flexForm.items.map((item) => {
      const { [w]: _, ...rest } = item.widthQtys || {};
      return { ...item, widthQtys: rest };
    });
    setFlexForm({ ...flexForm, widths, items });
    if (activeFlexWidth === w) setActiveFlexWidth(widths[0] || "");
  };

  const addFlexDim = () => {
    setFlexForm({ ...flexForm, dims: [...flexForm.dims, { dim: "", step: 1 }] });
  };

  const updateFlexDim = (idx, field, val) => {
    const dims = [...flexForm.dims];
    dims[idx] = { ...dims[idx], [field]: val };
    setFlexForm({ ...flexForm, dims });
  };

  const removeFlexDim = (idx) => {
    const dims = flexForm.dims.filter((_, i) => i !== idx);
    setFlexForm({ ...flexForm, dims });
  };

  const addFlexItem = () => {
    if (flexForm.mode === "width") {
      const item = { itemId: "", baseQty: 0, widthQtys: {} };
      for (const w of flexForm.widths) item.widthQtys[w] = 0;
      setFlexForm({ ...flexForm, items: [...flexForm.items, item] });
    } else {
      const item = { itemId: "", baseQty: 0, dimQtys: {} };
      for (const d of flexForm.dims) item.dimQtys[d.dim] = 0;
      setFlexForm({ ...flexForm, items: [...flexForm.items, item] });
    }
  };

  const updateFlexItem = (idx, field, val) => {
    const items = [...flexForm.items];
    items[idx] = { ...items[idx], [field]: val };
    setFlexForm({ ...flexForm, items });
  };

  const updateFlexItemDimQty = (idx, dimName, val) => {
    const items = [...flexForm.items];
    items[idx] = { ...items[idx], dimQtys: { ...items[idx].dimQtys, [dimName]: Number(val) } };
    setFlexForm({ ...flexForm, items });
  };

  const updateFlexItemWidthQty = (idx, width, val) => {
    const items = [...flexForm.items];
    items[idx] = { ...items[idx], widthQtys: { ...items[idx].widthQtys, [width]: Number(val) } };
    setFlexForm({ ...flexForm, items });
  };

  const removeFlexItem = (idx) => {
    setFlexForm({ ...flexForm, items: flexForm.items.filter((_, i) => i !== idx) });
  };

  const handleFlexSubmit = async (e) => {
    e.preventDefault();
    if (!flexForm.typeName || !flexForm.packageName) {
      setErrorMsg("اختر النوع واسم الباقة");
      return;
    }
    setSubmitting(true);
    try {
      const items = flexForm.items.map((item) => {
        const base = { itemId: item.itemId, baseQty: item.baseQty };
        if (flexForm.mode === "width") {
          const widthDef = {};
          for (const w of flexForm.widths) widthDef[w] = (item.widthQtys?.[w] || 0);
          return { ...base, widthDef, dimDef: [] };
        }
        return { ...base, dimDef: flexForm.dims.map((d) => ({ dim: d.dim, step: d.step, qty: (item.dimQtys[d.dim] || 0) })) };
      });
      const res = await fetch("/api/packages/flexible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeName: flexForm.typeName, packageName: flexForm.packageName, items }),
      });
      const data = await res.json();
      if (data.success) { resetFlexForm(); await fetchFlexPackages(); }
      else setErrorMsg(data.error || "فشل حفظ الباقة");
    } catch (err) { console.error(err); setErrorMsg("خطأ في الحفظ"); }
    setSubmitting(false);
  };

  const editFlexPackage = (pkg) => {
    const hasWidths = pkg.widths && pkg.widths.length > 0;
    const mode = hasWidths ? "width" : "dim";
    const items = pkg.items.map((item) => {
      if (hasWidths) {
        const widthQtys = {};
        for (const w of pkg.widths) widthQtys[w] = parseFloat(item.widthDef?.[w] || 0);
        return { itemId: item.itemId, baseQty: item.baseQty, widthQtys };
      }
      const dimQtys = {};
      for (const d of item.dimDef) dimQtys[d.dim] = d.qty;
      return { itemId: item.itemId, baseQty: item.baseQty, dimQtys };
    });
    setFlexForm({
      typeName: pkg.typeName, packageName: pkg.packageName, mode,
      dims: hasWidths ? [] : pkg.dims.map((d) => ({ dim: d.dim, step: d.step })),
      widths: hasWidths ? [...pkg.widths] : [],
      items,
    });
    if (hasWidths && pkg.widths.length > 0) setActiveFlexWidth(pkg.widths[0]);
    setFlexEditPkg(pkg.packageName);
    setShowForm(true);
  };

  const deleteFlexPackage = async (typeName, packageName) => {
    try {
      const res = await fetch(`/api/packages/flexible?typeName=${encodeURIComponent(typeName)}&packageName=${encodeURIComponent(packageName)}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) return data.error || "فشل الحذف";
      await fetchFlexPackages();
      return null;
    } catch (err) { console.error(err); return "خطأ في الاتصال"; }
  };

  const flexTotalItems = (pkg) => pkg.items.length;
  const flexDimsLabels = (pkg) => {
    if (pkg.widths && pkg.widths.length > 0) return `عروض: ${pkg.widths.join("، ")}م`;
    return pkg.dims.map((d) => `${d.dim} (خطوة ${d.step}م)`).join(" | ");
  };

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>🎁 إدارة الباقات</h2>
        <div className="btn-group">
          {!showForm && <button className="btn btn-primary" onClick={() => { setShowForm(true); resetFlexForm(); }}>➕ باقة جديدة</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mini-tabs" style={{ marginBottom: "1rem" }}>
        <button type="button" className={`mini-tab ${activeTab === "tent" ? "active" : ""}`}
          onClick={() => { setActiveTab("tent"); setShowForm(false); setEditMode(null); resetFlexForm(); }}>
          🏕️ باقات الخيام
        </button>
        <button type="button" className={`mini-tab ${activeTab === "flex" ? "active" : ""}`}
          onClick={() => { setActiveTab("flex"); setShowForm(false); setEditMode(null); resetFlexForm(); }}>
          📦 باقات {flexTypes.map((t) => t.typeName).join(" / ") || "مرنة"}
        </button>
      </div>

      {/* Tent form */}
      {showForm && activeTab === "tent" && (
        <form onSubmit={handleTentSubmit} className="inv-form">
          {editMode && <div className="alert alert-warning">⚠️ هذا التعديل سيؤثر على الحجوزات المستقبلية فقط. الحجوزات الحالية لا تتأثر.</div>}
          <div className="form-grid mini-grid">
            <div className="form-group full-width">
              <label>اسم الباقة <span className="required">*</span></label>
              <input type="text" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} className="form-control" placeholder="مثال: الباقة العادية" required />
            </div>
          </div>
          <div className="mini-tabs" style={{ marginTop: "1rem" }}>
            {TENT_WIDTHS.map((w) => {
              const items = form.widths[w] || [];
              return (
                <button key={w} type="button" className={`mini-tab ${activeWidth === w ? "active" : ""} ${items.length > 0 ? "has-items" : ""}`}
                  onClick={() => setActiveWidth(w)} style={{ fontSize: "0.9rem" }}>
                  عرض {w}م {items.length > 0 ? `(${items.length})` : ""}
                </button>
              );
            })}
          </div>
          <div className="form-group full-width" style={{ marginTop: "0.75rem" }}>
            <label>الأصناف لعرض {activeWidth}م</label>
            <div className="pkg-items-list">
              {(form.widths[activeWidth] || []).map((item, idx) => (
                <div key={idx} className="rented-row pkg-config-row" style={{ display: "grid", gridTemplateColumns: "2fr 60px 60px 60px 30px", gap: "0.5rem", alignItems: "center" }}>
                  <select value={item.itemId} onChange={(e) => updatePkgItem(idx, "itemId", e.target.value)} className="form-control">
                    <option value="">-- اختر صنف --</option>
                    {invItems.map((inv) => <option key={inv.itemId} value={inv.itemId}>{inv.itemName}</option>)}
                  </select>
                  <input type="number" min="0" value={item.baseQty} onChange={(e) => updatePkgItem(idx, "baseQty", Number(e.target.value))} className="form-control" placeholder="أساس" title="الكمية الأساسية (لـ 10م)" />
                  <input type="number" min="0" value={item.step5Qty} onChange={(e) => updatePkgItem(idx, "step5Qty", Number(e.target.value))} className="form-control" placeholder="+5م" title="إضافة لكل +5م" />
                  <input type="number" min="0" value={item.step10Qty} onChange={(e) => updatePkgItem(idx, "step10Qty", Number(e.target.value))} className="form-control" placeholder="+10م" title="إضافة لكل +10م" />
                  <button type="button" className="btn-remove" onClick={() => removePkgItem(idx)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-gold" onClick={addPkgItem}>➕ إضافة صنف لعرض {activeWidth}م</button>
            </div>
          </div>
          <div className="alert alert-info" style={{ marginTop: "0.5rem", padding: "0.5rem", fontSize: "0.85rem" }}>
            💡 <strong>كيف تعمل المعادلة:</strong> الكمية = <strong>الكمية الأساسية</strong> + (عدد الزيادات × 10م × <strong>زيادة +10م</strong>) + (عدد الزيادات × 5م × <strong>زيادة +5م</strong>). مثال: طول 25م → أساس + 1×زيادة10م + 1×زيادة5م.
          </div>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "جاري الحفظ..." : editMode ? "💾 تحديث الباقة" : "💾 حفظ الباقة"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditMode(null); setForm({ packageName: "", widths: {} }); }}>
              {editMode ? "إلغاء التعديل" : "إلغاء"}
            </button>
          </div>
        </form>
      )}

      {/* Flexible form */}
      {showForm && activeTab === "flex" && (
        <form onSubmit={handleFlexSubmit} className="inv-form">
          <div className="form-grid mini-grid">
            <div className="form-group full-width">
              <label>النوع <span className="required">*</span></label>
              <select value={flexForm.typeName} onChange={(e) => { setFlexForm({ ...flexForm, typeName: e.target.value, packageName: "", dims: [], widths: [], items: [] }); }} className="form-control" required>
                <option value="">-- اختر النوع --</option>
                {flexTypes.map((t) => <option key={t.typeName} value={t.typeName}>{t.typeName}</option>)}
              </select>
            </div>
            <div className="form-group full-width">
              <label>اسم الباقة <span className="required">*</span></label>
              <input type="text" value={flexForm.packageName} onChange={(e) => setFlexForm({ ...flexForm, packageName: e.target.value })} className="form-control" placeholder="مثال: كوشة ورد" required />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mini-tabs" style={{ marginTop: "0.75rem" }}>
            <button type="button" className={`mini-tab ${flexForm.mode === "width" ? "active" : ""}`}
              onClick={() => setFlexForm({ ...flexForm, mode: "width", dims: [], widths: [], items: [] })}>
              📐 نظام العروض (مثل الخيام)
            </button>
            <button type="button" className={`mini-tab ${flexForm.mode === "dim" ? "active" : ""}`}
              onClick={() => setFlexForm({ ...flexForm, mode: "dim", dims: [], widths: [], items: [] })}>
              📏 نظام الأبعاد (معادلة)
            </button>
          </div>

          {/* Width mode */}
          {flexForm.mode === "width" && (
            <>
              <div className="form-group full-width" style={{ marginTop: "0.75rem" }}>
                <label>قائمة العروض</label>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  {flexForm.widths.map((w) => (
                    <span key={w} className="pkg-item-tag" style={{ background: "var(--gold)", color: "#000", cursor: "pointer" }}
                      onClick={() => setActiveFlexWidth(w)} title="انقر لتعديل الأصناف لهذا العرض">
                      {w}م {activeFlexWidth === w ? "▼" : ""} <span style={{ cursor: "pointer", marginRight: "4px" }} onClick={(e) => { e.stopPropagation(); removeFlexWidth(w); }}>✕</span>
                    </span>
                  ))}
                </div>
                <button type="button" className="btn btn-sm btn-gold" onClick={addFlexWidth}>➕ إضافة عرض</button>
              </div>

              {flexForm.widths.length > 0 && activeFlexWidth && (
                <div className="form-group full-width" style={{ marginTop: "0.75rem" }}>
                  <label>الأصناف لعرض {activeFlexWidth}م</label>
                  <div className="pkg-items-list">
                    {flexForm.items.map((item, idx) => (
                      <div key={idx} className="rented-row" style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <select value={item.itemId} onChange={(e) => updateFlexItem(idx, "itemId", e.target.value)} className="form-control" style={{ flex: "1 1 150px", minWidth: "120px" }}>
                          <option value="">-- صنف --</option>
                          {invItems.map((inv) => <option key={inv.itemId} value={inv.itemId}>{inv.itemName}</option>)}
                        </select>
                        <input type="number" min="0" step="0.1" value={item.widthQtys?.[activeFlexWidth] ?? 0}
                          onChange={(e) => updateFlexItemWidthQty(idx, activeFlexWidth, e.target.value)}
                          className="form-control" placeholder={`كمية عرض ${activeFlexWidth}م`} style={{ width: "100px" }} />
                        <button type="button" className="btn-remove" onClick={() => removeFlexItem(idx)}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm btn-gold" onClick={addFlexItem}>➕ إضافة صنف</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Dim mode */}
          {flexForm.mode === "dim" && (
            <>
              <div className="form-group full-width" style={{ marginTop: "0.75rem" }}>
                <label>الأبعاد المخصصة</label>
                {flexForm.dims.map((d, idx) => (
                  <div key={idx} className="rented-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                    <input type="text" value={d.dim} onChange={(e) => updateFlexDim(idx, "dim", e.target.value)} className="form-control" placeholder="اسم البعد (مثال: عرض)" style={{ flex: 1 }} />
                    <input type="number" min="0.1" step="0.1" value={d.step} onChange={(e) => updateFlexDim(idx, "step", parseFloat(e.target.value) || 1)} className="form-control" placeholder="الخطوة (م)" style={{ width: "100px" }} />
                    <button type="button" className="btn-remove" onClick={() => removeFlexDim(idx)}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-gold" onClick={() => { addFlexDim(); }}>➕ إضافة بُعد</button>
              </div>

              {flexForm.dims.length > 0 && (
                <div className="form-group full-width" style={{ marginTop: "0.75rem" }}>
                  <label>الأصناف</label>
                  <div className="pkg-items-list">
                    {flexForm.items.map((item, idx) => (
                      <div key={idx} className="rented-row" style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <select value={item.itemId} onChange={(e) => updateFlexItem(idx, "itemId", e.target.value)} className="form-control" style={{ flex: "1 1 150px", minWidth: "120px" }}>
                          <option value="">-- صنف --</option>
                          {invItems.map((inv) => <option key={inv.itemId} value={inv.itemId}>{inv.itemName}</option>)}
                        </select>
                        <input type="number" min="0" value={item.baseQty} onChange={(e) => updateFlexItem(idx, "baseQty", Number(e.target.value))} className="form-control" placeholder="أساس" style={{ width: "70px" }} title="الكمية الأساسية" />
                        {flexForm.dims.map((d) => (
                          <input key={d.dim} type="number" min="0" step="0.1" value={item.dimQtys[d.dim] ?? 0}
                            onChange={(e) => updateFlexItemDimQty(idx, d.dim, e.target.value)}
                            className="form-control" placeholder={d.dim} style={{ width: "70px" }}
                            title={`إضافة لكل +${d.step}م من ${d.dim}`} />
                        ))}
                        <button type="button" className="btn-remove" onClick={() => removeFlexItem(idx)}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm btn-gold" onClick={addFlexItem}>➕ إضافة صنف</button>
                  </div>
                  <div className="alert alert-info" style={{ marginTop: "0.5rem", padding: "0.5rem", fontSize: "0.85rem" }}>
                    💡 الكمية = <strong>الكمية الأساسية</strong> + Σ (عدد مرات تكرار الخطوة × <strong>إضافة لكل خطوة</strong>)
                  </div>
                </div>
              )}
            </>
          )}

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting || !flexForm.typeName || !flexForm.packageName}>
              {submitting ? "جاري الحفظ..." : flexEditPkg ? "💾 تحديث الباقة" : "💾 حفظ الباقة"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetFlexForm(); }}>
              {flexEditPkg ? "إلغاء التعديل" : "إلغاء"}
            </button>
          </div>
        </form>
      )}

      {/* Tent packages list */}
      {activeTab === "tent" && (
        <div className="inv-table-wrapper">
          {packages.length === 0 ? (
            <p className="no-data">لا توجد باقات خيام مضافة بعد</p>
          ) : (
            <>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>اسم الباقة</th>
                    <th>العروض</th>
                    <th>عدد الأصناف</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => {
                    const totalItems = Object.values(pkg.widths || {}).reduce((s, items) => s + items.length, 0);
                    const widths = Object.keys(pkg.widths || {}).sort((a, b) => parseFloat(a) - parseFloat(b));
                    const MAX_VISIBLE = 4;
                    const showAll = expandedPkg === pkg.packageName;
                    const visibleWidths = showAll ? widths : widths.slice(0, MAX_VISIBLE);
                    const hiddenCount = widths.length - MAX_VISIBLE;
                    return (
                      <tr key={pkg.packageName}>
                        <td><strong>{pkg.packageName}</strong></td>
                        <td>
                          <div className="pkg-items-cell">
                            {visibleWidths.map((w) => <span key={w} className="pkg-item-tag" style={{ background: "var(--gold)", color: "#000" }}>{w}م</span>)}
                            {!showAll && hiddenCount > 0 && (
                              <button className="pkg-item-tag more-toggle" onClick={() => setExpandedPkg(pkg.packageName)}>+{hiddenCount}</button>
                            )}
                            {showAll && widths.length > MAX_VISIBLE && (
                              <button className="pkg-item-tag more-toggle" onClick={() => setExpandedPkg(null)}>عرض أقل</button>
                            )}
                          </div>
                        </td>
                        <td>{totalItems}</td>
                        <td className="actions-cell">
                          <div className="three-dots-wrapper">
                            <button className="three-dots-btn" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === pkg.packageName ? null : pkg.packageName); }}>⋮</button>
                            {openMenu === pkg.packageName && (
                              <div className="dots-menu">
                                <button className="dots-menu-item" onClick={() => { editPackage(pkg); setOpenMenu(null); }}>✏️ تعديل</button>
                                <button className="dots-menu-item danger" onClick={() => { setOpenMenu(null); setDeleteConfirm({ type: "tent", pkg }); }}>🗑️ حذف</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {openMenu && <div className="menu-backdrop" onClick={() => setOpenMenu(null)} />}
            </>
          )}
        </div>
      )}

      {/* Flexible packages list */}
      {activeTab === "flex" && (
        <div className="inv-table-wrapper">
          {flexPackages.length === 0 ? (
            <p className="no-data">لا توجد باقات مرنة مضافة بعد</p>
          ) : (
            <>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>اسم الباقة</th>
                    <th>الأبعاد / العروض</th>
                    <th>عدد الأصناف</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {flexPackages.map((pkg) => (
                    <tr key={`${pkg.typeName}::${pkg.packageName}`}>
                      <td><span className="behavior-badge behavior-hall">{pkg.typeName}</span></td>
                      <td><strong>{pkg.packageName}</strong></td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {flexDimsLabels(pkg)}
                      </td>
                      <td>{flexTotalItems(pkg)}</td>
                      <td className="actions-cell">
                        <div className="three-dots-wrapper">
                          <button className="three-dots-btn" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `${pkg.typeName}::${pkg.packageName}` ? null : `${pkg.typeName}::${pkg.packageName}`); }}>⋮</button>
                          {openMenu === `${pkg.typeName}::${pkg.packageName}` && (
                            <div className="dots-menu">
                              <button className="dots-menu-item" onClick={() => { editFlexPackage(pkg); setOpenMenu(null); }}>✏️ تعديل</button>
                              <button className="dots-menu-item danger" onClick={() => { setOpenMenu(null); setDeleteConfirm({ type: "flex", pkg }); }}>🗑️ حذف</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {openMenu && <div className="menu-backdrop" onClick={() => setOpenMenu(null)} />}
            </>
          )}
        </div>
      )}

      <ConfirmModal
        show={!!deleteConfirm}
        title="🗑️ حذف باقة"
        message={`هل أنت متأكد من حذف الباقة "${deleteConfirm?.pkg?.packageName}"؟`}
        confirmLabel="نعم، احذف"
        confirmClass="btn btn-danger"
        onConfirm={async () => {
          if (!deleteConfirm) return;
          const { type, pkg } = deleteConfirm;
          const err = type === "tent"
            ? await deletePackage(pkg.packageName)
            : await deleteFlexPackage(pkg.typeName, pkg.packageName);
          if (err) setErrorMsg(err);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </section>
  );
}