"use client";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";

export default function CancelView() {
  const { bookings, fetchBookings, print, setSuccessMsg, setErrorMsg, getBehavior } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refund, setRefund] = useState("0");
  const [penalty, setPenalty] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  return (
    <section className="create-section glass">
      <div className="section-title-row">
        <h2>❌ إدارة وتصفية الحجوزات الملغية</h2>
        {selected && (
          <button className="btn btn-gold" onClick={() => print("INVOICE", { ...selected, behavior: getBehavior(selected.bookingType, []), notes: `ملغي - المردود: ${refund} ريال - الغرامة: ${penalty} ريال` })}>
            🖨️ طباعة سند الإلغاء
          </button>
        )}
      </div>

      <div className="cancel-search-section">
        <p className="subtitle">ابحث عن الحجز المراد إلغاؤه</p>
        <div className="filter-bar">
          <div className="filter-group">
            <label>بحث برقم الحجز أو اسم العميل أو رقم الجوال</label>
            <input type="text" placeholder="رقم الحجز، اسم العميل، أو رقم الجوال..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-control" />
          </div>
          <button className="btn btn-primary" onClick={() => {
            if (!searchTerm.trim()) return;
            const term = searchTerm.trim().toLowerCase();
            const results = bookings.filter(
              (b) => b.bookingId === term || (b.customerName || "").toLowerCase().includes(term) || (b.customerPhone || "").includes(term)
            );
            setSearchResults(results);
            setSelected(null);
            setRefund("0");
            setPenalty("0");
          }}>
            🔍 بحث
          </button>
        </div>
      </div>

      {searchResults.length > 0 && !selected && (
        <div className="booking-cards-grid" style={{ marginTop: "1rem" }}>
          {searchResults.map((b) => (
            <div key={b.bookingId} className="search-result-card" onClick={() => { setSelected(b); setSearchResults([]); setSearchTerm(""); setRefund("0"); setPenalty("0"); }}>
              <h4>{b.customerName}</h4>
              <p>📋 {b.bookingId} — {b.startDate} إلى {b.endDate}</p>
              <p>💰 الإجمالي: {b.totalAmount} ريال | المدفوع: {b.paidAmount} ريال</p>
              <p>🔴 الحالة: {b.status}</p>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchTerm.trim() && !selected && (
        <p className="subtitle" style={{ marginTop: "1rem" }}>لا توجد حجوزات مطابقة</p>
      )}

      {selected && (
        <div className="cancel-settlement-section">
          <div className="settlement-header">
            <h3>💰 تسوية مالية للحجز: {selected.bookingId}</h3>
          </div>
          <div className="selected-booking-info">
            <p><strong>العميل:</strong> {selected.customerName}</p>
            <p><strong>رقم الحجز:</strong> {selected.bookingId}</p>
            <p><strong>الإجمالي:</strong> {selected.totalAmount} ريال</p>
            <p><strong>المدفوع:</strong> {selected.paidAmount} ريال</p>
            <p><strong>المتبقي:</strong> {selected.remainingAmount || "0"} ريال</p>
            <p><strong>الحالة:</strong> {selected.status}</p>
          </div>

          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <label>💰 المبلغ المردود للعميل</label>
              <input type="number" min="0" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0" className="form-control" />
            </div>
            <div className="form-group">
              <label>⚠️ مبلغ الغرامة</label>
              <input type="number" min="0" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="0" className="form-control" />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-danger btn-wide" disabled={submitting} onClick={async () => {
              setSubmitting(true);
              try {
                const tk = localStorage.getItem("token");
                const res = await fetch("/api/bookings/cancel", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                  body: JSON.stringify({ bookingId: selected.bookingId, refundAmount: refund || "0", penaltyAmount: penalty || "0" }),
                });
                const data = await res.json();
                if (data.success) {
                  setSuccessMsg(data.message || `تم إلغاء الحجز ${selected.bookingId}`);
                  setSelected(null);
                  setRefund("0");
                  setPenalty("0");
                  setSearchTerm("");
                  await fetchBookings();
                } else {
                  setErrorMsg(data.error || "فشل إلغاء الحجز");
                }
              } catch (err) {
                setErrorMsg("خطأ في الاتصال بالخادم");
              } finally {
                setSubmitting(false);
              }
            }}>
              {submitting ? "جاري الإلغاء..." : "🔴 تنفيذ إلغاء الحجز النهائي وبدء التسوية"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
