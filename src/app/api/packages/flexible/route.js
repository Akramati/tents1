import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData } from "@/lib/sheets";
import { requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const FLEX_RANGE = "Package_Flexible!A2:F";
const FLEX_HEADERS = ["TypeName", "PackageName", "ItemID", "BaseQty", "DimDef", "WidthDef"];

const parseDimDef = (raw) => { try { return JSON.parse(raw || "[]"); } catch { return []; } };
const parseWidthDef = (raw) => { try { return JSON.parse(raw || "{}"); } catch { return {}; } };

const autoMigrate = async () => {
  const hdr = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Package_Flexible!A1:F1",
  });
  const headers = hdr.data.values?.[0] || [];
  if (!headers.includes("WidthDef")) {
    const col = String.fromCharCode(64 + headers.length + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Package_Flexible!${col}1`,
      valueInputOption: "RAW", requestBody: { values: [["WidthDef"]] },
    });
  }
};

// GET /api/packages/flexible?typeName=كوش — list all packages for a type
export async function GET(request) {
  try {
    await autoMigrate();
    const { searchParams } = new URL(request.url);
    const typeName = searchParams.get("typeName");

    const rows = await getSheetData("Package_Flexible", "A2:F");
    let all = rows.map((r) => ({
      typeName: r[0] || "",
      packageName: r[1] || "",
      itemId: r[2] || "",
      baseQty: parseInt(r[3] || 0),
      dimDef: parseDimDef(r[4]),
      widthDef: parseWidthDef(r[5]),
    }));

    if (typeName) all = all.filter((p) => p.typeName === typeName);

    // Group by packageName
    const packages = [];
    const grouped = {};
    for (const p of all) {
      if (!grouped[p.packageName]) {
        grouped[p.packageName] = { packageName: p.packageName, typeName: p.typeName, items: [], dims: [], widths: [] };
      }
      grouped[p.packageName].items.push({ itemId: p.itemId, baseQty: p.baseQty, dimDef: p.dimDef, widthDef: p.widthDef });
      // Collect unique dims
      for (const d of p.dimDef) {
        if (!grouped[p.packageName].dims.some((dd) => dd.dim === d.dim)) {
          grouped[p.packageName].dims.push({ dim: d.dim, step: d.step });
        }
      }
      // Collect unique widths
      for (const w of Object.keys(p.widthDef)) {
        if (!grouped[p.packageName].widths.includes(w)) {
          grouped[p.packageName].widths.push(w);
        }
      }
    }
    for (const pkg of Object.values(grouped)) {
      pkg.widths.sort((a, b) => parseFloat(a) - parseFloat(b));
      packages.push(pkg);
    }

    const flat = searchParams.get("flat") === "true";
    return NextResponse.json({ success: true, packages: flat ? all : packages });
  } catch (error) {
    console.error("GET /api/packages/flexible error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/packages/flexible — save a package (replace all items)
export async function POST(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { typeName, packageName, items, dims } = await request.json();
    if (!typeName || !packageName || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: "اسم النوع واسم الباقة والأصناف مطلوبة" }, { status: 400 });
    }

    await autoMigrate();
    const allRows = await getSheetData("Package_Flexible", "A:F");
    const remaining = allRows.filter((r) => !(r[0] === typeName && r[1] === packageName));

    const newRows = [];
    for (const item of items) {
      newRows.push([
        typeName,
        packageName,
        item.itemId,
        (item.baseQty || 0).toString(),
        JSON.stringify(item.dimDef || dims || []),
        JSON.stringify(item.widthDef || {}),
      ]);
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID, range: "Package_Flexible!A:F",
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Package_Flexible!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [FLEX_HEADERS, ...remaining, ...newRows],
      },
    });

    return NextResponse.json({ success: true, message: `تم حفظ الباقة ${packageName}` });
  } catch (error) {
    console.error("POST /api/packages/flexible error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/packages/flexible?typeName=كوش&packageName=كوشة+ورد
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeName = searchParams.get("typeName");
    const packageName = searchParams.get("packageName");

    if (!typeName || !packageName) {
      return NextResponse.json({ success: false, error: "اسم النوع واسم الباقة مطلوبان" }, { status: 400 });
    }

    await autoMigrate();
    const allRows = await getSheetData("Package_Flexible", "A:F");
    const remaining = allRows.filter((r) => !(r[0] === typeName && r[1] === packageName));

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID, range: "Package_Flexible!A:F",
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Package_Flexible!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [FLEX_HEADERS, ...remaining],
      },
    });

    return NextResponse.json({ success: true, message: `تم حذف الباقة ${packageName}` });
  } catch (error) {
    console.error("DELETE /api/packages/flexible error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}