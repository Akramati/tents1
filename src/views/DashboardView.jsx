"use client";
import { useState, useEffect } from "react";

export default function DashboardView({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const monthStart = new Date();
        monthStart.setDate(1);
        const from = monthStart.toISOString().split("T")[0];

        const [plRes, bkRes] = await Promise.all([
          fetch(`/api/finance/profit-loss?from=${from}`),
          fetch("/api/bookings"),
        ]);
        const pl = await plRes.json();
        const bk = await bkRes.json();

        if (pl.success) setSummary(pl.summary);
        if (bk.success) {
          const all = (bk.bookings || []).sort((a, b) => (b.bookingId || "").localeCompare(a.bookingId || ""));
          setRecentBookings(all.slice(0, 10));
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-screen" style={{ textAlign: "center", padding: "3rem" }}>جاري تحميل البيانات...</div>;

  const formatCurrency = (v) => (v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const navLinks = [
    { label: "🔍 استعلام", view: "query" },
    { label: "➕ حجز جديد", view: "create" },
    { label: "🚛 الميدان", view: "fieldops" },
    { label: "📦 المخزون", view: "inventory" },
    { label: "📒 إدارة الحسابات", view: "accounting" },
    { label: "💰 العمليات المالية", view: "transactions" },
    { label: "❌ إلغاء", view: "cancel" },
    { label: "🎁 باقات", view: "packages" },
    { label: "📊 أرباح", view: "profitloss" },
  ];

  return (
    <section className="dashboard-view">
      <h2 style={{ marginBottom: "1rem" }}>🏠 لوحة القيادة</h2>

      {/* Summary Cards */}
      {summary && (
        <div className="dashboard-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="glass dashboard-card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>📅</div>
            <div className="card-value" style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{summary.ledgerCount}</div>
            <div className="card-label" style={{ fontSize: "0.75rem", opacity: 0.7 }}>عدد القيود</div>
          </div>
          <div className="glass dashboard-card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>🟢</div>
            <div className="card-value text-emerald" style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{formatCurrency(summary.totalIncome)}</div>
            <div className="card-label" style={{ fontSize: "0.75rem", opacity: 0.7 }}>إيرادات الشهر</div>
          </div>
          <div className="glass dashboard-card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>🔴</div>
            <div className="card-value text-gold" style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{formatCurrency(summary.totalExpenses)}</div>
            <div className="card-label" style={{ fontSize: "0.75rem", opacity: 0.7 }}>مصروفات الشهر</div>
          </div>
          <div className="glass dashboard-card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>💰</div>
            <div className="card-value" style={{ fontSize: "1.25rem", fontWeight: "bold", color: summary.netProfit >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(summary.netProfit)}</div>
            <div className="card-label" style={{ fontSize: "0.75rem", opacity: 0.7 }}>صافي الربح</div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="dashboard-links" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {navLinks.map((l) => (
          <button key={l.view} className="btn btn-secondary" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }} onClick={() => onNavigate(l.view)}>{l.label}</button>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="glass" style={{ padding: "1rem", borderRadius: "12px" }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>📋 آخر الحجوزات</h3>
        {recentBookings.length === 0 ? (
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>لا توجد حجوزات</p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {recentBookings.map((b) => (
              <div key={b.bookingId} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.8rem" }}>
                <span><strong>{b.bookingId}</strong> — {b.customerName}</span>
                <span style={{ opacity: 0.7 }}>{b.startDate} | {b.bookingType} | {b.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
