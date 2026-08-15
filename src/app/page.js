"use client";
import React, { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import FieldHub from "@/hubs/FieldHub";
import { useAuth } from "@/contexts/AuthContext";
import GeminiChat from "@/components/GeminiChat";

export default function Home() {
  const { view, setView, userRole, errorMsg, setErrorMsg, successMsg, setSuccessMsg, lastBooking, setLastBooking, handlePrint } = useApp();
  const { logout } = useAuth();
  const [showGemini, setShowGemini] = useState(false);

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
        <FieldHub embedded />
      </main>

      <footer className="main-footer glass">
        <button className="btn btn-gold" onClick={() => window.open('https://calendar.google.com', '_blank')}>
          📅 عرض وتقويم المناسبات (Google Calendar)
        </button>
        <p className="copyright">حقوق النشر © 2026 هابي لاند. جميع الحقوق محفوظة.</p>
      </footer>

      {/* Gemini AI Chat Button & Modal */}
      <button className="gemini-fab" onClick={() => setShowGemini(true)} title="المساعد الذكي">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </button>
      {showGemini && <GeminiChat onClose={() => setShowGemini(false)} />}
    </div>
  );
}
