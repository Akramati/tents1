"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import ConfirmModal from "@/components/ConfirmModal";

export default function InventoryView() {
  const { print } = useApp();
  const [tab, setTab] = useState("stock");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ itemName: "", totalQuantity: "", underMaintenance: "" });
  const [mtLogs, setMtLogs] = useState([]);
  const [mtLoading, setMtLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [costMap, setCostMap] = useState({});
  const [rentedMap, setRentedMap] = useState({});

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        const ids = (data.items || []).map((i) => i.itemId).filter(Boolean);
        if (ids.length > 0) {
          const costRes = await fetch(`/api/inventory/cost?itemIds=${ids.join(",")}`);
          const costData = await costRes.json();
          if (costData.success) {
            const map = {};
            costData.items.forEach((ci) => { map[ci.itemId] = ci; });
            setCostMap(map);
          }
        }
      }
      // Fetch current rented-out quantities
      const today = new Date().toISOString().slice(0, 10);
      const availRes = await fetch(`/api/inventory/available?date=${today}`);
      const availData = await availRes.json();
      if (availData.success) {
        const map = {};
        availData.items.forEach((i) => { map[i.itemId] = i.rentedOnDate || 0; });
        setRentedMap(map);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchMtLogs = async () => {
    setMtLoading(true);
    try {
      const res = await fetch("/api/maintenance");
      const data = await res.json();
      if (data.success) setMtLogs(data.logs || []);
    } catch (err) { console.error(err); }
    setMtLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        itemId: editId || undefined,
        itemName: form.itemName,
        totalQuantity: parseInt(form.totalQuantity) || 0,
        underMaintenance: parseInt(form.underMaintenance) || 0,
      };
      const res = await fetch("/api/inventory", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setForm({ itemName: "", totalQuantity: "", underMaintenance: "" });
        setEditId(null);
        setShowForm(false);
        await fetchItems();
      }
    } catch (err) { console.error(err); }
  };

  const startEdit = (item) => {
    setEditId(item.itemId);
    setForm({ itemName: item.itemName, totalQuantity: String(item.totalQuantity), underMaintenance: String(item.underMaintenance) });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ itemName: "", totalQuantity: "", underMaintenance: "" });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/inventory?itemId=${deleteConfirm.itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        setMenuOpenId(null);
        await fetchItems();
      }
    } catch (err) { console.error(err); }
  };

  const handleRenumber = async () => {
    try {
      const res = await fetch("/api/renumber", { method: "POST" });
      const data = await res.json();
      if (data.success) await fetchItems();
    } catch (err) { console.error(err); }
  };

  const handleMarkResolved = async (logId) => {
    try {
      await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      await fetchMtLogs();
    } catch (err) { console.error(err); }
  };

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>📦 إدارة المخزون</h2>
        <div className="btn-group">
          {!showForm && tab === "stock" && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>➕ إضافة صنف جديد</button>
          )}
          <button className="btn btn-sm btn-renumber" onClick={handleRenumber}>🔢 إعادة ترقيم</button>
          <button className="btn btn-gold" onClick={() => print("INVENTORY_LIST", {
            title: "قائمة جرد المخزون",
            date: new Date().toLocaleDateString("ar-SA"),
            items: items.map((item) => ({
              name: item.itemName, expected: item.totalQuantity,
              actual: item.totalQuantity - (item.underMaintenance || 0),
              rented: rentedMap[item.itemId] || 0,
              available: Math.max(0, item.totalQuantity - (item.underMaintenance || 0) - (rentedMap[item.itemId] || 0)),
              deficit: item.underMaintenance,
              status: (item.totalQuantity - (item.underMaintenance || 0) - (rentedMap[item.itemId] || 0)) <= 0 ? "غير متوفر" : "متوفر",
            })),
          })}>🖨️ طباعة الجرد</button>
        </div>
      </div>

      <div className="inv-tabs">
        <button className={`inv-tab ${tab === "stock" ? "active" : ""}`} onClick={() => setTab("stock")}>🏚️ المخزون</button>
        <button className={`inv-tab ${tab === "maintenance" ? "active" : ""}`} onClick={() => { setTab("maintenance"); fetchMtLogs(); }}>🔧 سجل الصيانة</button>
      </div>

      {tab === "stock" ? (
        <>
          {showForm && (
            <form onSubmit={handleSubmit} className="inv-form">
              <div className="form-grid mini-grid">
                <div className="form-group">
                  <label>اسم الصنف <span className="required">*</span></label>
                  <input type="text" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="مثال: خيمة كبيرة 10×10" className="form-control" required />
                </div>
                <div className="form-group">
                  <label>الكمية الإجمالية</label>
                  <input type="number" value={form.totalQuantity} onChange={(e) => setForm({ ...form, totalQuantity: e.target.value })} placeholder="0" className="form-control" />
                </div>
                <div className="form-group">
                  <label>تحت الصيانة</label>
                  <input type="number" value={form.underMaintenance} onChange={(e) => setForm({ ...form, underMaintenance: e.target.value })} placeholder="0" className="form-control" />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "جارٍ الحفظ..." : editId ? "تحديث الصنف" : "إضافة الصنف"}
                </button>
                <button type="button" className="btn btn-gold" onClick={cancelForm}>إلغاء</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="loading-spinner-container"><div className="loading-spinner"></div><p>جاري تحميل المخزون...</p></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>لا توجد أصناف في المخزون</h3>
              <p>أضف أول صنف للبدء في إدارة المخزون.</p>
              <button className="btn btn-gold" onClick={() => setShowForm(true)}>➕ إضافة صنف</button>
            </div>
          ) : (
            <div className="inv-table-wrapper">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الصنف</th>
                    <th>الإجمالي</th>
                    <th>تحت الصيانة</th>
                    <th>المتاح</th>
                    <th>المؤجر</th>
                    <th>المتوفر</th>
                    <th>تكلفة الوحدة</th>
                    <th>إجمالي التكلفة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.itemId}>
                      <td className="cell-mono">{item.itemId}</td>
                      <td><strong>{item.itemName}</strong></td>
                      <td className="cell-center">{item.totalQuantity}</td>
                      <td className="cell-center">
                        {item.underMaintenance > 0 ? <span className="text-red">{item.underMaintenance}</span> : item.underMaintenance}
                      </td>
                      <td className="cell-center">
                        <span className={`avail-badge ${(item.totalQuantity - (item.underMaintenance || 0)) <= 0 ? "out" : (item.totalQuantity - (item.underMaintenance || 0)) < 5 ? "low" : "ok"}`}>
                          {item.totalQuantity - (item.underMaintenance || 0)}
                        </span>
                      </td>
                      <td className="cell-center">{rentedMap[item.itemId] > 0 ? rentedMap[item.itemId] : "0"}</td>
                      <td className="cell-center">
                        <span className={`avail-badge ${(item.totalQuantity - (item.underMaintenance || 0) - (rentedMap[item.itemId] || 0)) <= 0 ? "out" : "ok"}`}>
                          {Math.max(0, item.totalQuantity - (item.underMaintenance || 0) - (rentedMap[item.itemId] || 0))}
                        </span>
                      </td>
                      <td className="cell-center">
                        {costMap[item.itemId] ? `${costMap[item.itemId].unitCost.toLocaleString()} ﷼` : "—"}
                      </td>
                      <td className="cell-center">
                        {costMap[item.itemId] ? `${costMap[item.itemId].totalCost.toLocaleString()} ﷼` : "—"}
                      </td>
                      <td className="actions-cell">
                        <div className="three-dots-wrapper">
                          <button className="three-dots-btn" onClick={() => setMenuOpenId(menuOpenId === item.itemId ? null : item.itemId)}>•••</button>
                          {menuOpenId === item.itemId && (
                            <>
                              <div className="menu-backdrop" onClick={() => setMenuOpenId(null)}></div>
                              <div className="dots-menu">
                                <button className="dots-menu-item" onClick={() => { setMenuOpenId(null); startEdit(item); }}>✏️ تعديل</button>
                                <button className="dots-menu-item danger" onClick={() => { setMenuOpenId(null); setDeleteConfirm(item); }}>🗑️ حذف</button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {mtLoading ? (
            <div className="loading-spinner-container"><div className="loading-spinner"></div><p>جاري تحميل سجل الصيانة...</p></div>
          ) : mtLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔧</div>
              <h3>لا توجد سجلات صيانة</h3>
              <p>سجلات الصيانة تظهر تلقائياً عند تسجيل تلف في الأصناف من لوحة العمليات الميدانية.</p>
            </div>
          ) : (
            <div className="inv-table-wrapper">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الصنف</th>
                    <th>تاريخ البداية</th>
                    <th>تاريخ النهاية</th>
                    <th>السبب</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {mtLogs.map((log) => (
                    <tr key={log.logId}>
                      <td className="cell-mono">{log.logId}</td>
                      <td><strong>{log.itemName}</strong></td>
                      <td className="cell-center">{log.startDate || "—"}</td>
                      <td className="cell-center">{log.endDate || "—"}</td>
                      <td className="cell-reason">{log.reason || "—"}</td>
                      <td className="cell-center">
                        {log.endDate ? <span className="avail-badge ok">مُصلَح</span> : <span className="avail-badge out">قيد الصيانة</span>}
                      </td>
                      <td>
                        {!log.endDate && (
                          <button className="btn-sm btn-success" onClick={() => handleMarkResolved(log.logId)}>✅ تم الإصلاح</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <ConfirmModal
        show={!!deleteConfirm}
        title="🗑️ حذف صنف"
        message={`هل أنت متأكد من حذف "${deleteConfirm?.itemName}"؟`}
        confirmLabel="نعم، احذف"
        confirmClass="btn btn-danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </section>
  );
}
