#!/usr/bin/env node
/**
 * MDS Work — backup cifrato dei dati della dashboard (SOLA LETTURA su Supabase).
 *
 *   npm run backup                          → nuovo backup cifrato in %USERPROFILE%\MDS-Backups
 *   npm run backup -- esporta-chiave <dir>  → copia di emergenza della chiave (da conservare offline)
 *   npm run backup -- importa-chiave <file> → ricrea la custodia DPAPI da una copia di emergenza
 *
 * Tabelle salvate: app_state (tutto lo stato, cassaforte inclusa nel suo formato cifrato originale),
 * agent_events, launch_requests. Nessuna scrittura su Supabase. Nei log solo conteggi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase } from "./lib-supabase.mjs";
import { BACKUP_DIR, KEY_FILE, PAYLOAD_FORMAT, encryptPayload, exportKey, importKey, loadKey, sha256, stable } from "./lib-backup.mjs";

const TABLES = {
  app_state: { query: "?select=id,data,updated_at&order=id.asc" },
  agent_events: { query: "?select=*&order=id.asc", paged: true },
  launch_requests: { query: "?select=*&order=id.asc", paged: true },
};

/** Legge una tabella intera in sola lettura (a pagine da 1000 righe). */
export async function readTable(sb, name) {
  const t = TABLES[name];
  if (!t.paged) return sb.select(name, t.query);
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await sb.select(name, `${t.query}&limit=1000&offset=${offset}`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export async function readAll(sb) {
  const tables = {};
  for (const name of Object.keys(TABLES)) tables[name] = await readTable(sb, name);
  return tables;
}

export function countsOf(tables) {
  const st = tables.app_state?.[0]?.data ?? {};
  return {
    app_state: tables.app_state.length,
    agent_events: tables.agent_events.length,
    launch_requests: tables.launch_requests.length,
    progetti: st.projects?.length ?? 0,
    task: st.tasks?.length ?? 0,
    incassi: st.payments?.length ?? 0,
    preventivi: st.quotes?.length ?? 0,
    lead: st.leads?.length ?? 0,
    cassaforte_voci: st.vault?.length ?? 0,
    cassaforte_attiva: Boolean(st.vaultMeta),
    libreria: st.library?.length ?? 0,
  };
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "esporta-chiave") {
    if (!arg) throw new Error("Indica la cartella di destinazione, es. una chiavetta USB");
    console.log(`✓ Copia di emergenza della chiave scritta in: ${exportKey(path.resolve(arg))}\n  Conservala offline e cancellala da questo PC se non serve qui.`);
    return;
  }
  if (cmd === "importa-chiave") {
    if (!arg) throw new Error("Indica il file della copia di emergenza");
    console.log(`✓ Chiave ${importKey(path.resolve(arg))} custodita di nuovo con DPAPI`);
    return;
  }

  const sb = supabase(15000);
  if (!sb) throw new Error("Chiavi Supabase non trovate in .env.local: backup impossibile");
  // 1. chiave prima di leggere i dati: se la cifratura non è garantita, non esporto nulla
  const created = !fs.existsSync(KEY_FILE);
  const key = loadKey({ create: true });
  if (created) console.log(`✓ Nuova chiave dei backup creata e custodita con DPAPI in ${KEY_FILE}`);

  // 2. lettura (solo SELECT)
  const tables = await readAll(sb);
  const createdAt = new Date().toISOString();
  const payload = { format: PAYLOAD_FORMAT, createdAt, source: "supabase", tables, counts: countsOf(tables), sha256: sha256(stable(tables)) };

  // 3. cifratura e scrittura atomica
  const env = encryptPayload(payload, key, createdAt);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `mds-backup-${createdAt.replace(/[:.]/g, "-")}.mdsbak`);
  fs.writeFileSync(file + ".tmp", JSON.stringify(env));
  fs.renameSync(file + ".tmp", file);

  const c = payload.counts;
  console.log(`✓ Backup cifrato (AES-256-GCM, chiave ${env.keyId}): ${file} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  console.log(`  righe: app_state ${c.app_state} · agent_events ${c.agent_events} · launch_requests ${c.launch_requests}`);
  console.log(`  contenuto: progetti ${c.progetti} · task ${c.task} · incassi ${c.incassi} · preventivi ${c.preventivi} · lead ${c.lead} · libreria ${c.libreria} · cassaforte ${c.cassaforte_attiva ? `attiva, ${c.cassaforte_voci} voci (restano cifrate)` : "non configurata"}`);
  console.log(`  Verifica: npm run backup:verifica -- "${file}"`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  });
}
