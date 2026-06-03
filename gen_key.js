const fs = require("fs");
const env = fs.readFileSync("D:/tents/.env.local", "utf-8");
const m = env.match(/^GOOGLE_PRIVATE_KEY="(.*?)"$/m);
if (m) {
  const keyWithNewlines = m[1].replace(/\\n/g, "\n");
  const b64 = Buffer.from(keyWithNewlines, "utf-8").toString("base64");
  console.log("GOOGLE_PRIVATE_KEY=base64:" + b64);
  console.log("\n(انسخ السطر أعلاه كاملًا إلى Vercel)");
}
