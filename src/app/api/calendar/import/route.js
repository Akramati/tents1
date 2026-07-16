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
        if (lines[i].startsWith(key + ":")) return lines[i].slice(key.length + 1).trim();
        if (lines[i].startsWith(key + ";")) {
          const colonIdx = lines[i].indexOf(":");
          if (colonIdx !== -1) return lines[i].slice(colonIdx + 1).trim();
        }
      }
      return "";
    };

    const uid = getVal("UID");
    const summary = getVal("SUMMARY");
    const description = getVal("DESCRIPTION");
    const location = getVal("LOCATION");

    const dtStart = getVal("DTSTART");
    const dtEnd = getVal("DTEND");

    let startDate = "";
    let endDate = "";
    if (dtStart.startsWith(";VALUE=DATE:")) {
      startDate = dtStart.split(":")[1]?.slice(0, 10) || "";
      startDate = startDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    } else if (dtStart.length === 8 && !isNaN(dtStart)) {
      startDate = dtStart.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    } else if (dtStart) {
      startDate = dtStart.slice(0, 10);
    }

    if (dtEnd.startsWith(";VALUE=DATE:")) {
      endDate = dtEnd.split(":")[1]?.slice(0, 10) || "";
      endDate = endDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    } else if (dtEnd.length === 8 && !isNaN(dtEnd)) {
      endDate = dtEnd.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    } else if (dtEnd) {
      endDate = dtEnd.slice(0, 10);
    }

    if (startDate) {
      events.push({
        eventId: uid || `ev-${events.length}`,
        summary: decodeURIComponent(summary.replace(/\\,/g, ",")),
        description: decodeURIComponent(description.replace(/\\,/g, ",") || ""),
        startDate,
        endDate: endDate || startDate,
        location: decodeURIComponent(location.replace(/\\,/g, ",") || ""),
      });
    }
  }
  return events;
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { icsUrl, icsContent } = await request.json();

    if (icsContent) {
      const events = parseICS(icsContent);
      return NextResponse.json({ success: true, events });
    }

    if (icsUrl) {
      const res = await fetch(icsUrl, { headers: { "Accept": "text/calendar" } });
      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: "فشل تحميل ملف ICS من الرابط. تأكد من صحة الرابط.",
        }, { status: 400 });
      }
      const text = await res.text();
      const events = parseICS(text);
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
