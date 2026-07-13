"use client";
import React, { useState } from "react";
import SuppliersView from "@/views/SuppliersView";
import ExpensesView from "@/views/ExpensesView";
import TransactionsView from "@/views/TransactionsView";

export default function FinanceHub() {
  const [activeTab, setActiveTab] = useState("suppliers");

  return (
    <div className="finance-hub">
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

      <div className="hub-content">
        {activeTab === "suppliers" && <SuppliersView />}
        {activeTab === "transactions" && <TransactionsView />}
        {activeTab === "expenses" && <ExpensesView />}
      </div>
    </div>
  );
}
