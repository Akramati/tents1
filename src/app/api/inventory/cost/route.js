import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData } from "@/lib/sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const itemIds = searchParams.get("itemIds");
    const itemName = searchParams.get("itemName");

    const invRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Inventory_Stock!A2:E",
    });
    const invRows = invRes.data.values || [];

    let targetItems = invRows.map((r) => ({
      itemId: r[0], itemName: r[1] || "", totalQuantity: parseInt(r[2] || 0), deficit: parseInt(r[4] || 0),
    }));
    if (itemId) targetItems = targetItems.filter((i) => i.itemId === itemId);
    if (itemIds) {
      const ids = itemIds.split(",").map((s) => s.trim()).filter(Boolean);
      targetItems = targetItems.filter((i) => ids.includes(i.itemId));
    }
    if (itemName) targetItems = targetItems.filter((i) => i.itemName.includes(itemName));

    // 1. Aggregate from Supplier_Purchases inventoryItems
    const purchRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A2:L",
    });
    const purchRows = purchRes.data.values || [];

    // Build set of cancelled purchase IDs
    const cancelledPurchases = new Set();
    for (const r of purchRows) {
      if (r[8] === "cancelled") cancelledPurchases.add(r[0]);
    }

    // 2. Aggregate from Finance_Ledger (notes with [invId:X])
    const ledgerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A2:M",
    });
    const ledgerRows = ledgerRes.data.values || [];

    const results = targetItems.map((item) => {
      const purchases = [];
      let purchaseTotal = 0;
      let purchaseQty = 0;

      for (const r of purchRows) {
        if (r[8] === "cancelled") continue;
        try {
          const invItems = JSON.parse(r[10] || "[]");
          for (const inv of invItems) {
            let matched = false;
            if (inv.itemId === item.itemId) {
              matched = true;
            } else if (!inv.itemId && inv.itemName) {
              const nameWords = inv.itemName.split(/[\s-]+/).filter(w => w.length > 2);
              const stockWords = item.itemName.split(/[\s-]+/).filter(w => w.length > 2);
              const common = nameWords.filter(w => stockWords.some(s => s.includes(w) || w.includes(s)));
              if (common.length >= 1) matched = true;
            }
            if (!matched) continue;
              const amt = parseFloat(inv.amount) || 0;
              const qty = parseInt(inv.quantity) || 0;
              purchases.push({
                purchaseId: r[0],
                date: r[2] || "",
                description: r[3] || "",
                itemName: inv.itemName,
                quantity: qty,
                unitCost: parseFloat(inv.unitCost) || (qty > 0 ? amt / qty : 0),
                amount: amt,
              });
              purchaseTotal += amt;
              purchaseQty += qty;
          }
        } catch {}
      }

      const expenses = [];
      let expenseTotal = 0;
      const expenseIdPattern = new RegExp(`\\[invId:${item.itemId}\\]`, "i");

      for (const r of ledgerRows) {
        const notes = r[6] || "";
        // Skip if this ledger entry references a cancelled purchase
        const purchaseMatch = notes.match(/PUR-\d+/);
        if (purchaseMatch && cancelledPurchases.has(purchaseMatch[0])) continue;
        if (expenseIdPattern.test(notes)) {
          const amt = parseFloat(r[4] || 0);
          expenses.push({
            journalId: r[0],
            date: r[1] || "",
            accountCode: r[2] || "",
            amount: amt,
            notes,
          });
          expenseTotal += amt;
        }
      }

      const totalCost = purchaseTotal + expenseTotal;
      const effectiveQty = Math.max(1, item.totalQuantity - item.deficit);
      const unitCost = effectiveQty > 0 ? totalCost / effectiveQty : 0;

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        totalQuantity: item.totalQuantity,
        deficit: item.deficit,
        totalCost,
        unitCost: Math.round(unitCost * 100) / 100,
        breakdown: { purchases, expenses },
      };
    });

    return NextResponse.json({ success: true, items: results });
  } catch (error) {
    console.error("Inventory cost API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
