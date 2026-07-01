import { google } from "googleapis";

let rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
// Handle both real newlines and literal \n sequences
if (!rawKey.includes("-----BEGIN PRIVATE KEY-----")) {
  rawKey = "";
}
const privateKey = rawKey.includes("\\n")
  ? rawKey.replace(/\\n/g, "\n")
  : rawKey;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    private_key: privateKey,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
  ],
});

export const sheets = google.sheets({ version: "v4", auth });
export const docs = google.docs({ version: "v1", auth });
export const drive = google.drive({ version: "v3", auth });
export const calendar = google.calendar({ version: "v3", auth });

export async function checkDriveQuota() {
  try {
    const res = await drive.about.get({ fields: "storageQuota" });
    return res.data.storageQuota;
  } catch (e) {
    return { error: e.message };
  }
}

export async function getSpreadsheetInfo() {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
    return { sheetCount: res.data.sheets?.length, title: res.data.properties?.title };
  } catch (e) {
    return { error: e.message };
  }
}

export async function getDriveFileInfo() {
  try {
    const res = await drive.files.get({
      fileId: process.env.GOOGLE_SHEET_ID,
      fields: "owners,size",
    });
    return res.data;
  } catch (e) {
    return { error: e.message };
  }
}
