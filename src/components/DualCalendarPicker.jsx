"use client";
import { useState, useRef, useEffect } from "react";

const DAY_NAMES = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];
const HIJRI_MONTH_SHORT = [
  "محرم", "صفر", "ر.أول", "ر.آخر",
  "ج.أولى", "ج.آخرة", "رجب", "شعبان",
  "رمضان", "شوال", "ذو قعدة", "ذو حجة"
];

function fmtHijri(d, opt) { try { return new Intl.DateTimeFormat("en-u-ca-islamic", opt).format(d); } catch { return "?"; } }
function fmtHijriAr(d, opt) { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", opt).format(d); } catch { return "?"; } }
function getHijriDay(d) { return parseInt(fmtHijri(d, { day: "numeric" })); }
function getHijriMonth(d) { return parseInt(fmtHijri(d, { month: "numeric" })); }
function getHijriYear(d) { return parseInt(fmtHijri(d, { year: "numeric" })); }
function getHijriMonthName(d) { return fmtHijriAr(d, { month: "long" }); }

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 1) % 7; // Saturday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let row = new Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { weeks.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); weeks.push(row); }
  return weeks;
}

function fmtDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function safeDate(v) {
  if (v) { const d = new Date(v + "T00:00:00"); if (!isNaN(d.getTime())) return d; }
  return new Date();
}
export default function DualCalendarPicker({ value, onChange, id, name, required }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const initial = safeDate(value);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (open) {
      const d = safeDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const safeViewYear = isNaN(viewYear) ? new Date().getFullYear() : viewYear;
  const safeViewMonth = isNaN(viewMonth) ? new Date().getMonth() : viewMonth;
  let grid = buildMonthGrid(safeViewYear, safeViewMonth);
  if (!grid || grid.length === 0) { grid = buildMonthGrid(new Date().getFullYear(), new Date().getMonth()); }
  const firstOfMonth = new Date(safeViewYear, safeViewMonth, 1);
  const hijriMonthName = getHijriMonthName(firstOfMonth);
  const hijriYear = getHijriYear(firstOfMonth);

  const handleDayClick = (day) => {
    if (!day) return;
    const ds = fmtDateStr(safeViewYear, safeViewMonth, day);
    onChange(ds);
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };

  const cellStyle = (day) => {
    if (!day) return {};
    const ds = fmtDateStr(safeViewYear, safeViewMonth, day);
    const isSel = ds === value;
    const isT = ds === todayStr;
    return {
      textAlign: "center", padding: "0.2rem 0", cursor: "pointer", borderRadius: "4px",
      background: isSel ? "#f59e0b" : isT ? "#fef3c7" : "#fff",
      color: isSel ? "#fff" : "#1f2937",
      fontWeight: isSel ? "bold" : "normal",
      transition: "background 0.1s",
    };
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="date" id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} className="form-control" style={{ display: "none" }} />
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        <div
          onClick={() => setOpen(true)}
          style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "var(--radius)", border: "1px solid var(--card-border)", background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: "1rem", fontFamily: "inherit", direction: "ltr", textAlign: "left", color: "#1f2937" }}
        >
          {value ? (() => { try { return safeDate(value).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); } catch { return value; } })() : <span style={{ color: "#9ca3af" }}>اختر التاريخ...</span>}
        </div>
        <button type="button" onClick={() => setOpen(!open)}
          style={{ padding: "0.5rem 0.6rem", cursor: "pointer", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: "1.1rem", lineHeight: 1 }}>
          📅
        </button>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, background: "#fff", color: "#1f2937", border: "1px solid var(--card-border)", borderRadius: "var(--radius)", padding: "0.75rem", width: "340px", maxWidth: "90vw", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", marginTop: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <button type="button" onClick={prevMonth} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.2rem", padding: "0.25rem 0.5rem", color: "var(--primary)" }}>◀</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{MONTH_NAMES[safeViewMonth]} {safeViewYear}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.1rem" }}>{hijriMonthName} {hijriYear} هـ</div>
            </div>
            <button type="button" onClick={nextMonth} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.2rem", padding: "0.25rem 0.5rem", color: "var(--primary)" }}>▶</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.25rem" }}>
            {DAY_NAMES.map(d => <div key={d} style={{ fontWeight: "bold" }}>{d}</div>)}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "1px" }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} />;
                const dateObj = new Date(safeViewYear, safeViewMonth, day);
                const hDay = getHijriDay(dateObj);
                const hMon = getHijriMonth(dateObj);
                const cs = cellStyle(day);
                const ds = fmtDateStr(safeViewYear, safeViewMonth, day);
                return (
                  <div key={di} onClick={() => handleDayClick(day)}
                    style={cs}
                    onMouseEnter={(e) => { if (ds !== value && ds !== todayStr) e.currentTarget.style.background = "#f3f4f6"; }}
                    onMouseLeave={(e) => { if (ds !== value && ds !== todayStr) e.currentTarget.style.background = "transparent"; }}
                    title={`${hDay} ${HIJRI_MONTH_SHORT[hMon - 1] || ""} ${getHijriYear(dateObj)} هـ`}
                  >
                    <div style={{ fontSize: "0.85rem", lineHeight: 1.3 }}>{day}</div>
                    <div style={{ fontSize: "0.55rem", opacity: 0.55, lineHeight: 1.1 }}>{hDay}/{hMon}</div>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: "0.4rem", paddingTop: "0.3rem", borderTop: "1px solid var(--card-border)", display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#6b7280" }}>
            <span>🇸🇦 هجري</span>
            <span>🌍 ميلادي</span>
          </div>
        </div>
      )}
      {value && (() => {
        const vd = safeDate(value);
        return (
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem", direction: "ltr", textAlign: "left" }}>
            🇸🇦 {getHijriDay(vd)} {getHijriMonthName(vd)} {getHijriYear(vd)} هـ
          </div>
        );
      })()}
    </div>
  );
}
