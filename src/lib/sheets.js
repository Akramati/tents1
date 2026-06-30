import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Generic helpers
export async function getSheetData(sheetName, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });
  if (res.status !== 200) throw new Error(`Google Sheets read failed: status=${res.status}`);
  return res.data.values || [];
}

export async function appendRow(sheetName, range, values) {
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  return res;
}

export async function updateRow(sheetName, range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// --- Bookings ---
const BOOKINGS_HEADERS = [
  "BookingID", "CustomerName", "CustomerPhone",
  "StartDate", "EndDate", "TotalAmount", "PaidAmount",
  "RemainingAmount", "Status", "ContractLink", "Timestamp",
  "BookingType", "PackageUsed", "Notes", "FieldStatus",
  "EventType", "Shift", "TentLength", "TentWidth", "TentCount",
  "PricingType", "DepositType", "GuarantorName", "GuarantorPhone",
  "GuarantorId", "TransResponsibility", "TransCost", "CustomFields",
  "CustomerIdNumber", "CustomerIdPhoto", "CustomerAddress", "GuarantorIdPhoto",
];

export async function getBookings() {
  const rows = await getSheetData("Bookings", "A2:AA");
  return rows.map(normalizeBookingRow);
}

export async function getAllBookingsRaw() {
  return await getSheetData("Bookings", "A2:AF");
}

function normalizeBookingRow(row) {
  const r = {};
  BOOKINGS_HEADERS.forEach((h, i) => {
    r[h[0].toLowerCase() + h.slice(1)] = row[i] ?? "";
  });
  return r;
}

export async function updateBookingFieldStatus(bookingId, fieldStatus) {
  const rows = await getSheetData("Bookings", "A:O");
  const idx = rows.findIndex((r) => r[0] === bookingId);
  if (idx === -1) throw new Error("Booking not found");
  const rowNum = idx + 1; // header is row 1, data starts at row 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Bookings!O${rowNum}`,
    valueInputOption: "RAW",
    requestBody: { values: [[fieldStatus]] },
  });
}

// Rented items with inventory names
export async function getRentedItemsWithDetails(bookingId) {
  const rentRows = await getSheetData("Rented_Items", "A2:E");
  const invRows = await getSheetData("Inventory_Stock", "A2:D");
  const invMap = {};
  for (const r of invRows) invMap[r[0]] = r[1] || "";
  return rentRows
    .filter((r) => r[1] === bookingId)
    .map((r) => ({
      id: r[0],
      itemId: r[2],
      itemName: invMap[r[2]] || `صنف #${r[2]}`,
      quantityRequested: parseInt(r[3] || 0),
      unitPrice: parseFloat(r[4] || 0),
    }));
}

// --- Inventory Stock ---
const INVENTORY_HEADERS = [
  "ItemID", "ItemName", "TotalQuantity", "UnderMaintenance",
];

export async function getInventory() {
  const rows = await getSheetData("Inventory_Stock", "A2:D");
  return rows.map((row) => ({
    itemId: row[0],
    itemName: row[1] || "",
    totalQuantity: parseInt(row[2] || 0),
    underMaintenance: parseInt(row[3] || 0),
    availableQuantity: parseInt(row[2] || 0) - parseInt(row[3] || 0),
  }));
}

function maxId(rows) {
  let m = 0;
  for (const r of rows) { const n = parseInt(r[0]); if (n > m) m = n; }
  return m;
}

export async function addInventoryItem(item) {
  const rows = await getSheetData("Inventory_Stock", "A:A");
  const newId = maxId(rows) + 1;
    await appendRow("Inventory_Stock", "A1:D1", [
    newId.toString(),
    item.itemName,
    (item.totalQuantity || 0).toString(),
    (item.underMaintenance || 0).toString(),
  ]);
  return newId;
}

// --- Asset Maintenance Logs ---
const MAINTENANCE_HEADERS = [
  "LogID", "ItemID", "StartDate", "EndDate", "Reason",
];

export async function getMaintenanceLogs() {
  const rows = await getSheetData("Asset_Maintenance_Logs", "A2:E");
  return rows.map((row) => ({
    logId: row[0],
    itemId: row[1],
    startDate: row[2],
    endDate: row[3],
    reason: row[4] || "",
  }));
}

export async function addMaintenanceLog(log) {
  const rows = await getSheetData("Asset_Maintenance_Logs", "A:A");
  const newId = maxId(rows) + 1;
    await appendRow("Asset_Maintenance_Logs", "A1:E1", [
    newId.toString(),
    log.itemId,
    log.startDate,
    log.endDate,
    log.reason || "",
  ]);
  return newId;
}

// --- Rented Items ---
const RENTED_HEADERS = [
  "ID", "BookingID", "ItemID", "QuantityRequested", "UnitPrice",
];

