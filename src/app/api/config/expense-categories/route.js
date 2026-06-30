import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "Expense_Categories!A:F";

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Expense_Categories!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Expense_Categories" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Expense_Categories!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Category", "SubCategory", "LinkedBookingType", "DetailName", "EntryType", "IsActive"]],
      },
    });
  }
}

// GET /api/config/expense-categories
export async function GET() {
  try {
    await ensureSheet();
    const rows = await getSheetData("Expense_Categories", "A2:F");
    const items = rows
      .filter((r) => r[5] !== "FALSE")
      .map((r) => ({
        category: r[0] || "",
        subCategory: r[1] || "",
        linkedBookingType: r[2] || "",
        detailName: r[3] || "",
        entryType: r[4] || "expense",
      }));
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/config/expense-categories
export async function POST(request) {
  try {
    await ensureSheet();
    const body = await request.json();
    const { category, subCategory, linkedBookingType, detailName, entryType } = body;
    if (!category) {
      return NextResponse.json({ success: false, error: "التصنيف الرئيسي مطلوب" }, { status: 400 });
    }

    const isActive = "TRUE";
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[category, subCategory || "", linkedBookingType || "", detailName || "", entryType || "expense", isActive]],
      },
    });

    return NextResponse.json({ success: true, message: "تم إضافة التصنيف" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/config/expense-categories
export async function PUT(request) {
  try {
    await ensureSheet();
    const body = await request.json();
    const { search, category, subCategory, linkedBookingType, detailName, entryType } = body;
    if (!search) {
      return NextResponse.json({ success: false, error: "بيانات البحث مطلوبة" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r) =>
      r[0] === search.category && r[1] === (search.subCategory || "") &&
      r[2] === (search.linkedBookingType || "") && r[3] === (search.detailName || "")
    );
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "التصنيف غير موجود" }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Expense_Categories!A${rowIdx + 1}:F${rowIdx + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          category ?? rows[rowIdx][0],
          subCategory ?? rows[rowIdx][1] ?? "",
          linkedBookingType ?? rows[rowIdx][2] ?? "",
          detailName ?? rows[rowIdx][3] ?? "",
          entryType ?? rows[rowIdx][4] ?? "expense",
          rows[rowIdx][5] ?? "TRUE",
        ]],
      },
    });

    return NextResponse.json({ success: true, message: "تم تحديث التصنيف" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/config/expense-categories
export async function DELETE(request) {
  try {
    await ensureSheet();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subCategory = searchParams.get("subCategory") || "";
    const linkedBookingType = searchParams.get("linkedBookingType") || "";
    const detailName = searchParams.get("detailName") || "";

    if (!category) {
      return NextResponse.json({ success: false, error: "التصنيف مطلوب" }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r) =>
      r[0] === category && r[1] === subCategory &&
      r[2] === linkedBookingType && r[3] === detailName
    );
    if (rowIdx < 0) {
      return NextResponse.json({ success: false, error: "التصنيف غير موجود" }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Expense_Categories!F${rowIdx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [["FALSE"]] },
    });

    return NextResponse.json({ success: true, message: "تم إخفاء التصنيف" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
