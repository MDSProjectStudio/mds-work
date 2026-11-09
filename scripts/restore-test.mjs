#!/usr/bin/env node
/**
 * MDS Work — prova di ripristino di un backup cifrato (offline e isolata).
 *
 *   npm run backup:verifica                 → ultimo backup in %USERPROFILE%\MDS-Backups
 *   npm run backup:verifica -- <file>       → backup indicato
 *   aggiungi --app per avviare anche la dashboard OFFLINE sui dati ripristinati
 *
 * Passi:
 *  1. decifra e verifica autenticità (AES-GCM) + impronta interna
 *  2. confronta il CONTENUTO con la produzione, letta in sola lettura (riga per riga, campo per campo)
 *  3. (--app) avvia la dashboard senza chiavi Supabase in una cartella temporanea isolata,
 *     legge lo stato ripristinato dall'API e lo confronta con il backup; poi cancella la copia in chiaro
 * Non scrive mai su Supabase. Nei log solo esiti e conteggi, mai dati.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { supabase } from "./lib-supabase.mjs";
import { BACKUP_DIR, decryptEnvelope, loadKey, sha256, stable } from "./lib-backup.mjs";
import { countsOf, readAll } from "./backup.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ok = (m) => console.log(`  ✓ ${m}`);
const ko = (m) => console.log(`  ✗ ${m}`);
const info = (m) => console.log(`  · ${m}`);

/** Confronto riga per riga per id: identiche, diverse, mancanti, in più. */
function compareRows(a, b) {
  const ma = new Map(a.map((r) => [String(r.id), stable(r)]));
  const mb = new Map(b.map((r) => [String(r.id), stable(r)]));
  let same = 0, diff = 0, missing = 0;
  for (const [id, s] of ma) {
    if (!mb.has(id)) missing++;
    else if (mb.get(id) === s) same++;
    else diff++;
  }
  const extra = [...mb.keys()].filter((id) => !ma.has(id)).length;
  return { same, diff, missing, extra };
}

/** Confronto delle collezioni dello stato: per ciascuna chiave, uguale o no (+ righe per id se è un elenco). */
function compareState(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const va = a?.[k], vb = b?.[k];
    out[k] = Array.isArray(va) && Array.isArray(vb) && va.every((x) => x && x.id != null) ? compareRows(va, vb) : { equal: stable(va) === stable(vb) };
  }
  return out;
}

const fmt = (r) => ("equal" in r ? (r.equal ? "identico" : "DIVERSO") : `${r.same} identiche${r.diff ? `, ${r.diff} diverse` : ""}${r.missing ? `, ${r.missing} mancanti` : ""}${r.extra ? `, ${r.extra} in più` : ""}`);

function latestBackup() {
  const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".mdsbak")).sort() : [];
  if (!files.length) throw new Error(`Nessun backup in ${BACKUP_DIR}`);
  return path.join(BACKUP_DIR, files.at(-1));
}

const fileHash = (p) => (fs.existsSync(p) ? sha256(fs.readFileSync(p)) : null);

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("La dashboard offline non ha risposto in tempo");
}

