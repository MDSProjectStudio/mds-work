import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Rimuove SOLO la cartella temporanea dei dati di prova creata da playwright.config.ts (mds-e2e-*). */
export default function teardown() {
  const dir = process.env.MDS_E2E_DATA;
  if (dir && path.basename(dir).startsWith("mds-e2e-") && path.dirname(path.resolve(dir)) === path.resolve(os.tmpdir())) {
    rmSync(dir, { recursive: true, force: true });
  }
}
