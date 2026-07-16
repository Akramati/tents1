import { NextResponse } from "next/server";
import { sheets, calendar } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { targetCalendarId, bookingIds } = await request.json();
    if (!targetCalendarId) {
      return NextResponse.json({ success: false, error: "معرف التقويم الهدف مطلوب" }, { status: 400 });
    }
    if (!bookingIds || !bookingIds.length) {
      return NextResponse.json({ success: false, error: "اختر حجزاً واحداً على الأقل للتصدير" }, { status: 400 });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A2:AF",
    });
    const rows = response.data.values || [];
    const idSet = new Set(bookingIds);

    const results = [];
    for (const row of rows) {
      if (!row[0] || !idSet.has(row[0])) continue;
      const bookingId = row[0];
      const customerName = row[1] || "";
      const customerPhone = row[2] || "";
      const startDate = row[3] || "";
      const endDate = row[4] || "";
      const total = parseFloat(row[5] || 0);
      const paid = parseFloat(row[6] || 0);
      const remaining = parseFloat(row[7] || 0);
      const bookingType = row[11] || "";
      const customerAddress = row[30] || "";
      const timestamp = row[10] || "";

      const startDateTime = new Date(startDate);
      const endDateTime = new Date(startDate > endDate ? startDate : endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);

      const description = `رقم الحجز: ${bookingId}\nالعميل: ${customerName}\nرقم الجوال: ${customerPhone}\nالعنوان: ${customerAddress}\nالمبلغ الإجمالي: ${total}\nالمبلغ المقدم: ${paid}\nالمتبقي: ${remaining}\nنوع الحجز: ${bookingType}\nتاريخ الحجز: ${timestamp}`;

      try {
        await calendar.events.insert({
          calendarId: targetCalendarId,
          requestBody: {
            summary: `${bookingType === "حجز الصالة" ? "🏛️" : "⛺"} ${customerName} - ${bookingType}`,
            description,
            start: { date: startDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
            end: { date: endDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
            location: customerAddress || "",
          },
        });
        results.push({ bookingId, status: "ok" });
      } catch (evErr) {
        results.push({ bookingId, status: "error", error: evErr.message });
      }
    }

    const successCount = results.filter(r => r.status === "ok").length;
    return NextResponse.json({
      success: true,
      exported: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error("Calendar export error:", error);
    return NextResponse.json({
      success: false,
      error: error.message?.includes("not found") ? "لم يتم العثور على التقويم الهدف. تأكد من مشاركته مع البريد الإلكتروني للحساب الخدمي." : "فشل تصدير الحجوزات إلى التقويم.",
    }, { status: 500 });
  }
}
