"use client";
import React, { useState, useEffect } from "react";
import { LayoutDashboard, BarChart3, DollarSign, CreditCard, TrendingUp } from "lucide-react";

export default function AdminHub() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      });
  }, []);

  const tabs = [
    { key: "dashboard", label: "📈 لوحة التحكم", icon: LayoutDashboard },
    { key: "reports", label: "📊 التقارير المالية", icon: BarChart3 },
    { key: "pnl", label: "💰 قائمة الدخل", icon: DollarSign },
    { key: "balance-sheet", label: "📋 الميزانية العمومية", icon: CreditCard },
  ];

  if (loading) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  if (!authorized) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><h2>⛔ غير مصرح</h2><a href="/" style={{ color: "#059669" }}>← العودة</a></div>;

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">👑</div>
          <div><h1>هابي لاند</h1><p>إدارة النظام</p></div>
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
        {activeTab === "dashboard" && <AdminDashboard embedded />}
        {activeTab === "reports" && <AdminReports embedded />}
        {activeTab === "pnl" && <AdminReports embedded defaultTab="pnl" />}
        {activeTab === "balance-sheet" && <AdminReports embedded defaultTab="bs" />}
      </div>
    </div>
  );
}

function AdminDashboard({ embedded }) {
  const [bookings, setBookings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings?limit=1000").then(r => r.json()),
      fetch("/api/inventory").then(r => r.json()),
      fetch("/api/finance/profit-loss").then(r => r.json()),
    ]).then(([bData, invData, pnlRes]) => {
      setBookings(bData.bookings || []);
      setInventory(invData.items || []);
      setPnlData(pnlRes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalCollected = bookings.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalOutstanding = bookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
  const pendingCount = bookings.filter(b => b.status === "قيد الانتظار").length;
  const activeCount = bookings.filter(b => b.status === "مؤكد").length;

  const formatCurrency = (val) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val);

  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}><p>جاري تحميل لوحة المدير...</p></div>;

  const pnl = pnlData?.summary;

  return (
    <>
      <section className="stats-grid">
        <div className="stat-card glass"><span className="stat-icon">📅</span><div className="stat-info"><h3>إجمالي الحجوزات</h3><p className="stat-value">{bookings.length}</p></div></div>
        <div className="stat-card glass"><span className="stat-icon text-emerald">💰</span><div className="stat-info"><h3>إجمالي الإيرادات</h3><p className="stat-value text-emerald">{formatCurrency(totalRevenue)}</p></div></div>
        <div className="stat-card glass"><span className="stat-icon text-gold">💵</span><div className="stat-info"><h3>المبالغ المحصلة</h3><p className="stat-value text-gold">{formatCurrency(totalCollected)}</p></div></div>
        <div className="stat-card glass"><span className="stat-icon text-red">⚠️</span><div className="stat-info"><h3>المستحقات المتبقية</h3><p className="stat-value text-red">{formatCurrency(totalOutstanding)}</p></div></div>
        <div className="stat-card glass"><span className="stat-icon" style={{color: "#7c3aed"}}>⏳</span><div className="stat-info"><h3>قيد الانتظار</h3><p className="stat-value" style={{color: "#7c3aed"}}>{pendingCount}</p></div></div>
        <div className="stat-card glass"><span className="stat-icon text-emerald">✅</span><div className="stat-info"><h3>الحجوزات النشطة</h3><p className="stat-value text-emerald">{activeCount}</p></div></div>
      </section>

      {pnl && (
        <section className="stats-grid four-col">
          <div className="stat-card glass"><span className="stat-icon text-emerald">💰</span><div className="stat-info"><h3>إجمالي الإيرادات (P&L)</h3><p className="stat-value text-emerald">{formatCurrency(pnl.totalIncome)}</p></div></div>
          <div className="stat-card glass"><span className="stat-icon text-red">💸</span><div className="stat-info"><h3>إجمالي المصروفات</h3><p className="stat-value text-red">{formatCurrency(pnl.totalExpenses)}</p></div></div>
          <div className="stat-card glass"><span className="stat-icon" style={{color: pnl.netProfit >= 0 ? "#059669" : "#dc2626"}}>📈</span><div className="stat-info"><h3>صافي الربح</h3><p className="stat-value" style={{color: pnl.netProfit >= 0 ? "#059669" : "#dc2626"}}>{formatCurrency(pnl.netProfit)}</p></div></div>
          <div className="stat-card glass"><span className="stat-icon text-gold">📊</span><div className="stat-info"><h3>هامش الربح</h3><p className="stat-value text-gold">{pnl.profitMarginPercent?.toFixed(1)}%</p></div></div>
        </section>
      )}

      <section className="glass" style={{ padding: "1.5rem" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem" }}>🔗 روابط سريعة</h2>
        <div className="admin-links" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <a href="/" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>🎁</span><span style={{ fontWeight: "bold", color: "#065f46" }}>إدارة الباقات</span></a>
          <a href="/admin/config" className="admin-link-card" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>⚙️</span><span style={{ fontWeight: "bold", color: "#5b21b6" }}>إدارة الأنواع والحقول</span></a>
          <a href="/admin/finance" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>🏦</span><span style={{ fontWeight: "bold", color: "#065f46" }}>إدارة الفروع ومراكز التكلفة</span></a>
          <a href="/" className="admin-link-card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>💸</span><span style={{ fontWeight: "bold", color: "#991b1b" }}>إدارة المصروفات</span></a>
          <a href="/admin/reports" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>📊</span><span style={{ fontWeight: "bold", color: "#065f46" }}>التقارير المالية</span></a>
          <a href="/" className="admin-link-card" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}><span style={{ fontSize: "1.5rem" }}>📦</span><span style={{ fontWeight: "bold", color: "#1d4ed8" }}>إدارة المخزون</span></a>
        </div>
      </section>
    </>
  );
}

function AdminReports({ embedded, defaultTab }) {
  const [tab, setTab] = useState(defaultTab || "pnl");
  const [pnl, setPnl] = useState(null);
  const [bs, setBs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadPnl = async (from, to) => {
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const r = await fetch(`/api/finance/profit-loss?${p}`);
      const d = await r.json();
      if (d.success) setPnl(d);
    } catch {}
    setLoading(false);
  };

  const loadBs = async () => {
    try {
      const r = await fetch("/api/finance/balance-sheet");
      const d = await r.json();
      if (d.success) setBs(d);
    } catch {}
  };

  useEffect(() => { loadPnl(); loadBs(); }, []);

  const formatCurrency = (val) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val || 0);

  const renderTree = (items, depth = 0) => (
    <div>
      {items.map(item => (
        <div key={item.accountCode}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", paddingRight: `${depth * 1.2}rem`, fontSize: depth === 0 ? "0.9rem" : "0.82rem", fontWeight: depth === 0 ? 700 : 400, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span>{item.accountName} <span style={{ opacity: 0.4, fontSize: "0.7rem" }}>({item.accountCode})</span></span>
            <span style={{ color: item.balance >= 0 ? "#4caf50" : "#ff4444" }}>{formatCurrency(item.balance)}</span>
          </div>
          {item.children?.length > 0 && renderTree(item.children, depth + 1)}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="mini-tabs" style={{ marginTop: "1rem" }}>
        <button className={`mini-tab ${tab === "pnl" ? "active" : ""}`} onClick={() => setTab("pnl")}>📊 قائمة الدخل</button>
        <button className={`mini-tab ${tab === "bs" ? "active" : ""}`} onClick={() => setTab("bs")}>📋 الميزانية العمومية</button>
      </div>

      {tab === "pnl" && pnl && (
        <section className="glass" style={{ marginTop: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); loadPnl(e.target.value, toDate); }} className="form-control" style={{ width: "auto" }} />
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); loadPnl(fromDate, e.target.value); }} className="form-control" style={{ width: "auto" }} />
          </div>

          <div className="stats-grid four-col" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card glass"><span className="stat-icon text-emerald">💰</span><div className="stat-info"><h3>إجمالي الإيرادات</h3><p className="stat-value text-emerald">{formatCurrency(pnl.summary.totalIncome)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon text-red">💸</span><div className="stat-info"><h3>إجمالي المصروفات</h3><p className="stat-value text-red">{formatCurrency(pnl.summary.totalExpenses)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon" style={{color: pnl.summary.netProfit >= 0 ? "#059669" : "#dc2626"}}>📈</span><div className="stat-info"><h3>صافي الربح</h3><p className="stat-value" style={{color: pnl.summary.netProfit >= 0 ? "#059669" : "#dc2626"}}>{formatCurrency(pnl.summary.netProfit)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon text-gold">📊</span><div className="stat-info"><h3>هامش الربح</h3><p className="stat-value text-gold">{pnl.summary.profitMarginPercent?.toFixed(1)}%</p></div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div><h3 style={{ color: "#4caf50", marginBottom: "0.5rem" }}>🟢 الإيرادات</h3>{renderTree(pnl.incomeTree)}</div>
            <div><h3 style={{ color: "#ff4444", marginBottom: "0.5rem" }}>🔴 المصروفات</h3>{renderTree(pnl.expenseTree)}</div>
          </div>
        </section>
      )}

      {tab === "bs" && bs && (
        <section className="glass" style={{ marginTop: "1rem", padding: "1.5rem" }}>
          <div className="stats-grid three-col" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card glass"><span className="stat-icon">🏦</span><div className="stat-info"><h3>إجمالي الأصول</h3><p className="stat-value">{formatCurrency(bs.summary.totalAssets)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon" style={{color:"#f59e0b"}}>💳</span><div className="stat-info"><h3>إجمالي الخصوم</h3><p className="stat-value" style={{color:"#f59e0b"}}>{formatCurrency(bs.summary.totalLiabilities)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon" style={{color:"#8b5cf6"}}>📊</span><div className="stat-info"><h3>حقوق الملكية</h3><p className="stat-value" style={{color:"#8b5cf6"}}>{formatCurrency(bs.summary.totalEquity)}</p></div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
            <div><h3 style={{ marginBottom: "0.5rem" }}>🏦 الأصول</h3>{renderTree(bs.assets)}</div>
            <div><h3 style={{ color: "#f59e0b", marginBottom: "0.5rem" }}>💳 الخصوم</h3>{renderTree(bs.liabilities)}</div>
            <div><h3 style={{ color: "#8b5cf6", marginBottom: "0.5rem" }}>📊 حقوق الملكية</h3>{renderTree(bs.equity)}</div>
          </div>
        </section>
      )}
    </>
  );
}