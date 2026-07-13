"use client";
import React, { useState } from "react";
import SuppliersView from "@/views/SuppliersView";
import ExpensesView from "@/views/ExpensesView";
import TransactionsView from "@/views/TransactionsView";
import PaymentsView from "@/views/PaymentsView";

export default function FinanceHub() {
  const [activeTab, setActiveTab] = useState("suppliers");

  return (
    <div className="finance-hub">
      <div className="inv-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button 
          className={`inv-tab ${activeTab === "suppliers" ? "active" : ""}`} 
          onClick={() => setActiveTab("suppliers")}
        >
          👥 الموردون
        </button>
        <button 
          className={`inv-tab ${activeTab === "expenses" ? "active" : ""}`} 
          onClick={() => setActiveTab("expenses")}
        >
          💸 المصروفات
        </button>
        <button 
          className={`inv-tab ${activeTab === "transactions" ? "active" : ""}`} 
          onClick={() => setActiveTab("transactions")}
        >
          💰 المركز المالي
        </button>
        <button 
          className={`inv-tab ${activeTab === "payments" ? "active" : ""}`} 
          onClick={() => setActiveTab("payments")}
        >
          💳 سندات الصرف
        </button>
      </div>

      <div className="hub-content">
        {activeTab === "suppliers" && <SuppliersView />}
        {activeTab === "expenses" && <ExpensesView />}
        {activeTab === "transactions" && <TransactionsView />}
        {activeTab === "payments" && <PaymentsView />}
      </div>
    </div>
  );
}
