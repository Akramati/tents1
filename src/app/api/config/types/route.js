import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const HEADERS = ["TypeName", "Behavior", "Icon", "IsActive", "AccountCode", "TypeCode", "CostCenterCode"];
const RANGE = "Booking_Types!A2:G";

function inferTypeCode(typeName, behavior) {
  if (behavior === "hall" || (typeName || "").includes("صالة")) return "HALL";
  if ((typeName || "").includes("خيام") || (typeName || "").includes("باقات")) return "TENTS";
  if ((typeName || "").includes("مفردات")) return "ITEMS";
  if ((typeName || "").includes("كوش")) return "KOSH";
  return "OTHER";
}

async function ensureAccountCodeColumn() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A1:E1",
    });
    const existingHeaders = res.data.values?.[0] || [];
    if (!existingHeaders.includes("AccountCode")) {
      const colLetter = String.fromCharCode(64 + existingHeaders.length + 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `Booking_Types!${colLetter}1`,
        valueInputOption: "RAW",
        requestBody: { values: [["AccountCode"]] },
      });
      // Fill defaults for existing rows
      const existingTypes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:B",
      });
      const rows = existingTypes.data.values || [];
      const fillValues = rows.map((r) => {
        const behavior = (r[1] || "").trim();
        if (behavior === "hall") return ["4001-01"];
        return ["4001-02"];
      });
      if (fillValues.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Booking_Types!${colLetter}2`,
          valueInputOption: "RAW",
          requestBody: { values: fillValues },
        });
      }
    }
  } catch { /* sheet may not exist yet */ }
}

async function ensureTypeCodeColumn() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A1:F1",
    });
    const existingHeaders = res.data.values?.[0] || [];
    if (!existingHeaders.includes("TypeCode")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!F1",
        valueInputOption: "RAW",
        requestBody: { values: [["TypeCode"]] },
      });
      const existingTypes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:B",
      });
      const rows = existingTypes.data.values || [];
      const fillValues = rows.map((r) => [inferTypeCode(r[0], (r[1] || "").trim())]);
      if (fillValues.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!F2",
          valueInputOption: "RAW",
          requestBody: { values: fillValues },
        });
      }
    }
  } catch { /* sheet may not exist yet */ }
}

async function ensureCostCenterCodeColumn() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A1:G1",
    });
    const existingHeaders = res.data.values?.[0] || [];
    if (!existingHeaders.includes("CostCenterCode")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!G1",
        valueInputOption: "RAW",
        requestBody: { values: [["CostCenterCode"]] },
      });
    }
  } catch { /* sheet may not exist yet */ }
}

export async function GET(request) {
  try {
    await ensureAccountCodeColumn();
    await ensureTypeCodeColumn();
    await ensureCostCenterCodeColumn();
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: RANGE,
    });
    const rows = res.data.values || [];
    const types = rows
      .filter((r) => showAll || r[3] !== "FALSE")
      .map((r) => ({
        typeName: r[0] || "",
        behavior: r[1] || "individual",
        icon: r[2] || "📦",
        isActive: r[3] !== "FALSE",
        accountCode: r[4] || "",
        typeCode: r[5] || inferTypeCode(r[0], (r[1] || "").trim()),
        costCenterCode: r[6] || "",
      }));
    return NextResponse.json({ success: true, types });
  } catch (error) {
    console.error("GET /api/config/types error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { typeName, behavior, icon, accountCode, typeCode, costCenterCode } = body;
    if (!typeName || !behavior) {
      return NextResponse.json({ success: false, error: "اسم النوع والسلوك مطلوبان" }, { status: 400 });
    }
    const validBehaviors = ["packages", "individual", "hall"];
    if (!validBehaviors.includes(behavior)) {
      return NextResponse.json({ success: false, error: "سلوك غير صالح" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A:A",
    });
    const existing = res.data.values || [];
    if (existing.slice(1).some((r) => r[0] === typeName)) {
      return NextResponse.json({ success: false, error: "النوع موجود مسبقاً" }, { status: 409 });
    }
    // Auto-assign account code and type code if not set
    const code = accountCode || (behavior === "hall" ? "4001-01" : "4001-02");
    const tc = typeCode || inferTypeCode(typeName, behavior);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A:G",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[typeName, behavior, icon || "📦", "TRUE", code, tc, costCenterCode || ""]] },
    });
    return NextResponse.json({ success: true, message: `تم إضافة النوع ${typeName}` });
  } catch (error) {
    console.error("POST /api/config/types error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { originalName, typeName, behavior, icon, isActive, accountCode, typeCode, costCenterCode } = await request.json();
    if (!originalName) {
      return NextResponse.json({ success: false, error: "اسم النوع الأصلي مطلوب" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A:F",
    });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r) => r[0] === originalName);
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "النوع غير موجود" }, { status: 404 });
    }
    const existing = rows[rowIdx];
    const newCode = accountCode ?? existing[4] ?? "";
    const newTc = typeCode ?? existing[5] ?? inferTypeCode(typeName || existing[0], behavior || existing[1] || "");
    const newCc = costCenterCode !== undefined ? costCenterCode : (existing[6] || "");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Booking_Types!A${rowIdx + 1}:G${rowIdx + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          typeName || existing[0],
          behavior || existing[1] || "individual",
          icon || existing[2] || "📦",
          isActive !== undefined ? (isActive ? "TRUE" : "FALSE") : (existing[3] || "TRUE"),
          newCode,
          newTc,
          newCc,
        ]],
      },
    });
    return NextResponse.json({ success: true, message: `تم تحديث النوع ${originalName}` });
  } catch (error) {
    console.error("PUT /api/config/types error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json({ success: false, error: "اسم النوع مطلوب" }, { status: 400 });
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A:G",
    });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r) => r[0] === name);
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "النوع غير موجود" }, { status: 404 });
    }
    // Soft delete by setting isActive to FALSE
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Booking_Types!D${rowIdx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [["FALSE"]] },
    });
    return NextResponse.json({ success: true, message: `تم إخفاء النوع ${name}` });
  } catch (error) {
    console.error("DELETE /api/config/types error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
