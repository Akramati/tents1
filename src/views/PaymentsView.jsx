"use client";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";

export default function PaymentsView() {
  const { setSuccessMsg, setErrorMsg, getTodayString } = useApp();
  const [tab, setTab] = useState("create");

  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [vDate, setVDate] = useState(getTodayString?.() || new Date().toLocaleDateString("en-CA"));
  const [recipient, setRecipient] = useState("");
  const [debitAcct, setDebitAcct] = useState("");
  const [debitAcctName, setDebitAcctName] = useState("");
  const [cashAcct, setCashAcct] = useState("1101");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDebitDropdown, setShowDebitDropdown] = useState(false);
  const [debitSearch, setDebitSearch] = useState("");

  // List filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchAccounts = async () => {
    try {
      const r = await fetch("/api/finance/accounts?includeInactive=false");
      const d = await r.json();
      if (d.success) setAccounts(d.accounts || []);
    } catch {}
  };

  const fetchVouchers = async (from, to) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const r = await fetch(`/api/finance/vouchers?${p}`);
      const d = await r.json();
      if (d.success) setVouchers(d.vouchers || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); fetchVouchers(); }, []);

  // Build tree for debit account dropdown
  const accountTree = useMemo(() => {
    const seen = new Set();
    const deduped = accounts.filter(a => {
      if (seen.has(a.accountCode)) return false;
      seen.add(a.accountCode);
      return true;
    });
    const build = (parents, depth = 0) => {
      const result = [];
      for (const p of parents) {
        result.push({ ...p, depth });
        const children = deduped.filter(a => a.parentCode === p.accountCode);
        if (children.length > 0) result.push(...build(children, depth + 1));
      }
      return result;
    };
    return deduped.filter(a => !a.parentCode).map(typeRoot => ({
      ...typeRoot,
      children: build(deduped.filter(a => a.parentCode === typeRoot.accountCode), 1),
    }));
  }, [accounts]);

  const flatTree = useMemo(() => {
    const result = [];
    for (const root of accountTree) {
      result.push(root);
      result.push(...root.children);
    }
    return result;
  }, [accountTree]);

  const filteredFlat = useMemo(() => {
    if (!debitSearch.trim()) return flatTree;
    const q = debitSearch.trim().toLowerCase();
    return flatTree.filter(a => a.accountName.toLowerCase().includes(q) || a.accountCode.includes(q));
  }, [flatTree, debitSearch]);

  // Cash accounts (assets under 1100 or any asset with "نقد" or "صندوق" or "محفظة")
  const cashAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (a.isActive === false) return false;
      if (a.accountType !== "asset") return false;
      if (a.accountCode.startsWith("110")) return true;
      const kw = ["نقد", "صندوق", "محفظة", "بنك", "كاش"];
      return kw.some(k => a.accountName.includes(k));
    });
  }, [accounts]);

  const handleSelectDebit = (acct) => {
    setDebitAcct(acct.accountCode);
    setDebitAcctName(acct.accountName);
    setShowDebitDropdown(false);
    setDebitSearch("");
  };

  const handleSubmit = async () => {
    if (!debitAcct || !amount || parseFloat(amount) <= 0) {
      setErrorMsg("الحساب المدينة والمبلغ مطلوبان");
      return;
    }
    setSubmitting(true);
    const tk = localStorage.getItem("token");
    try {
      const r = await fetch("/api/finance/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          date: vDate,
          recipient,
          accountCode: debitAcct,
          cashAccountCode: cashAcct,
          amount: parseFloat(amount),
          notes,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`✅ سند صرف #${d.voucherId} — ${parseFloat(amount).toLocaleString()} ريال`);
        setRecipient("");
        setAmount("");
        setNotes("");
        fetchVouchers(filterFrom, filterTo);
      } else {
        setErrorMsg(d.error);
      }
    } catch {
      setErrorMsg("خطأ في الاتصال");
    }
    setSubmitting(false);
  };

  return (
    <div className="create-section glass" style={{ marginTop: "1rem" }}>
      <h2 style={{ marginBottom: "1rem", textAlign: "center" }}>🧾 سندات الصرف</h2>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1.5rem" }}>
        <button className={`tab-btn ${tab === "create" ? "active" : ""}`} onClick={() => setTab("create")}>➕ إنشاء سند صرف</button>
        <button className={`tab-btn ${tab === "list" ? "active" : ""}`} onClick={() => { setTab("list"); fetchVouchers(filterFrom, filterTo); }}>📋 سندات الصرف</button>
      </div>

      {tab === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "600px", margin: "0 auto" }}>
          <div className="form-row">
            <label>التاريخ:</label>
            <input type="date" className="form-input" value={vDate} onChange={e => setVDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>المستلم / المستفيد:</label>
            <input type="text" className="form-input" placeholder="اسم المستلم" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </div>

          <div className="form-row">
            <label>الحساب المدين (مصروف / أصل / مطلوب):</label>
            <div style={{ position: "relative" }}>
              <input type="text" className="form-input"
                placeholder="ابحث أو اختر..."
                value={debitAcct ? `${debitAcct} - ${debitAcctName}` : debitSearch}
                onFocus={() => { setShowDebitDropdown(true); setDebitSearch(""); }}
                onChange={e => { setDebitSearch(e.target.value); setDebitAcct(""); setDebitAcctName(""); setShowDebitDropdown(true); }} />
              {showDebitDropdown && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#1a1a2e", border: "1px solid #e94560", borderRadius: "8px", maxHeight: "250px", overflowY: "auto" }}>
                  {filteredFlat.map(a => (
                    <div key={a.accountCode}
                      onClick={() => handleSelectDebit(a)}
                      style={{ padding: "0.4rem 0.75rem", cursor: "pointer", borderBottom: "1px solid #333", direction: "rtl", textAlign: "right", paddingRight: `${1 + (a.depth || 0)}rem` }}>
                      <span style={{ color: a.accountType === "asset" ? "#4fc3f7" : a.accountType === "liability" ? "#ffb74d" : a.accountType === "equity" ? "#ce93d8" : a.accountType === "income" ? "#81c784" : "#e57373" }}>
                        {a.accountCode}
                      </span>
                      <span style={{ marginRight: "0.5rem" }}>{a.accountName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <label>الحساب الدائن (الخزينة / الصندوق):</label>
            <select className="form-input" value={cashAcct} onChange={e => setCashAcct(e.target.value)}>
              {cashAccounts.map(a => (
                <option key={a.accountCode} value={a.accountCode}>{a.accountCode} - {a.accountName}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>المبلغ (ريال):</label>
            <input type="number" className="form-input" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div className="form-row">
            <label>البيان:</label>
            <textarea className="form-input" rows="2" placeholder="سبب الصرف..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ marginTop: "0.5rem" }}>
            {submitting ? "جاري الحفظ..." : "💾 حفظ سند الصرف"}
          </button>
        </div>
      )}

      {tab === "list" && (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <label>من:</label>
            <input type="date" className="form-input" style={{ width: "auto" }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            <label>إلى:</label>
            <input type="date" className="form-input" style={{ width: "auto" }} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            <button className="btn btn-sm btn-primary" onClick={() => fetchVouchers(filterFrom, filterTo)}>🔍 بحث</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setFilterFrom(""); setFilterTo(""); fetchVouchers(); }}>إظهار الكل</button>
          </div>

          {loading ? (
            <p style={{ textAlign: "center" }}>جاري التحميل...</p>
          ) : vouchers.length === 0 ? (
            <p style={{ textAlign: "center" }}>لا توجد سندات صرف</p>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: "500px", overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>#</th><th>التاريخ</th><th>المستلم</th><th>المبلغ</th><th>مدين</th><th>دائن</th><th>البيان</th></tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <tr key={v.voucherId}>
                      <td>{v.voucherId}</td>
                      <td>{v.date}</td>
                      <td>{v.recipient || "-"}</td>
                      <td style={{ fontWeight: "bold", color: "#e94560" }}>{v.amount.toLocaleString()}</td>
                      <td style={{ fontSize: "0.75rem" }}>{v.accountCode} {v.accountName}</td>
                      <td style={{ fontSize: "0.75rem" }}>{v.cashAccountCode}</td>
                      <td style={{ fontSize: "0.75rem" }}>{v.notes || v.recipient || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
