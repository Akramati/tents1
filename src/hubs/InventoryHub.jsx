"use client";
import React, { useState } from "react";
import InventoryView from "@/views/InventoryView";
import PackagesView from "@/views/PackagesView";

export default function InventoryHub() {
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "packages"
  const [subTab, setSubTab] = useState("quantities"); // "quantities" | "finance"

  return (
    <div className="inventory-hub">
      <div className="inv-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button 
          className={`inv-tab ${activeTab === "stock" ? "active" : ""}`} 
          onClick={() => setActiveTab("stock")}
        >
          🏚️ المخزون والأصناف
        </button>
        <button 
          className={`inv-tab ${activeTab === "packages" ? "active" : ""}`} 
          onClick={() => setActiveTab("packages")}
        >
          🎁 إدارة الباقات
        </button>
      </div>

      <div className="hub-content">
        {activeTab === "stock" ? (
          <>
            <div className="inv-sub-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <button 
                type="button" 
                className={`btn btn-sm ${subTab === "quantities" ? "btn-primary" : "btn-ghost"}`} 
                onClick={() => setSubTab("quantities")}
              >
                📊 الكميات والجرد
              </button>
              <button 
                type="button" 
                className={`btn btn-sm ${subTab === "finance" ? "btn-primary" : "btn-ghost"}`} 
                onClick={() => setSubTab("finance")}
              >
                💰 التكاليف والمالية
              </button>
            </div>
            <InventoryView subTab={subTab} />
          </>
        ) : (
          <PackagesView />
        )}
      </div>
    </div>
  );
}
