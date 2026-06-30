const { sheets } = require("../src/lib/google");
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function clear() {
  const sheetsToClear = [
    { range: "Bookings!A2:AF", sheet: "Bookings" },
    { range: "Rented_Items!A2:E", sheet: "Rented_Items" },
    { range: "Finance_Ledger!A2:M", sheet: "Finance_Ledger" },
    { range: "Asset_Maintenance_Logs!A2:D", sheet: "Asset_Maintenance_Logs" },
  ];
  for (const { range, sheet } of sheetsToClear) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values || [];
    if (rows.length === 0) { console.log(sheet + ": \u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A"); continue; }
    const emptyRows = rows.map(() => new Array(rows[0].length).fill(""));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range, valueInputOption: "RAW",
      requestBody: { values: emptyRows },
    });
    console.log(sheet + ": \u062A\u0645 \u0645\u0633\u062D " + rows.length + " \u0635\u0641");
  }
  console.log("\u2705 \u062A\u0645");
}
clear().catch(e => console.error(e));