/** Avvia la dashboard OFFLINE in una cartella temporanea con i dati ripristinati e legge lo stato dall'API. */
async function appRestore(state) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mds-restore-"));
  const repoData = path.join(ROOT, ".data", "db.json");
  const repoDataBefore = fileHash(repoData);
  const port = 3400 + Math.floor(Math.random() * 400);
  let child;
  try {
    fs.mkdirSync(path.join(tmp, ".data"));
    fs.writeFileSync(path.join(tmp, ".data", "db.json"), JSON.stringify(state));
    // chiavi Supabase VUOTE: Next non le sovrascrive con .env.local → nessun collegamento alla produzione
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", MDS_OWNER_EMAIL: "", NEXT_DIST_DIR: ".next-restore", NEXT_TELEMETRY_DISABLED: "1" };
    delete env.MDS_ALLOW_REMOTE;
    child = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", ROOT, "-p", String(port), "-H", "127.0.0.1"], { cwd: tmp, env, stdio: "ignore", windowsHide: true });
    const view = await waitFor(`http://127.0.0.1:${port}/api/state`, 180_000);
    const written = JSON.parse(fs.readFileSync(path.join(tmp, ".data", "db.json"), "utf8"));
    return { view, written, isolated: fileHash(repoData) === repoDataBefore };
  } finally {
    if (child?.pid) spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    // la copia in chiaro è solo per la durata della prova
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * --sintetico: prova di compatibilità della cassaforte senza dati reali.
 * Crea voci cifrate con il modulo VERO dell'app (lib/vault.ts), le passa per backup cifrato →
 * decifratura → dashboard offline isolata, poi verifica che si decifrino ancora con la password.
 * Non legge né scrive Supabase.
 */
async function syntheticVault() {
  console.log("\nProva sintetica della cassaforte (nessun dato reale)");
  const vault = await import(new URL("../lib/vault.ts", import.meta.url).href);
  const { encryptPayload, PAYLOAD_FORMAT } = await import("./lib-backup.mjs");
  const password = crypto.randomBytes(18).toString("base64url");
  const { meta, key } = await vault.createVault(password);
  const secrets = ["utente-finto@example.test / Pa55-finta-1", "token-finto-abc123", "nota finta con accenti: àèìòù €"];
  const entries = [];
  for (const [i, s] of secrets.entries()) entries.push({ id: `v_sint_${i}`, provider: "other", label: `Voce sintetica ${i}`, ...(await vault.encryptText(key, s)), updatedAt: 1_700_000_000_000 + i });
  const state = { projects: [], tasks: [], agents: [], requests: [], approvals: [], logs: [], payments: [], inbox: [], vault: entries, vaultMeta: meta, library: [], leads: [], quotes: [], studio: { name: "Prova sintetica" }, meta: { seed: 1, version: 1 } };
  const tables = { app_state: [{ id: 1, data: state, updated_at: "sintetico" }], agent_events: [], launch_requests: [] };
  const testKey = crypto.randomBytes(32);
  const env = encryptPayload({ format: PAYLOAD_FORMAT, createdAt: "sintetico", tables, counts: countsOf(tables), sha256: sha256(stable(tables)) }, testKey);
  let failed = 0;
  const restored = decryptEnvelope(env, testKey).tables.app_state[0].data;
  (stable(restored.vault) === stable(entries) && stable(restored.vaultMeta) === stable(meta) ? ok : (failed++, ko))("cassaforte identica byte per byte dopo cifratura e decifratura del backup");
  const { view, isolated } = await appRestore(restored);
  (isolated ? ok : (failed++, ko))("la .data del progetto non è stata toccata");
  (stable(view.vault) === stable(entries) && stable(view.vaultMeta) === stable(meta) ? ok : (failed++, ko))("la dashboard offline ripristinata restituisce la cassaforte invariata");
  const unlocked = await vault.unlockVault(password, view.vaultMeta);
  if (!unlocked) {
    failed++;
    ko("la password non sblocca più la cassaforte ripristinata");
  } else {
    let good = 0;
    for (const [i, e] of view.vault.entries()) if ((await vault.decryptText(unlocked, e.iv, e.ct)) === secrets[i]) good++;
    (good === secrets.length ? ok : (failed++, ko))(`password corretta: ${good}/${secrets.length} voci decifrate identiche agli originali`);
  }
  const wrong = await vault.unlockVault(password + "x", view.vaultMeta);
  (!wrong ? ok : (failed++, ko))("password sbagliata: la cassaforte resta chiusa");
  return failed;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--sintetico")) {
    const failed = await syntheticVault();
    console.log(failed ? `\n✗ Prova sintetica: ${failed} controlli falliti\n` : "\n✓ Prova sintetica della cassaforte superata\n");
    process.exitCode = failed ? 1 : 0;
    return;
  }
  const withApp = args.includes("--app");
  const file = args.find((a) => !a.startsWith("--")) ?? latestBackup();
  console.log(`\nProva di ripristino: ${file}`);
  let failed = 0;

  // 1. decifratura e autenticità
  const env = JSON.parse(fs.readFileSync(file, "utf8"));
  const payload = decryptEnvelope(env, loadKey());
  ok(`decifrato con AES-256-GCM, autenticità e impronta interna verificate (chiave ${env.keyId})`);
  const c = payload.counts;
  info(`contenuto: progetti ${c.progetti} · task ${c.task} · incassi ${c.incassi} · preventivi ${c.preventivi} · lead ${c.lead} · cassaforte ${c.cassaforte_attiva ? `${c.cassaforte_voci} voci` : "non configurata"} · eventi ${c.agent_events} · lanci ${c.launch_requests}`);
  if (stable(countsOf(payload.tables)) !== stable(c)) {
    ko("conteggi interni incoerenti");
    failed++;
  }

  // 1b. manomissione: un byte cambiato deve far fallire la decifratura
  const tampered = { ...env, ciphertext: Buffer.from(env.ciphertext, "base64").map((b, i) => (i === 10 ? b ^ 1 : b)).toString("base64") };
  try {
    decryptEnvelope(tampered, loadKey());
    ko("un file alterato è stato accettato");
    failed++;
  } catch {
    ok("un file alterato viene rifiutato");
  }
  try {
    decryptEnvelope(env, crypto.randomBytes(32));
    ko("una chiave sbagliata è stata accettata");
    failed++;
  } catch {
    ok("una chiave sbagliata viene rifiutata");
  }

  // 2. contenuto rispetto alla produzione (sola lettura)
  const sb = supabase(15000);
  if (sb) {
    const live = await readAll(sb);
    const st = compareState(payload.tables.app_state[0]?.data, live.app_state[0]?.data);
    const vaultSame = stable(payload.tables.app_state[0]?.data?.vault) === stable(live.app_state[0]?.data?.vault) && stable(payload.tables.app_state[0]?.data?.vaultMeta) === stable(live.app_state[0]?.data?.vaultMeta);
    (vaultSame ? ok : ko)(`cassaforte ${vaultSame ? "identica alla produzione, nel formato cifrato originale" : "DIVERSA dalla produzione"}`);
    if (!vaultSame) failed++;
    const changedSince = payload.tables.app_state[0]?.updated_at !== live.app_state[0]?.updated_at;
    info(`stato in produzione ${changedSince ? "modificato dopo il backup (differenze attese su log/agenti)" : "invariato dal backup"}`);
    for (const [k, r] of Object.entries(st)) {
      const bad = "equal" in r ? !r.equal : r.diff + r.missing > 0;
      (bad ? (changedSince ? info : ko) : ok)(`${k}: ${fmt(r)}`);
      if (bad && !changedSince) failed++;
    }
    for (const t of ["agent_events", "launch_requests"]) {
      const r = compareRows(payload.tables[t], live[t]);
      (r.diff + r.missing ? ko : ok)(`${t}: ${fmt(r)}${r.extra ? " (righe nuove dopo il backup)" : ""}`);
      if (r.diff + r.missing) failed++;
    }
  } else info("chiavi Supabase non disponibili: confronto con la produzione saltato");

  // 3. ripristino nell'app offline isolata
  if (withApp) {
    console.log("\n  Avvio la dashboard OFFLINE in una cartella temporanea isolata…");
    const original = payload.tables.app_state[0]?.data;
    const { view, written, isolated } = await appRestore(original);
    (isolated ? ok : ko)(`la .data del progetto non è stata toccata`);
    if (!isolated) failed++;
    // collezioni che il motore della dashboard non modifica da solo
    const stableKeys = ["projects", "quotes", "leads", "library", "vault", "vaultMeta", "studio", "requests"];
    for (const k of stableKeys) {
      const r = Array.isArray(original?.[k]) ? compareRows(original[k], view[k] ?? []) : { equal: stable(original?.[k]) === stable(view[k]) };
      const bad = "equal" in r ? !r.equal : r.diff + r.missing + r.extra > 0;
      (bad ? ko : ok)(`app ripristinata · ${k}: ${fmt(r)}`);
      if (bad) failed++;
    }
    // collezioni che la simulazione può far avanzare: nessuna voce persa
    for (const k of ["tasks", "payments", "inbox", "approvals"]) {
      const r = compareRows(original?.[k] ?? [], view[k] ?? []);
      (r.missing ? ko : ok)(`app ripristinata · ${k}: ${r.missing ? `${r.missing} voci perse` : `nessuna voce persa (${r.same} identiche${r.diff ? `, ${r.diff} aggiornate dal motore` : ""}${r.extra ? `, ${r.extra} generate` : ""})`}`);
      if (r.missing) failed++;
    }
    (written ? ok : ko)("lo stato ripristinato è stato letto e salvato solo nella cartella temporanea (poi eliminata)");
  }

  console.log(failed ? `\n✗ Prova di ripristino: ${failed} controlli falliti\n` : "\n✓ Prova di ripristino superata\n");
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
});
