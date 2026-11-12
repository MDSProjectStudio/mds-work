#!/usr/bin/env node
/**
 * Avvia la dashboard in modalità ONLINE (login Supabase) contro il progetto di PROVA, solo su localhost.
 *   MDS_ENV_FILE=<file di chiavi del progetto di prova> node tests/isolato/avvia-app-prova.mjs [porta] [--senza-build]
 * Ascolta SOLO su 127.0.0.1 (non sulla rete locale).
 * Costruisce in una cartella separata (.next-prova) e non tocca né .next né .data.
 * Si rifiuta di partire senza MDS_ENV_FILE e senza il marcatore MDS_AMBIENTE=prova nel file.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { envFilePath } from "../../scripts/lib-supabase.mjs";

if (!process.env.MDS_ENV_FILE) {
  console.error("✗ Imposta MDS_ENV_FILE sul file di chiavi del progetto di PROVA (mai .env.local).");
  process.exit(2);
}
const env = {};
for (const line of fs.readFileSync(envFilePath(), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
if (env.MDS_AMBIENTE !== "prova") {
  console.error("✗ Il file non ha il marcatore MDS_AMBIENTE=prova: rifiuto di procedere.");
  process.exit(2);
}
const port = process.argv[2] ?? "3300";
const childEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  MDS_OWNER_EMAIL: env.MDS_OWNER_EMAIL,
  NEXT_DIST_DIR: ".next-prova",
  MDS_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "mds-prova-app-")),
  NEXT_TELEMETRY_DISABLED: "1",
};
const next = path.join("node_modules", "next", "dist", "bin", "next");
if (!process.argv.includes("--senza-build")) {
  console.log("Costruzione (può richiedere un paio di minuti)…");
  const b = spawnSync(process.execPath, [next, "build"], { env: childEnv, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
console.log(`App di prova pronta su http://localhost:${port} (progetto di prova, proprietario ${env.MDS_OWNER_EMAIL})`);
const s = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", port], { env: childEnv, stdio: "inherit" });
s.on("exit", (c) => process.exit(c ?? 0));
