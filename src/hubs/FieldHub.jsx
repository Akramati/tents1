"use client";
import React, { useState, useEffect } from "react";
import { Package, Truck, Wrench, Settings, LayoutDashboard } from "lucide-react";
import FieldOpsView from "@/views/FieldOpsView";
import OperationsWorkspace from "@/views/OperationsWorkspace";

export default function FieldHub() {
  const [activeTab, setActiveTab] = useState("fieldops");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { window.location.href = "/"; return; }
        setAuthorized(true);
        setLoading(false);
      });
  }, []);

  const tabs = [
    { key: "fieldops", label: "🚛 عمليات الميدان", icon: Truck },
    { key: "operations", label: "💼 لوحة العمليات", icon: LayoutDashboard },
    { key: "packages", label: "🎁 الباقات", icon: Package },
    { key: "maintenance", label: "🔧 الصيانة", icon: Wrench },
  ];

  if (loading) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  if (!authorized) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><h2>⛔ غير مصرح</h2><a href="/" style={{ color: "#059669" }}>← العودة</a></div>;

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">🚛</div>
          <div><h1>هابي لاند</h1><p>العمليات الميدانية</p></div>
        </div>
      </header>

      <div className="hub-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={`hub-tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1rem", borderRadius: "10px", fontWeight: 600, cursor: "pointer", border: "none", background: activeTab === t.key ? "var(--gold)" : "rgba(255,255,255,0.05)", color: activeTab === t.key ? "#000" : "inherit" }}
            >
              <Icon size={18} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hub-content">
        {activeTab === "fieldops" && <FieldOpsView />}
        {activeTab === "operations" && <OperationsWorkspace />}
        {activeTab === "packages" && <PackagesEmbedded />}
        {activeTab === "maintenance" && <MaintenanceEmbedded />}
      </div>
    </div>
  );
}

function PackagesEmbedded() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/packages").then(r => r.json()).then(d => { if (d.success) setPackages(d.packages || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>جاري التحميل...</div>;

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>🎁 إدارة الباقات</h2>
        <a href="/admin/config" className="btn btn-primary" style={{ textDecoration: "none" }}>⚙️ إعدادات كاملة</a>
      </div>
      <div className="inv-table-wrapper">
        {packages.length === 0 ? (
          <p className="empty-state">لا توجد باقات</p>
        ) : (
          <table className="inv-table">
            <thead><tr><th>اسم الباقة</th><th>العروض</th><th>الأصناف</th></tr></thead>
            <tbody>
              {packages.map(pkg => {
                const widths = Object.keys(pkg.widths || {}).sort((a, b) => parseFloat(a) - parseFloat(b));
                const totalItems = Object.values(pkg.widths || {}).reduce((s, items) => s + items.length, 0);
                return (
                  <tr key={pkg.packageName}>
                    <td><strong>{pkg.packageName}</strong></td>
                    <td>{widths.map(w => <span key={w} className="pkg-item-tag" style={{ background: "var(--gold)", color: "#000", marginRight: "0.3rem" }}>{w}م</span>)}</td>
                    <td>{totalItems}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MaintenanceEmbedded() {
  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>🔧 سجل الصيانة</h2>
      </div>
      <p className="empty-state">يظهر تلقائياً عند تسجيل تلف في الأصناف من لوحة العمليات الميدانية.</p>
    </section>
  );
}