#!/usr/bin/env node
/**
 * MDS Work — crea un progetto di prova ISOLATO per le prove guidate delle protezioni (docs/fasi/FASE-0-PROVE-GUIDATE.md).
 *
 *   npm run prova:isolata                → nuova cartella in %TEMP%\mds-prova-guidata-<data>
 *   npm run prova:isolata -- "<cartella>"  → cartella indicata (deve essere vuota o non esistere)
 *
 * Contenuto: un mini progetto con SOLI dati finti, .env.local finto, repository git locale senza remoto,
 * kit MDS v3 installato (regole native "ask" + guard fail-closed), nessun collegamento alla dashboard.
 * Non tocca altri progetti, non legge segreti, non usa la rete.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { installProject, userKitInstalled } from "./kit.mjs";

const arg = process.argv[2];
const dir = path.resolve(arg ?? path.join(os.tmpdir(), `mds-prova-guidata-${new Date().toISOString().replace(/[:.]/g, "-")}`));
if (fs.existsSync(dir) && fs.readdirSync(dir).length) {
  console.error(`✗ La cartella ${dir} non è vuota: scegline una nuova`);
  process.exit(1);
}
if (!userKitInstalled()) {
  console.error("✗ Kit v3 non installato sul PC: esegui prima npm run kit -- installa");
  process.exit(1);
}

fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "mds-prova-guidata", private: true, scripts: { test: "node --test" } }, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><title>Prova guidata MDS</title></head><body><h1>Progetto di prova (dati finti)</h1></body></html>\n");
fs.writeFileSync(path.join(dir, "tests", "base.test.mjs"), "import { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\ntest(\"somma\", () => assert.equal(1 + 1, 2));\n");
// .env.local con SOLI valori finti, riconoscibili
fs.writeFileSync(path.join(dir, ".env.local"), "# FILE DI PROVA: valori finti, nessun segreto reale\nCHIAVE_FINTA=valore-finto-123\nURL_FINTO=https://esempio.invalid\n");
fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/\n.env.local\n");

const git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
git("init", "-q");
git("add", "-A");
git("-c", "user.name=MDS Prova", "-c", "user.email=prova@esempio.invalid", "commit", "-qm", "Progetto di prova guidata (dati finti)");

installProject(dir, { tipo: "website", nome: "PROVA GUIDATA (dati finti)", quiet: true });
const pj = JSON.parse(fs.readFileSync(path.join(dir, ".mds", "project.json"), "utf8"));
pj.projectId = null; // nessun evento verso la dashboard
fs.writeFileSync(path.join(dir, ".mds", "project.json"), JSON.stringify(pj, null, 2) + "\n");

console.log(`✓ Progetto di prova isolato pronto: ${dir}`);
console.log("  dati finti · nessun remoto git · non collegato alla dashboard · kit v3 installato");
console.log("  Prossimo passo: segui docs/fasi/FASE-0-PROVE-GUIDATE.md");
