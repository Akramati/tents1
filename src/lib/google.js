import { google } from "googleapis";

// Initialize Google Auth client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Replace escaped newlines in private key
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
  ],
});

export const sheets = google.sheets({ version: "v4", auth });
export const docs = google.google?.docs?.({ version: "v1", auth }) || google.docs({ version: "v1", auth });
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
