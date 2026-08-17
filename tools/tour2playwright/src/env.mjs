// Minimal zero-dependency .env loader (avoids pulling in `dotenv`).
// Reads KEY=VALUE lines from tools/tour2playwright/.env into process.env
// without overwriting variables already present in the real environment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env");

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(ENV_PATH)) return;
  const parsed = parseEnv(fs.readFileSync(ENV_PATH, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

// Load immediately on import so `import "./env.mjs"` is enough.
loadEnv();

export const ODOO_URL = () => process.env.ODOO_URL || "http://localhost:8069";
export const ODOO_DB = () => process.env.ODOO_DB || "";
export const ODOO_LOGIN = () => process.env.ODOO_LOGIN || "admin";
export const ODOO_PASSWORD = () => process.env.ODOO_PASSWORD || "admin";
