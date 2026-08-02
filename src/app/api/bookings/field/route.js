import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import {
  getAllBookingsRaw,
  updateBookingFieldStatus,
  getSheetData,
  getFinanceLedger,
} from "@/lib/sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function parseCustomFields(cfStr) {
  if (!cfStr) return {};
  try { return JSON.parse(cfStr); } catch { return {}; }
}

function getInstallationDate(customFields) {
  const val = customFields["تاريخ التركيب"] || customFields["installationDate"] || "";
  return val || null;
}

function computeCompletionSummary(items, completions) {
  const compMap = {};
  for (const c of completions) compMap[c.itemId] = c;
  let receivedTotal = 0;
  let damagedTotal = 0;
  let requestedTotal = 0;
  let remainingTotal = 0;
  let missingItems = 0;
  for (const item of items) {
    const qty = item.quantityRequested || 0;
    const received = compMap[item.itemId]?.receivedQty || 0;
    const damaged = compMap[item.itemId]?.damagedQty || 0;
    const remaining = qty - received - damaged;
    requestedTotal += qty;
    receivedTotal += received;
    damagedTotal += damaged;
    remainingTotal += remaining;
    if (remaining > 0) missingItems++;
  }
  const fullyResolved = missingItems === 0;
  return {
    requestedTotal,
    receivedTotal,
    damagedTotal,
    remainingTotal,
    missingItems,
    fullyResolved,
  };
}

function calcAutoFieldStatus(booking) {
  const currentStatus = booking.fieldStatus || "pending";

  // If archived — never change
  if (currentStatus === "archived") return "archived";

  if (currentStatus !== "pending" && currentStatus !== "") {
    // If it's a hall booking and currently in preparation, auto-advance to installed
    if (currentStatus === "preparation" && (booking.bookingType || "").includes("صالة")) {
      const customFields = parseCustomFields(booking.customFieldsStr);
      const installDate = getInstallationDate(customFields);
      const targetDateStr = installDate || booking.startDate;
      if (targetDateStr) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(targetDateStr); target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "installed";
      }
    }
    // Auto-advance "installed" → "completed" when end date has passed
    if (currentStatus === "installed" && booking.endDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end = new Date(booking.endDate); end.setHours(23, 59, 59, 0);
      if (today > end) return "completed";
    }
    return currentStatus;
  }

  // Auto-assign to preparation based on dates
  const customFields = parseCustomFields(booking.customFieldsStr);
  const installDate = getInstallationDate(customFields);
  const targetDateStr = installDate || booking.startDate;
  if (!targetDateStr) return currentStatus;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (installDate) {
    if (diffDays >= 0 && diffDays <= 2) return "preparation";
  } else {
    if (diffDays >= 0 && diffDays <= 1) return "preparation";
  }

  return currentStatus;
}

