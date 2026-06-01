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
