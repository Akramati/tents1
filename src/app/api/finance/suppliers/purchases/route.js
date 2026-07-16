import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { addFinanceEntry, deleteFinanceEntry } from "@/lib/sheets";
import { requireAuth, requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET /api/finance/suppliers/purchases?supplierId=SUP-0001
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Supplier_Purchases!A2:L",
    });
    let rows = res.data.values || [];
    if (supplierId) rows = rows.filter((r) => r[1] === supplierId);

    const purchases = rows.map((r) => ({
      purchaseId: r[0],
      supplierId: r[1],
      date: r[2] || "",
      description: r[3] || "",
      totalAmount: parseFloat(r[4] || 0),
      paidAmount: parseFloat(r[5] || 0),
      remainingAmount: parseFloat(r[4] || 0) - parseFloat(r[5] || 0),
      costCenter: r[6] || "",
      notes: r[7] || "",
      status: r[8] || "open",
      imageUrl: r[9] || "",
      inventoryItems: r[10] ? (() => { try { return JSON.parse(r[10]); } catch { return []; } })() : [],
      journalId: r[11] || "",
    }));

    purchases.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({ success: true, purchases });
  } catch (error) {
    console.error("GET /api/finance/suppliers/purchases error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/finance/suppliers/purchases — cancel a purchase
export async function DELETE(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get("purchaseId");
    if (!purchaseId) {
      return NextResponse.json({ success: false, error: "معرف الفاتورة مطلوب" }, { status: 400 });
    }

    const pRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:L",
    });
    const pRows = pRes.data.values || [];
    const pIdx = pRows.findIndex((r) => r[0] === purchaseId);
    if (pIdx < 0) return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
    if (pRows[pIdx][8] === "cancelled") {
      return NextResponse.json({ success: false, error: "الفاتورة ملغاة بالفعل" }, { status: 400 });
    }

    const pRow = pIdx + 1;
    const supplierId = pRows[pIdx][1];
    const totalAmt = parseFloat(pRows[pIdx][4] || 0);
    const paidAmt = parseFloat(pRows[pIdx][5] || 0);
    const journalId = pRows[pIdx][11] || "";

    // Mark as cancelled
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Supplier_Purchases!I${pRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [["cancelled"]] },
    });

    // Reverse finance ledger entry for the purchase
    if (journalId) {
      await deleteFinanceEntry(journalId);
    }

    // Reverse supplier balance: subtract total amount (not just remaining)
    const supRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
    });
    const supRows = supRes.data.values || [];
    const supIdx = supRows.findIndex((r) => r[0] === supplierId);
    if (supIdx >= 0) {
      const supRow2 = supIdx + 1;
      const curBalance = parseFloat(supRows[supIdx][4] || 0);
      const newBalance = curBalance - totalAmt;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `Suppliers!E${supRow2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newBalance.toString()]] },
      });
    }

    // Record cancellation transaction
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:A",
    });
    const existingTrans = transRes.data.values || [];
    let maxTrans = 0;
    for (const r of existingTrans) { const n = parseInt(r[0]); if (n > maxTrans) maxTrans = n; }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:G",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[(maxTrans + 1).toString(), supplierId, new Date().toLocaleDateString("en-CA"),
          "cancel", totalAmt.toString(), purchaseId, `إلغاء فاتورة ${pRows[pIdx][3] || purchaseId}`]],
      },
    });

    const msg = paidAmt > 0
      ? `تم إلغاء الفاتورة بقيمة ${totalAmt.toLocaleString()} ريال. المدفوعات السابقة (${paidAmt.toLocaleString()} ريال) بقيت كرصيد مدين للمورد.`
      : "تم إلغاء الفاتورة";

    return NextResponse.json({ success: true, message: msg });
  } catch (error) {
    console.error("DELETE /api/finance/suppliers/purchases error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/finance/suppliers/purchases — record a supplier delivery (توريد)
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { supplierId, date, description, totalAmount, notes, costCenter, imageUrl, accountCode, carryFrom, inventoryItems, inventoryAction } = body;

    if (!supplierId || !description || !totalAmount || parseFloat(totalAmount) <= 0) {
      return NextResponse.json({ success: false, error: "المورد والوصف والمبلغ مطلوبون" }, { status: 400 });
    }
    if (!costCenter) {
      return NextResponse.json({ success: false, error: "مركز التكلفة مطلوب (يُحدد مرة واحدة لكل فاتورة)" }, { status: 400 });
    }
    if (!accountCode) {
      return NextResponse.json({ success: false, error: "حساب المصروف مطلوب" }, { status: 400 });
    }

    const amt = parseFloat(totalAmount);

    const supRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
    });
    const supRows = supRes.data.values || [];
    const supIdx = supRows.findIndex((r) => r[0] === supplierId);
    if (supIdx < 0) return NextResponse.json({ success: false, error: "المورد غير موجود" }, { status: 404 });

    const purchRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:J",
    });
    const allPurchRows = purchRes.data.values || [];
    let maxP = 0;
    for (const r of allPurchRows) { const n = parseInt((r[0] || "").replace("PUR-", "")); if (n > maxP) maxP = n; }
    const newPurchId = `PUR-${String(maxP + 1).padStart(4, "0")}`;

    // Carry forward: close old invoices and record transfers
    let carriedTotal = 0;
    const carriedNotes = [];
    if (carryFrom && Array.isArray(carryFrom) && carryFrom.length > 0) {
      for (const oldId of carryFrom) {
        const oldIdx = allPurchRows.findIndex(r => r[0] === oldId);
        if (oldIdx < 0) continue;
        const oldRow = oldIdx + 1;
        const oldTotal = parseFloat(allPurchRows[oldIdx][4] || 0);
        const oldPaid = parseFloat(allPurchRows[oldIdx][5] || 0);
        const oldRemaining = oldTotal - oldPaid;
        if (oldRemaining <= 0) continue;
        // Mark old invoice as carried (remains open with its balance, but linked to new invoice)
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Supplier_Purchases!I${oldRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [["carried"]] },
        });
        carriedTotal += oldRemaining;
        carriedNotes.push(`${oldId} (${oldRemaining.toLocaleString()} ر.ي)`);
        // Record transfer transaction
        const trRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:A",
        });
        const trRows = trRes.data.values || [];
        let maxTr = 0;
        for (const r of trRows) { const n = parseInt(r[0]); if (n > maxTr) maxTr = n; }
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:G",
          valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
          requestBody: {
            values: [[(maxTr + 1).toString(), supplierId, date || new Date().toLocaleDateString("en-CA"),
              "carry", oldRemaining.toString(), newPurchId, `ترحيل رصيد من ${oldId} إلى ${newPurchId}`]],
          },
        });
      }
    }

    const carryNote = carriedNotes.length > 0 ? `[مرحل من: ${carriedNotes.join("، ")}]` : "";
    const fullNotes = [notes || "", carryNote].filter(Boolean).join(" ");

    // Record in Finance_Ledger first to get journalId
    const journalId = await addFinanceEntry({
      date: date || new Date().toLocaleDateString("en-CA"),
      accountCode,
      entryType: "expense",
      amount: amt,
      cashAccountCode: "2101",
      notes: `توريد من مورد: ${supRows[supIdx][1] || supplierId} - ${description} (${newPurchId}) [${costCenter}]${carryNote ? ` ${carryNote}` : ""}`,
      costCenter,
    });

    const invItemsJson = (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0)
      ? JSON.stringify(inventoryItems) : "";
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:L",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[newPurchId, supplierId, date || new Date().toLocaleDateString("en-CA"),
          description, amt.toString(), "0", costCenter, fullNotes, "open", imageUrl || "", invItemsJson, journalId.toString()]],
      },
    });

    // Update supplier balance (only new amount, carried is already in balance)
    const supRow = supIdx + 1;
    const currentBalance = parseFloat(supRows[supIdx][4] || 0);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Suppliers!E${supRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[(currentBalance + amt).toString()]] },
    });

    // Record in Supplier_Transactions
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:A",
    });
    const existingTrans = transRes.data.values || [];
    let maxTrans = 0;
    for (const r of existingTrans) { const n = parseInt(r[0]); if (n > maxTrans) maxTrans = n; }

    const transNote = `توريد ${description} [${costCenter}]${carryNote ? ` ${carryNote}` : ""}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:H",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[(maxTrans + 1).toString(), supplierId, date || new Date().toLocaleDateString("en-CA"),
          "purchase", amt.toString(), newPurchId, transNote, "2101"]],
      },
    });

    // Process inventory items based on inventoryAction
    if (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0 && inventoryAction !== "none") {
      const invStockRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Inventory_Stock!A:E",
      });
      const invRows = invStockRes.data.values || [];

      for (const item of inventoryItems) {
        if (!item.itemName) continue;
        const qty = parseInt(item.quantity) || 1;
        const unitCost = parseFloat(item.unitCost) || 0;
        const itemAmount = parseFloat(item.amount) || 0;

        if (item.itemId && inventoryAction === "restock") {
          // Update existing item: increase quantity + weighted average cost
          const invIdx = invRows.findIndex(r => r[0] === item.itemId.toString());
          if (invIdx >= 0) {
            const sheetRow = invIdx + 1;
            const oldQty = parseInt(invRows[invIdx][2] || 0);
            const newQty = oldQty + qty;
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID, range: `Inventory_Stock!C${sheetRow}`,
              valueInputOption: "RAW",
              requestBody: { values: [[newQty.toString()]] },
            });
          }
        } else if (!item.itemId) {
          // Create new inventory item
          let maxInv = 0;
          for (const r of invRows) { const n = parseInt(r[0]); if (n > maxInv) maxInv = n; }
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: "Inventory_Stock!A:D",
            valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
            requestBody: { values: [[(maxInv + 1).toString(), item.itemName, qty.toString(), "0"]] },
          });
        }
        // Existing items in "add" mode: linked for documentation only — quantity not updated
      }
    }

    const msg = carriedTotal > 0
      ? `تم تسجيل توريد ${description} بقيمة ${amt} ريال وترحيل ${carriedTotal.toLocaleString()} ريال من الفواتير السابقة`
      : `تم تسجيل توريد ${description} بقيمة ${amt} ريال`;

    return NextResponse.json({
      success: true, message: msg,
      purchaseId: newPurchId, journalId, carriedTotal,
    });
  } catch (error) {
    console.error("POST /api/finance/suppliers/purchases error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
