import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const SEED_BRANCHES = [
  ["DHM", "ذمار", "TRUE"],
];

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Branches" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["Code", "Name", "IsActive"]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A2",
      valueInputOption: "RAW",
      requestBody: { values: SEED_BRANCHES },
    });
  }
}

export async function GET() {
  try {
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
    });
    const rows = (res.data.values || []).slice(1);
    const branches = rows
      .filter((r) => r[0] && r[2] !== "FALSE")
      .map((r) => ({ code: r[0], name: r[1] || "" }));
    return NextResponse.json({ success: true, branches });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json({ success: false, error: "كود واسم الفرع مطلوبان" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A:A",
    });
    if ((res.data.values || []).slice(1).some((r) => r[0] === code)) {
      return NextResponse.json({ success: false, error: "الفرع موجود" }, { status: 409 });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[code, name, "TRUE"]] },
    });
    return NextResponse.json({ success: true, message: `تمت إضافة ${name}` });
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
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json({ success: false, error: "كود واسم الفرع مطلوبان" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === code);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "الفرع غير موجود" }, { status: 404 });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Branches!B${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[name]] },
    });
    return NextResponse.json({ success: true, message: `تم تحديث ${name}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ success: false, error: "كود الفرع مطلوب" }, { status: 400 });
    }
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === code);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Branches!C${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [["FALSE"]] },
    });
    return NextResponse.json({ success: true, message: "تم إخفاء الفرع" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
