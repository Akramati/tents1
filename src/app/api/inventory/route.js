import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/inventory - list all items
export async function GET() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A2:D",
    });

    const rows = res.data.values || [];
    const items = rows.map((row) => ({
      itemId: row[0],
      itemName: row[1] || "",
      totalQuantity: parseInt(row[2] || 0),
      underMaintenance: parseInt(row[3] || 0),
      availableQuantity: parseInt(row[2] || 0) - parseInt(row[3] || 0),
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Inventory GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/inventory - add new item
export async function POST(request) {
  try {
    const body = await request.json();
    const { itemName, totalQuantity = 0, underMaintenance = 0 } = body;

    if (!itemName) {
      return NextResponse.json(
        { success: false, error: "اسم الصنف مطلوب" },
        { status: 400 }
      );
    }

    // Determine next ID
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:A",
    });
    const rows = existing.data.values || [];
    let maxItemId = 0;
    for (const r of rows) {
      const n = parseInt(r[0]);
      if (n > maxItemId) maxItemId = n;
    }
    const nextId = (maxItemId + 1).toString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:D",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[nextId, itemName, totalQuantity.toString(), underMaintenance.toString()]],
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        itemId: nextId,
        itemName,
        totalQuantity,
        underMaintenance,
        availableQuantity: totalQuantity - underMaintenance,
      },
    });
  } catch (error) {
    console.error("Inventory POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory - delete item
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ success: false, error: "معرف الصنف مطلوب" }, { status: 400 });
    }

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:A",
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === itemId.toString());
    if (rowIndex < 0) {
      return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
    }

    // Clear row content (shift up via deletion not supported, so clear values)
    const sheetRow = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory_Stock!A${sheetRow}:D${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [["", "", "", ""]] },
    });

    return NextResponse.json({ success: true, message: "تم حذف الصنف" });
  } catch (error) {
    console.error("Inventory DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/inventory - update item
export async function PUT(request) {
  try {
    const body = await request.json();
    const { itemId, itemName, totalQuantity, underMaintenance } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "معرف الصنف مطلوب" },
        { status: 400 }
      );
    }

    // Find the row
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:A",
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === itemId.toString());

    if (rowIndex < 0) {
      return NextResponse.json(
        { success: false, error: "الصنف غير موجود" },
        { status: 404 }
      );
    }

    const sheetRow = rowIndex + 1; // rowIndex 0 = header(A1), so rowIndex 1 = A2
    const name = itemName ?? rows[rowIndex][1] ?? "";
    const qty = (totalQuantity ?? parseInt(rows[rowIndex][2] || 0)).toString();
    const maint = (underMaintenance ?? parseInt(rows[rowIndex][3] || 0)).toString();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory_Stock!A${sheetRow}:D${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[itemId.toString(), name, qty, maint]],
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        itemId: itemId.toString(),
        itemName: name,
        totalQuantity: parseInt(qty),
        underMaintenance: parseInt(maint),
        availableQuantity: parseInt(qty) - parseInt(maint),
      },
    });
  } catch (error) {
    console.error("Inventory PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
