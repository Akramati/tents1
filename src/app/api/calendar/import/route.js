import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

function parseICS(icsText) {
  const events = [];
  const blocks = icsText.split(/(?=BEGIN:VEVENT)/);
  for (const block of blocks) {
    if (!block.includes("END:VEVENT")) continue;

    const getVal = (key) => {
      const lines = block.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, "");
        if (line.startsWith(key + ":")) return line.slice(key.length + 1).trim();
        if (line.startsWith(key + ";")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) return line.slice(colonIdx + 1).trim();
        }
      }
      return "";
    };

    const uid = getVal("UID") || `ev-${events.length}`;
    const summary = getVal("SUMMARY");
    const description = getVal("DESCRIPTION");
    const location = getVal("LOCATION");

    let dtStart = getVal("DTSTART");
    let dtEnd = getVal("DTEND");

    // Handle folded lines (continuation with whitespace)
    const lines = block.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(/\r$/, "");
      if (!dtStart && l.startsWith("DTSTART")) dtStart = l;
      if (!dtEnd && l.startsWith("DTEND")) dtEnd = l;
    }

    let startDate = "";
    let endDate = "";

    // Detect all-day events (VALUE=DATE in the raw DTSTART line)
    const isAllDay = block.includes("DTSTART;VALUE=DATE");

    const parseDate = (val) => {
      // Strip property params like ;VALUE=DATE:
      const afterSemi = val.replace(/^DTSTART(?:;[^:]*)?:/, "").replace(/^DTEND(?:;[^:]*)?:/, "");
      const clean = afterSemi || val;
      // YYYYMMDD format
      const m = clean.match(/(\d{4})(\d{2})(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      // ISO format
      if (clean.match(/^\d{4}-\d{2}-\d{2}/)) return clean.slice(0, 10);
      return "";
    };

    const addDays = (dateStr, days) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    };

    startDate = parseDate(dtStart);
    endDate = parseDate(dtEnd);
    if (!endDate) endDate = startDate;
    // ICS all-day events (VALUE=DATE) use exclusive DTEND, so subtract one day
    else if (isAllDay) endDate = addDays(endDate, -1);

    if (startDate) {
      events.push({
        eventId: uid,
        summary: summary.replace(/\\,/g, ",").replace(/\\n/g, "\n"),
        description: description.replace(/\\,/g, ",").replace(/\\n/g, "\n"),
        startDate,
        endDate,
        location: location.replace(/\\,/g, ","),
      });
    }
  }
  return events;
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { icsUrl, icsContent } = await request.json();

    if (icsContent) {
      const events = parseICS(icsContent);
      return NextResponse.json({ success: true, events });
    }

    if (icsUrl) {
      console.log("[ICS-IMPORT] Fetching URL:", icsUrl);
      const res = await fetch(icsUrl, {
        headers: {
          "Accept": "text/calendar, */*",
          "User-Agent": "HappyLand-Booking-System/1.0",
        },
      });
      console.log("[ICS-IMPORT] Fetch status:", res.status);
      if (!res.ok) {
        let msg = `فشل تحميل ملف ICS من الرابط (رمز الخطأ: ${res.status}).`;
        if (res.status === 403 || res.status === 401) {
          msg += " الرابط يتطلب صلاحية أو أن التقويم غير عام. جرب:\n• الرابط السري بتنسيق iCal من إعدادات التقويم\n• أو اجعل التقويم عاماً (public)";
        } else if (res.status === 404) {
          msg += " الرابط غير صحيح.";
        }
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
      const text = await res.text();
      console.log("[ICS-IMPORT] Fetch body length:", text.length);
      if (!text.includes("BEGIN:VCALENDAR") && !text.includes("BEGIN:VEVENT")) {
        return NextResponse.json({
          success: false,
          error: "الرابط لا يحتوي على بيانات تقويم صالحة. استخدم:\n• الرابط السري بتنسيق iCal من إعدادات التقويم\n• أو البريد الإلكتروني للتقويم (إذا كان عاماً)\n• أو رابط التضمين (embed) من جوجل كاليندر",
        }, { status: 400 });
      }
      const events = parseICS(text);
      console.log("[ICS-IMPORT] Parsed events count:", events.length);
      return NextResponse.json({ success: true, events });
    }

    return NextResponse.json({ success: false, error: "الرجاء توفير رابط ICS أو محتوى الملف" }, { status: 400 });
  } catch (error) {
    console.error("ICS import error:", error);
    return NextResponse.json({
      success: false,
      error: "فشل استيراد الأحداث. تأكد من صحة الرابط أو محتوى الملف.",
    }, { status: 500 });
  }
}
