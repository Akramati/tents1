import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// POST /api/renumber — إعادة ترقيم أصناف المخزون وتحديث كافة المراجع المرتبطة
export async function POST() {
  try {
    const results = [];

    // --- 1. قراءة المخزون الحالي ---
    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:D",
    });
    const allRows = invRes.data.values || [];
    if (allRows.length === 0) {
      return NextResponse.json({ success: false, error: "لا توجد بيانات" }, { status: 400 });
    }

    const header = allRows[0];
    const dataRows = allRows.slice(1).filter((r) => r[0]);

    // بناء خريطة الترجمة [المعرف القديم -> المعرف الجديد]
    const idMap = {};
    const newRows = dataRows.map((row, idx) => {
      const oldId = row[0];
      const newId = (idx + 1).toString();
      idMap[oldId] = newId;
      return [newId, row[1] || "", row[2] || "0", row[3] || "0"];
    });

    // مسح النطاق بالكامل أولاً لمنع بقاء أسطر قديمة
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:D",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Inventory_Stock!A:D",
      valueInputOption: "RAW",
      requestBody: { values: [header, ...newRows] },
    });
    results.push(`Inventory_Stock: تم إعادة ترقيم ${dataRows.length} صنف`);

    // --- 2. تحديث Package_Config ---
    const pkgCfgRaw = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Package_Config!A:H",
    });
    const pkgCfgRows = pkgCfgRaw.data.values || [];
    if (pkgCfgRows.length > 0) {
      let updatedCount = 0;
      const updatedCfgRows = pkgCfgRows.map((row, i) => {
        if (i === 0) return row;
        const newId = idMap[row[3]];
        if (newId) { updatedCount++; return [row[0], row[1], row[2], newId, row[4] || "0", row[5] || "0", row[6] || "0", row[7] || ""]; }
        return row;
      });
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "Package_Config!A:H" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Package_Config!A:H",
        valueInputOption: "RAW",
        requestBody: { values: updatedCfgRows },
      });
      results.push(`Package_Config: تم تحديث ${updatedCount} مرجع`);
    }

    // --- 3. تحديث Rented_Items ---
    const rentRaw = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Rented_Items!A:E",
    });
    const rentRows = rentRaw.data.values || [];
    if (rentRows.length > 0) {
      let updatedCount = 0;
      const updatedRentRows = rentRows.map((row, i) => {
        if (i === 0) return row;
        const newId = idMap[row[2]];
        if (newId) { updatedCount++; return [row[0], row[1], newId, row[3] || "0", row[4] || "0"]; }
        return row;
      });
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "Rented_Items!A:E" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A:E",
        valueInputOption: "RAW",
        requestBody: { values: updatedRentRows },
      });
      results.push(`Rented_Items: تم تحديث ${updatedCount} مرجع`);
    }

    // --- 4. تحديث Asset_Maintenance_Logs (سجل الصيانة) ---
    const maintRaw = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Asset_Maintenance_Logs!A:E",
    });
    const maintRows = maintRaw.data.values || [];
    if (maintRows.length > 0) {
      let updatedCount = 0;
      const updatedMaintRows = maintRows.map((row, i) => {
        if (i === 0) return row;
        const newId = idMap[row[1]];
        if (newId) { updatedCount++; return [row[0], newId, row[2] || "", row[3] || "", row[4] || ""]; }
        return row;
      });
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "Asset_Maintenance_Logs!A:E" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Asset_Maintenance_Logs!A:E",
        valueInputOption: "RAW",
        requestBody: { values: updatedMaintRows },
      });
      results.push(`Asset_Maintenance_Logs: تم تحديث ${updatedCount} مرجع صيانة`);
    }

    // --- 5. تحديث General_Expenses_Log (المصروفات العامة) ---
    const genExpRaw = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "General_Expenses_Log!A:F",
    });
    const genExpRows = genExpRaw.data.values || [];
    if (genExpRows.length > 0) {
      let updatedCount = 0;
      const updatedGenRows = genExpRows.map((row, i) => {
        if (i === 0) return row;
        const newId = idMap[row[1]];
        if (newId) { updatedCount++; return [row[0], newId, row[2] || "", row[3] || "0", row[4] || "", row[5] || ""]; }
        return row;
      });
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "General_Expenses_Log!A:F" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "General_Expenses_Log!A:F",
        valueInputOption: "RAW",
        requestBody: { values: updatedGenRows },
      });
      results.push(`General_Expenses_Log: تم تحديث ${updatedCount} مرجع مصروفات`);
    }

    return NextResponse.json({
      success: true,
      message: "تم إعادة الترقيم بأمان وتحديث كافة العلاقات بنجاح",
      results,
      idMap,
    });
  } catch (error) {
    console.error("Renumber error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
