// Playwright "setup" project: log in to Odoo once and persist the session so
// the generated tour specs can reuse it via storageState.
import { test as setup, expect } from "@playwright/test";
import "./env.mjs";

const AUTH_FILE = "generated/.auth/state.json";

setup("authenticate to Odoo", async ({ page }) => {
  const db = process.env.ODOO_DB || "";
  const login = process.env.ODOO_LOGIN || "admin";
  const password = process.env.ODOO_PASSWORD || "admin";

  await page.goto("/web/login");

  // Some multi-db instances render a database <select> on the login page.
  const dbField = page.locator('select[name="db"], input[name="db"]');
  if (db && (await dbField.count())) {
    await dbField.first().fill(db).catch(async () => {
      await dbField.first().selectOption(db).catch(() => {});
    });
  }

  await page.locator('input[name="login"]').fill(login);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Successful login lands in the web client.
  await page.waitForURL(/\/(web|odoo)(\b|\/|#|$)/, { timeout: 30_000 });
  await expect(page.locator(".o_main_navbar, .o_web_client")).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
