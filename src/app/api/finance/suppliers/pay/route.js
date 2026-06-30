import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { addFinanceEntry, getFinanceLedger } from "@/lib/sheets";
import { requireAuth, requireAdmin } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Helper: reverse a payment transaction
async function reversePayment(transId) {
  // Read transaction
  const transRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A2:H",
  });
  const transRows = transRes.data.values || [];
  const tIdx = transRows.findIndex((r) => r[0] === transId.toString());
  if (tIdx < 0) return { error: "المعاملة غير موجودة" };

  const tRow = transRows[tIdx];
  const rowNum = tIdx + 2;
  const supplierId = tRow[1];
  const amt = parseFloat(tRow[4] || 0);
  const purchaseId = tRow[5] || "";
  const cashCode = tRow[7] || "1101";

  // 1. Reverse supplier balance (+amount)
  const supRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
  });
  const supRows = supRes.data.values || [];
  const supIdx = supRows.findIndex((r) => r[0] === supplierId);
  if (supIdx >= 0) {
    const supRow = supIdx + 1;
    const curBal = parseFloat(supRows[supIdx][4] || 0);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Suppliers!E${supRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[(curBal + amt).toString()]] },
    });
  }

  // 2. Reverse purchase paidAmount if linked
  if (purchaseId) {
    const pRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:I",
    });
    const pRows = pRes.data.values || [];
    const pIdx = pRows.findIndex((r) => r[0] === purchaseId);
    if (pIdx > 0) {
      const pRow = pIdx + 1;
      const curPaid = parseFloat(pRows[pIdx][5] || 0);
      const newPaid = Math.max(0, curPaid - amt);
      const totalAmt = parseFloat(pRows[pIdx][4] || 0);
      const newStatus = newPaid >= totalAmt ? "closed" : "open";
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `Supplier_Purchases!F${pRow}:I${pRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newPaid.toString(), pRows[pIdx][6] || "", pRows[pIdx][7] || "", newStatus]] },
      });
    }
  }

  // 3. Delete the transaction row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: `Supplier_Transactions!A${rowNum}:H${rowNum}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", ""]] },
  });

  return { success: true, supplierId, amount: amt, purchaseId, cashAccountCode: cashCode };
}

