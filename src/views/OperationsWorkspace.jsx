"use client";
import React, { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import QueryView from "@/views/QueryView";
import CreateBookingView from "@/views/CreateBookingView";
import FieldOpsView from "@/views/FieldOpsView";
import SuppliersView from "@/views/SuppliersView";
import InventoryView from "@/views/InventoryView";
import ProfitLossView from "@/views/ProfitLossView";
import PackagesView from "@/views/PackagesView";
import ExpensesView from "@/views/ExpensesView";
import PaymentsView from "@/views/PaymentsView";
import PaymentView from "@/views/PaymentView";

const OP_VIEWS = [
  { key: "query", label: "الحجوزات والاستعلام", icon: "🔍", adminOnly: false },
  { key: "create", label: "حجز جديد", icon: "➕", adminOnly: false },
  { key: "fieldops", label: "حركة الميدان", icon: "🚛", adminOnly: false },
  { key: "suppliers", label: "العملاء والموردين", icon: "👥", adminOnly: false },
  { key: "inventory", label: "حالة المخزون", icon: "📦", adminOnly: false },
  { key: "divider", label: "", icon: "", adminOnly: true, divider: true },
  { key: "packages", label: "الباقات", icon: "🎁", adminOnly: true },
  { key: "expenses", label: "المصروفات", icon: "💸", adminOnly: true },
  { key: "profitloss", label: "الأرباح والخسائر", icon: "📊", adminOnly: true },
  { key: "payments", label: "سندات الصرف", icon: "💳", adminOnly: true },
  { key: "payment", label: "تسجيل دفعة", icon: "💰", hidden: true, adminOnly: false },
];

export default function OperationsWorkspace() {
  const { userRole, print, view, setView } = useApp();
  const [activeView, setActiveView] = useState("query");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);

  const isAdmin = userRole === "admin";
  const visibleViews = OP_VIEWS.filter(v => !v.divider && !v.hidden).filter(v => !v.adminOnly || isAdmin);

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
          <div key="divider" className="ops-sidebar-divider" />
        ) : (
          <button key={v.key} className={`ops-sidebar-btn ${activeView === v.key ? "active" : ""}`}
            onClick={() => selectView(v.key)}>
            <span className="ops-sidebar-icon">{v.icon}</span>
            <span className="ops-sidebar-label">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="ops-main">
        {activeView === "query" && <QueryView />}
        {activeView === "create" && <CreateBookingView />}
        {activeView === "fieldops" && <FieldOpsView />}
        {activeView === "suppliers" && <SuppliersView />}
        {activeView === "inventory" && <InventoryView />}
        {isAdmin && activeView === "packages" && <PackagesView />}
        {isAdmin && activeView === "expenses" && <ExpensesView />}
        {isAdmin && activeView === "profitloss" && (
          <ProfitLossView pnlData={pnlData} pnlLoading={pnlLoading} fetchProfitLoss={fetchProfitLoss} print={print} />
        )}
        {isAdmin && activeView === "payments" && <PaymentsView />}
        {activeView === "payment" && <PaymentView />}
      </div>
    </div>
  );
}
