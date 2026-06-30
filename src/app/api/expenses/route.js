import { NextResponse } from "next/server";
import {
  getSheetData,
  getBookingExpenses,
  addBookingExpense,
  getGeneralExpenses,
  addGeneralExpense,
} from "@/lib/sheets";
import { requireAdmin } from "@/lib/auth";

// GET /api/expenses
// ?bookingId=X → booking expenses
// ?type=general&from=X&to=Y → general expenses
export async function GET(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");
    const type = searchParams.get("type");

    if (bookingId) {
      const expenses = await getBookingExpenses(bookingId);
      return NextResponse.json({ success: true, expenses });
    }

    if (type === "general") {
      const from = searchParams.get("from") || "";
      const to = searchParams.get("to") || "";
      const expenses = await getGeneralExpenses(from, to);
      return NextResponse.json({ success: true, expenses });
    }

    // Return both
    const [bookingExps, generalExps] = await Promise.all([
      getBookingExpenses(),
      getGeneralExpenses(),
    ]);
    return NextResponse.json({
      success: true,
      bookingExpenses: bookingExps,
      generalExpenses: generalExps,
    });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل المصروفات" },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");
    if (!logId) {
      return NextResponse.json({ success: false, error: "معرف المصروف مطلوب" }, { status: 400 });
    }

    const { sheets } = await import("@/lib/google");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "General_Expenses_Log!A:A",
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === logId.toString());
    if (rowIndex < 0) {
      return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });
    }

    const sheetRow = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `General_Expenses_Log!A${sheetRow}:F${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [["", "", "", "", "", ""]] },
    });

    return NextResponse.json({ success: true, message: "تم حذف المصروف" });
  } catch (error) {
    console.error("DELETE /api/expenses error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/expenses
export async function PUT(request) {
  try {
    const body = await request.json();
    const { logId, expenseCategory, amount, dateSpent, notes } = body;
    if (!logId) {
      return NextResponse.json({ success: false, error: "معرف المصروف مطلوب" }, { status: 400 });
    }

    const { sheets } = await import("@/lib/google");
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "General_Expenses_Log!A:A",
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === logId.toString());
    if (rowIndex < 0) {
      return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });
    }

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "General_Expenses_Log!A2:F",
    });
    const existingRows = existing.data.values || [];
    const idx = existingRows.findIndex((r) => r[0] === logId.toString());
    const old = idx >= 0 ? existingRows[idx] : ["", "", "", "", "", ""];
    const sheetRow = rowIndex + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `General_Expenses_Log!A${sheetRow}:F${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          logId.toString(),
          old[1] || "",
          expenseCategory ?? old[2] ?? "",
          (amount ?? old[3] ?? "0").toString(),
          dateSpent ?? old[4] ?? "",
          notes ?? old[5] ?? "",
        ]],
      },
    });

    return NextResponse.json({ success: true, message: "تم تحديث المصروف" });
  } catch (error) {
    console.error("PUT /api/expenses error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { type, bookingId, expenseType, amount, dateSpent, notes, itemId, expenseCategory, entryType } = body;

    if (!type || !amount) {
      return NextResponse.json(
        { success: false, error: "نوع القيد والمبلغ مطلوبان" },
        { status: 400 }
      );
    }

    let amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "المبلغ غير صالح" },
        { status: 400 }
      );
    }

    // Income entries are stored as negative amounts
    if (entryType === "income") {
      amountNum = -amountNum;
    }

    if (type === "booking") {
      if (!bookingId) {
        return NextResponse.json(
          { success: false, error: "رقم الحجز مطلوب لمصروفات الحجز" },
          { status: 400 }
        );
      }
      await addBookingExpense({
        bookingId,
        expenseType: expenseType || (entryType === "income" ? "إيراد" : "نقل"),
        amountPaid: amountNum,
        notes: notes || "",
      });
    } else if (type === "general") {
      const cat = expenseCategory || (entryType === "income" ? "إيرادات" : "أخرى");
      await addGeneralExpense({
        itemId: itemId || "",
        expenseCategory: cat,
        amount: amountNum,
        dateSpent: dateSpent || new Date().toLocaleDateString("en-CA"),
        notes: notes || "",
      });
    } else {
      return NextResponse.json(
        { success: false, error: "نوع القيد غير معروف (booking/general)" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: entryType === "income"
        ? "تم تسجيل الإيراد بنجاح"
        : "تم تسجيل المصروف بنجاح",
    });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تسجيل القيد" },
      { status: 500 }
    );
  }
}
