"use client";
import React, { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState(null);

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
        Promise.all([
          fetch("/api/bookings?limit=1000").then((r) => r.json()),
          fetch("/api/inventory").then((r) => r.json()),
          fetch("/api/finance/profit-loss").then((r) => r.json()),
        ])
      .then(([bData, invData, pnlRes]) => {
        setBookings(bData.bookings || []);
        setInventory(invData.items || []);
        setPnlData(pnlRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
      });
  }, []);

  const totalRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalCollected = bookings.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalOutstanding = bookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
  const pendingCount = bookings.filter((b) => b.status === "قيد الانتظار").length;
  const activeCount = bookings.filter((b) => b.status === "مؤكد").length;

  const formatCurrency = (val) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>جاري تحميل لوحة المدير...</p>
      </div>
    );
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

  const pnl = pnlData?.summary;

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">👑</div>
          <div>
            <h1>هابي لاند</h1>
            <p>لوحة تحكم المدير</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: "bold" }}>
            ← العودة للوحة الموظفين
          </a>
        </div>
      </header>

      {/* Financial KPI Cards */}
      <section className="stats-grid">
        <div className="stat-card glass">
          <span className="stat-icon">📅</span>
          <div className="stat-info">
            <h3>إجمالي الحجوزات</h3>
            <p className="stat-value">{bookings.length}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-emerald">💰</span>
          <div className="stat-info">
            <h3>إجمالي الإيرادات</h3>
            <p className="stat-value text-emerald">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-gold">💵</span>
          <div className="stat-info">
            <h3>المبالغ المحصلة</h3>
            <p className="stat-value text-gold">{formatCurrency(totalCollected)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-red">⚠️</span>
          <div className="stat-info">
            <h3>المستحقات المتبقية</h3>
            <p className="stat-value text-red">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon" style={{ color: "#7c3aed" }}>⏳</span>
          <div className="stat-info">
            <h3>قيد الانتظار</h3>
            <p className="stat-value" style={{ color: "#7c3aed" }}>{pendingCount}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-emerald">✅</span>
          <div className="stat-info">
            <h3>الحجوزات النشطة</h3>
            <p className="stat-value text-emerald">{activeCount}</p>
          </div>
        </div>
      </section>

      {/* P&L Summary */}
      {pnl && (
        <>
        <section className="stats-grid four-col">
          <div className="stat-card glass">
            <span className="stat-icon text-emerald">💰</span>
            <div className="stat-info">
              <h3>إجمالي الإيرادات (P&L)</h3>
              <p className="stat-value text-emerald">{formatCurrency(pnl.totalIncome)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon text-red">💸</span>
            <div className="stat-info">
              <h3>إجمالي المصروفات</h3>
              <p className="stat-value text-red">{formatCurrency(pnl.totalExpenses)}</p>
            </div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon" style={{ color: pnl.netProfit >= 0 ? "#059669" : "#dc2626" }}>📈</span>
            <div className="stat-info">
              <h3>صافي الربح</h3>
              <p className="stat-value" style={{ color: pnl.netProfit >= 0 ? "#059669" : "#dc2626" }}>
                {formatCurrency(pnl.netProfit)}
              </p>
            </div>
          </div>
          <div className="stat-card glass">
            <span className="stat-icon text-gold">📊</span>
            <div className="stat-info">
              <h3>هامش الربح</h3>
              <p className="stat-value text-gold">{pnl.profitMarginPercent?.toFixed(1)}%</p>
            </div>
          </div>
        </section>
        </>
      )}

      {/* Quick Actions */}
      <section className="glass" style={{ padding: "1.5rem" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem" }}>🔗 روابط سريعة</h2>
        <div className="admin-links">
          <a href="/" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🎁</span>
            <span style={{ fontWeight: "bold", color: "#065f46" }}>إدارة الباقات</span>
          </a>
          <a href="/admin/config" className="admin-link-card" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>⚙️</span>
            <span style={{ fontWeight: "bold", color: "#5b21b6" }}>إدارة الأنواع والحقول</span>
          </a>
          <a href="/admin/finance" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🏦</span>
            <span style={{ fontWeight: "bold", color: "#065f46" }}>إدارة الفروع ومراكز التكلفة</span>
          </a>
          <a href="/" className="admin-link-card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>💸</span>
            <span style={{ fontWeight: "bold", color: "#991b1b" }}>إدارة المصروفات</span>
          </a>
          <a href="/admin/reports" className="admin-link-card" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📊</span>
            <span style={{ fontWeight: "bold", color: "#065f46" }}>التقارير المالية</span>
          </a>
          <a href="/" className="admin-link-card" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "12px", padding: "1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📦</span>
            <span style={{ fontWeight: "bold", color: "#1d4ed8" }}>إدارة المخزون</span>
          </a>
        </div>
      </section>

    </div>
  );
}
