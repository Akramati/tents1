import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import { rowsToPackages, calculateItems } from "@/lib/package-engine";

// Simple in-memory cache to avoid redundant Inventory_Stock reads
let _invCache = { data: null, ts: 0 };
const CACHE_TTL = 30000; // 30 seconds

async function getCachedInventory() {
  const now = Date.now();
  if (_invCache.data && now - _invCache.ts < CACHE_TTL) return _invCache.data;
  const invRows = await getSheetData("Inventory_Stock", "A2:D");
  const invMap = {};
  for (const r of invRows) invMap[r[0]] = { itemName: r[1] || "" };
  _invCache = { data: invMap, ts: now };
  return invMap;
}

// GET /api/packages/calculate?packageName=X&width=Y&length=Z
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageName = searchParams.get("packageName");
    const width = searchParams.get("width");
    const length = searchParams.get("length");

    if (!packageName || !width || !length) {
      return NextResponse.json(
        { success: false, error: "اسم الباقة والعرض والطول مطلوبون" },
        { status: 400 }
      );
    }

    // Fetch inventory (cached) for name resolution
    const invMap = await getCachedInventory();

    // Fetch package config
    const configRows = await getSheetData("Package_Config", "A2:H");
    const packages = rowsToPackages(configRows, invMap);
    const pkg = packages.find((p) => p.packageName === packageName);

    if (!pkg) {
      return NextResponse.json(
        { success: false, error: `الباقة "${packageName}" غير موجودة` },
        { status: 404 }
      );
    }

    const widthItems = pkg.widths[width];
    if (!widthItems) {
      return NextResponse.json(
        { success: false, error: `العرض ${width} غير مدعوم لهذه الباقة` },
        { status: 404 }
      );
    }

    const calculated = calculateItems(widthItems, parseFloat(length));

    return NextResponse.json({
      success: true,
      packageName,
      width,
      length: parseFloat(length),
      items: calculated,
    });
  } catch (error) {
    console.error("Calculate error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
