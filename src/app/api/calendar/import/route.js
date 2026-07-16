import { NextResponse } from "next/server";
import { calendar } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { externalCalendarId, dateFrom, dateTo } = await request.json();
    if (!externalCalendarId) {
      return NextResponse.json({ success: false, error: "معرف التقويم الخارجي مطلوب" }, { status: 400 });
    }

    const timeMin = dateFrom ? new Date(dateFrom + "T00:00:00+03:00").toISOString() : new Date().toISOString();
    const timeMax = dateTo ? new Date(dateTo + "T23:59:59+03:00").toISOString() : undefined;

    const params = {
      calendarId: externalCalendarId,
      timeMin,
      singleEvents: true,
      orderBy: "startTime",
    };
    if (timeMax) params.timeMax = timeMax;

    const res = await calendar.events.list(params);
    const events = (res.data.items || []).map(ev => ({
      eventId: ev.id,
      summary: ev.summary || "",
      description: ev.description || "",
      startDate: (ev.start?.date || ev.start?.dateTime || "").slice(0, 10),
      endDate: (ev.end?.date || ev.end?.dateTime || "").slice(0, 10),
      location: ev.location || "",
    }));

    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error("Calendar import error:", error);
    return NextResponse.json({
      success: false,
      error: error.message?.includes("not found") ? "لم يتم العثور على التقويم. تأكد من مشاركته مع البريد الإلكتروني للحساب الخدمي." : "فشل استيراد الأحداث من التقويم.",
    }, { status: 500 });
  }
}
