// Script to empty the Service Account's Drive trash and list files consuming storage
import { google } from "googleapis";
import { readFileSync } from "fs";

// Load env manually
const envContent = readFileSync(".env.local", "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^(\w+)="(.*)"/s);
  if (match) envVars[match[1]] = match[2].replace(/\\n/g, "\n");
});

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: envVars.GOOGLE_PRIVATE_KEY,
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function main() {
  console.log("=== Checking Service Account Drive Storage ===\n");
  
  // 1. Get storage info
  try {
    const about = await drive.about.get({ fields: "storageQuota" });
    const quota = about.data.storageQuota;
    console.log(`Storage limit: ${(parseInt(quota.limit) / 1e9).toFixed(2)} GB`);
    console.log(`Storage used: ${(parseInt(quota.usage) / 1e9).toFixed(2)} GB`);
    console.log(`In trash: ${(parseInt(quota.usageInDriveTrash || 0) / 1e9).toFixed(2)} GB`);
    console.log();
  } catch (e) {
    console.error("Could not get storage info:", e.message);
  }

  // 2. Empty the trash
  console.log("=== Emptying Trash ===");
  try {
    await drive.files.emptyTrash({});
    console.log("✅ Trash emptied successfully!\n");
  } catch (e) {
    console.error("❌ Could not empty trash:", e.message);
  }

  // 3. List all files owned by service account
  console.log("=== All Files in Service Account Drive ===");
  let allFiles = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: "'me' in owners",
      fields: "nextPageToken, files(id, name, size, mimeType, createdTime)",
      pageSize: 100,
      pageToken: pageToken,
    });
    allFiles = allFiles.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${allFiles.length} files:`);
  let totalSize = 0;
  allFiles.forEach((f) => {
    const sizeMB = f.size ? (parseInt(f.size) / 1e6).toFixed(2) : "0.00";
    totalSize += parseInt(f.size || 0);
    console.log(`  - ${f.name} (${sizeMB} MB) [${f.mimeType}]`);
  });
  console.log(`\nTotal size of listed files: ${(totalSize / 1e9).toFixed(2)} GB`);

  // 4. Delete old contract files to free space (keep template)
  const templateId = envVars.GOOGLE_DOC_TEMPLATE_ID;
  const folderId = envVars.GOOGLE_DRIVE_FOLDER_ID;
  const contractFiles = allFiles.filter(
    (f) => f.id !== templateId && f.id !== folderId && f.name.includes("عقد إيجار")
  );
  
  if (contractFiles.length > 0) {
    console.log(`\n=== Deleting ${contractFiles.length} old contract files to free space ===`);
    for (const f of contractFiles) {
      try {
        await drive.files.delete({ fileId: f.id });
        console.log(`  ✅ Deleted: ${f.name}`);
      } catch (e) {
        console.error(`  ❌ Failed to delete ${f.name}: ${e.message}`);
      }
    }
  }

  // 5. Check storage again after cleanup
  try {
    const about = await drive.about.get({ fields: "storageQuota" });
    const quota = about.data.storageQuota;
    console.log(`\n=== Storage After Cleanup ===`);
    console.log(`Storage used: ${(parseInt(quota.usage) / 1e9).toFixed(2)} GB`);
    console.log(`Storage limit: ${(parseInt(quota.limit) / 1e9).toFixed(2)} GB`);
    const freeGB = (parseInt(quota.limit) - parseInt(quota.usage)) / 1e9;
    console.log(`Free space: ${freeGB.toFixed(2)} GB`);
  } catch (e) {
    console.error("Could not get storage info:", e.message);
  }
}

main().catch(console.error);
