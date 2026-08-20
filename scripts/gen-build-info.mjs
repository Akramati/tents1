import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

let sha = "unknown";
let date = "";
try {
  sha = execSync("git rev-parse --short HEAD").toString().trim();
  date = execSync("git log -1 --format=%cI").toString().trim();
} catch (e) {}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "lib");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "buildInfo.js"),
  `export const BUILD_SHA = ${JSON.stringify(sha)};\nexport const BUILD_TIME = ${JSON.stringify(date)};\n`,
  "utf8"
);
console.log(`buildInfo: ${sha} ${date}`);