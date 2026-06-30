import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "System_Settings" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["Key", "Value"]] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A:B",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [["DEFAULT_CASH_ACCOUNT", "1101"]] },
    });
  }
}

export async function GET() {
  try {
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A:B",
    });
    const rows = res.data.values || [];
    const settings = {};
    for (const row of rows) {
      if (row[0]) settings[row[0]] = row[1] ?? "";
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { key, value } = body;
    if (!key) {
      return NextResponse.json({ success: false, error: "مفتاح الإعداد مطلوب" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A:B",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === key);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `System_Settings!B${idx + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[value ?? ""]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A:B",
        valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[key, value ?? ""]] },
      });
    }

    return NextResponse.json({ success: true, message: `تم تحديث ${key}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
