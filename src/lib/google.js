import { google } from "googleapis";

// Decode private key: supports raw PEM, escaped \n, or base64
function getPrivateKey() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || "";
  // If it's base64 (starts with base64: prefix)
  if (raw.startsWith("base64:")) {
    return Buffer.from(raw.slice(7), "base64").toString("utf-8").replace(/\\n/g, "\n");
  }
  // Replace escaped newlines (for .env.local format)
  return raw.replace(/\\n/g, "\n");
}

// Initialize Google Auth client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: getPrivateKey(),
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
