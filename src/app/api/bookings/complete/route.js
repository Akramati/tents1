import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { requireAuth } from "@/lib/auth";
import {
  getSheetData,
  appendRow,
  updateBookingFieldStatus,
  addFinanceEntry,
  getChartOfAccounts,
  getFinanceLedger,
  getIncomeAccountForBooking,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// POST /api/bookings/complete — finalize field ops (damages distribution + removal expenses + inventory)
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { bookingId, damages = [], laborCost, transportCost, cleaningCost, notes, removalExpenses, costCenter, costCenterType, transportType, cashAccountCode, customExpenseNotes } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "رقم الحجز مطلوب" }, { status: 400 });
    }

    // Batch all sheet reads upfront
    const [allAccounts, allBookingsRows, invRows, allFinance, rentRows] = await Promise.all([
      getChartOfAccounts(),
      getSheetData("Bookings", "A:O"),
      getSheetData("Inventory_Stock", "A2:D"),
      getFinanceLedger(),
      getSheetData("Rented_Items", "A2:E"),
    ]);
    let compRows = [];
    try {
      const compRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Item_Completions!A2:G",
      });
      compRows = compRes.data.values || [];
    } catch (e) {
      compRows = [];
    }
    const accountNameMap = {};
    for (const a of allAccounts) accountNameMap[a.accountCode] = a.accountName;
    const getAcctName = (code) => accountNameMap[code] || code;

    const warnings = [];
    const today = new Date().toLocaleDateString("en-CA");

    // --- 0. Validate all rented items are fully resolved (received + damaged = requested) ---
    const compMap = {};
    for (const r of compRows) {
      if (r[1] !== bookingId) continue;
      compMap[r[2]] = { receivedQty: parseInt(r[3] || 0), damagedQty: parseInt(r[4] || 0) };
    }
    const bookingRentRows = rentRows.filter((r) => r[1] === bookingId);
    const unresolved = [];
    for (const r of bookingRentRows) {
      const itemId = r[2];
      const requested = parseInt(r[3] || 0);
      const received = compMap[itemId]?.receivedQty || 0;
      const damaged = compMap[itemId]?.damagedQty || 0;
      if (requested - received - damaged > 0) {
        unresolved.push({ itemId, remaining: requested - received - damaged });
      }
    }
    if (unresolved.length > 0) {
      return NextResponse.json({
        success: false,
        error: `لا يمكن إتمام الجرد: ${unresolved.length} صنف لم يُستلم بعد. أكمل استلام الأصناف أو سجل التوالف/المفقودات أولاً`,
        unresolved,
      }, { status: 400 });
    }

    const bIdx = allBookingsRows.findIndex(r => r[0] === bookingId);
    const bookingType = bIdx !== -1 ? (allBookingsRows[bIdx][11] || "") : "";
    const totalAmount = bIdx !== -1 ? parseFloat(allBookingsRows[bIdx][5] || 0) : 0;
    const paidAmount = bIdx !== -1 ? parseFloat(allBookingsRows[bIdx][6] || 0) : 0;
    const customerName = bIdx !== -1 ? (allBookingsRows[bIdx][1] || "") : "";

    // --- 1. Record removal stage expenses ---
    const defaultRemovalExpenses = {
      "5103-01": parseFloat(laborCost) || 0,
      "5103-03": parseFloat(transportCost) || 0,
      "5103-05": parseFloat(cleaningCost) || 0,
    };
    const allRemovalExpenses = removalExpenses || defaultRemovalExpenses;
    const customNotes = customExpenseNotes || {};
    for (const [accountCode, amount] of Object.entries(allRemovalExpenses)) {
      if (amount > 0) {
        const customDesc = customNotes[accountCode] || "";
        await addFinanceEntry({
          date: today,
          accountCode,
          entryType: "expense",
          amount,
          linkedBookingId: bookingId,
          notes: `[فك] ${customDesc || getAcctName(accountCode)}${(!customDesc && notes) ? ` - ${notes}` : ""}`,
          costCenter,
          costCenterType,
          transportType,
          cashAccountCode,
        });
      }
    }

    // --- 2. Process damages: update inventory + record distribution ---
    const actualDamages = damages.filter((d) => parseInt(d.damagedQuantity || 0) > 0);
    if (actualDamages.length > 0) {
      const invMap = {};
      invRows.forEach((r, i) => {
        invMap[r[0]] = { idx: i + 2, total: parseInt(r[2] || 0), maintenance: parseInt(r[3] || 0) };
      });

      let maintMaxId = 0;
      for (const d of actualDamages) {
        const qty = parseInt(d.damagedQuantity || 0);
        if (qty <= 0) continue;

        // Update inventory under maintenance
        const inv = invMap[d.itemId];
        if (inv) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Inventory_Stock!D${inv.idx}`,
            valueInputOption: "RAW",
            requestBody: { values: [[(inv.maintenance + qty).toString()]] },
          });
        } else {
          warnings.push(`الصنف #${d.itemId} غير موجود في المخزون`);
        }

        // Log to maintenance log
        if (!maintMaxId) {
          const maintRows = await getSheetData("Asset_Maintenance_Logs", "A:A");
          for (const r of maintRows) { const n = parseInt(r[0]); if (n > maintMaxId) maintMaxId = n; }
        }
        maintMaxId++;
        await appendRow("Asset_Maintenance_Logs", "A:D", [
          maintMaxId.toString(), d.itemId, today, "", `تالف من الحجز ${bookingId}: ${qty} قطعة`,
        ]);

        // --- Record damage distribution ---
        const dist = d.distribution || {};
        const totalValue = Math.max(Object.values(dist).reduce((s, v) => s + (parseFloat(v) || 0), 0), 0);
        if (totalValue > 0) {
          const damageAccounts = allAccounts.filter((a) => a.parentCode === "5104");
          const partySuffix = { client: "01", workers: "02", driver: "03", guard: "04", system: "05" };
          const distributionMap = {};
          for (const a of damageAccounts) {
            const suffix = a.accountCode.split("-").pop();
            for (const [party, s] of Object.entries(partySuffix)) {
              if (suffix === s) {
                distributionMap[party] = { code: a.accountCode, label: a.accountName };
              }
            }
          }
          for (const [party, amount] of Object.entries(dist)) {
            const amt = parseFloat(amount) || 0;
            if (amt <= 0) continue;
            const info = distributionMap[party];
            if (!info) continue;
            await addFinanceEntry({
              date: today,
              accountCode: info.code,
              entryType: "expense",
              amount: amt,
              linkedBookingId: bookingId,
              notes: `توالف ${d.itemName || `صنف #${d.itemId}`} ${info.label} - ${qty} قطعة`,
              costCenter,
              costCenterType,
              transportType: "",
              cashAccountCode,
            });
          }
        }
      }
    }

    // --- 2.5. Convert عربون (liability) to income + recognize full revenue ---
    try {
      const arabonEntries = allFinance.filter(e => e.linkedBookingId === bookingId && e.accountCode === "2300" && e.entryType === "liability" && e.amount > 0);
      const totalArabon = arabonEntries.reduce((s, e) => s + e.amount, 0);
      const incomeAccount = await getIncomeAccountForBooking(bookingType);

      if (totalArabon > 0) {
        // Reverse existing عربون entries
        for (const ae of arabonEntries) {
          await addFinanceEntry({
            date: today,
            accountCode: "2300",
            entryType: "liability",
            linkedBookingId: bookingId,
            amount: -(ae.amount),
            notes: `تحويل عربون إلى إيراد للحجز ${bookingId}`,
            cashAccountCode: ae.cashAccountCode || "",
            costCenter: ae.costCenter || "",
            costCenterType: ae.costCenterType || "",
          });
        }
        // Record income for paid portion
        await addFinanceEntry({
          date: today,
          accountCode: incomeAccount,
          entryType: "income",
          amount: totalArabon,
          linkedBookingId: bookingId,
          notes: `إيراد الحجز ${bookingId} (مدفوع)`,
          cashAccountCode: arabonEntries[0]?.cashAccountCode || cashAccountCode || "",
          costCenter: arabonEntries[0]?.costCenter || costCenter || "",
          costCenterType: arabonEntries[0]?.costCenterType || costCenterType || "",
        });
      }

      // Recognize income for any remaining unpaid amount (ذمة/remaining balance)
      if (totalAmount > totalArabon) {
        const remainingIncome = totalAmount - totalArabon;
        await addFinanceEntry({
          date: today,
          accountCode: incomeAccount,
          entryType: "income",
          amount: remainingIncome,
          linkedBookingId: bookingId,
          notes: `إيراد الحجز ${bookingId} - ${customerName} (مبلغ ذمة)`,
          cashAccountCode: "1202",
          costCenter: costCenter || "",
          costCenterType: costCenterType || "",
          transportType: transportType || "",
        });
      }
    } catch (finError) {
      console.error("Failed to recognize revenue:", finError);
      warnings.push("تعذر تسجيل الإيراد");
    }

    // --- 3. Update field status to "archived" (hides from kanban board) ---
    await updateBookingFieldStatus(bookingId, "archived");

    // --- 4. Update main booking status if not cancelled ---
    if (bIdx !== -1) {
      const rowNum = bIdx + 1;
      const currentStatus = allBookingsRows[bIdx][8] || "";
      if (currentStatus !== "ملغي" && currentStatus !== "مكتمل") {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Bookings!I${rowNum}`,
          valueInputOption: "RAW",
          requestBody: { values: [["مكتمل"]] },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "تم إتمام الجرد وتسوية التوالف",
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error("POST /api/bookings/complete error:", error);
    return NextResponse.json({ success: false, error: "فشل إتمام الجرد" }, { status: 500 });
  }
}
