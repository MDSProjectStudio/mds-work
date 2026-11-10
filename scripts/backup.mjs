#!/usr/bin/env node
/**
 * MDS Work — backup cifrato dei dati della dashboard (SOLA LETTURA su Supabase).
 *
 *   npm run backup                          → nuovo backup cifrato in %USERPROFILE%\MDS-Backups
 *   npm run backup -- esporta-chiave <dir>  → copia di emergenza PROTETTA da frase segreta (scrypt + AES-256-GCM)
 *   npm run backup -- esporta-chiave <dir> --non-cifrata → copia IN CHIARO (solo su supporto già cifrato)
 *   npm run backup -- importa-chiave <file> → ricrea la custodia DPAPI da una copia di emergenza
 *   npm run backup -- --pianificato [--conserva N] → per l'attività pianificata (Fase 1 · M6): scrive in
 *        MDS-Backupspianificati, NON crea chiavi nuove, verifica il file appena scritto e poi tiene solo gli
 *        ultimi N backup DI QUELLA SOTTOCARTELLA (predefinito 8, minimo 2). I backup fuori da lì non vengono mai toccati.
 *
 * Tabelle salvate: app_state (tutto lo stato, cassaforte inclusa nel suo formato cifrato originale),
 * agent_events, launch_requests e, se le migrazioni della Fase 1 sono applicate, anche app_config,
 * applied_actions, app_state_history, portal_requests, error_events (facoltative: se mancano si saltano).
 * Nessuna scrittura su Supabase. Nei log solo conteggi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase } from "./lib-supabase.mjs";
import { BACKUP_DIR, EXPORT_PROTECTED, KEY_FILE, MIN_PASSPHRASE, PAYLOAD_FORMAT, decryptEnvelope, encryptPayload, exportKeyPlain, exportKeyProtected, importKey, loadKey, sha256, stable } from "./lib-backup.mjs";

const TABLES = {
  app_state: { query: "?select=*&order=id.asc" },
  agent_events: { query: "?select=*&order=id.asc", paged: true },
  launch_requests: { query: "?select=*&order=id.asc", paged: true },
  // Fase 1 (M2, M3, M6): esistono solo dopo le migrazioni → facoltative
  app_config: { query: "?select=*", optional: true },
  applied_actions: { query: "?select=*&order=action_id.asc", paged: true, optional: true },
  app_state_history: { query: "?select=*&order=id.asc", paged: true, optional: true },
  portal_requests: { query: "?select=*&order=created_at.asc", paged: true, optional: true },
  error_events: { query: "?select=*&order=id.asc", paged: true, optional: true },
};
/** Tabella inesistente (migrazione non applicata): PostgREST risponde 404 / PGRST205. */
const missingTable = (e) => /^404 |PGRST205|does not exist|schema cache/i.test(String(e?.message ?? e));

export const SCHEDULED_SUBDIR = "pianificati";
const BACKUP_NAME = /^mds-backup-[0-9TZ-]+.mdsbak$/;

/**
 * Rotazione dei backup PIANIFICATI: agisce solo nella sottocartella "pianificati" e solo sui file
 * mds-backup-*.mdsbak; tiene i `keep` più recenti (minimo 2). Restituisce i nomi rimossi.
 */
export function rotateScheduled(dir, keep) {
  if (path.basename(path.resolve(dir)) !== SCHEDULED_SUBDIR) throw new Error("Rotazione consentita solo nella cartella dei backup pianificati");
  const n = Math.max(2, Math.floor(Number(keep) || 8));
  const files = fs.readdirSync(dir).filter((f) => BACKUP_NAME.test(f)).sort();
  const remove = files.slice(0, Math.max(0, files.length - n));
  for (const f of remove) fs.unlinkSync(path.join(dir, f));
  return remove;
}

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
  for (const name of Object.keys(TABLES)) {
    try {
      tables[name] = await readTable(sb, name);
    } catch (e) {
      if (TABLES[name].optional && missingTable(e)) continue; // migrazione non ancora applicata
      throw e;
    }
  }
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
    ...Object.fromEntries(Object.keys(TABLES).filter((n) => TABLES[n].optional && tables[n]).map((n) => [n, tables[n].length])),
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

  const scheduled = args.includes("--pianificato");
  const outDir = scheduled ? path.join(BACKUP_DIR, SCHEDULED_SUBDIR) : BACKUP_DIR;
  const sb = supabase(15000);
  if (!sb) throw new Error("Chiavi Supabase non trovate in .env.local: backup impossibile");
  // 1. chiave prima di leggere i dati: se la cifratura non è garantita, non esporto nulla.
  //    In modalità pianificata NON si crea mai una chiave nuova (sarebbe una chiave senza copia di emergenza).
  const created = !fs.existsSync(KEY_FILE);
  if (scheduled && created) throw new Error("Chiave dei backup assente: il backup pianificato non ne crea una nuova. Esegui prima npm run backup a mano.");
  const key = loadKey({ create: !scheduled });
  if (created) console.log(`✓ Nuova chiave dei backup creata e custodita con DPAPI in ${KEY_FILE}`);

  // 2. lettura (solo SELECT)
  const tables = await readAll(sb);
  const createdAt = new Date().toISOString();
  const payload = { format: PAYLOAD_FORMAT, createdAt, source: "supabase", tables, counts: countsOf(tables), sha256: sha256(stable(tables)) };

  // 3. cifratura e scrittura atomica
  const env = encryptPayload(payload, key, createdAt);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `mds-backup-${createdAt.replace(/[:.]/g, "-")}.mdsbak`);
  fs.writeFileSync(file + ".tmp", JSON.stringify(env));
  fs.renameSync(file + ".tmp", file);
  // 4. (pianificato) verifica del file appena scritto, POI rotazione: mai rimuovere i vecchi se il nuovo non è buono
  if (scheduled) {
    const back = decryptEnvelope(JSON.parse(fs.readFileSync(file, "utf8")), key);
    if (back.sha256 !== payload.sha256 || sha256(stable(back.tables)) !== payload.sha256) throw new Error("Verifica del backup appena scritto NON riuscita: nessuna rotazione");
    const i = args.indexOf("--conserva");
    const removed = rotateScheduled(outDir, i >= 0 ? args[i + 1] : 8);
    console.log(`✓ Verificato. Backup pianificati conservati in ${outDir}; rimossi i più vecchi: ${removed.length}`);
  }

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
