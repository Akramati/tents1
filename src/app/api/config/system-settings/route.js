import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const DEFAULTS = {
  companyName: "مجموعة التعزي لإدارة المناسبات والتأجير",
  defaultFont: "Arial",
  titleFontSize: "26",
  tableFontSize: "14",
  templateType: "A4",
  fontSize: "normal",
};

const ALL_KEYS = Object.keys(DEFAULTS);

async function ensureSheet() {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const titles = spreadsheet.data.sheets.map((s) => s.properties.title);
  if (!titles.includes("System_Settings")) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "System_Settings" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "System_Settings!A1:D1",
      valueInputOption: "RAW",
      requestBody: { values: [["Key", "Value", "Label", "Type"]] },
    });
    // Seed defaults
    const rows = ALL_KEYS.map((key) => {
      const labels = {
        companyName: "اسم المنشأة",
        defaultFont: "الخط الافتراضي",
        titleFontSize: "حجم خط العناوين",
        tableFontSize: "حجم خط الجداول",
        templateType: "نوع القالب الافتراضي",
        fontSize: "حجم الخط الافتراضي",
      };
      const types = {
        companyName: "text",
        defaultFont: "text",
        titleFontSize: "number",
        tableFontSize: "number",
        templateType: "select",
        fontSize: "select",
      };
      return [key, DEFAULTS[key], labels[key] || key, types[key] || "text"];
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "System_Settings!A:D",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
  }
}

export async function GET() {
  try {
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "System_Settings!A:B",
    });
    const rows = res.data.values || [];
    const settings = { ...DEFAULTS };
    for (const row of rows) {
      if (row[0] && row[1] !== undefined && ALL_KEYS.includes(row[0])) {
        settings[row[0]] = row[1];
      }
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("GET /api/config/system-settings error:", error);
    return NextResponse.json({ success: false, error: error.message, settings: { ...DEFAULTS } }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "System_Settings!A:B",
    });
    const rows = res.data.values || [];
    for (const [key, value] of Object.entries(body)) {
      if (!ALL_KEYS.includes(key)) continue;
      const idx = rows.findIndex((r) => r[0] === key);
      if (idx >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `System_Settings!B${idx + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [[String(value)]] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "System_Settings!A:B",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [[key, String(value)]] },
        });
      }
    }
    return NextResponse.json({ success: true, message: "تم حفظ الإعدادات" });
  } catch (error) {
    console.error("PUT /api/config/system-settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
