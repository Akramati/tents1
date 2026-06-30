import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Cost_Centers" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["Code", "Name", "Type", "IsActive"]] },
    });
  }
}

export async function GET() {
  try {
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
    });
    const rows = (res.data.values || []).slice(1);
    const centers = rows
      .filter((r) => r[0] && r[3] !== "FALSE")
      .map((r) => ({
        code: r[0],
        name: r[1] || "",
        type: r[2] || "vehicle",
      }));
    return NextResponse.json({ success: true, centers });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureSheet();
    const body = await request.json();

    // Seed mode: auto-create hierarchical cost centers from branches × booking types
    if (body.action === "seed") {
      const [branchesRes, typesRes] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:F",
        }),
      ]);
      const branches = (branchesRes.data.values || []).slice(1).filter((r) => r[0] && r[2] !== "FALSE");
      const types = (typesRes.data.values || []).filter((r) => r[0] && r[3] !== "FALSE");

      const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:A",
      });
      const existingCodes = new Set((existingRes.data.values || []).slice(1).map((r) => r[0]));

      const toInsert = [];
      for (const branch of branches) {
        const branchCode = branch[0];
        const branchName = branch[1] || "";
        for (const t of types) {
          const typeCode = t[5] || "OTHER";
          const typeName = t[0] || "";
          const code = `CC-${branchCode}-${typeCode}`;
          if (!existingCodes.has(code)) {
            toInsert.push([code, `${branchName} - ${typeName}`, "booking", "TRUE"]);
          }
        }
        // Also add an admin cost center per branch
        const adminCode = `CC-${branchCode}-ADMIN`;
        if (!existingCodes.has(adminCode)) {
          toInsert.push([adminCode, `${branchName} - إداري`, "administrative", "TRUE"]);
        }
      }
      if (toInsert.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
          valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
          requestBody: { values: toInsert },
        });
      }
      return NextResponse.json({ success: true, message: `تم إنشاء ${toInsert.length} مركز تكلفة`, count: toInsert.length });
    }

    // Normal single creation
    const { code, name, type } = body;
    if (!code || !name) {
      return NextResponse.json({ success: false, error: "كود واسم مركز التكلفة مطلوبان" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:A",
    });
    if ((res.data.values || []).slice(1).some((r) => r[0] === code)) {
      return NextResponse.json({ success: false, error: "مركز التكلفة موجود" }, { status: 409 });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[code, name, type || "vehicle", "TRUE"]] },
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
    const { code, name, type } = body;
    if (!code || !name) {
      return NextResponse.json({ success: false, error: "كود واسم مركز التكلفة مطلوبان" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === code);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "مركز التكلفة غير موجود" }, { status: 404 });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Cost_Centers!B${idx + 1}:C${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[name, type || rows[idx][2] || "vehicle"]] },
    });
    return NextResponse.json({ success: true, message: `تم تحديث ${name}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ success: false, error: "كود مركز التكلفة مطلوب" }, { status: 400 });
    }
    await ensureSheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === code);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Cost_Centers!D${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [["FALSE"]] },
    });
    return NextResponse.json({ success: true, message: "تم إخفاء مركز التكلفة" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
