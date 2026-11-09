#!/usr/bin/env node
/**
 * MDS Work — backup cifrato dei dati della dashboard (SOLA LETTURA su Supabase).
 *
 *   npm run backup                          → nuovo backup cifrato in %USERPROFILE%\MDS-Backups
 *   npm run backup -- esporta-chiave <dir>  → copia di emergenza PROTETTA da frase segreta (scrypt + AES-256-GCM)
 *   npm run backup -- esporta-chiave <dir> --non-cifrata → copia IN CHIARO (solo su supporto già cifrato)
 *   npm run backup -- importa-chiave <file> → ricrea la custodia DPAPI da una copia di emergenza
 *
 * Tabelle salvate: app_state (tutto lo stato, cassaforte inclusa nel suo formato cifrato originale),
 * agent_events, launch_requests. Nessuna scrittura su Supabase. Nei log solo conteggi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase } from "./lib-supabase.mjs";
import { BACKUP_DIR, EXPORT_PROTECTED, KEY_FILE, MIN_PASSPHRASE, PAYLOAD_FORMAT, encryptPayload, exportKeyPlain, exportKeyProtected, importKey, loadKey, sha256, stable } from "./lib-backup.mjs";

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

/** Legge una frase segreta dal terminale senza mostrarla. Rifiuta pipe e file: la frase non deve finire in log o chat. */
function askHidden(question) {
  if (!process.stdin.isTTY) throw new Error("La frase segreta si inserisce solo da un terminale interattivo (mai da file, pipe o chat)");
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let s = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(s);
          return;
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") s = s.slice(0, -1);
        else s += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const [cmd, arg] = args;
  if (cmd === "esporta-chiave") {
    if (!arg || arg.startsWith("--")) throw new Error("Indica la cartella di destinazione, es. una chiavetta USB");
    if (args.includes("--non-cifrata")) {
      const file = exportKeyPlain(path.resolve(arg));
      console.log(`⚠ Copia NON CIFRATA della chiave scritta in: ${file}\n  Chi possiede questo file può leggere tutti i backup: tienilo solo su un supporto cifrato (es. BitLocker To Go).`);
      return;
    }
    console.log(`Copia protetta della chiave. Scegli una frase segreta di almeno ${MIN_PASSPHRASE} caratteri e conservala in un posto DIVERSO dal file (es. password manager).`);
    const p1 = await askHidden("Frase segreta: ");
    const p2 = await askHidden("Ripeti la frase segreta: ");
    if (p1 !== p2) throw new Error("Le due frasi non coincidono: niente è stato scritto");
    console.log(`✓ Copia protetta della chiave scritta in: ${exportKeyProtected(path.resolve(arg), p1)}`);
    return;
  }
  if (cmd === "importa-chiave") {
    if (!arg) throw new Error("Indica il file della copia di emergenza");
    const j = JSON.parse(fs.readFileSync(path.resolve(arg), "utf8"));
    const passphrase = j.format === EXPORT_PROTECTED ? await askHidden("Frase segreta della copia: ") : undefined;
    console.log(`✓ Chiave ${importKey(path.resolve(arg), { passphrase })} custodita di nuovo con DPAPI`);
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
