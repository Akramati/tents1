import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function readCompletionRows() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Item_Completions!A2:G",
    });
    return res.data.values || [];
  } catch {
    return [];
  }
}

async function ensureCompletionTab() {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const titles = spreadsheet.data.sheets.map((s) => s.properties.title);
    if (titles.includes("Item_Completions")) return;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Item_Completions" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Item_Completions!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["ID", "BookingID", "ItemID", "ReceivedQty", "DamagedQty", "Distribution", "UpdatedAt"]] },
    });
  } catch (e) {
    console.error("ensureCompletionTab error:", e.message);
  }
}

// GET /api/bookings/field/completion?bookingId=HL-123 — load saved per-item completion state
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId مطلوب" }, { status: 400 });
    }

    let rows = await readCompletionRows();
    const items = rows
      .filter((r) => r[1] === bookingId)
      .map((r) => ({
        id: r[0],
        bookingId: r[1],
        itemId: r[2],
        receivedQty: parseInt(r[3] || 0),
        damagedQty: parseInt(r[4] || 0),
        distribution: (() => {
          try { return JSON.parse(r[5] || "{}"); } catch { return {}; }
        })(),
      }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("GET /api/bookings/field/completion error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/bookings/field/completion — save per-item completion state (received/damaged)
// Without finalize=true this does NOT close the booking; it stays on the field board
// until all items are received or damaged (fully resolved).
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { bookingId, items = [] } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "رقم الحجز مطلوب" }, { status: 400 });
    }

    await ensureCompletionTab();

    let rows = await readCompletionRows();
    const rowIndexMap = {};
    rows.forEach((r, i) => {
      if (r[1] === bookingId) rowIndexMap[r[2]] = { sheetRow: i + 2, existing: r };
    });
    let maxId = 0;
    for (const r of rows) { const n = parseInt(r[0]); if (n > maxId) maxId = n; }

    const today = new Date().toLocaleDateString("en-CA");

    for (const it of items) {
      const itemId = it.itemId;
      const receivedQty = parseInt(it.receivedQty || 0);
      const damagedQty = parseInt(it.damagedQty || 0);
      const distribution = it.distribution || {};
      const values = [
        (rowIndexMap[itemId]?.existing?.[0]) || (++maxId).toString(),
        bookingId,
        itemId,
        receivedQty.toString(),
        damagedQty.toString(),
        JSON.stringify(distribution),
        today,
      ];
      if (rowIndexMap[itemId]) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Item_Completions!A${rowIndexMap[itemId].sheetRow}:G${rowIndexMap[itemId].sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [values] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Item_Completions!A:G",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [values] },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "تم حفظ حالة استلام الأصناف — الحجز ما زال في الميدان",
    });
  } catch (error) {
    console.error("POST /api/bookings/field/completion error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
