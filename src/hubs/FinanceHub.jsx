"use client";
import React, { useState, useEffect } from "react";
import SuppliersView from "@/views/SuppliersView";
import ExpensesView from "@/views/ExpensesView";
import TransactionsView from "@/views/TransactionsView";
import PaymentView from "@/views/PaymentView";
import { useApp } from "@/contexts/AppContext";

export default function FinanceHub() {
  const { view, setView } = useApp();
  const [activeTab, setActiveTab] = useState("suppliers"); // suppliers | transactions | expenses | payment

  // استقبال التنقل إلى شاشة الدفع (مثل أزرار الدفع الخاصة بالعملاء)
  useEffect(() => {
    if (view === "payment") {
      setActiveTab("payment");
      setView("workspace"); // تصفير الحالة لمنع إعادة التشغيل
    }
  }, [view, setView]);

  return (
    <div className="finance-hub">
      {activeTab !== "payment" && (
        <div className="inv-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button 
            className={`inv-tab ${activeTab === "suppliers" ? "active" : ""}`} 
            onClick={() => setActiveTab("suppliers")}
          >
            👥 الموردون والعملاء
          </button>
          <button 
            className={`inv-tab ${activeTab === "transactions" ? "active" : ""}`} 
            onClick={() => setActiveTab("transactions")}
          >
            💰 العمليات المالية
          </button>
          <button 
            className={`inv-tab ${activeTab === "expenses" ? "active" : ""}`} 
            onClick={() => setActiveTab("expenses")}
          >
            📒 إدارة الحسابات
          </button>
        </div>
      )}

      <div className="hub-content">
        {activeTab === "suppliers" && <SuppliersView />}
        {activeTab === "transactions" && <TransactionsView />}
        {activeTab === "expenses" && <ExpensesView />}
        {activeTab === "payment" && (
          <>
            <div style={{ marginBottom: "0.75rem" }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab("suppliers")}>
                ← العودة للعملاء والموردين
              </button>
            </div>
            <PaymentView />
          </>
        )}
      </div>
    </div>
  );
}
