const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const NEW_TABS = [
  { title: "Inventory_Stock", headers: ["ItemID", "ItemName", "TotalQuantity", "UnderMaintenance"] },
  { title: "Asset_Maintenance_Logs", headers: ["LogID", "ItemID", "StartDate", "EndDate", "Reason"] },
  { title: "Package_Templates", headers: ["TemplateID", "PackageName", "ItemID", "DefaultQuantity"] },
  { title: "Rented_Items", headers: ["ID", "BookingID", "ItemID", "QuantityRequested", "UnitPrice"] },
  { title: "Booking_Expenses", headers: ["ExpenseID", "BookingID", "ExpenseType", "AmountPaid", "Notes"] },
  { title: "General_Expenses_Log", headers: ["LogID", "ItemID", "ExpenseCategory", "Amount", "DateSpent", "Notes"] },
];

const NEW_BOOKING_COLS = ["BookingType", "PackageUsed", "Notes"];

async function init() {
  console.log("Fetching spreadsheet info...");
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = spreadsheet.data.sheets.map((s) => s.properties.title);
  console.log("Existing tabs:", existing.join(", "));

  // Create new tabs
  for (const tab of NEW_TABS) {
    if (existing.includes(tab.title)) {
      console.log(`SKIP ${tab.title} - already exists`);
      continue;
    }
    console.log(`Creating ${tab.title}...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab.title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tab.title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [tab.headers] },
    });
    console.log(`  DONE - ${tab.title}`);
  }

  // Expand Bookings
  if (existing.includes("Bookings")) {
    const headerRow = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A1:N1",
    });
    const currentHeaders = headerRow.data.values?.[0] || [];
    const toAdd = NEW_BOOKING_COLS.filter((h) => !currentHeaders.includes(h));
    if (toAdd.length > 0) {
      const startCol = String.fromCharCode(65 + currentHeaders.length);
      console.log(`Expanding Bookings: adding ${toAdd.join(", ")} starting at col ${startCol}...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Bookings!${startCol}1`,
        valueInputOption: "RAW",
        requestBody: { values: [toAdd] },
      });
      console.log("DONE - Bookings expanded");
    } else {
      console.log("Bookings already has the new columns");
    }
  }

  console.log("\nAll done! New tabs created:");
  const updated = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  updated.data.sheets.forEach((s) => console.log(`  - ${s.properties.title}`));
}

init().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