export async function getRentedItems(bookingId) {
  const rows = await getSheetData("Rented_Items", "A2:E");
  return rows
    .filter((row) => !bookingId || row[1] === bookingId)
    .map((row) => ({
      id: row[0],
      bookingId: row[1],
      itemId: row[2],
      quantityRequested: parseInt(row[3] || 0),
      unitPrice: parseFloat(row[4] || 0),
    }));
}

export async function addRentedItems(items) {
  const existing = await getSheetData("Rented_Items", "A:A");
  let idx = maxId(existing);
  const toInsert = items.map((item) => [
    (++idx).toString(),
    item.bookingId,
    item.itemId,
    (item.quantityRequested || 0).toString(),
    (item.unitPrice || 0).toString(),
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Rented_Items!A:E",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: toInsert },
  });
}

// --- Booking Expenses ---
const BOOKING_EXPENSE_HEADERS = [
  "ExpenseID", "BookingID", "ExpenseType", "AmountPaid", "Notes",
];

export async function getBookingExpenses(bookingId) {
  const rows = await getSheetData("Booking_Expenses", "A2:E");
  return rows
    .filter((row) => !bookingId || row[1] === bookingId)
    .map((row) => ({
      expenseId: row[0],
      bookingId: row[1],
      expenseType: row[2] || "",
      amountPaid: parseFloat(row[3] || 0),
      notes: row[4] || "",
    }));
}

export async function addBookingExpense(expense) {
  const rows = await getSheetData("Booking_Expenses", "A:A");
  const newId = maxId(rows) + 1;
    await appendRow("Booking_Expenses", "A1:E1", [
    newId.toString(),
    expense.bookingId,
    expense.expenseType,
    (expense.amountPaid || 0).toString(),
    expense.notes || "",
  ]);
  return newId;
}

// --- General Expenses Log ---
const GENERAL_EXPENSE_HEADERS = [
  "LogID", "ItemID", "ExpenseCategory", "Amount", "DateSpent", "Notes",
];

export async function getGeneralExpenses(fromDate, toDate) {
  const rows = await getSheetData("General_Expenses_Log", "A2:F");
  return rows
    .filter((row) => {
      if (!fromDate && !toDate) return true;
      const d = row[4] || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    })
    .map((row) => ({
      logId: row[0],
      itemId: row[1] || "",
      expenseCategory: row[2] || "",
      amount: parseFloat(row[3] || 0),
      dateSpent: row[4] || "",
      notes: row[5] || "",
    }));
}

export async function addGeneralExpense(expense) {
  const rows = await getSheetData("General_Expenses_Log", "A:A");
  const newId = maxId(rows) + 1;
    await appendRow("General_Expenses_Log", "A1:F1", [
    newId.toString(),
    expense.itemId || "",
    expense.expenseCategory,
    (expense.amount || 0).toString(),
    expense.dateSpent,
    expense.notes || "",
  ]);
  return newId;
}

// ===== Finance Ledger (دفتر اليومية) =====
export async function getFinanceLedger(fromDate, toDate, accountCode) {
  const rows = await getSheetData("Finance_Ledger", "A2:M");
  return rows
    .filter((row) => {
      if (!row[0]) return false;
      const d = row[1] || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (accountCode && row[2] !== accountCode) return false;
      return true;
    })
    .map((row) => ({
      journalId: row[0],
      date: row[1] || "",
      accountCode: row[2] || "",
      entryType: row[3] || "expense",
      amount: parseFloat(row[4] || 0),
      linkedBookingId: row[5] || "",
      notes: row[6] || "",
      createdAt: row[7] || "",
      costCenter: row[8] || "",
      costCenterType: row[9] || "",
      transportType: row[10] || "",
      cashAccountCode: row[11] || "",
      branch: row[12] || "",
    }));
}

export async function getFinanceEntryByJournalId(journalId) {
  const rows = await getSheetData("Finance_Ledger", "A2:M");
  const row = rows.find((r) => r[0] === journalId.toString());
  if (!row) return null;
  return {
    journalId: row[0],
    date: row[1] || "",
    accountCode: row[2] || "",
    entryType: row[3] || "expense",
    amount: parseFloat(row[4] || 0),
    linkedBookingId: row[5] || "",
    notes: row[6] || "",
    costCenter: row[8] || "",
    costCenterType: row[9] || "",
    transportType: row[10] || "",
    cashAccountCode: row[11] || "",
    branch: row[12] || "",
  };
}

export async function getCumulativeCashBalances() {
  const rows = await getSheetData("Finance_Ledger", "A2:L");
  const balances = {};
  for (const r of rows) {
    if (!r[0]) continue;
    const cashCode = r[11] || "1101";
    const entryType = r[3] || "expense";
    const amount = parseFloat(r[4] || 0);
    if (!balances[cashCode]) balances[cashCode] = 0;
    if (entryType === "income" || entryType === "liability") balances[cashCode] += amount;
    else balances[cashCode] -= amount;
  }
  return balances;
}

