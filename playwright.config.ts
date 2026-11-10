import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Test dei flussi nel browser (Fase 1 · M4) — SOLO modalità offline con dati demo finti:
 * - le variabili Supabase sono svuotate per il server di prova (nessun collegamento alla produzione);
 * - i dati vivono in una cartella temporanea nuova (MDS_DATA_DIR), mai in .data;
 * - in locale si usa Microsoft Edge già installato (nessun browser scaricato); in CI il Chromium di Playwright.
 * Avvio: npm run test:e2e
 */
process.env.MDS_E2E_DATA ??= mkdtempSync(path.join(os.tmpdir(), "mds-e2e-"));
const PORT = Number(process.env.MDS_E2E_PORT ?? 3200);
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  outputDir: path.join(os.tmpdir(), "mds-e2e-risultati"),
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: CI ? "retain-on-failure" : "off",
    ...(CI ? {} : { channel: "msedge" }),
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(CI ? {} : { channel: "msedge" }) } }],
  webServer: {
    // build di produzione in una cartella separata (.next-e2e): stabile e senza toccare .next
    command: `node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/me`,
    reuseExistingServer: false,
    timeout: 400_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      MDS_DATA_DIR: process.env.MDS_E2E_DATA,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
