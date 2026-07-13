"use client";
import React, { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import QueryView from "@/views/QueryView";
import CreateBookingView from "@/views/CreateBookingView";
import FieldOpsView from "@/views/FieldOpsView";
import InventoryView from "@/views/InventoryView";
import ProfitLossView from "@/views/ProfitLossView";
import PackagesView from "@/views/PackagesView";
import ExpensesView from "@/views/ExpensesView";
import TransactionsView from "@/views/TransactionsView";
import PaymentView from "@/views/PaymentView";
import DashboardView from "@/views/DashboardView";
import CancelView from "@/views/CancelView";
import AdminConfig from "@/app/admin/config/page";
import AdminFinance from "@/app/admin/finance/page";
import AdminReports from "@/app/admin/reports/page";

const OP_VIEWS = [
  { key: "query", label: "الحجوزات والاستعلام", icon: "🔍", adminOnly: false },
  { key: "create", label: "حجز جديد", icon: "➕", adminOnly: false },
  { key: "fieldops", label: "حركة الميدان", icon: "🚛", adminOnly: false },
  { key: "inventory", label: "حالة المخزون", icon: "📦", adminOnly: false },
  { key: "divider", label: "", icon: "", adminOnly: true, divider: true },
  { key: "transactions", label: "العمليات المالية", icon: "💰", adminOnly: true, sub: "قيود، إيجار، سندات صرف، موردون" },
  { key: "packages", label: "الباقات", icon: "🎁", adminOnly: true },
  { key: "admin-config", label: "الإعدادات", icon: "⚙️", adminOnly: true, sub: "الأنواع والرسائل والحقول" },
  { key: "admin-finance", label: "الفروع والتكاليف", icon: "🏛️", adminOnly: true, sub: "الفروع ومراكز التكلفة" },
  { key: "admin-reports", label: "التقارير المالية", icon: "📊", adminOnly: true, sub: "قائمة الدخل والميزانية" },
  { key: "accounting", label: "إدارة الحسابات", icon: "📒", adminOnly: true, sub: "شجرة حسابات، تحويل، تسوية" },
  { key: "divider2", label: "", icon: "", adminOnly: false, divider: true },
  { key: "dashboard", label: "لوحة المعلومات", icon: "📈", adminOnly: false, sub: "ملخص ونظرة سريعة" },
  { key: "cancel", label: "إدارة الإلغاء", icon: "❌", adminOnly: false, sub: "إلغاء الحجوزات وتسويتها" },
  { key: "payment", label: "تسجيل دفعة", icon: "💰", hidden: true, adminOnly: false },
];

export default function OperationsWorkspace() {
  const { userRole, print, view, setView } = useApp();
  const [activeView, setActiveView] = useState("query");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);

  const isAdmin = userRole === "admin";
  const visibleViews = OP_VIEWS.filter(v => !v.hidden).filter(v => v.divider || !v.adminOnly || isAdmin);

  // Sync with page-level view (e.g. when QueryView calls setView("create") for edit)
  useEffect(() => {
    const workspaceViews = new Set(OP_VIEWS.filter(v => !v.divider).map(v => v.key));
    if (workspaceViews.has(view)) {
      setActiveView(view);
      setView("workspace"); // reset page-level view to prevent re-trigger
    }
  }, [view]);

  // Reset to query if current sidebar view becomes hidden (role switch)
  useEffect(() => {
    const currentDef = OP_VIEWS.find(v => v.key === activeView);
    if (currentDef && !currentDef.hidden && !visibleViews.find(v => v.key === activeView)) setActiveView("query");
  }, [isAdmin]);

  const fetchProfitLoss = async (from, to, costCenter) => {
    setPnlLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (costCenter) params.set("costCenter", costCenter);
      const res = await fetch(`/api/finance/profit-loss?${params}`);
      const data = await res.json();
      if (data.success) setPnlData(data);
    } catch (err) { console.error(err); }
    setPnlLoading(false);
  };

  const selectView = (key) => {
    setActiveView(key);
    setSidebarOpen(false);
    if (key === "profitloss") fetchProfitLoss();
  };

  return (
    <div className="ops-workspace">
      {/* Mobile sidebar toggle */}
      <button className="ops-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="القائمة">
        <span style={{ fontSize: "1.5rem" }}>{sidebarOpen ? "✕" : "☰"}</span>
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="ops-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`ops-sidebar glass ${sidebarOpen ? "open" : ""}`}>
        <div className="ops-sidebar-header">
          <span className="ops-sidebar-title">💼 لوحة العمليات</span>
          {isAdmin && <span className="ops-sidebar-badge">مدير</span>}
        </div>
        {visibleViews.map(v => v.divider ? (
          <div key={v.key || "divider"} className="ops-sidebar-divider" />
        ) : (
          <button key={v.key} className={`ops-sidebar-btn ${activeView === v.key ? "active" : ""}`}
            onClick={() => selectView(v.key)}>
            <span className="ops-sidebar-icon">{v.icon}</span>
            <span className="ops-sidebar-btn-inner">
              <span className="ops-sidebar-label">{v.label}</span>
              {v.sub && <span className="ops-sidebar-sub">{v.sub}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="ops-main">
        {activeView === "query" && <QueryView />}
        {activeView === "create" && <CreateBookingView />}
        {activeView === "fieldops" && <FieldOpsView />}
        {activeView === "inventory" && <InventoryView />}
        {isAdmin && activeView === "packages" && <PackagesView />}
        {isAdmin && activeView === "transactions" && <TransactionsView />}
        {isAdmin && activeView === "profitloss" && <ProfitLossView data={pnlData} loading={pnlLoading} />}
        {isAdmin && activeView === "admin-config" && <AdminConfig embedded />}
        {isAdmin && activeView === "admin-finance" && <AdminFinance embedded />}
        {isAdmin && activeView === "admin-reports" && <AdminReports embedded />}
        {isAdmin && activeView === "accounting" && <ExpensesView />}
        {activeView === "dashboard" && <DashboardView onNavigate={(key) => selectView(key)} />}
        {activeView === "cancel" && <CancelView />}
        {activeView === "payment" && <PaymentView />}
      </div>
    </div>
  );
}
