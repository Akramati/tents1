"use client";
import React, { useState, useEffect } from "react";
import { Truck, Search, PlusCircle, ArrowRight, LayoutDashboard } from "lucide-react";
import FieldOpsView from "@/views/FieldOpsView";
import QueryView from "@/views/QueryView";
import CreateBookingView from "@/views/CreateBookingView";
import OperationsWorkspace from "@/views/OperationsWorkspace";
import { useApp } from "@/contexts/AppContext";
import { BUILD_SHA } from "@/lib/buildInfo";

export default function FieldHub({ embedded = false }) {
  const { view, setView } = useApp();
  const [activeTab, setActiveTab] = useState("menu"); // "menu" | "query" | "create" | "fieldops" | "operations"
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

  // المزامنة التلقائية مع حالة الحجز (مثل الانتقال للتعديل عند الضغط على ✏️ في الاستعلام)
  useEffect(() => {
    if (view === "create") {
      setActiveTab("create");
      setView("workspace"); // تصفير الحالة لمنع التكرار
    } else if (view === "query") {
      setActiveTab("query");
      setView("workspace");
    }
  }, [view, setView]);

  if (loading) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><p>جاري التحميل...</p></div>;
  if (!authorized) return <div className="container" style={{ padding: "2rem", textAlign: "center" }}><h2>⛔ غير مصرح</h2><a href="/" style={{ color: "#059669" }}>← العودة</a></div>;

  return (
    <div className="container" style={{ paddingBottom: "2rem" }}>
      {/* زر العودة المرن للوحة العمليات الرئيسية */}
      {activeTab !== "menu" && (
        <button 
          onClick={() => setActiveTab("menu")} 
          className="btn btn-secondary" 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem", 
            marginBottom: "1.5rem", 
            borderRadius: "10px", 
            padding: "0.5rem 1rem", 
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer"
          }}
        >
          <ArrowRight size={18} />
          <span>العودة للعمليات الرئيسية</span>
        </button>
      )}

      {activeTab === "menu" ? (
        <div className="operations-menu" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {!embedded && (
            <header className="main-header glass" style={{ marginBottom: "1.5rem" }}>
              <div className="logo-container">
                <div className="crown-icon">💼</div>
                <div>
                  <h1>هابي لاند</h1>
                  <p>إدارة العمليات اليومية</p>
                </div>
              </div>
            </header>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* 1. كرت الاستعلام */}
            <button 
              onClick={() => setActiveTab("query")}
              className="glass hover-scale" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                padding: "1.5rem", 
                borderRadius: "16px", 
                border: "1px solid rgba(255,255,255,0.08)", 
                background: "rgba(255,255,255,0.02)", 
                textAlign: "right", 
                cursor: "pointer", 
                width: "100%", 
                color: "inherit" 
              }}
            >
              <div style={{ background: "rgba(59,130,246,0.1)", padding: "1rem", borderRadius: "12px", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem", fontWeight: "bold" }}>🔍 الاستعلام</h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>البحث عن الحجوزات، وعرض تفاصيل العقود وطباعتها</p>
              </div>
            </button>

            {/* 2. كرت حجز جديد */}
            <button 
              onClick={() => setActiveTab("create")}
              className="glass hover-scale" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                padding: "1.5rem", 
                borderRadius: "16px", 
                border: "1px solid rgba(255,255,255,0.08)", 
                background: "rgba(255,255,255,0.02)", 
                textAlign: "right", 
                cursor: "pointer", 
                width: "100%", 
                color: "inherit" 
              }}
            >
              <div style={{ background: "rgba(16,185,129,0.1)", padding: "1rem", borderRadius: "12px", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PlusCircle size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem", fontWeight: "bold" }}>➕ حجز جديد</h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>تسجيل حجز جديد مع فحص فوري ومباشر للمخزون</p>
              </div>
            </button>

            {/* 3. كرت عمليات الميدان */}
            <button 
              onClick={() => setActiveTab("fieldops")}
              className="glass hover-scale" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                padding: "1.5rem", 
                borderRadius: "16px", 
                border: "1px solid rgba(255,255,255,0.08)", 
                background: "rgba(255,255,255,0.02)", 
                textAlign: "right", 
                cursor: "pointer", 
                width: "100%", 
                color: "inherit" 
              }}
            >
              <div style={{ background: "rgba(245,158,11,0.1)", padding: "1rem", borderRadius: "12px", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Truck size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem", fontWeight: "bold" }}>🚛 عمليات الميدان</h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>إدارة حركة التجهيز، التحميل، التركيب، الفك، وحساب التوالف</p>
              </div>
            </button>

            {/* 4. كرت لوحة العمليات الكاملة */}
            <button 
              onClick={() => setActiveTab("operations")}
              className="glass hover-scale" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                padding: "1.5rem", 
                borderRadius: "16px", 
                border: "1px solid rgba(255,255,255,0.08)", 
                background: "rgba(255,255,255,0.02)", 
                textAlign: "right", 
                cursor: "pointer", 
                width: "100%", 
                color: "inherit" 
              }}
            >
              <div style={{ background: "rgba(139,92,246,0.1)", padding: "1rem", borderRadius: "12px", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LayoutDashboard size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 0.25rem", fontWeight: "bold" }}>💼 لوحة العمليات الكاملة</h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>الوصول للقائمة الجانبية وكافة التبويبات والخيارات الإدارية</p>
              </div>
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: "1.5rem", opacity: 0.55, fontSize: "0.8rem", direction: "ltr" }}>
            الإصدار: {BUILD_SHA || "unknown"}
          </div>
        </div>
      ) : (
        <div className="hub-content">
          {activeTab === "query" && <QueryView />}
          {activeTab === "create" && <CreateBookingView />}
          {activeTab === "fieldops" && <FieldOpsView />}
          {activeTab === "operations" && <OperationsWorkspace />}
        </div>
      )}
    </div>
  );
}