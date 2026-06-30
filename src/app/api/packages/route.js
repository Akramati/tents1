import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData } from "@/lib/sheets";
import { rowsToPackages, packagesToRows } from "@/lib/package-engine";
import { requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Simple in-memory cache for inventory data (shared across endpoints)
let _invCache2 = { data: null, ts: 0 };
const CACHE_TTL = 30000;

async function getCachedInventory() {
  const now = Date.now();
  if (_invCache2.data && now - _invCache2.ts < CACHE_TTL) return _invCache2.data;
  const invRows = await getSheetData("Inventory_Stock", "A2:D");
  const invMap = {};
  for (const r of invRows) invMap[r[0]] = { itemName: r[1] || "" };
  _invCache2 = { data: invMap, ts: now };
  return invMap;
}

// GET /api/packages — list all structured packages with widths + items
export async function GET(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const [invMap, configRows] = await Promise.all([
      getCachedInventory(),
      getSheetData("Package_Config", "A2:H"),
    ]);
    const packages = rowsToPackages(configRows, invMap);
    return NextResponse.json({ success: true, packages });
  } catch (error) {
    console.error("GET /api/packages error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل الباقات" },
      { status: 500 }
    );
  }
}

// POST /api/packages — create or replace a package (full structure)
export async function POST(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { packageName, widths } = body;

    if (!packageName || !widths || Object.keys(widths).length === 0) {
      return NextResponse.json(
        { success: false, error: "اسم الباقة والعروض والأصناف مطلوبة" },
        { status: 400 }
      );
    }

    // Find next package ID
    const existing = await getSheetData("Package_Config", "A2:A");
    let maxId = 0;
    for (const r of existing) {
      const n = parseInt(r[0]);
      if (n > maxId) maxId = n;
    }
    const newId = (maxId + 1).toString();

    // Build rows
    const rows = [];
    for (const [width, items] of Object.entries(widths)) {
      for (const item of items) {
        rows.push([
          newId,
          packageName,
          width,
          item.itemId,
          (item.baseQty || 0).toString(),
          (item.step5Qty || 0).toString(),
          (item.step10Qty || 0).toString(),
          item.itemName || "",
        ]);
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Package_Config!A:H",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return NextResponse.json({
      success: true,
      message: "تم إنشاء الباقة بنجاح",
      packageId: newId,
      packageName,
    });
  } catch (error) {
    console.error("POST /api/packages error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إنشاء الباقة" },
      { status: 500 }
    );
  }
}

// PUT /api/packages — update a package (delete old rows, insert new)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { packageName, oldPackageName, widths } = body;

    if (!packageName || !widths) {
      return NextResponse.json(
        { success: false, error: "اسم الباقة مطلوب" },
        { status: 400 }
      );
    }

    const deleteName = oldPackageName || packageName;

    // Read all config rows
    const allRows = await getSheetData("Package_Config", "A:H");
    if (allRows.length === 0) {
      return NextResponse.json({ success: false, error: "لا توجد بيانات" }, { status: 404 });
    }

    // Filter out old rows for this package, keep header
    const headerRow = allRows[0];
    const remaining = [headerRow, ...allRows.slice(1).filter((r) => r[1] !== deleteName)];

    // Build new rows
    let maxId = 0;
    for (const r of allRows.slice(1)) {
      if (r[1] !== deleteName) {
        const n = parseInt(r[0]);
        if (n > maxId) maxId = n;
      }
    }
    // Also check if we need a package ID from remaining
    let pkgId = "0";
    for (const r of allRows.slice(1)) {
      if (r[1] === packageName || r[1] === deleteName) {
        pkgId = r[0];
        break;
      }
    }
    if (pkgId === "0") pkgId = (maxId + 1).toString();

    const invRows = await getSheetData("Inventory_Stock", "A2:D");
    const invMap = {};
    for (const r of invRows) invMap[r[0]] = { itemName: r[1] || "" };

    for (const [width, items] of Object.entries(widths)) {
      for (const item of items) {
        const inv = invMap[item.itemId];
        remaining.push([
          pkgId,
          packageName,
          width,
          item.itemId,
          (item.baseQty || 0).toString(),
          (item.step5Qty || 0).toString(),
          (item.step10Qty || 0).toString(),
          item.itemName || (inv ? inv.itemName : ""),
        ]);
      }
    }

    // Rewrite entire sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Package_Config!A:H",
      valueInputOption: "RAW",
      requestBody: { values: remaining },
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث الباقة بنجاح",
      packageName,
    });
  } catch (error) {
    console.error("PUT /api/packages error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث الباقة" },
      { status: 500 }
    );
  }
}

// DELETE /api/packages — حذف باقة باسمها بأمان مع فحص التعارضات
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageName = searchParams.get("name");

    if (!packageName) {
      return NextResponse.json(
        { success: false, error: "اسم الباقة مطلوب" },
        { status: 400 }
      );
    }

    // 1. جلب الحجوزات للتحقق من التعارضات
    const bookingsRows = await getSheetData("Bookings", "A2:N");

    // 2. تصفية الحجوزات النشطة أو المعلقة التي تستخدم هذه الباقة
    const activeConflicts = bookingsRows
      .filter((row) => {
        const status = (row[8] || "").trim();
        const packageUsed = (row[12] || "").trim();
        const isActive = status !== "مكتمل" && status !== "ملغي";
        return isActive && packageUsed === packageName;
      })
      .map((row) => row[0]);

    // 3. منع الحذف إذا وجد أي تعارض
    if (activeConflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن حذف الباقة لأنها مستخدمة في حجوزات نشطة أو معلقة (${activeConflicts.join(", ")})`,
        },
        { status: 400 }
      );
    }

    // 4. إذا كان الحذف آمناً، نقرأ الباقات ونحذفها
    const allRows = await getSheetData("Package_Config", "A:H");
    if (allRows.length === 0) {
      return NextResponse.json({ success: false, error: "لا توجد بيانات" }, { status: 404 });
    }

    const remaining = [allRows[0], ...allRows.slice(1).filter((r) => r[1] !== packageName)];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Package_Config!A:H",
      valueInputOption: "RAW",
      requestBody: { values: remaining },
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف الباقة بنجاح",
    });
  } catch (error) {
    console.error("DELETE /api/packages error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف الباقة" },
      { status: 500 }
    );
  }
}
