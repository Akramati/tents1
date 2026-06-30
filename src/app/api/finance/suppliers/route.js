import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth, requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/finance/suppliers — list all suppliers
export async function GET() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Suppliers!A2:G",
    });
    const rows = res.data.values || [];
    const suppliers = rows.map((r) => ({
      supplierId: r[0],
      supplierName: r[1] || "",
      phone: r[2] || "",
      address: r[3] || "",
      balance: parseFloat(r[4] || 0),
      notes: r[5] || "",
      isActive: r[6] !== "FALSE",
    }));
    return NextResponse.json({ success: true, suppliers });
  } catch (error) {
    console.error("GET /api/finance/suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/finance/suppliers — add new supplier
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { supplierName, phone, address, notes } = body;
    if (!supplierName) {
      return NextResponse.json({ success: false, error: "اسم المورد مطلوب" }, { status: 400 });
    }

    // Auto-generate ID
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Suppliers!A:A",
    });
    const existing = res.data.values || [];
    let max = 0;
    for (const r of existing) {
      const n = parseInt((r[0] || "").replace("SUP-", ""));
      if (n > max) max = n;
    }
    const newId = `SUP-${String(max + 1).padStart(4, "0")}`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Suppliers!A:G",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[newId, supplierName, phone || "", address || "", "0", notes || "", "TRUE"]],
      },
    });

    return NextResponse.json({ success: true, supplierId: newId, message: "تم إضافة المورد" });
  } catch (error) {
    console.error("POST /api/finance/suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/finance/suppliers — soft-delete supplier
export async function DELETE(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    if (!supplierId) {
      return NextResponse.json({ success: false, error: "معرف المورد مطلوب" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === supplierId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "المورد غير موجود" }, { status: 404 });
    }
    const sheetRow = idx + 1;
    const current = rows[idx];
    // Soft delete: set isActive to FALSE
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Suppliers!G${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [["FALSE"]] },
    });

    return NextResponse.json({ success: true, message: "تم حذف المورد" });
  } catch (error) {
    console.error("DELETE /api/finance/suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/finance/suppliers — update supplier
export async function PUT(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { supplierId, supplierName, phone, address, notes, isActive } = body;
    if (!supplierId || !supplierName) {
      return NextResponse.json({ success: false, error: "المعرف والاسم مطلوبان" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Suppliers!A:G",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === supplierId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "المورد غير موجود" }, { status: 404 });
    }
    const sheetRow = idx + 1;
    const current = rows[idx];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Suppliers!A${sheetRow}:G${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          supplierId,
          supplierName,
          phone ?? current[2] ?? "",
          address ?? current[3] ?? "",
          current[4] || "0",
          notes ?? current[5] ?? "",
          isActive !== undefined ? (isActive ? "TRUE" : "FALSE") : current[6] || "TRUE",
        ]],
      },
    });

    return NextResponse.json({ success: true, message: "تم تحديث المورد" });
  } catch (error) {
    console.error("PUT /api/finance/suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
