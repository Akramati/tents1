"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";

const CASH_ACCOUNTS = [
  { code: "1101", label: "💰 صندوق الصالة" },
  { code: "1102", label: "📱 محفظة كريمي" },
  { code: "1103", label: "📱 محفظة جوالي" },
  { code: "1104", label: "📱 محفظة جيب" },
];

export default function PaymentView() {
  const { bookings, fetchBookings, print, setSuccessMsg, setErrorMsg, getTodayString, formatDateArabic, paymentRedirect, setPaymentRedirect } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [cashAccount, setCashAccount] = useState("1101");
  const [confirmBooking, setConfirmBooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("DHM");
  const [costCenters, setCostCenters] = useState([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState("");

  useEffect(() => {
    fetch("/api/finance/branches").then(r => r.json()).then(d => { if (d.success) setBranches(d.branches || []); }).catch(() => {});
    fetch("/api/finance/cost-centers").then(r => r.json()).then(d => { if (d.success) setCostCenters((d.centers || []).filter(c => c.type === "booking" || c.type === "administrative")); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialized) return;
    if (paymentRedirect) {
      const b = paymentRedirect;
      setPaymentRedirect(null);
      setSelected(b);
      setInitialized(true);
    }
  }, [paymentRedirect, initialized]);

  const reset = () => {
    setSelected(null);
    setAmount("");
    setConfirmBooking(false);
    setSearchTerm("");
    setReceipt(null);
    setSelectedCostCenter("");
  };

  return (
    <section className="create-section glass">
      <div className="section-title-row">
        <h2>💰 تسجيل دفعة جديدة</h2>
      </div>

      {!selected && !receipt && (
        <div className="filter-bar">
          <div className="filter-group">
            <label>ابحث عن الحجز</label>
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
          }}>
            🔍 بحث
          </button>
        </div>
      )}

      {searchResults.length > 0 && !selected && (
        <div className="booking-cards-grid" style={{ marginTop: "1rem" }}>
          {searchResults.map((b) => (
            <div key={b.bookingId} className="search-result-card" onClick={() => { setSelected(b); setSearchResults([]); setSearchTerm(""); }}>
              <h4>{b.customerName}</h4>
              <p>📋 {b.bookingId} — {b.startDate} إلى {b.endDate}</p>
              <p>💰 الإجمالي: {b.totalAmount} ريال | المدفوع: {b.paidAmount} ريال | المتبقي: {b.remainingAmount || "0"} ريال</p>
              <p>📞 {b.customerPhone}</p>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchTerm.trim() && !selected && (
        <p className="subtitle" style={{ marginTop: "1rem" }}>لا توجد حجوزات مطابقة</p>
      )}

      {selected && !receipt && (
        <div className="payment-form" style={{ marginTop: "1.5rem" }}>
          <div className="selected-booking-info">
            <h3>الحجز المحدد</h3>
            <p><strong>العميل:</strong> {selected.customerName}</p>
            <p><strong>رقم الحجز:</strong> {selected.bookingId}</p>
            <p><strong>الإجمالي:</strong> {selected.totalAmount} ريال</p>
            <p><strong>المدفوع:</strong> {selected.paidAmount} ريال</p>
            <p><strong>المتبقي:</strong> {selected.remainingAmount || "0"} ريال</p>
            <p><strong>الحالة:</strong> {selected.status}</p>
            {selected.status === "قيد الانتظار" && (
              <label className="checkbox-label" style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={confirmBooking} onChange={(e) => setConfirmBooking(e.target.checked)} />
                ✅ تأكيد الحجز (تغيير الحالة من "قيد الانتظار" إلى "مؤكد")
              </label>
            )}
          </div>

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label>المبلغ المستلم (ريال) <span className="required">*</span></label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="أدخل المبلغ المستلم..." className="form-control" />
          </div>

          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <label>🏦 الخزينة المستلمة</label>
            <select className="form-control" value={cashAccount} onChange={(e) => setCashAccount(e.target.value)}>
              {CASH_ACCOUNTS.map((ca) => (
                <option key={ca.code} value={ca.code}>{ca.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <label>🏢 الفرع</label>
            <select className="form-control" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              {branches.length === 0 && <option value="DHM">ذمار</option>}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <label>🏷️ مركز التكلفة</label>
            <select className="form-control" value={selectedCostCenter} onChange={(e) => setSelectedCostCenter(e.target.value)}>
              <option value="">— بدون —</option>
              {costCenters.filter(c => c.code.startsWith(`CC-${selectedBranch}`)).map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="pay-validation-row" style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.5rem" }}>
            {amount && parseFloat(amount) > 0 && (
              parseFloat(amount) > parseFloat(selected.remainingAmount || 0)
                ? <span className="pay-warning">⚠️ المبلغ المستلم أكبر من المبلغ المتبقي!</span>
                : <span className="pay-valid">✅ المبلغ صحيح</span>
            )}
            {amount && parseFloat(amount) <= 0 && <span className="pay-warning">❌ المبلغ يجب أن يكون أكبر من صفر</span>}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" disabled={submitting || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(selected.remainingAmount || 0)} onClick={async () => {
              const amt = parseFloat(amount);
              if (!amt || amt <= 0) { setErrorMsg("المبلغ يجب أن يكون أكبر من صفر"); return; }
              if (amt > parseFloat(selected.remainingAmount || 0)) { setErrorMsg("المبلغ المستلم أكبر من المبلغ المتبقي"); return; }
              setSubmitting(true);
              try {
                const tk = localStorage.getItem("token");
                const res = await fetch("/api/bookings/payment", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
                  body: JSON.stringify({ bookingId: selected.bookingId, amount, confirmBooking, cashAccountCode: cashAccount, costCenter: selectedCostCenter || "" }),
                });
                const data = await res.json();
                if (data.success) {
                  setReceipt({ booking: selected, amount: parseFloat(amount), newPaid: data.paidAmount, newRemaining: data.remainingAmount, status: data.status });
                  setSuccessMsg(data.message || "تم تسجيل الدفعة بنجاح");
                  await fetchBookings();
                } else {
                  setErrorMsg(data.error || "فشل تسجيل الدفعة");
                }
              } catch (err) {
                setErrorMsg("خطأ في الاتصال بالخادم");
              } finally {
                setSubmitting(false);
              }
            }}>
              {submitting ? "جاري التسجيل..." : "✅ تأكيد تسجيل الدفعة"}
            </button>
            <button className="btn btn-gold" onClick={() => { setSelected(null); setAmount(""); setConfirmBooking(false); }}>إلغاء</button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="payment-form receipt-view" style={{ marginTop: "1.5rem" }}>
          <div className="receipt-card">
            <div className="receipt-header">
              <h3>🧾 سند قبض</h3>
              <p className="receipt-subtitle">هابي لاند لتأجير الخيام</p>
            </div>
            <div className="receipt-body">
              <div className="receipt-row">
                <span>رقم السند:</span>
                <strong>RCP-{receipt.booking.bookingId}-{Date.now().toString().slice(-6)}</strong>
              </div>
              <div className="receipt-row">
                <span>التاريخ:</span>
                <strong>{formatDateArabic(getTodayString())}</strong>
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>اسم العميل:</span>
                <strong>{receipt.booking.customerName}</strong>
              </div>
              <div className="receipt-row">
                <span>رقم الحجز:</span>
                <strong>{receipt.booking.bookingId}</strong>
              </div>
              <div className="receipt-row">
                <span>رقم الجوال:</span>
                <strong>{receipt.booking.customerPhone}</strong>
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>إجمالي الحجز:</span>
                <strong>{receipt.booking.totalAmount} ريال</strong>
              </div>
              <div className="receipt-row highlight">
                <span>💰 المبلغ المستلم:</span>
                <strong className="text-gold">{receipt.amount} ريال</strong>
              </div>
              <div className="receipt-row">
                <span>إجمالي المدفوع:</span>
                <strong>{receipt.newPaid} ريال</strong>
              </div>
              <div className="receipt-row">
                <span>المبلغ المتبقي:</span>
                <strong>{receipt.newRemaining} ريال</strong>
              </div>
              <div className="receipt-row">
                <span>حالة الحجز:</span>
                <strong>{receipt.status || receipt.booking.status}</strong>
              </div>
            </div>
            <div className="receipt-actions">
              <button className="action-btn print-btn" onClick={() => print("INVOICE", { ...receipt.booking, paidAmount: receipt.newPaid, remainingAmount: receipt.newRemaining, behavior: "packages" })}>
                🖨️ طباعة السند
              </button>
              <button className="btn btn-gold" onClick={reset}>
                تسجيل دفعة أخرى
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}