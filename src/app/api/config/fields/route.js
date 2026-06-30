import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const HEADERS = ["TypeName", "FieldKey", "FieldLabel", "FieldType", "Options", "Required", "IsActive"];

async function ensureColumns() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Type_Fields!A1:G1",
  });
  const h = res.data.values?.[0] || [];
  if (!h.includes("IsActive")) {
    const col = String.fromCharCode(64 + h.length + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Type_Fields!${col}1`,
      valueInputOption: "RAW", requestBody: { values: [["IsActive"]] },
    });
  }
}

const readAll = async () => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Type_Fields!A2:G",
  });
  return (res.data.values || []).filter((r) => r[0] && r[1]);
};

const rewriteAll = async (rows) => {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID, range: "Type_Fields!A:G",
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: "Type_Fields!A1",
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS, ...rows] },
  });
};

export async function GET(request) {
  try {
    await ensureColumns();
    const { searchParams } = new URL(request.url);
    const typeName = searchParams.get("type");
    const showAll = searchParams.get("all") === "true";

    const rows = await readAll();
    let fields = rows.map((r) => ({
      typeName: r[0] || "",
      fieldKey: r[1] || "",
      fieldLabel: r[2] || "",
      fieldType: r[3] || "text",
      options: r[4] ? r[4].split(",").map((o) => o.trim()) : [],
      required: r[5] === "true" || r[5] === "TRUE",
      isActive: r[6] !== "FALSE",
    }));

    if (!showAll) fields = fields.filter((f) => f.isActive);

    if (typeName) {
      fields = fields.filter((f) => f.typeName === typeName);
    }

    return NextResponse.json({ success: true, fields });
  } catch (error) {
    console.error("GET /api/config/fields error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { typeName, fieldKey, fieldLabel, fieldType, options, required } = body;
    if (!typeName || !fieldKey || !fieldLabel || !fieldType) {
      return NextResponse.json({ success: false, error: "جميع الحقول الأساسية مطلوبة" }, { status: 400 });
    }
    const validTypes = ["text", "number", "select", "checkbox", "date", "image", "textarea"];
    if (!validTypes.includes(fieldType)) {
      return NextResponse.json({ success: false, error: "نوع حقل غير صالح" }, { status: 400 });
    }
    await ensureColumns();
    const rows = await readAll();
    if (rows.some((r) => r[0] === typeName && r[1] === fieldKey)) {
      return NextResponse.json({ success: false, error: "حقل بنفس المفتاح موجود مسبقاً لهذا النوع" }, { status: 409 });
    }
    const optsStr = Array.isArray(options) ? options.join(",") : (options || "");
    const reqStr = required ? "TRUE" : "FALSE";
    rows.push([typeName, fieldKey, fieldLabel, fieldType, optsStr, reqStr, "TRUE"]);
    await rewriteAll(rows);
    return NextResponse.json({ success: true, message: `تم إضافة الحقل ${fieldLabel}` });
  } catch (error) {
    console.error("POST /api/config/fields error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { typeName, fieldKey, fieldLabel, fieldType, options, required, isActive } = await request.json();
    if (!typeName || !fieldKey) {
      return NextResponse.json({ success: false, error: "اسم النوع ومفتاح الحقل مطلوبان" }, { status: 400 });
    }
    await ensureColumns();
    const rows = await readAll();
    const rowIdx = rows.findIndex((r) => r[0] === typeName && r[1] === fieldKey);
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "الحقل غير موجود" }, { status: 404 });
    }
    const existing = rows[rowIdx];
    rows[rowIdx] = [
      typeName, fieldKey,
      fieldLabel || existing[2],
      fieldType || existing[3] || "text",
      options !== undefined ? (Array.isArray(options) ? options.join(",") : options) : (existing[4] || ""),
      required !== undefined ? (required ? "TRUE" : "FALSE") : (existing[5] || "FALSE"),
      isActive !== undefined ? (isActive ? "TRUE" : "FALSE") : (existing[6] || "TRUE"),
    ];
    await rewriteAll(rows);
    return NextResponse.json({ success: true, message: `تم تحديث الحقل ${fieldKey}` });
  } catch (error) {
    console.error("PUT /api/config/fields error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeName = searchParams.get("type");
    const fieldKey = searchParams.get("key");
    if (!typeName || !fieldKey) {
      return NextResponse.json({ success: false, error: "نوع الحقل ومفتاح الحقل مطلوبان" }, { status: 400 });
    }
    // Soft delete: set isActive to FALSE
    const rows = await readAll();
    const rowIdx = rows.findIndex((r) => r[0] === typeName && r[1] === fieldKey);
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "الحقل غير موجود" }, { status: 404 });
    }
    rows[rowIdx][6] = "FALSE";
    await rewriteAll(rows);
    return NextResponse.json({ success: true, message: `تم إخفاء الحقل ${fieldKey}` });
  } catch (error) {
    console.error("DELETE /api/config/fields error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}