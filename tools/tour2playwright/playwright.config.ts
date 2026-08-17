import { defineConfig, devices } from "@playwright/test";
import "./src/env.mjs";

// Base URL of the target Odoo instance (from .env → ODOO_URL).
const baseURL = process.env.ODOO_URL || "http://localhost:8069";

// Where the authenticated session is stored by auth.setup.mjs.
const storageState = "generated/.auth/state.json";

export default defineConfig({
  testDir: "generated/specs",
  // Odoo tours are inherently sequential UI flows — run one at a time so
  // screenshots are deterministic and the target DB isn't hit concurrently.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"], ["html", { outputFolder: "generated/report", open: "never" }]],
  use: {
    baseURL,
    storageState,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    // 1) Log in to Odoo once and persist the session.
    {
      name: "setup",
      testDir: "src",
      testMatch: /auth\.setup\.mjs/,
      use: { storageState: undefined },
    },
    // 2) The generated tour specs, reusing the saved session.
    {
      name: "tours",
      testDir: "generated/specs",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
