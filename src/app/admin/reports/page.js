"use client";
import React, { useState, useEffect } from "react";
import DualCalendarPicker from "@/components/DualCalendarPicker";

export default function AdminReports({ embedded }) {
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("pnl");
  const [pnl, setPnl] = useState(null);
  const [bs, setBs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (embedded) { setAuthorized(true); loadPnl(); loadBs(); return; }
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
        loadPnl();
        loadBs();
      });
  }, []);

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

  const formatCurrency = (val) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val || 0);

  const renderTree = (items, depth = 0) => (
    <div>
      {items.map((item) => (
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

  if (loading) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  if (!authorized && !embedded) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><h2>⛔ غير مصرح</h2><a href="/" style={{ color: "#059669" }}>← العودة</a></div>;

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">👑</div>
          <div><h1>هابي لاند</h1><p>التقارير المالية</p></div>
        </div>
        <a href="/admin/dashboard" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "8px" }}>← العودة للوحة المدير</a>
      </header>

      <div className="mini-tabs" style={{ marginTop: "1rem" }}>
        <button className={`mini-tab ${tab === "pnl" ? "active" : ""}`} onClick={() => setTab("pnl")}>📊 قائمة الدخل</button>
        <button className={`mini-tab ${tab === "bs" ? "active" : ""}`} onClick={() => setTab("bs")}>📋 الميزانية العمومية</button>
      </div>

      {tab === "pnl" && pnl && (
        <section className="glass" style={{ marginTop: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <DualCalendarPicker value={fromDate} onChange={(val) => { setFromDate(val); loadPnl(val, toDate); }} />
            <DualCalendarPicker value={toDate} onChange={(val) => { setToDate(val); loadPnl(fromDate, val); }} />
          </div>

          <div className="stats-grid four-col" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card glass"><span className="stat-icon text-emerald">💰</span><div className="stat-info"><h3>إجمالي الإيرادات</h3><p className="stat-value text-emerald">{formatCurrency(pnl.summary.totalIncome)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon text-red">💸</span><div className="stat-info"><h3>إجمالي المصروفات</h3><p className="stat-value text-red">{formatCurrency(pnl.summary.totalExpenses)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon" style={{color: pnl.summary.netProfit >= 0 ? "#059669" : "#dc2626"}}>📈</span><div className="stat-info"><h3>صافي الربح</h3><p className="stat-value" style={{color: pnl.summary.netProfit >= 0 ? "#059669" : "#dc2626"}}>{formatCurrency(pnl.summary.netProfit)}</p></div></div>
            <div className="stat-card glass"><span className="stat-icon text-gold">📊</span><div className="stat-info"><h3>هامش الربح</h3><p className="stat-value text-gold">{pnl.summary.profitMarginPercent?.toFixed(1)}%</p></div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <h3 style={{ color: "#4caf50", marginBottom: "0.5rem" }}>🟢 الإيرادات</h3>
              {renderTree(pnl.incomeTree)}
            </div>
            <div>
              <h3 style={{ color: "#ff4444", marginBottom: "0.5rem" }}>🔴 المصروفات</h3>
              {renderTree(pnl.expenseTree)}
            </div>
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
            <div>
              <h3 style={{ marginBottom: "0.5rem" }}>🏦 الأصول</h3>
              {renderTree(bs.assets)}
            </div>
            <div>
              <h3 style={{ color: "#f59e0b", marginBottom: "0.5rem" }}>💳 الخصوم</h3>
              {renderTree(bs.liabilities)}
            </div>
            <div>
              <h3 style={{ color: "#8b5cf6", marginBottom: "0.5rem" }}>📊 حقوق الملكية</h3>
              {renderTree(bs.equity)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
