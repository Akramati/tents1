"use client";
import React, { useState, useEffect } from "react";

export default function Home() {
  const [view, setView] = useState("query"); // 'query' or 'create'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Date filtering - default to today
  const getTodayString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset*60*1000));
    return localToday.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    startDate: getTodayString(),
    endDate: getTodayString(),
    totalAmount: "",
    paidAmount: "",
    status: "مؤكد",
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        setErrorMsg(data.error || "فشل في تحميل الحجوزات");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Handle form change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.customerPhone || !formData.startDate || !formData.endDate) {
      setErrorMsg("الرجاء ملء جميع الحقول الأساسية");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalAmount: Number(formData.totalAmount || 0),
          paidAmount: Number(formData.paidAmount || 0),
          status: formData.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.warning) {
          setSuccessMsg(`تم تسجيل الحجز بنجاح، لكن: ${data.warning}`);
        } else {
          setSuccessMsg("تم تسجيل الحجز بنجاح وإضافته إلى جدول البيانات!");
        }
        // Clear form
        setFormData({
          customerName: "",
          customerPhone: "",
          startDate: getTodayString(),
          endDate: getTodayString(),
          totalAmount: "",
          paidAmount: "",
          status: "مؤكد",
        });
        // Reload bookings and switch view after delay
        await fetchBookings();
        setTimeout(() => {
          setView("query");
          setSuccessMsg(null);
        }, Math.max(3000, data.warning ? 5000 : 2000));
      } else {
        setErrorMsg(data.error || "فشل في حفظ الحجز");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("فشل الاتصال بالخادم لحفظ الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter bookings based on selectedDate and searchTerm
  const filteredBookings = bookings.filter((b) => {
    // Match date
    let dateMatch = true;
    if (selectedDate) {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      const target = new Date(selectedDate);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      target.setHours(0,0,0,0);
      dateMatch = target >= start && target <= end;
    }

    // Match search term
    let searchMatch = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      searchMatch = 
        b.customerName.toLowerCase().includes(term) || 
        b.customerPhone.includes(term) || 
        b.bookingId.toLowerCase().includes(term);
    }

    return dateMatch && searchMatch;
  });

  // Calculate statistics
  const totalBookingsCount = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const totalCollected = bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
  const totalOutstanding = bookings.reduce((sum, b) => sum + (b.remainingAmount || 0), 0);

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(val);
  };

  // Helper to format date nicely
  const formatDateArabic = (dateStr) => {
    if (!dateStr) return "";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('ar-SA', options);
  };

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
        <div className="header-badge">لوحة التحكم الميدانية</div>
      </header>

      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <div className="stat-card glass">
          <span className="stat-icon">📅</span>
          <div className="stat-info">
            <h3>إجمالي الحجوزات</h3>
            <p className="stat-value">{totalBookingsCount}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-emerald">💰</span>
          <div className="stat-info">
            <h3>إجمالي الإيرادات</h3>
            <p className="stat-value text-emerald">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-gold">💵</span>
          <div className="stat-info">
            <h3>المبالغ المحصلة</h3>
            <p className="stat-value text-gold">{formatCurrency(totalCollected)}</p>
          </div>
        </div>
        <div className="stat-card glass">
          <span className="stat-icon text-red">⚠️</span>
          <div className="stat-info">
            <h3>المستحقات المتبقية</h3>
            <p className="stat-value text-red">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
      </section>

      {/* Mode Switches */}
      <div className="navigation-tabs">
        <button
          className={`tab-btn ${view === "query" ? "active" : ""}`}
          onClick={() => setView("query")}
        >
          🔍 استعلام واستعراض الحجوزات
        </button>
        <button
          className={`tab-btn ${view === "create" ? "active" : ""}`}
          onClick={() => setView("create")}
        >
          ➕ إضافة حجز جديد
        </button>
      </div>

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
        </div>
      )}

      {/* Main View Area */}
      <main className="content-area">
        {view === "query" ? (
          <section className="query-section glass">
            <div className="filter-bar">
              <div className="filter-group">
                <label>تصفية بالتاريخ</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="filter-group">
                <label>بحث بالاسم أو الهاتف</label>
                <input
                  type="text"
                  placeholder="ابحث عن عميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="section-title-row">
              <h2>نتائج الاستعلام ({filteredBookings.length})</h2>
              {selectedDate && (
                <span className="date-badge">📅 {formatDateArabic(selectedDate)}</span>
              )}
            </div>

            {loading ? (
              <div className="loading-spinner-container">
                <div className="loading-spinner"></div>
                <p>جاري تحميل الحجوزات من Google Sheets...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>لا توجد حجوزات مطابقة</h3>
                <p>جرب تغيير تاريخ البحث أو كتابة عبارة بحث مختلفة.</p>
                <button className="btn btn-gold" onClick={() => { setSelectedDate(""); setSearchTerm(""); }}>
                  عرض جميع الحجوزات
                </button>
              </div>
            ) : (
              <div className="booking-cards-grid">
                {filteredBookings.map((booking) => (
                  <div key={booking.bookingId} className="booking-card glass">
                    <div className="booking-card-header">
                      <span className="booking-id">{booking.bookingId}</span>
                      <span className={`status-badge status-${booking.status === "نشط" || booking.status === "مؤكد" ? "active" : "cancelled"}`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="booking-card-body">
                      <h3>{booking.customerName}</h3>
                      <p className="phone-number">📞 {booking.customerPhone}</p>
                      
                      <div className="date-range-box">
                        <div>
                          <span className="label">من</span>
                          <span className="val">{formatDateArabic(booking.startDate)}</span>
                        </div>
                        <div>
                          <span className="label">إلى</span>
                          <span className="val">{formatDateArabic(booking.endDate)}</span>
                        </div>
                      </div>

                      <div className="financial-summary">
                        <div className="fin-item">
                          <span className="label">الإجمالي</span>
                          <span className="val">{formatCurrency(booking.totalAmount)}</span>
                        </div>
                        <div className="fin-item">
                          <span className="label">المدفوع</span>
                          <span className="val text-emerald">{formatCurrency(booking.paidAmount)}</span>
                        </div>
                        <div className="fin-itemHighlight">
                          <span className="label">المتبقي</span>
                          <span className="val text-red">{formatCurrency(booking.remainingAmount)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="booking-card-actions">
                      {booking.contractLink && (
                        <a 
                          href={booking.contractLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="action-btn contract-btn"
                        >
                          📄 العقد
                        </a>
                      )}
                      <a 
                        href={(() => {
                          const phone = booking.customerPhone.replace(/^0/, '966').replace(/[^0-9]/g, '');
                          const contractPart = booking.contractLink
                            ? `\n📄 رابط العقد: ${booking.contractLink}`
                            : '';
                          const msg = `السلام عليكم ورحمة الله وبركاته 🌿\n\nعزيزي ${booking.customerName}،\nيسعدنا إبلاغكم بتأكيد حجزكم لدى *هابي لاند* 🎉\n\n📋 *تفاصيل الحجز:*\n🔖 رقم الحجز: ${booking.bookingId}\n📅 من: ${formatDateArabic(booking.startDate)}\n📅 إلى: ${formatDateArabic(booking.endDate)}\n💰 المبلغ الإجمالي: ${formatCurrency(booking.totalAmount)}\n✅ المدفوع: ${formatCurrency(booking.paidAmount)}\n⏳ المتبقي: ${formatCurrency(booking.remainingAmount)}${contractPart}\n\nشكراً لثقتكم بنا 🙏`;
                          return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                        })()}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="action-btn wa-btn"
                      >
                        💬 واتساب
                      </a>
                      {booking.contractLink ? (
                        <a
                          href={booking.contractLink.replace('/edit', '/export?format=pdf')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-btn print-btn"
                        >
                          🖨️ طباعة
                        </a>
                      ) : (
                        <button 
                          onClick={() => window.print()}
                          className="action-btn print-btn"
                        >
                          🖨️ طباعة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="create-section glass">
            <h2>تسجيل حجز خيمة جديد</h2>
            <p className="subtitle">سيتم حفظ البيانات مباشرة في جدول Google Sheets وتحديث لوحة التحكم</p>

            <form onSubmit={handleSubmit} className="booking-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="customerName">اسم العميل بالكامل <span className="required">*</span></label>
                  <input
                    type="text"
                    id="customerName"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    placeholder="مثال: محمد بن عبد العزيز"
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="customerPhone">رقم جوال العميل <span className="required">*</span></label>
                  <input
                    type="tel"
                    id="customerPhone"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    placeholder="مثال: 0555555555"
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="startDate">تاريخ بداية الإيجار <span className="required">*</span></label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">تاريخ نهاية الإيجار <span className="required">*</span></label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="totalAmount">إجمالي مبلغ الإيجار (ريال)</label>
                  <input
                    type="number"
                    id="totalAmount"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    placeholder="مثال: 5000"
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="paidAmount">المبلغ المدفوع (مقدم)</label>
                  <input
                    type="number"
                    id="paidAmount"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleInputChange}
                    placeholder="مثال: 2000"
                    className="form-control"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="status">حالة الحجز</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="form-control"
                  >
                    <option value="مؤكد">مؤكد (نشط)</option>
                    <option value="قيد الانتظار">قيد الانتظار</option>
                    <option value="ملغي">ملغي</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={submitting} className="btn btn-primary submit-btn">
                  {submitting ? (
                    <>
                      <div className="mini-spinner"></div>
                      جاري الحفظ وإنشاء السجل...
                    </>
                  ) : (
                    "تأكيد الحجز وحفظ البيانات"
                  )}
                </button>
                <button type="button" onClick={() => setView("query")} className="btn btn-gold">
                  إلغاء
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      <footer className="main-footer glass">
        <button className="btn btn-gold" onClick={() => window.open('https://calendar.google.com', '_blank')}>
          📅 عرض وتقويم المناسبات (Google Calendar)
        </button>
        <p className="copyright">حقوق النشر © 2026 هابي لاند. جميع الحقوق محفوظة.</p>
      </footer>

      <style jsx>{`
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          min-height: 100vh;
        }

        /* Header Style */
        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .crown-icon {
          font-size: 2.5rem;
        }

        .main-header h1 {
          margin: 0;
          font-size: 2rem;
          line-height: 1.2;
        }

        .main-header p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--primary-light);
          font-weight: 500;
        }

        .header-badge {
          background: var(--primary);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: bold;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
        }

        .stat-icon {
          font-size: 2.2rem;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
        }

        .text-emerald { color: #059669; }
        .text-gold { color: #d97706; }
        .text-red { color: #dc2626; }

        .stat-info h3 {
          font-size: 0.85rem;
          margin: 0;
          color: var(--foreground);
          opacity: 0.8;
          font-weight: 600;
        }

        .stat-value {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0;
        }

        /* Tabs */
        .navigation-tabs {
          display: flex;
          gap: 1rem;
        }

        .tab-btn {
          flex: 1;
          padding: 1rem;
          border-radius: var(--radius);
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--foreground);
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow);
        }

        .tab-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .tab-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
        }

        /* Alerts */
        .alert {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-radius: var(--radius);
          position: relative;
        }

        .alert-danger {
          border-left: 5px solid #ef4444;
          background: rgba(254, 242, 242, 0.9);
          color: #991b1b;
        }

        .alert-success {
          border-left: 5px solid #10b981;
          background: rgba(209, 250, 229, 0.9);
          color: #065f46;
        }

        .alert p {
          margin: 0;
          font-weight: 600;
        }

        .close-btn {
          position: absolute;
          left: 1rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          color: inherit;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
        }

        /* Content Area */
        .content-area {
          flex: 1;
        }

        .query-section, .create-section {
          padding: 2rem;
        }

        .subtitle {
          color: var(--primary-light);
          margin-bottom: 1.5rem;
        }

        /* Filters */
        .filter-bar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--card-border);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-group label {
          font-weight: 700;
          color: var(--primary);
          font-size: 0.9rem;
        }

        .form-control {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: var(--radius);
          border: 1px solid var(--card-border);
          background: rgba(255, 255, 255, 0.9);
          font-family: inherit;
          font-size: 1rem;
          transition: var(--transition);
        }

        .form-control:focus {
          outline: 2px solid var(--secondary);
          border-color: transparent;
        }

        .section-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-title-row h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .date-badge {
          background: rgba(251, 191, 36, 0.2);
          color: var(--accent);
          padding: 0.4rem 0.8rem;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
        }

        /* Loading */
        .loading-spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 4rem 1rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(6, 78, 59, 0.1);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .mini-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 4rem 1rem;
          border: 2px dashed var(--card-border);
          border-radius: var(--radius);
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: var(--primary-light);
          margin-bottom: 1.5rem;
        }

        /* Booking Cards */
        .booking-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .booking-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: var(--transition);
        }

        .booking-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
          border-color: var(--secondary);
        }

        .booking-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .booking-id {
          font-family: monospace;
          background: rgba(0,0,0,0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .status-active {
          background: rgba(16, 185, 129, 0.15);
          color: #047857;
        }

        .status-cancelled {
          background: rgba(239, 68, 68, 0.15);
          color: #b91c1c;
        }

        .booking-card-body h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1.25rem;
        }

        .phone-number {
          font-size: 0.9rem;
          color: var(--primary-light);
          font-weight: 500;
          margin-bottom: 0.75rem;
        }

        .date-range-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.4);
          padding: 0.75rem;
          border-radius: var(--radius);
          border: 1px solid var(--card-border);
          font-size: 0.8rem;
          margin-bottom: 0.75rem;
        }

        .date-range-box .label {
          display: block;
          color: var(--primary-light);
          font-weight: bold;
          margin-bottom: 0.2rem;
        }

        .date-range-box .val {
          font-weight: 700;
        }

        .financial-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.25rem;
          text-align: center;
        }

        .financial-summary .label {
          display: block;
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .financial-summary .val {
          font-size: 0.85rem;
          font-weight: bold;
        }

        .fin-itemHighlight {
          background: rgba(220, 38, 38, 0.05);
          border-radius: 6px;
          padding: 0.25rem;
        }

        .booking-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
          border-top: 1px solid var(--card-border);
          padding-top: 1rem;
        }

        .action-btn {
          flex: 1;
          padding: 0.5rem;
          font-size: 0.85rem;
          font-weight: bold;
          border-radius: 6px;
          text-align: center;
          transition: var(--transition);
        }

        .wa-btn {
          background: #25d366;
          color: white;
        }

        .wa-btn:hover {
          background: #128c7e;
          transform: translateY(-2px);
        }

        .contract-btn {
          background: var(--primary);
          color: white;
        }

        .contract-btn:hover {
          background: var(--primary-light);
          transform: translateY(-2px);
        }

        .print-btn {
          background: #e2e8f0;
          color: #475569;
          border: none;
          cursor: pointer;
        }

        .print-btn:hover {
          background: #cbd5e1;
          transform: translateY(-2px);
        }

        /* Form */
        .booking-form {
          margin-top: 1.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group.full-width {
          grid-column: span 2;
        }

        .form-group label {
          font-weight: bold;
          color: var(--primary);
        }

        .required {
          color: #ef4444;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          border-top: 1px solid var(--card-border);
          padding-top: 1.5rem;
        }

        .submit-btn {
          flex: 2;
        }

        /* Footer */
        .main-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          text-align: center;
        }

        .copyright {
          font-size: 0.8rem;
          opacity: 0.7;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .main-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .filter-bar {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full-width {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
