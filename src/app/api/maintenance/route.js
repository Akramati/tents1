import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/maintenance — list all maintenance logs with item names
export async function GET() {
  try {
    const [logsRes, invRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Asset_Maintenance_Logs!A2:E",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Inventory_Stock!A2:D",
      }),
    ]);

    const invMap = {};
    for (const r of invRes.data.values || []) {
      invMap[r[0]] = r[1] || "";
    }

    const logs = (logsRes.data.values || []).map((row) => ({
      logId: row[0],
      itemId: row[1],
      itemName: invMap[row[1]] || `صنف #${row[1]}`,
      startDate: row[2] || "",
      endDate: row[3] || "",
      reason: row[4] || "",
    }));

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Maintenance GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/maintenance — update a log (e.g., set endDate)
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { logId, endDate } = body;

    if (!logId) {
      return NextResponse.json(
        { success: false, error: "معرف السجل مطلوب" },
        { status: 400 }
      );
    }

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Asset_Maintenance_Logs!A:E",
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === logId.toString());

    if (rowIndex < 0) {
      return NextResponse.json(
        { success: false, error: "السجل غير موجود" },
        { status: 404 }
      );
    }

    const sheetRow = rowIndex + 1;
    const current = rows[rowIndex];

    const newEndDate = endDate ?? current[3] ?? "";
    const updated = [
      current[0],
      current[1] || "",
      current[2] || "",
      newEndDate,
      current[4] || "",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Asset_Maintenance_Logs!A${sheetRow}:E${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [updated] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Maintenance PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