// POST /api/finance/suppliers/pay — record payment to a supplier
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { supplierId, date, amount, cashAccountCode, notes, accountCode, costCenter, purchaseId } = body;

    if (!supplierId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "المورد والمبلغ مطلوبان" }, { status: 400 });
    }

    const amt = parseFloat(amount);

    const supRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
    });
    const supRows = supRes.data.values || [];
    const supIdx = supRows.findIndex((r) => r[0] === supplierId);
    if (supIdx < 0) return NextResponse.json({ success: false, error: "المورد غير موجود" }, { status: 404 });

    const supRow = supIdx + 1;
    const supName = supRows[supIdx][1] || supplierId;
    const currentBalance = parseFloat(supRows[supIdx][4] || 0);
    const newBalance = Math.max(0, currentBalance - amt);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Suppliers!E${supRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newBalance.toString()]] },
    });

    let purchaseInfo = "";
    let effectiveCostCenter = costCenter || "";
    if (purchaseId) {
      const pRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:I",
      });
      const pRows = pRes.data.values || [];
      const pIdx = pRows.findIndex((r) => r[0] === purchaseId);
      if (pIdx > 0) {
        const pRow = pIdx + 1;
        const currentPaid = parseFloat(pRows[pIdx][5] || 0);
        const totalAmt = parseFloat(pRows[pIdx][4] || 0);
        const newPaid = currentPaid + amt;
        const newStatus = newPaid >= totalAmt ? "closed" : "open";
        if (!effectiveCostCenter && pRows[pIdx][6]) effectiveCostCenter = pRows[pIdx][6];
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Supplier_Purchases!F${pRow}:I${pRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[newPaid.toString(), pRows[pIdx][6] || "", pRows[pIdx][7] || "", newStatus]] },
        });
        purchaseInfo = pRows[pIdx][3] || purchaseId;
      }
    }

    // Record in Finance_Ledger
    const journalId = await addFinanceEntry({
      date: date || new Date().toLocaleDateString("en-CA"),
      accountCode: accountCode || "2101",
      entryType: "expense",
      amount: amt,
      cashAccountCode: cashAccountCode || "1101",
      notes: `تسديد مورد: ${supName} (${supplierId})${purchaseInfo ? ` - ${purchaseInfo}` : ""}${notes ? ` - ${notes}` : ""}${effectiveCostCenter ? ` [${effectiveCostCenter}]` : ""}`,
      costCenter: effectiveCostCenter || "",
    });

    // Record in Supplier_Transactions (8 cols A:H)
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:A",
    });
    const existingTrans = transRes.data.values || [];
    let maxTrans = 0;
    for (const r of existingTrans) { const n = parseInt(r[0]); if (n > maxTrans) maxTrans = n; }
    const newTransId = maxTrans + 1;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:H",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[newTransId.toString(), supplierId,
          date || new Date().toLocaleDateString("en-CA"),
          "payment", amt.toString(), purchaseId || "",
          `تسديد${purchaseInfo ? ` (${purchaseInfo})` : ""}${notes ? ` - ${notes}` : ""}`,
          cashAccountCode || "1101",
        ]],
      },
    });

    return NextResponse.json({
      success: true, message: "تم تسجيل الدفع",
      journalId, balance: newBalance,
    });
  } catch (error) {
    console.error("POST /api/finance/suppliers/pay error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/finance/suppliers/pay?transId=123 — reverse a payment
export async function DELETE(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const transId = searchParams.get("transId");
    if (!transId) {
      return NextResponse.json({ success: false, error: "رقم المعاملة مطلوب" }, { status: 400 });
    }

    const result = await reversePayment(transId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "تم حذف الدفع وعكس جميع القيود" });
  } catch (error) {
    console.error("DELETE /api/finance/suppliers/pay error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/finance/suppliers/pay — edit a payment (reverse + re-create)
export async function PUT(request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { transId, date, amount, cashAccountCode, notes, accountCode, costCenter, purchaseId } = body;

    if (!transId) {
      return NextResponse.json({ success: false, error: "رقم المعاملة مطلوب" }, { status: 400 });
    }

    // 1. Reverse the old payment
    const reverseResult = await reversePayment(transId);
    if (reverseResult.error) {
      return NextResponse.json({ success: false, error: reverseResult.error }, { status: 404 });
    }

    // 2. Create a new POST request with the updated data
    // Reuse the supplier data from the reversed transaction
    const newBody = {
      supplierId: reverseResult.supplierId,
      date: date || new Date().toLocaleDateString("en-CA"),
      amount: amount || reverseResult.amount,
      cashAccountCode: cashAccountCode || reverseResult.cashAccountCode,
      notes: notes || "",
      accountCode: accountCode || "2101",
      costCenter: costCenter || "",
      purchaseId: purchaseId || reverseResult.purchaseId,
    };

    // Reuse POST logic by calling the handler directly
    const supRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Suppliers!A:G",
    });
    const supRows = supRes.data.values || [];
    const supIdx = supRows.findIndex((r) => r[0] === newBody.supplierId);
    if (supIdx < 0) return NextResponse.json({ success: false, error: "المورد غير موجود" }, { status: 404 });

    const supRow = supIdx + 1;
    const supName = supRows[supIdx][1] || newBody.supplierId;
    const amt = parseFloat(newBody.amount);
    const currentBalance = parseFloat(supRows[supIdx][4] || 0);
    const newBalance = Math.max(0, currentBalance - amt);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `Suppliers!E${supRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[newBalance.toString()]] },
    });

    let purchaseInfo = "";
    let effectiveCostCenter = newBody.costCenter || "";
    if (newBody.purchaseId) {
      const pRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Supplier_Purchases!A:I",
      });
      const pRows = pRes.data.values || [];
      const pIdx = pRows.findIndex((r) => r[0] === newBody.purchaseId);
      if (pIdx > 0) {
        const pRow = pIdx + 1;
        const currentPaid = parseFloat(pRows[pIdx][5] || 0);
        const totalAmt = parseFloat(pRows[pIdx][4] || 0);
        const newPaid = currentPaid + amt;
        const newStatus = newPaid >= totalAmt ? "closed" : "open";
        if (!effectiveCostCenter && pRows[pIdx][6]) effectiveCostCenter = pRows[pIdx][6];
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Supplier_Purchases!F${pRow}:I${pRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[newPaid.toString(), pRows[pIdx][6] || "", pRows[pIdx][7] || "", newStatus]] },
        });
        purchaseInfo = pRows[pIdx][3] || newBody.purchaseId;
      }
    }

    const journalId = await addFinanceEntry({
      date: newBody.date,
      accountCode: accountCode || "2101",
      entryType: "expense",
      amount: amt,
      cashAccountCode: newBody.cashAccountCode,
      notes: `تسديد مورد: ${supName} (${newBody.supplierId})${purchaseInfo ? ` - ${purchaseInfo}` : ""}${newBody.notes ? ` - ${newBody.notes}` : ""}${effectiveCostCenter ? ` [${effectiveCostCenter}]` : ""}`,
      costCenter: effectiveCostCenter || "",
    });

    // Record new transaction
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:A",
    });
    const existingTrans = transRes.data.values || [];
    let maxTrans = 0;
    for (const r of existingTrans) { const n = parseInt(r[0]); if (n > maxTrans) maxTrans = n; }
    const newTransId = maxTrans + 1;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: "Supplier_Transactions!A:H",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[newTransId.toString(), newBody.supplierId,
          newBody.date, "payment", amt.toString(), newBody.purchaseId || "",
          `تسديد${purchaseInfo ? ` (${purchaseInfo})` : ""}${newBody.notes ? ` - ${newBody.notes}` : ""}`,
          newBody.cashAccountCode,
        ]],
      },
    });

    return NextResponse.json({
      success: true, message: "تم تعديل الدفع",
      journalId, balance: newBalance,
    });
  } catch (error) {
    console.error("PUT /api/finance/suppliers/pay error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
