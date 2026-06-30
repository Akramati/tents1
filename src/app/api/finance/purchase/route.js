import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { addFinanceEntry } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { date, accountCode, amount, cashAccountCode, notes, itemId, itemName, quantity, branch, supplierId, costCenter } = body;

    if (!date || !accountCode || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "التاريخ والحساب والمبلغ مطلوبون" }, { status: 400 });
    }

    if (!itemName) {
      return NextResponse.json({ success: false, error: "اسم الصنف مطلوب" }, { status: 400 });
    }

    const qty = parseInt(quantity) || 1;
    const amt = parseFloat(amount);
    const tk = requireAuth(request, true);

    let invItemId = itemId;

    // Create new inventory item if no itemId provided
    if (!invItemId) {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Inventory_Stock!A:A",
      });
      const rows = existing.data.values || [];
      let maxId = 0;
      for (const r of rows) { const n = parseInt(r[0]); if (n > maxId) maxId = n; }
      invItemId = (maxId + 1).toString();

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Inventory_Stock!A:D",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[invItemId, itemName, qty.toString(), "0"]] },
      });
    } else {
      // Update existing item quantity
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Inventory_Stock!A:D",
      });
      const rows = existing.data.values || [];
      const rowIndex = rows.findIndex((r) => r[0] === invItemId.toString());
      if (rowIndex < 0) {
        return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
      }
      const currentQty = parseInt(rows[rowIndex][2] || 0);
      const newQty = currentQty + qty;
      const sheetRow = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Inventory_Stock!C${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newQty.toString()]] },
      });
    }

    let journalId = null;

    if (supplierId) {
      // توريد على الحساب: لا يسجل في الدفتر النقدي
      // فقط يزيد المخزون + رصيد المورد
      const supRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Suppliers!A:G",
      });
      const supRows = supRes.data.values || [];
      const supIdx = supRows.findIndex((r) => r[0] === supplierId);
      if (supIdx >= 0) {
        const supRow = supIdx + 1;
        const currentBalance = parseFloat(supRows[supIdx][4] || 0);
        const newBalance = currentBalance + amt;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Suppliers!E${supRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[newBalance.toString()]] },
        });

        // Record in Supplier_Transactions
        const transRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Supplier_Transactions!A:A",
        });
        const existingTrans = transRes.data.values || [];
        let maxTrans = 0;
        for (const r of existingTrans) { const n = parseInt(r[0]); if (n > maxTrans) maxTrans = n; }
        const newTransId = maxTrans + 1;
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Supplier_Transactions!A:F",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            values: [[newTransId.toString(), supplierId, date, "purchase", amt.toString(), `توريد ${qty} × ${itemName}${notes ? ` - ${notes}` : ""}${costCenter ? ` [${costCenter}]` : ""}`]],
          },
        });
      }
    } else {
      // شراء نقدي: يسجل في الدفتر المالي
      const purchaseNotes = `شراء ${qty} × ${itemName}${notes ? ` - ${notes}` : ""}${costCenter ? ` [${costCenter}]` : ""}`;
      // Determine entry type based on account type
      const acctRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Chart_Of_Accounts!A:G",
      });
      const allAccts = acctRes.data.values || [];
      const acctRow = allAccts.find((r) => r[0] === accountCode);
      const acctType = acctRow ? acctRow[2] || "expense" : "expense";
      journalId = await addFinanceEntry({
        date,
        accountCode,
        entryType: acctType === "asset" ? "expense" : acctType,
        amount: amt,
        notes: purchaseNotes,
        cashAccountCode: cashAccountCode || "1101",
        branch: branch || "",
        linkedBookingId: "",
        costCenter: costCenter || "",
      });
    }

    return NextResponse.json({
      success: true,
      message: `تم ${supplierId ? "توريد" : "شراء"} ${qty} ${itemName} بقيمة ${amt} ريال`,
      journalId,
      itemId: invItemId,
    });
  } catch (error) {
    console.error("Purchase POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
