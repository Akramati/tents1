import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

// GET /api/packages/flexible/calculate?typeName=كوش&packageName=كوشة+ورد&dims={"width":3}
// GET /api/packages/flexible/calculate?typeName=كوش&packageName=كوشة+ورد&width=6
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeName = searchParams.get("typeName");
    const packageName = searchParams.get("packageName");
    const dimsRaw = searchParams.get("dims");
    const widthParam = searchParams.get("width");

    if (!typeName || !packageName) {
      return NextResponse.json({ success: false, error: "typeName و packageName مطلوبان" }, { status: 400 });
    }
    if (!dimsRaw && !widthParam) {
      return NextResponse.json({ success: false, error: "dims أو width مطلوب" }, { status: 400 });
    }

    const rows = await getSheetData("Package_Flexible", "A2:F");
    const packageItems = rows.filter((r) => r[0] === typeName && r[1] === packageName);

    if (packageItems.length === 0) {
      return NextResponse.json({ success: false, error: "الباقة غير موجودة لهذا النوع" }, { status: 404 });
    }

    const invRows = await getSheetData("Inventory_Stock", "A2:D");
    const invMap = {};
    for (const r of invRows) invMap[r[0]] = { itemName: r[1] || "" };

    // Width-based calculation
    if (widthParam) {
      const items = packageItems.map((r) => {
        const itemId = r[2] || "";
        let widthDef = {};
        try { widthDef = JSON.parse(r[5] || "{}"); } catch {}
        const qty = parseFloat(widthDef[widthParam] || 0);
        const inv = invMap[itemId] || {};
        return { itemId, itemName: inv.itemName || "", calculatedQuantity: qty, widthDef };
      });
      return NextResponse.json({ success: true, items, width: widthParam });
    }

    // Dim-based calculation (existing)
    let dims;
    try { dims = JSON.parse(dimsRaw); } catch {
      return NextResponse.json({ success: false, error: "dims يجب أن تكون JSON صالح" }, { status: 400 });
    }

    const items = packageItems.map((r) => {
      const itemId = r[2] || "";
      const baseQty = parseInt(r[3] || 0);
      let dimDef = [];
      try { dimDef = JSON.parse(r[4] || "[]"); } catch {}

      let extraQty = 0;
      for (const d of dimDef) {
        const step = parseFloat(d.step || 0);
        const qtyPerStep = parseFloat(d.qty || 0);
        const inputVal = parseFloat(dims[d.dim] || 0);
        if (step > 0 && inputVal > 0) {
          extraQty += Math.floor(inputVal / step) * qtyPerStep;
        }
      }

      const total = baseQty + extraQty;
      const inv = invMap[itemId] || {};
      return {
        itemId,
        itemName: inv.itemName || "",
        baseQty,
        extraQty,
        calculatedQuantity: total,
      };
    });

    return NextResponse.json({ success: true, items, dims });
  } catch (error) {
    console.error("GET /api/packages/flexible/calculate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}