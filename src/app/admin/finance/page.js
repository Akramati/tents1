"use client";
import React, { useState, useEffect } from "react";

export default function AdminFinance() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [centers, setCenters] = useState([]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [selectedNode, setSelectedNode] = useState(null); // { type: "branch"|"vehicle"|"booking"|"admin"|"addBranch"|"addCenter", code, name, data? }
  const [form, setForm] = useState({ code: "", name: "", type: "vehicle" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
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
  }, []);

  const loadData = async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/finance/branches"),
        fetch("/api/finance/cost-centers"),
      ]);
      const bData = await bRes.json();
      const cData = await cRes.json();
      if (bData.success) setBranches(bData.branches || []);
      if (cData.success) setCenters(cData.centers || []);
    } catch { setError("فشل تحميل البيانات"); }
    setLoading(false);
  };

  const vehicles = centers.filter(c => c.type === "vehicle");
  const getBranchCenters = (branchCode) => ({
    booking: centers.filter(c => c.type === "booking" && c.code.startsWith(`CC-${branchCode}`)),
    admin: centers.filter(c => c.type === "administrative" && c.code.startsWith(`CC-${branchCode}`)),
  });

  const handleSelect = (node) => {
    setSelectedNode(node);
    setEditing(false);
    if (node.type === "addBranch") {
      setForm({ code: "", name: "", type: "branch" });
    } else if (node.type === "addCenter") {
      setForm({ code: "", name: "", type: "vehicle", branchCode: node.branchCode || "" });
    } else {
      setForm({ code: node.code, name: node.name, type: node.data?.type || "vehicle" });
    }
  };

  const tk = () => localStorage.getItem("token");
  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tk()}` });

  const handleSubmit = async () => {
    setMsg(null); setError(null);
    if (!form.name.trim()) { setError("الاسم مطلوب"); return; }

    if (selectedNode?.type === "addBranch" || (selectedNode?.type === "branch" && !editing)) {
      if (!form.code.trim()) { setError("كود الفرع مطلوب"); return; }
      try {
        const res = await fetch("/api/finance/branches", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ code: form.code, name: form.name }),
        });
        const data = await res.json();
        if (data.success) { setMsg(data.message); loadData(); setSelectedNode(null); setForm({ code: "", name: "", type: "vehicle" }); }
        else setError(data.error);
      } catch { setError("خطأ"); }
    } else if (selectedNode?.type === "addCenter" || (selectedNode?.type === "vehicle" || selectedNode?.type === "booking" || selectedNode?.type === "admin") && !editing) {
      if (!form.code.trim()) { setError("الكود مطلوب"); return; }
      const fType = selectedNode?.data?.type || form.type;
      try {
        const res = await fetch("/api/finance/cost-centers", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ code: form.code, name: form.name, type: fType }),
        });
        const data = await res.json();
        if (data.success) { setMsg(data.message); loadData(); setSelectedNode(null); setForm({ code: "", name: "", type: "vehicle" }); }
        else setError(data.error);
      } catch { setError("خطأ"); }
    }
  };

  const handleUpdate = async () => {
    setMsg(null); setError(null);
    if (!form.name.trim()) { setError("الاسم مطلوب"); return; }
    if (!selectedNode) return;

    try {
      if (selectedNode.type === "branch") {
        const res = await fetch("/api/finance/branches", {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ code: form.code, name: form.name }),
        });
        const data = await res.json();
        if (data.success) { setMsg(data.message); loadData(); setEditing(false); }
        else setError(data.error);
      } else {
        const res = await fetch("/api/finance/cost-centers", {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ code: form.code, name: form.name, type: form.type }),
        });
        const data = await res.json();
        if (data.success) { setMsg(data.message); loadData(); setEditing(false); }
        else setError(data.error);
      }
    } catch { setError("خطأ"); }
  };

  const handleDelete = async (node) => {
    if (!node || !node.code) return;
    if (!confirm(`إخفاء "${node.name}"؟`)) return;
    setMsg(null); setError(null);
    try {
      const endpoint = node.type === "branch" ? "/api/finance/branches" : "/api/finance/cost-centers";
      const res = await fetch(`${endpoint}?code=${encodeURIComponent(node.code)}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setMsg(data.message); loadData(); if (selectedNode?.code === node.code) setSelectedNode(null); }
      else setError(data.error);
    } catch { setError("خطأ"); }
  };

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isFormVisible = selectedNode && (selectedNode.type === "addBranch" || selectedNode.type === "addCenter" || editing);

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  }

  if (!authorized) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>⛔ غير مصرح</h2>
        <p>هذه الصفحة مخصصة للمدير فقط.</p>
        <a href="/" style={{ color: "#059669", fontWeight: "bold" }}>← العودة للوحة الرئيسية</a>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">🏦</div>
          <div>
            <h1>هابي لاند</h1>
            <p>إدارة الفروع ومراكز التكلفة</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/admin/dashboard" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: "bold" }}>← لوحة المدير</a>
          <a href="/" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: "bold" }}>← الرئيسية</a>
        </div>
      </header>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="config-layout">
        {/* Left panel: Tree */}
        <section className="glass config-panel">
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleSelect({ type: "addBranch", code: "", name: "" })}>➕ إضافة فرع</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleSelect({ type: "addCenter", code: "", name: "", branchCode: "" })}>➕ إضافة مركز تكلفة</button>
          </div>

          <div className="tree-view">
            {/* Vehicles */}
            <div className="tree-node">
              <div className={`tree-node-header ${selectedNode?.type === "vehicleGroup" ? "selected" : ""}`} onClick={() => toggleExpand("vehicles")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem", cursor: "pointer", borderRadius: "6px", fontWeight: 600 }}>
                <span>{expanded.vehicles ? "▼" : "▶"}</span>
                <span>🚛 مركبات ({vehicles.length})</span>
              </div>
              {expanded.vehicles && vehicles.map(v => (
                <div key={v.code} className={`tree-node-child ${selectedNode?.code === v.code && selectedNode?.type === "vehicle" ? "selected" : ""}`}
                  onClick={() => handleSelect({ type: "vehicle", code: v.code, name: v.name, data: v })}
                  style={{ padding: "0.3rem 0.5rem 0.3rem 2rem", cursor: "pointer", borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ flex: 1 }}>{v.name}</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{v.code}</span>
                  <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleSelect({ type: "vehicle", code: v.code, name: v.name, data: v }); setEditing(true); }}>✏️</button>
                  <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleDelete({ type: "vehicle", code: v.code, name: v.name }); }}>🗑️</button>
                </div>
              ))}
            </div>

            {/* Branches */}
            {branches.map(b => {
              const bc = getBranchCenters(b.code);
              const hasChildren = bc.booking.length > 0 || bc.admin.length > 0;
              const isExpanded = expanded[b.code];
              return (
                <div key={b.code} className="tree-node">
                  <div className={`tree-node-header ${selectedNode?.code === b.code && selectedNode?.type === "branch" ? "selected" : ""}`}
                    onClick={() => handleSelect({ type: "branch", code: b.code, name: b.name, data: b })}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem", cursor: "pointer", borderRadius: "6px", fontWeight: 600 }}>
                    <span onClick={(e) => { e.stopPropagation(); toggleExpand(b.code); }} style={{ cursor: "pointer" }}>{hasChildren ? (isExpanded ? "▼" : "▶") : "  "}</span>
                    <span>🏢 {b.name}</span>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem", marginLeft: "auto" }} onClick={(e) => { e.stopPropagation(); handleSelect({ type: "branch", code: b.code, name: b.name, data: b }); setEditing(true); }}>✏️</button>
                    <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleDelete({ type: "branch", code: b.code, name: b.name }); }}>🗑️</button>
                  </div>
                  {isExpanded && (
                    <div className="tree-node-children">
                      {bc.booking.length > 0 && (
                        <div style={{ fontSize: "0.75rem", opacity: 0.6, padding: "0.2rem 0.5rem 0.2rem 2rem" }}>📋 حجوزات</div>
                      )}
                      {bc.booking.map(c => (
                        <div key={c.code} className={`tree-node-child ${selectedNode?.code === c.code && selectedNode?.type === "booking" ? "selected" : ""}`}
                          onClick={() => handleSelect({ type: "booking", code: c.code, name: c.name, data: c })}
                          style={{ padding: "0.3rem 0.5rem 0.3rem 2.5rem", cursor: "pointer", borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{c.code}</span>
                          <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleSelect({ type: "booking", code: c.code, name: c.name, data: c }); setEditing(true); }}>✏️</button>
                          <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleDelete({ type: "booking", code: c.code, name: c.name }); }}>🗑️</button>
                        </div>
                      ))}
                      {bc.admin.length > 0 && (
                        <div style={{ fontSize: "0.75rem", opacity: 0.6, padding: "0.2rem 0.5rem 0.2rem 2rem" }}>📋 إداري</div>
                      )}
                      {bc.admin.map(c => (
                        <div key={c.code} className={`tree-node-child ${selectedNode?.code === c.code && selectedNode?.type === "admin" ? "selected" : ""}`}
                          onClick={() => handleSelect({ type: "admin", code: c.code, name: c.name, data: c })}
                          style={{ padding: "0.3rem 0.5rem 0.3rem 2.5rem", cursor: "pointer", borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>{c.code}</span>
                          <button className="btn btn-sm btn-ghost" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleSelect({ type: "admin", code: c.code, name: c.name, data: c }); setEditing(true); }}>✏️</button>
                          <button className="btn btn-sm btn-ghost text-red" style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem" }} onClick={(e) => { e.stopPropagation(); handleDelete({ type: "admin", code: c.code, name: c.name }); }}>🗑️</button>
                        </div>
                      ))}
                      <div className="tree-node-child" style={{ padding: "0.3rem 0.5rem 0.3rem 2.5rem", cursor: "pointer", borderRadius: "4px", opacity: 0.7 }}
                        onClick={() => handleSelect({ type: "addCenter", code: "", name: "", branchCode: b.code })}>
                        ➕ إضافة مركز تكلفة لـ {b.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {branches.length === 0 && <p className="no-data" style={{ marginTop: "0.5rem" }}>لا توجد فروع بعد</p>}
          </div>
        </section>

        {/* Right panel: Form */}
        <section className="glass config-panel">
          <h2>
            {selectedNode?.type === "addBranch" && "➕ إضافة فرع جديد"}
            {selectedNode?.type === "addCenter" && "➕ إضافة مركز تكلفة جديد"}
            {selectedNode?.type === "branch" && (editing ? `✏️ تعديل فرع: ${selectedNode.name}` : `🏢 ${selectedNode.name}`)}
            {selectedNode?.type === "vehicle" && (editing ? `✏️ تعديل: ${selectedNode.name}` : `🚛 ${selectedNode.name}`)}
            {selectedNode?.type === "booking" && (editing ? `✏️ تعديل: ${selectedNode.name}` : `📋 ${selectedNode.name}`)}
            {selectedNode?.type === "admin" && (editing ? `✏️ تعديل: ${selectedNode.name}` : `📋 ${selectedNode.name}`)}
            {!selectedNode && "اختر عنصراً من الشجرة"}
          </h2>

          {!selectedNode && <p className="no-data">اختر فرعاً أو مركز تكلفة من القائمة لعرض التفاصيل أو إضافة جديد</p>}

          {(selectedNode?.type === "branch" && !editing) && (
            <div>
              <p><strong>الكود:</strong> {selectedNode.code}</p>
              <p><strong>الاسم:</strong> {selectedNode.name}</p>
              <p><strong>عدد مراكز التكلفة:</strong> {getBranchCenters(selectedNode.code).booking.length + getBranchCenters(selectedNode.code).admin.length}</p>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ تعديل</button>
            </div>
          )}

          {((selectedNode?.type === "vehicle" || selectedNode?.type === "booking" || selectedNode?.type === "admin") && !editing) && (
            <div>
              <p><strong>الكود:</strong> {selectedNode.code}</p>
              <p><strong>الاسم:</strong> {selectedNode.name}</p>
              <p><strong>النوع:</strong> {selectedNode.data?.type === "vehicle" ? "مركبة" : selectedNode.data?.type === "booking" ? "حجوزات" : selectedNode.data?.type === "administrative" ? "إداري" : selectedNode.data?.type}</p>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ تعديل</button>
            </div>
          )}

          {(selectedNode?.type === "addBranch" || (selectedNode?.type === "branch" && editing)) && (
            <div className="add-form">
              <div className="form-group">
                <label>كود الفرع</label>
                <input type="text" className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: RUH" disabled={editing} />
              </div>
              <div className="form-group">
                <label>اسم الفرع</label>
                <input type="text" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: الرياض" />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                {editing ? (
                  <button className="btn btn-primary" onClick={handleUpdate}>💾 حفظ التعديلات</button>
                ) : (
                  <button className="btn btn-primary" onClick={handleSubmit}>➕ إضافة</button>
                )}
                <button className="btn btn-secondary" onClick={() => { setSelectedNode(null); setEditing(false); setForm({ code: "", name: "", type: "vehicle" }); }}>إلغاء</button>
              </div>
            </div>
          )}

          {(selectedNode?.type === "addCenter" || ((selectedNode?.type === "vehicle" || selectedNode?.type === "booking" || selectedNode?.type === "admin") && editing)) && (
            <div className="add-form">
              <div className="form-group">
                <label>الكود</label>
                <input type="text" className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={selectedNode?.branchCode ? `مثال: CC-${selectedNode.branchCode}-TYPE` : "مثال: VEH-03"} disabled={editing} />
              </div>
              <div className="form-group">
                <label>الاسم</label>
                <input type="text" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: دينا رقم 3" />
              </div>
              {!editing && (
                <div className="form-group">
                  <label>النوع</label>
                  <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="vehicle">🚛 مركبة</option>
                    <option value="booking">📋 حجوزات</option>
                    <option value="administrative">📋 إداري</option>
                  </select>
                </div>
              )}
              {selectedNode?.branchCode && (
                <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>سيتم إضافة مركز التكلفة لفرع {branches.find(b => b.code === selectedNode.branchCode)?.name}</p>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                {editing ? (
                  <button className="btn btn-primary" onClick={handleUpdate}>💾 حفظ التعديلات</button>
                ) : (
                  <button className="btn btn-primary" onClick={handleSubmit}>➕ إضافة</button>
                )}
                <button className="btn btn-secondary" onClick={() => { setSelectedNode(null); setEditing(false); setForm({ code: "", name: "", type: "vehicle" }); }}>إلغاء</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .tree-node-header:hover, .tree-node-child:hover { background: rgba(255,255,255,0.05); }
        .tree-node-header.selected, .tree-node-child.selected { background: rgba(255,215,0,0.12); border-right: 3px solid #ffd700; }
        .tree-node-child { transition: background 0.15s; }
      `}</style>
    </div>
  );
}
