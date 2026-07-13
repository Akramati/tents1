"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Package, Settings, FileText, TrendingUp, Truck, DollarSign, Warehouse, MessageSquare, ShieldCheck, BarChart3, ClipboardList, Users } from "lucide-react";

export default function AdminHub() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [pnl, setPnl] = useState(null);

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
          fetch("/api/bookings?limit=1000").then(r => r.json()),
          fetch("/api/finance/profit-loss").then(r => r.json()),
        ]).then(([bData, pnlRes]) => {
          setBookings(bData.bookings || []);
          setPnl(pnlRes.summary || null);
        }).catch(() => {}).finally(() => setLoading(false));
      });
  }, []);

  const totalRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalCollected = bookings.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalOutstanding = bookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
  const activeCount = bookings.filter(b => b.status === "مؤكد" || b.status === "قيد الانتظار").length;

  const formatCurrency = (val) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val || 0);

  if (loading) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  if (!authorized) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><h2>⛔ غير مصرح</h2><Link href="/" style={{ color: "var(--primary)" }}>← العودة</Link></div>;

  const mainLinks = [
    { label: "إدارة الأنواع والحقول", href: "/admin/config", icon: Settings, desc: "أنواع الحجوزات، الحقول المخصصة، قوالب الرسائل", color: "#8b5cf6" },
    { label: "المخزون والأصناف", href: "/admin/inventory", icon: Package, desc: "إدارة المخزون، الأصناف، الباقات", color: "#3b82f6" },
    { label: "العمليات الميدانية", href: "/admin/operations", icon: Truck, desc: "لوحة تحكم الميدان، متابعة الحجوزات", color: "#10b981" },
    { label: "الشؤون المالية", href: "/admin/finance", icon: DollarSign, desc: "الحسابات، القيود، مراكز التكلفة", color: "#f59e0b" },
    { label: "التقارير المالية", href: "/admin/reports", icon: BarChart3, desc: "قائمة الدخل، الميزانية العمومية", color: "#06b6d4" },
  ];

  const quickLinks = [
    { label: "الموردين", href: "#", icon: Users, desc: "إدارة الموردين" },
    { label: "صلاحيات المستخدمين", href: "#", icon: ShieldCheck, desc: "إدارة الصلاحيات" },
  ];

  return (
    <div className="container">
      {/* Header */}
      <div className="glass" style={{ padding: "1.5rem 2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>👑</span>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>هابي لاند</h1>
            <p style={{ color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>لوحة تحكم المدير</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <div className="stat-card glass" style={{ padding: "1.25rem" }}>
          <span className="stat-icon" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>📅</span>
          <div className="stat-info"><h3>إجمالي الحجوزات</h3><p className="stat-value">{bookings.length}</p></div>
        </div>
        <div className="stat-card glass" style={{ padding: "1.25rem" }}>
          <span className="stat-icon" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>💰</span>
          <div className="stat-info"><h3>إجمالي الإيرادات</h3><p className="stat-value" style={{ color: "#10b981" }}>{formatCurrency(totalRevenue)}</p></div>
        </div>
        <div className="stat-card glass" style={{ padding: "1.25rem" }}>
          <span className="stat-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>💵</span>
          <div className="stat-info"><h3>المبالغ المحصلة</h3><p className="stat-value" style={{ color: "#f59e0b" }}>{formatCurrency(totalCollected)}</p></div>
        </div>
        <div className="stat-card glass" style={{ padding: "1.25rem" }}>
          <span className="stat-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>⚠️</span>
          <div className="stat-info"><h3>المستحقات</h3><p className="stat-value" style={{ color: "#ef4444" }}>{formatCurrency(totalOutstanding)}</p></div>
        </div>
        <div className="stat-card glass" style={{ padding: "1.25rem" }}>
          <span className="stat-icon" style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>✅</span>
          <div className="stat-info"><h3>الحجوزات النشطة</h3><p className="stat-value" style={{ color: "#8b5cf6" }}>{activeCount}</p></div>
        </div>
      </div>

      {/* P&L Summary */}
      {pnl && (
        <div className="glass" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <TrendingUp size={20} style={{ color: "var(--primary)" }} />
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>ملخص الأرباح (الشهر الحالي)</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>الإيرادات</span>
              <p style={{ fontWeight: 700, color: "#10b981", margin: "0.25rem 0 0", fontSize: "1.1rem" }}>{formatCurrency(pnl.totalIncome)}</p>
            </div>
            <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>المصروفات</span>
              <p style={{ fontWeight: 700, color: "#ef4444", margin: "0.25rem 0 0", fontSize: "1.1rem" }}>{formatCurrency(pnl.totalExpenses)}</p>
            </div>
            <div style={{ background: pnl.netProfit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>صافي الربح</span>
              <p style={{ fontWeight: 700, color: pnl.netProfit >= 0 ? "#10b981" : "#ef4444", margin: "0.25rem 0 0", fontSize: "1.1rem" }}>{formatCurrency(pnl.netProfit)}</p>
            </div>
            <div style={{ background: "rgba(6,182,212,0.08)", borderRadius: "var(--radius-sm)", padding: "0.75rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>هامش الربح</span>
              <p style={{ fontWeight: 700, color: "#06b6d4", margin: "0.25rem 0 0", fontSize: "1.1rem" }}>{pnl.profitMarginPercent?.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Cards */}
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>أقسام الإدارة</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        {mainLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                padding: "1.25rem", borderRadius: "var(--radius)",
                background: "var(--card-bg)", border: "1px solid var(--card-border)",
                boxShadow: "var(--shadow)", textDecoration: "none",
                transition: "var(--transition)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = link.color; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--card-border)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
            >
              <div style={{
                width: "48px", height: "48px", borderRadius: "14px",
                background: `${link.color}15`, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={24} style={{ color: link.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>{link.label}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>{link.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/admin/config" className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem", textDecoration: "none" }}>
          <Settings size={16} /> إعدادات النظام
        </Link>
        <Link href="/admin/reports" className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem", textDecoration: "none" }}>
          <BarChart3 size={16} /> التقارير المالية
        </Link>
      </div>
    </div>
  );
}