// GET /api/bookings/field — fetch all bookings with rented items + field status + expense totals
export async function GET() {
  try {
    const [bookingsRaw, rentRows, invRows, ledger] = await Promise.all([
      getAllBookingsRaw(),
      getSheetData("Rented_Items", "A2:E"),
      getSheetData("Inventory_Stock", "A2:D"),
      getFinanceLedger(),
    ]);

    // Auto-expire bookings whose end date has passed
    const todayStr = new Date().toLocaleDateString("en-CA");
    const toExpire = [];
    for (let i = 0; i < bookingsRaw.length; i++) {
      const status = bookingsRaw[i][8] || "";
      const endDate = bookingsRaw[i][4] || "";
      if (status === "مؤكد" && endDate && endDate < todayStr) {
        toExpire.push(i + 2);
      }
    }
    if (toExpire.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: toExpire.map(rowNum => ({ range: `Bookings!I${rowNum}`, values: [["منتهي"]] })),
        },
      });
      toExpire.forEach(rowNum => { bookingsRaw[rowNum - 2][8] = "منتهي"; });
    }

    const invMap = {};
    for (const r of invRows) invMap[r[0]] = r[1] || "";

    const rentedItemsMap = {};
    for (const r of rentRows) {
      const bookingId = r[1];
      if (!rentedItemsMap[bookingId]) rentedItemsMap[bookingId] = [];
      rentedItemsMap[bookingId].push({
        id: r[0],
        itemId: r[2],
        itemName: invMap[r[2]] || `صنف #${r[2]}`,
        quantityRequested: parseInt(r[3] || 0),
        unitPrice: parseFloat(r[4] || 0),
      });
    }

    // Pre-compute expense totals per booking from ledger
    const expenseTotals = {};
    for (const e of ledger) {
      if (e.entryType !== "expense" || !e.linkedBookingId) continue;
      const bid = e.linkedBookingId;
      if (!expenseTotals[bid]) expenseTotals[bid] = 0;
      expenseTotals[bid] += e.amount;
    }

    // Pre-compute per-item completion state per booking
    let completionRows = [];
    try {
      const compRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Item_Completions!A2:G",
      });
      completionRows = compRes.data.values || [];
    } catch {}
    const completionMap = {};
    for (const r of completionRows) {
      const bid = r[1];
      if (!completionMap[bid]) completionMap[bid] = [];
      completionMap[bid].push({
        itemId: r[2],
        receivedQty: parseInt(r[3] || 0),
        damagedQty: parseInt(r[4] || 0),
      });
    }

    const bookings = bookingsRaw.map((row) => {
      const bookingId = row[0];
      const customFieldsStr = row[27] || "";
      const startDate = row[3] || "";
      const rawFieldStatus = row[14] || "pending";

      // Parse customFields to check for transfer info
      let customFields = {};
      try { customFields = JSON.parse(customFieldsStr || "{}"); } catch {}
      const hasTransfer = customFields.transferFrom && Array.isArray(customFields.transferItems);

      let displayItems = rentedItemsMap[bookingId] || [];

      // For transferred bookings in "preparation", show ONLY items that need picking from warehouse
      // (diff > 0 = target needs more than source has). Inherited items (diff=0) are already at site.
      // Items with diff < 0 are excess that get returned directly, not through prep.
      if (hasTransfer && rawFieldStatus === "preparation") {
        displayItems = customFields.transferItems
          .filter(ti => ti.diff > 0)
          .map(ti => {
            const existingItem = (rentedItemsMap[bookingId] || []).find(i => i.itemId === ti.itemId);
            const itemName = existingItem?.itemName || ti.itemName || `#${ti.itemId}`;
            return { itemId: ti.itemId, itemName, quantityRequested: ti.diff };
          });
      }

      const booking = {
        bookingId,
        customerName: row[1] || "",
        customerPhone: row[2] || "",
        startDate,
        endDate: row[4] || "",
        totalAmount: parseFloat(row[5] || 0),
        paidAmount: parseFloat(row[6] || 0),
        remainingAmount: parseFloat(row[7] || 0),
        status: row[8] || "",
        bookingType: row[11] || "",
        packageUsed: row[12] || "",
        fieldStatus: rawFieldStatus,
        customFieldsStr,
        notes: row[13] || "",
        eventType: row[15] || "",
        shift: row[16] || "",
        tentLength: row[17] || "",
        tentWidth: row[18] || "",
        tentCount: row[19] || "",
        customerAddress: row[30] || "",
        rentedItems: displayItems,
        expenseTotal: expenseTotals[bookingId] || 0,
        completion: computeCompletionSummary(displayItems, completionMap[bookingId] || []),
      };

      // Auto-calculate field status based on dates
      booking.fieldStatus = calcAutoFieldStatus(booking);

      return booking;
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error("GET /api/bookings/field error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل بيانات الميدان" },
      { status: 500 }
    );
  }
}

