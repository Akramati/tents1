const { google } = require("googleapis");
const fs = require("fs");
const env = fs.readFileSync(".env.local","utf8").split("\n").reduce((a,l)=>{
  const m = l.match(/^(\w+)=(.+)/);
  if (m) a[m[1]] = m[2].replace(/["']/g,"");
  return a;
}, {});
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
(async () => {
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
  const sid = env.GOOGLE_SHEET_ID;
  const purch = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: "Supplier_Purchases!A2:L" });
  const rows = purch.data.values || [];
  console.log("=== ALL PURCHASES WITH STATUS ===");
  for (const r of rows) {
    console.log(`${r[0]}: date=${r[2]} desc=${r[3]} total=${r[4]} paid=${r[5]} status=${r[8]||"open"} journalId=${r[11]||""}`);
    if (r[10]) {
      try { console.log("  items:", JSON.stringify(JSON.parse(r[10]).map(i=>({id:i.itemId||i.itemName,q:i.quantity,amt:i.amount})))); } catch {}
    }
  }
})();
