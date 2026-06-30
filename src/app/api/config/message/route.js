import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const TEMPLATES = {
  bookingConfirm: {
    key: "bookingConfirm",
    default: `السلام عليكم ورحمة الله وبركاته 🌿

عزيزي {customerName}،
يسعدنا إبلاغكم بتأكيد حجزكم لدى *هابي لاند* 🎉

📋 *تفاصيل الحجز:*
🔖 رقم الحجز: {bookingId}
📅 من: {startDate}
📅 إلى: {endDate}
💰 المبلغ الإجمالي: {totalAmount}
✅ المدفوع: {paidAmount}
⏳ المتبقي: {remainingAmount}
{contractLink}

شكراً لثقتكم بنا 🙏`,
    placeholders: [
      { key: "customerName", label: "اسم العميل" },
      { key: "customerPhone", label: "رقم الجوال" },
      { key: "bookingId", label: "رقم الحجز" },
      { key: "startDate", label: "تاريخ البداية" },
      { key: "endDate", label: "تاريخ النهاية" },
      { key: "totalAmount", label: "المبلغ الإجمالي" },
      { key: "paidAmount", label: "المدفوع" },
      { key: "remainingAmount", label: "المتبقي" },
      { key: "bookingType", label: "نوع الحجز" },
      { key: "contractLink", label: "رابط العقد" },
      { key: "notes", label: "ملاحظات" },
      { key: "eventType", label: "نوع الفعالية" },
      { key: "shift", label: "الفترة" },
      { key: "guarantorName", label: "اسم الضامن" },
      { key: "guarantorPhone", label: "جوال الضامن" },
      { key: "customerAddress", label: "العنوان" },
      { key: "customerIdNumber", label: "رقم البطاقة" },
    ],
  },
  paymentReceipt: {
    key: "paymentReceipt",
    default: `السلام عليكم ورحمة الله وبركاته 🌿

عزيزي {customerName}،
نشكركم على ثقتكم ب *هابي لاند* 🎉

🧾 *سند قبض*
🔖 رقم الحجز: {bookingId}
💰 المبلغ المستلم: {amount} ريال
✅ إجمالي المدفوع: {newPaid} ريال
⏳ المتبقي: {newRemaining} ريال
📅 التاريخ: {date}

شكراً لكم 🙏`,
    placeholders: [
      { key: "customerName", label: "اسم العميل" },
      { key: "bookingId", label: "رقم الحجز" },
      { key: "amount", label: "المبلغ المستلم" },
      { key: "newPaid", label: "إجمالي المدفوع" },
      { key: "newRemaining", label: "المتبقي" },
      { key: "date", label: "التاريخ" },
      { key: "status", label: "حالة الحجز" },
    ],
  },
};

async function ensureSheet() {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const titles = spreadsheet.data.sheets.map((s) => s.properties.title);
  if (!titles.includes("Message_Templates")) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Message_Templates" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Message_Templates!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["TemplateKey", "TemplateContent"]] },
    });
  }
}

export async function GET(request) {
  try {
    await ensureSheet();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bookingConfirm";
    const config = TEMPLATES[type];
    if (!config) {
      return NextResponse.json({ success: false, error: "نوع القالب غير موجود" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Message_Templates!A:B",
    });
    const rows = res.data.values || [];
    const row = rows.find((r) => r[0] === config.key);
    return NextResponse.json({
      success: true,
      template: row ? row[1] : config.default,
      placeholders: config.placeholders,
    });
  } catch (error) {
    console.error("GET /api/config/message error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { template, type } = await request.json();
    const config = TEMPLATES[type || "bookingConfirm"];
    if (!config) {
      return NextResponse.json({ success: false, error: "نوع القالب غير موجود" }, { status: 400 });
    }
    if (!template) {
      return NextResponse.json({ success: false, error: "القالب مطلوب" }, { status: 400 });
    }
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Message_Templates!A:B",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === config.key);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Message_Templates!B${idx + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[template]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Message_Templates!A:B",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[config.key, template]] },
      });
    }
    return NextResponse.json({ success: true, message: "تم حفظ القالب" });
  } catch (error) {
    console.error("PUT /api/config/message error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