let _journalCounter = Date.now();
export async function addFinanceEntry(entry) {
  _journalCounter++;
  const newId = _journalCounter;
  const now = new Date().toISOString();
  const vals = [
    newId.toString(),
    entry.date || new Date().toLocaleDateString("en-CA"),
    entry.accountCode || "",
    entry.entryType || "expense",
    (entry.amount || 0).toString(),
    entry.linkedBookingId || "",
    entry.notes || "",
    now,
    entry.costCenter || "",
    entry.costCenterType || "",
    entry.transportType || "",
    entry.cashAccountCode || "",
    entry.branch || "",
  ];
  const appRes = await appendRow("Finance_Ledger", "A1:M1", vals);
  if (appRes.status !== 200) throw new Error(`Google Sheets append failed: ${JSON.stringify(appRes.data)}`);
  return newId;
}

export async function updateFinanceEntry(journalId, entry) {
  const rows = await getSheetData("Finance_Ledger", "A:L");
  const rowIndex = rows.findIndex((r) => r[0] === journalId.toString());
  if (rowIndex < 0) return null;
  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Finance_Ledger!A${sheetRow}:M${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        journalId.toString(),
        entry.date || rows[rowIndex][1] || "",
        entry.accountCode || rows[rowIndex][2] || "",
        entry.entryType || rows[rowIndex][3] || "expense",
        (entry.amount ?? rows[rowIndex][4] ?? "0").toString(),
        entry.linkedBookingId ?? rows[rowIndex][5] ?? "",
        entry.notes ?? rows[rowIndex][6] ?? "",
        rows[rowIndex][7] || new Date().toISOString(),
        entry.costCenter ?? rows[rowIndex][8] ?? "",
        entry.costCenterType ?? rows[rowIndex][9] ?? "",
        entry.transportType ?? rows[rowIndex][10] ?? "",
        entry.cashAccountCode ?? rows[rowIndex][11] ?? "",
        entry.branch ?? rows[rowIndex][12] ?? "",
      ]],
    },
  });
  return true;
}

export async function deleteFinanceEntry(journalId) {
  const rows = await getSheetData("Finance_Ledger", "A:A");
  const rowIndex = rows.findIndex((r) => r[0] === journalId.toString());
  if (rowIndex < 0) return null;
  const sheetRow = rowIndex + 1;
  await updateRow("Finance_Ledger", `A${sheetRow}:L${sheetRow}`, ["", "", "", "", "", "", "", "", "", "", "", ""]);
  return true;
}

// ===== Chart of Accounts (دليل الحسابات) =====
export async function getChartOfAccounts(includeInactive = false) {
  const rows = await getSheetData("Chart_Of_Accounts", "A2:G");
  return rows
    .filter((r) => r[0])
    .filter((r) => includeInactive || r[5] !== "FALSE")
    .map((r) => ({
      accountCode: r[0] || "",
      accountName: r[1] || "",
      accountType: r[2] || "expense",
      parentCode: r[3] || "",
      linkedBookingType: r[4] || "",
      isActive: r[5] !== "FALSE",
      costCenterCode: r[6] || "",
    }));
}

export async function addAccount(acct) {
  const rows = await getSheetData("Chart_Of_Accounts", "A:A");
  if (rows.slice(1).some((r) => r[0] === acct.accountCode)) {
    return { error: "كود الحساب موجود" };
  }
    await appendRow("Chart_Of_Accounts", "A1:G1", [
    acct.accountCode,
    acct.accountName,
    acct.accountType || "expense",
    acct.parentCode || "",
    acct.linkedBookingType || "",
    "TRUE",
    acct.costCenterCode || "",
  ]);
  return { success: true };
}

// ===== Booking → Income Account mapping =====
export async function getIncomeAccountForBooking(bookingType) {
  try {
    const rows = await getSheetData("Booking_Types", "A2:E");
    const match = rows.find((r) => r[0] === bookingType);
    if (match && match[4]) return match[4];
  } catch { /* fall through to default */ }
  // Fallback by behavior
  if (bookingType.includes("صالة")) return "4001-01";
  return "4001";
}

export async function ensureFinanceLedgerSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Finance_Ledger" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["JournalID", "Date", "AccountCode", "EntryType", "Amount", "LinkedBookingID", "Notes", "CreatedAt", "CostCenter", "CostCenterType", "TransportType", "CashAccountCode"]],
      },
    });
  }
}

export async function ensureChartOfAccountsSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Chart_Of_Accounts" } } }],
      },
    });
  }
}
