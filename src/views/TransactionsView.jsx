"use client";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import DualCalendarPicker from "@/components/DualCalendarPicker";

const CATEGORIES = [
  { key: "expense", label: "🔴 صرف", desc: "دفع نقدي أو تسديد" },
  { key: "income", label: "🟢 تحصيل", desc: "قبض نقدي" },
  { key: "transfer", label: "🔄 تحويل", desc: "تحويل بين الخزائن" },
];

const OP_TYPES = {
  expense: [
    { id: "withdrawal", label: "مسحوبات المالك", icon: "👤", desc: "سحب نقدي من صاحب المؤسسة", debitAuto: "2203", entryType: "expense" },
    { id: "general", label: "مصروف عام", icon: "📋", desc: "اختر حساب المصروف", entryType: "expense" },
  ],
  income: [
    { id: "customer", label: "تحصيل من عميل", icon: "👥", desc: "تسديد ذمم عميل", creditAuto: "1202", entryType: "income" },
  ],
};

export default function TransactionsView() {
  const { formatCurrency, setSuccessMsg, setErrorMsg, getTodayString } = useApp();
  const [category, setCategory] = useState("expense");
  const [opType, setOpType] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayString?.() || new Date().toLocaleDateString("en-CA"));
  const [cashAccount, setCashAccount] = useState("1101");
  const [expenseAccount, setExpenseAccount] = useState(null);
  const [fromAccount, setFromAccount] = useState("1101");
  const [toAccount, setToAccount] = useState("1102");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [allBookings, setAllBookings] = useState([]);

  // Expense account search
  const [expenseSearch, setExpenseSearch] = useState("");
  const [showExpenseDropdown, setShowExpenseDropdown] = useState(false);

  // Withdrawal sub-account (hierarchical)
  const [wdPath, setWdPath] = useState([{ code: "2203", name: "مسحوبات المالك" }]);
  const [wdAccount, setWdAccount] = useState("2203");

  useEffect(() => {
    fetchAccounts();
    fetch("/api/bookings?limit=1000").then(r => r.json()).then(d => {
      if (d.success) setAllBookings(d.bookings || []);
    }).catch(() => {});
  }, []);

  const fetchAccounts = async () => {
    try {
      const r = await fetch("/api/finance/accounts?includeInactive=false");
      const d = await r.json();
      if (d.success) setAccounts(d.accounts || []);
    } catch {}
  };

  const cashAccounts = useMemo(() => {
    return accounts.filter(a => a.accountType === "asset" && a.parentCode === "1100").sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }, [accounts]);

  const expenseAccounts = useMemo(() => {
    return accounts.filter(a => a.accountType === "expense" && a.isActive !== false);
  }, [accounts]);

  const wdChildren = (parentCode) => {
    return accounts.filter(a => a.parentCode === parentCode && a.isActive !== false)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  };
  const wdCurrentChildren = useMemo(() => {
    return wdChildren(wdPath[wdPath.length - 1].code);
  }, [accounts, wdPath]);

  const filteredExpense = useMemo(() => {
    if (!expenseSearch.trim()) return expenseAccounts;
    const q = expenseSearch.trim().toLowerCase();
    return expenseAccounts.filter(a => a.accountName.toLowerCase().includes(q) || a.accountCode.includes(q));
  }, [expenseAccounts, expenseSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.trim().toLowerCase();
    const seen = new Set();
    const unique = [];
    for (const b of allBookings) {
      const key = `${b.customerName}|${b.customerPhone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = (b.customerName || "").toLowerCase();
      const phone = (b.customerPhone || "").toLowerCase();
      if (name.includes(q) || phone.includes(q)) {
        unique.push({ customerName: b.customerName, customerPhone: b.customerPhone });
      }
    }
    return unique.slice(0, 20);
  }, [allBookings, customerSearch]);

  const operTypes = OP_TYPES[category] || [];

  const selectOpType = (id) => {
    setOpType(id);
    setAmount("");
    setNotes("");
    setExpenseAccount(null);
    setExpenseSearch("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setWdPath([{ code: "2203", name: "مسحوبات المالك" }]);
    setWdAccount("2203");
  };

  const acctName = (code) => {
    const a = accounts.find(a => a.accountCode === code);
    return a ? a.accountName : code;
  };

  const getPreview = () => {
    if (!opType || !amount || parseFloat(amount) <= 0) return null;
    const amt = parseFloat(amount);
    const op = operTypes.find(o => o.id === opType);
    if (!op) return null;

    if (opType === "withdrawal") {
      const wa = accounts.find(a => a.accountCode === wdAccount);
      return { debit: { code: wdAccount, name: wa?.accountName || "مسحوبات المالك" }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "general") {
      if (!expenseAccount) return null;
      return { debit: { code: expenseAccount.accountCode, name: expenseAccount.accountName }, credit: { code: cashAccount, name: acctName(cashAccount) }, amount: amt };
    }
    if (opType === "customer") {
      return { debit: { code: cashAccount, name: acctName(cashAccount) }, credit: { code: "1202", name: "ذمم مدينة - عملاء" }, amount: amt };
    }
    return null;
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    if (fromAccount === toAccount) { setErrorMsg("لا يمكن التحويل إلى نفس الحساب"); return; }
    setSubmitting(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/finance/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ fromAccount, toAccount, amount: parseFloat(amount), date: entryDate, notes }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`تم التحويل: ${parseFloat(amount).toLocaleString()} ريال`);
        setAmount(""); setNotes("");
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setErrorMsg("المبلغ مطلوب"); return; }
    const op = operTypes.find(o => o.id === opType);
    if (!op) return;

    if (opType === "general" && !expenseAccount) { setErrorMsg("اختر حساب المصروف"); return; }
    if (opType === "customer" && !selectedCustomer) { setErrorMsg("اختر العميل"); return; }

    const accountCode = opType === "withdrawal" ? wdAccount : opType === "general" ? expenseAccount.accountCode : "1202";
    const entryType = op.entryType;

    setSubmitting(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          date: entryDate,
          accountCode,
          entryType,
          amount: parseFloat(amount),
          cashAccountCode: cashAccount,
          branch: "DHM",
          notes: [selectedCustomer ? `عميل: ${selectedCustomer.customerName}` : "", notes].filter(Boolean).join(" | "),
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`✅ ${op.label}: ${parseFloat(amount).toLocaleString()} ريال`);
        setAmount(""); setNotes(""); setExpenseAccount(null); setSelectedCustomer(null);
      } else setErrorMsg(d.error);
    } catch { setErrorMsg("خطأ"); }
    setSubmitting(false);
  };

  const handleSubmit = (e) => {
    if (category === "transfer") return handleTransferSubmit(e);
    return handleEntrySubmit(e);
  };

  const preview = getPreview();

  return (
    <section className="inventory-section glass">
      <div className="section-title-row">
        <h2>💰 العمليات المالية</h2>
      </div>

      {/* Category selector */}
      <div className="tx-category-row">
        {CATEGORIES.map(c => (
          <button key={c.key} className={`tx-cat-btn ${category === c.key ? "active" : ""}`}
            onClick={() => { setCategory(c.key); setOpType(null); }}>
            <span className="tx-cat-icon">{c.label.split(" ")[0]}</span>
            <span className="tx-cat-label">{c.label.split(" ").slice(1).join(" ")}</span>
            <span className="tx-cat-desc">{c.desc}</span>
          </button>
        ))}
      </div>

      {/* Operation type selector */}
      {operTypes.length > 0 && (
        <div className="tx-op-grid">
          {operTypes.map(op => (
            <button key={op.id} className={`tx-op-btn ${opType === op.id ? "active" : ""}`}
              onClick={() => selectOpType(op.id)}>
              <span className="tx-op-icon">{op.icon}</span>
              <span className="tx-op-label">{op.label}</span>
              <span className="tx-op-desc">{op.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      {opType && category !== "transfer" && (
        <form onSubmit={handleSubmit} className="tx-form">
          {opType === "withdrawal" && (
            <div className="form-group full-width">
              <label>📂 تصنيف المسحوبات</label>
              <div className="tx-wd-tree">
                {/* Breadcrumb */}
                <div className="tx-wd-bc">
                  {wdPath.map((p, i) => (
                    <span key={p.code}>
                      {i > 0 && <span className="tx-wd-bc-sep"> › </span>}
                      <button type="button" className={`tx-wd-bc-btn ${i === wdPath.length - 1 ? "active" : ""}`}
                        onClick={() => {
                          if (i < wdPath.length - 1) {
                            const newPath = wdPath.slice(0, i + 1);
                            setWdPath(newPath);
                            setWdAccount(newPath[i].code);
                          }
                        }}>
                        {p.name}
                      </button>
                    </span>
                  ))}
                </div>
                {/* Current level accounts */}
                {wdCurrentChildren.length > 0 ? (
                  <div className="tx-wd-level">
                    {wdCurrentChildren.map(acct => {
                      const hasKids = accounts.some(a => a.parentCode === acct.accountCode && a.isActive !== false);
                      return (
                        <button key={acct.accountCode} type="button"
                          className={`tx-wd-card ${wdAccount === acct.accountCode ? "active" : ""}`}
                          onClick={() => {
                            if (hasKids) {
                              setWdPath([...wdPath, { code: acct.accountCode, name: acct.accountName }]);
                            }
                            setWdAccount(acct.accountCode);
                          }}>
                          <span className="tx-wd-code">{acct.accountCode}</span>
                          <span className="tx-wd-name">{acct.accountName}</span>
                          {hasKids && <span className="tx-wd-arrow">◀</span>}
                          {wdAccount === acct.accountCode && <span className="tx-wd-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tx-wd-leaf">
                    ✅ تم الاختيار: <strong>{wdPath[wdPath.length - 1].name}</strong> ({wdPath[wdPath.length - 1].code})
                  </div>
                )}
              </div>
            </div>
          )}
          {opType === "customer" && (
            <div className="tx-auto-banner">
              <span>🏦 دائن تلقائي: </span>
              <strong>1202 — ذمم مدينة - عملاء</strong>
            </div>
          )}

          <div className="tx-form-grid">
            {(opType === "general") && (
              <div className="form-group">
                <label>🔴 حساب المصروف <span className="required">*</span></label>
                <div style={{ position: "relative" }}>
                  <input type="text" className="form-control"
                    placeholder={expenseAccount ? `✅ ${expenseAccount.accountName}` : "ابحث عن حساب مصروف..."}
                    value={expenseAccount ? "" : expenseSearch}
                    onChange={e => { setExpenseSearch(e.target.value); setShowExpenseDropdown(true); if (expenseAccount) setExpenseAccount(null); }}
                    onFocus={() => setShowExpenseDropdown(true)}
                    onBlur={() => setTimeout(() => setShowExpenseDropdown(false), 250)} />
                  {showExpenseDropdown && expenseSearch.trim() && filteredExpense.length > 0 && (
                    <div className="acct-search-dropdown">
                      {filteredExpense.slice(0, 15).map(a => (
                        <div key={a.accountCode} className="acct-search-item expense"
                          onMouseDown={() => { setExpenseAccount(a); setShowExpenseDropdown(false); setExpenseSearch(""); }}>
                          <span className="asi-name">{a.accountName}</span>
                          <span className="asi-code">{a.accountCode}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showExpenseDropdown && expenseSearch.trim() && filteredExpense.length === 0 && (
                    <div className="acct-search-dropdown">
                      <div className="acct-search-empty">لا توجد نتائج</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {opType === "customer" && (
              <div className="form-group">
                <label>👥 العميل <span className="required">*</span></label>
                <div style={{ position: "relative" }}>
                  <input type="text" className="form-control"
                    placeholder={selectedCustomer ? `✅ ${selectedCustomer.customerName}${selectedCustomer.customerPhone ? ` (${selectedCustomer.customerPhone})` : ""}` : "ابحث باسم العميل..."}
                    value={selectedCustomer ? "" : customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (selectedCustomer) setSelectedCustomer(null); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 250)} />
                  {showCustomerDropdown && customerSearch.trim() && filteredCustomers.length > 0 && (
                    <div className="acct-search-dropdown">
                      {filteredCustomers.map((c, i) => (
                        <div key={i} className="acct-search-item"
                          onMouseDown={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(""); }}>
                          <span className="asi-name">{c.customerName}</span>
                          {c.customerPhone && <span className="asi-code">{c.customerPhone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && customerSearch.trim() && filteredCustomers.length === 0 && (
                    <div className="acct-search-dropdown">
                      <div className="acct-search-empty">لا توجد نتائج</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>🏦 الخزينة</label>
              <select className="form-control" value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
                {cashAccounts.map(a => (
                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>💰 المبلغ <span className="required">*</span></label>
              <input type="number" step="0.01" min="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label>📅 التاريخ</label>
              <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
            </div>
            <div className="form-group full-width">
              <label>📝 البيان</label>
              <textarea className="form-control" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder={opType === "withdrawal" ? "سحب شخصي" : "سبب العملية..."} />
            </div>
          </div>

          {/* Journal preview */}
          {preview && (
            <div className="tx-preview">
              <div className="tx-preview-title">🧾 معاينة القيد</div>
              <div className="tx-preview-rows">
                <div className="tx-preview-row debit">
                  <span className="tx-pr-side">مدين</span>
                  <span className="tx-pr-acct">{preview.debit.code} — {preview.debit.name}</span>
                  <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                </div>
                <div className="tx-preview-row credit">
                  <span className="tx-pr-side">دائن</span>
                  <span className="tx-pr-acct">{preview.credit.code} — {preview.credit.name}</span>
                  <span className="tx-pr-amt">{formatCurrency(preview.amount)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !amount || parseFloat(amount) <= 0}>
              {submitting ? "..." : opType === "withdrawal" ? "👤 تسجيل مسحوبات" : opType === "customer" ? "👥 تسجيل تحصيل" : "🔴 تسجيل مصروف"}
            </button>
          </div>
        </form>
      )}

      {/* Transfer form */}
      {opType === "transfer" && (
        <form onSubmit={handleTransferSubmit} className="tx-form">
          <div className="tx-form-grid">
            <div className="form-group">
              <label>من خزينة</label>
              <select className="form-control" value={fromAccount} onChange={e => setFromAccount(e.target.value)}>
                {cashAccounts.map(a => (
                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>إلى خزينة</label>
              <select className="form-control" value={toAccount} onChange={e => setToAccount(e.target.value)}>
                {cashAccounts.map(a => (
                  <option key={a.accountCode} value={a.accountCode}>{a.accountName} ({a.accountCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>💰 المبلغ <span className="required">*</span></label>
              <input type="number" step="0.01" min="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label>📅 التاريخ</label>
              <DualCalendarPicker value={entryDate} onChange={val => setEntryDate(val)} />
            </div>
            <div className="form-group full-width">
              <label>📝 البيان</label>
              <textarea className="form-control" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="سبب التحويل..." />
            </div>
          </div>

          {parseFloat(amount) > 0 && (
            <div className="tx-preview">
              <div className="tx-preview-title">🧾 معاينة القيد</div>
              <div className="tx-preview-rows">
                <div className="tx-preview-row debit">
                  <span className="tx-pr-side">مدين</span>
                  <span className="tx-pr-acct">{toAccount} — {acctName(toAccount)}</span>
                  <span className="tx-pr-amt">{formatCurrency(parseFloat(amount))}</span>
                </div>
                <div className="tx-preview-row credit">
                  <span className="tx-pr-side">دائن</span>
                  <span className="tx-pr-acct">{fromAccount} — {acctName(fromAccount)}</span>
                  <span className="tx-pr-amt">{formatCurrency(parseFloat(amount))}</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-gold" disabled={submitting || !amount || parseFloat(amount) <= 0 || fromAccount === toAccount}>
              {submitting ? "..." : "🔄 تنفيذ التحويل"}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {!opType && (
        <div className="tx-empty">
          <p>👈 اختر نوع العملية أعلاه للبدء</p>
        </div>
      )}

      <style jsx>{`
        .tx-category-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .tx-cat-btn {
          flex: 1;
          min-width: 120px;
          padding: 0.75rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          color: var(--foreground);
        }
        .tx-cat-btn.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-cat-btn:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-cat-icon { font-size: 1.5rem; }
        .tx-cat-label { font-weight: 700; font-size: 0.95rem; }
        .tx-cat-desc { font-size: 0.7rem; opacity: 0.6; }
        .tx-op-grid {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .tx-op-btn {
          padding: 0.6rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          flex: 1;
          min-width: 140px;
          color: var(--foreground);
        }
        .tx-op-btn.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-op-btn:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-op-icon { font-size: 1.3rem; display: block; }
        .tx-op-label { font-weight: 600; font-size: 0.85rem; display: block; margin-top: 0.15rem; }
        .tx-op-desc { font-size: 0.68rem; opacity: 0.5; display: block; }
        .tx-form { max-width: 600px; margin: 0 auto; }
        .tx-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .tx-form-grid .full-width { grid-column: 1 / -1; }
        .tx-auto-banner {
          padding: 0.5rem 0.75rem;
          background: rgba(212, 168, 67, 0.1);
          border: 1px solid rgba(212, 168, 67, 0.2);
          border-radius: var(--radius);
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
          text-align: center;
          color: var(--foreground);
        }
        .tx-preview {
          margin-top: 1rem;
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .tx-preview-title {
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
          color: var(--foreground);
        }
        .tx-preview-rows { padding: 0.5rem 0.75rem; }
        .tx-preview-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0;
          font-size: 0.85rem;
          color: var(--foreground);
        }
        .tx-pr-side {
          display: inline-block;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          min-width: 40px;
          text-align: center;
        }
        .tx-preview-row.debit .tx-pr-side { background: rgba(233, 69, 96, 0.2); color: #ef4444; }
        .tx-preview-row.credit .tx-pr-side { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .tx-pr-acct { flex: 1; color: var(--foreground); }
        .tx-pr-amt { font-weight: 700; direction: ltr; text-align: left; min-width: 80px; color: var(--foreground); }
        .tx-wd-tree {
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .tx-wd-bc {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
          flex-wrap: wrap;
          font-size: 0.85rem;
        }
        .tx-wd-bc-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: var(--foreground);
          opacity: 0.6;
        }
        .tx-wd-bc-btn:hover { opacity: 1; background: var(--hover-bg); }
        .tx-wd-bc-btn.active { opacity: 1; font-weight: 700; color: var(--gold); }
        .tx-wd-bc-sep { opacity: 0.3; margin: 0 0.15rem; color: var(--foreground); }
        .tx-wd-level {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.5rem;
          padding: 0.75rem;
        }
        .tx-wd-card {
          position: relative;
          padding: 0.6rem 0.75rem;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          background: var(--hover-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          color: var(--foreground);
        }
        .tx-wd-card:hover { border-color: var(--gold); background: rgba(255,255,255,0.08); }
        .tx-wd-card.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.1);
          box-shadow: 0 0 0 1px var(--gold);
        }
        .tx-wd-code { font-size: 0.7rem; opacity: 0.5; color: var(--foreground); }
        .tx-wd-name { font-weight: 600; font-size: 0.85rem; color: var(--foreground); }
        .tx-wd-arrow {
          position: absolute;
          left: 0.4rem;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.3;
          font-size: 0.8rem;
          color: var(--foreground);
        }
        .tx-wd-check {
          position: absolute;
          right: 0.4rem;
          top: 0.3rem;
          font-size: 0.8rem;
        }
        .tx-wd-leaf {
          padding: 1rem;
          text-align: center;
          font-size: 0.9rem;
        }
        .tx-empty {
          text-align: center;
          padding: 2rem;
          opacity: 0.5;
        }
      `}</style>
    </section>
  );
}