// PATCH /api/bookings/field — update field status (column move or transfer)
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { bookingId, fieldStatus, targetBookingId } = body;

    if (!bookingId || !fieldStatus) {
      return NextResponse.json(
        { success: false, error: "رقم الحجز والحالة المطلوبة" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "preparation", "installed", "completed", "archived"];
    if (!validStatuses.includes(fieldStatus)) {
      return NextResponse.json(
        { success: false, error: "حالة غير صالحة" },
        { status: 400 }
      );
    }

    // Read current field status before updating
    const { sheets } = await import("@/lib/google");
    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

    // If moving from preparation → installed, clear transfer info from customFields
    // so the GET handler returns ALL items (including transferred ones)
    const bookRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A:AF",
    });
    const allBookRows = bookRes.data.values || [];
    const bookIdx = allBookRows.findIndex((r) => r[0] === bookingId);
    if (bookIdx >= 0) {
      const oldStatus = allBookRows[bookIdx][14] || "";
      const sheetRow = bookIdx + 1;
      if (oldStatus === "preparation" && fieldStatus === "installed") {
        let cf = {};
        try { cf = JSON.parse(allBookRows[bookIdx][31] || "{}"); } catch {}
        if (cf.transferFrom) {
          delete cf.transferFrom;
          delete cf.transferItems;
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Bookings!AF${sheetRow}`,
            valueInputOption: "RAW",
            requestBody: { values: [[JSON.stringify(cf)]] },
          });
        }
      }
    }

    await updateBookingFieldStatus(bookingId, fieldStatus);

    // If transferring (direct transfer or dismantled transfer), update target booking
    if (targetBookingId) {
      // Mark target booking as installed (already on site)
      await updateBookingFieldStatus(targetBookingId, "installed");
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث حالة الحقل",
      bookingId,
      fieldStatus,
    });
  } catch (error) {
    console.error("PATCH /api/bookings/field error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث حالة الحقل" },
      { status: 500 }
    );
  }
}

// POST /api/bookings/field — record transfer between bookings
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      action,
      sourceBookingId,
      targetBookingId,
      transferType,
      isFullMatch,
      targetStatus,
      transferItems,
    } = body;

    if (action !== "transfer" || !sourceBookingId || !targetBookingId) {
      return NextResponse.json({ success: false, error: "بيانات النقل غير مكتملة" }, { status: 400 });
    }

    if (!["installed", "dismantled"].includes(transferType)) {
      return NextResponse.json({ success: false, error: "نوع النقل غير صالح" }, { status: 400 });
    }

    const finalTargetStatus = targetStatus || (transferType === "installed" ? "installed" : "pending");

    const { sheets } = await import("@/lib/google");
    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

    // 1. Delete source booking's rented items (they are freed back to inventory)
    const rentRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Rented_Items!A:E",
    });
    const allRentRows = rentRes.data.values || [];
    const keptRentRows = allRentRows.filter((r, i) => i === 0 || r[1] !== sourceBookingId);
    if (keptRentRows.length !== allRentRows.length) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "Rented_Items!A:E" });
      if (keptRentRows.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Rented_Items!A:E", valueInputOption: "RAW",
          requestBody: { values: keptRentRows },
        });
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Rented_Items!A1", valueInputOption: "RAW",
          requestBody: { values: [["ID", "BookingID", "ItemID", "QuantityRequested", "UnitPrice"]] },
        });
      }
    }

    // 2. Save transfer info in the target booking's customFields (column AF)
    //    This tells the field API to filter rentedItems: for "preparation" status,
    //    only show the diff items. When the booking moves to "installed", the
    //    transfer flag is cleared so ALL items appear.
    if (transferItems && Array.isArray(transferItems) && transferItems.length > 0) {
      // Read existing booking row to get current customFields
      const bookRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Bookings!A:AF",
      });
      const allBookRows = bookRes.data.values || [];
      const bookIdx = allBookRows.findIndex((r) => r[0] === targetBookingId);
      if (bookIdx >= 0) {
        const sheetRow = bookIdx + 1; // +1 because sheet is 1-indexed, row 1 is header
        let existingCF = {};
        try { existingCF = JSON.parse(allBookRows[bookIdx][31] || "{}"); } catch {}
        existingCF.transferFrom = sourceBookingId;
        existingCF.transferItems = transferItems;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Bookings!AF${sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [[JSON.stringify(existingCF)]] },
        });
      }
    }

    // Mark source booking based on transfer type:
    //   - dismantled (مفكوك) → "completed" (needs جرد/إتمام)
    //   - installed (منصوب)  → "archived" (done, no جرد needed)
    if (transferType === "dismantled") {
      await updateBookingFieldStatus(sourceBookingId, "completed");
    } else {
      await updateBookingFieldStatus(sourceBookingId, "archived");
    }

    // Mark target with the computed status
    await updateBookingFieldStatus(targetBookingId, finalTargetStatus);

    // Link the two bookings via notes in Finance_Ledger
    const { addFinanceEntry } = await import("@/lib/sheets");
    const transferLabel = transferType === "installed" ? "منصوب" : "مفكوك";
    const matchLabel = isFullMatch ? "مطابق" : "غير مطابق";
    await addFinanceEntry({
      date: new Date().toLocaleDateString("en-CA"),
      accountCode: "5100",
      entryType: "expense",
      amount: 0,
      linkedBookingId: sourceBookingId,
      notes: `نقل مباشر ${transferLabel} (${matchLabel}) من ${sourceBookingId} إلى ${targetBookingId}`,
    });

    return NextResponse.json({
      success: true,
      message: "تم نقل الحجز بنجاح",
      targetStatus: finalTargetStatus,
      isFullMatch: !!isFullMatch,
    });
  } catch (error) {
    console.error("POST /api/bookings/field transfer error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
