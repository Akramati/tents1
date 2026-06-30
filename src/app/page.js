"use client";
import React, { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import OperationsWorkspace from "@/views/OperationsWorkspace";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { view, setView, userRole, errorMsg, setErrorMsg, successMsg, setSuccessMsg, lastBooking, setLastBooking, handlePrint } = useApp();
  const { logout } = useAuth();

  return (
    <div className="container">
      <header className="main-header glass">
        <div className="logo-container">
          <div className="crown-icon">👑</div>
          <div>
            <h1>هابي لاند</h1>
            <p>نظام إدارة تأجير خيام الأفراح والمناسبات</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div className="header-badge">{userRole === "admin" ? "🛡️ مدير" : "👤 موظف"}</div>
          <button className="header-badge" style={{ background: "#dc2626", cursor: "pointer", border: "none", color: "#fff", fontSize: "0.75rem" }} onClick={() => { logout(); window.location.href = "/login"; }}>
            🚪 خروج
          </button>
        </div>
      </header>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="alert alert-danger glass animate-fade-in">
          <span>❌</span>
          <p>{errorMsg}</p>
          <button className="close-btn" onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success glass animate-fade-in">
          <span>✅</span>
          <p>{successMsg}</p>
          {lastBooking && (
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" onClick={() => handlePrint(lastBooking)} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", borderRadius: "10px", fontWeight: "bold", fontSize: "1rem" }}>
                🖨️ طباعة
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setLastBooking(null); setView("workspace"); setSuccessMsg(null); }} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", borderRadius: "10px", fontWeight: "bold", fontSize: "1rem" }}>
                ✅ تم — العودة
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main View Area */}
      <main className="content-area">
        <OperationsWorkspace />
      </main>

      <footer className="main-footer glass">
        <button className="btn btn-gold" onClick={() => window.open('https://calendar.google.com', '_blank')}>
          📅 عرض وتقويم المناسبات (Google Calendar)
        </button>
        <p className="copyright">حقوق النشر © 2026 هابي لاند. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}
