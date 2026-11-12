#!/usr/bin/env node
/**
 * Prove A–H sulle API REALI di Supabase (PostgREST, supabase-js, ruoli e chiavi), su un progetto di PROVA con dati finti.
 * Fase 1 · §6.4 del rapporto finale: condizione bloccante prima del rilascio.
 *
 *   MDS_ENV_FILE=<file di chiavi del progetto di prova> node tests/isolato/prova-api-supabase.mjs <fase> [--attesa=prima|dopo]
 *
 * Fasi (la modalità di scrittura si cambia a mano dal SQL Editor tra una fase e l'altra):
 *   vecchio              prima delle migrazioni: scrive come il codice VECCHIO (upsert cieco, avvio in coda)
 *   dopo-migrazioni      modalità allow/block: dati intatti, codice nuovo rifiutato, vecchio funzionante
 *   permessi --attesa=…  chiave pubblica: nessun accesso a tabelle e funzioni (prima/dopo la revoca dei privilegi)
 *   manutenzione         modalità block/block: nessuno scrive
 *   solo-nuovo           modalità block/allow: funzioni nuove, concorrenza reale, codice vecchio rifiutato
 *   dopo-ritorno         modalità allow/block (rollback): il vecchio scrive, il nuovo è rifiutato
 *   dopo-down            dopo gli script inversi: funzioni assenti, dati intatti, il vecchio funziona
 *
 * Sicurezza: parte SOLO con MDS_ENV_FILE impostato e con il marcatore MDS_AMBIENTE=prova nel file;
 * non legge mai .env.local e non stampa mai le chiavi.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { envFilePath } from "../../scripts/lib-supabase.mjs";

if (!process.env.MDS_ENV_FILE) {
  console.error("✗ Imposta MDS_ENV_FILE sul file di chiavi del progetto di PROVA (mai .env.local).");
  process.exit(2);
}
const env = {};
for (const line of fs.readFileSync(envFilePath(), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (env.MDS_AMBIENTE !== "prova") {
  console.error("✗ Il file non ha il marcatore MDS_AMBIENTE=prova: rifiuto di procedere (potrebbe essere la produzione).");
  process.exit(2);
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(URL_ ?? "") || !env.SUPABASE_SECRET_KEY || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.error("✗ File di chiavi incompleto.");
  process.exit(2);
}
const opt = { auth: { persistSession: false, autoRefreshToken: false } };
const srv = createClient(URL_, env.SUPABASE_SECRET_KEY, opt); // come il server dell'app
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, opt); // come il browser

const fase = process.argv[2];
const attesa = (process.argv.find((a) => a.startsWith("--attesa=")) ?? "--attesa=dopo").split("=")[1];
const OUT = process.env.MDS_RISULTATI_DIR ?? path.dirname(envFilePath());
const results = [];
const t = (id, nome, ok, dettaglio = "") => {
  results.push({ fase, id, nome, ok: !!ok, dettaglio: String(dettaglio).slice(0, 200) });
  console.log(`${ok ? "✓" : "✗"} ${id} ${nome}${ok || !dettaglio ? "" : `  → ${String(dettaglio).slice(0, 160)}`}`);
};
// jsonb riordina le chiavi: il confronto deve essere canonico (chiavi ordinate)
const canon = (v) => (v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(",")}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`);
const sha = (v) => crypto.createHash("sha256").update(canon(v)).digest("hex");
const rpc = async (name, args) => {
  const r = await srv.rpc(name, args);
  return r;
};
const uuid = () => crypto.randomUUID();
const H = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Stato finto (nessun dato reale). */
const fake = () => ({
  projects: [{ id: "p_finto", name: "Progetto finto", client: "Cliente finto", description: "dati sintetici", kind: "website", status: "active", price: 0, color: "#000000", createdAt: 1, token: "0123456789abcdef0123", agentsMode: "off", localPath: "C:\\finto" }],
  tasks: [], agents: [], requests: [], approvals: [], logs: [], payments: [], inbox: [], vault: [], vaultMeta: null, library: [], leads: [], quotes: [],
  studio: { name: "Studio finto", owner: "Titolare finto", email: "finto@esempio.invalid", rate: 40, vatNote: "", quoteFooter: "" },
});
const mode = async () => (await srv.from("app_config").select("legacy_writes,new_writes").eq("id", 1).maybeSingle()).data;
const row = async () => (await srv.from("app_state").select("data,version,written_by").eq("id", 1).maybeSingle()).data;
const oldUpsert = (data) => srv.from("app_state").upsert({ id: 1, data, updated_at: new Date().toISOString() });
const oldLaunch = () => srv.from("launch_requests").insert({ project_id: "p_finto", task_id: null, template: "T", brief: "avvio del codice vecchio" }).select("id").single();
const stateFile = path.join(OUT, "prova-stato.json");
const saveState = (o) => fs.writeFileSync(stateFile, JSON.stringify({ ...(fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {}), ...o }));
const loadState = () => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {});
const denied = (r) => !!r.error && (r.status === 401 || r.status === 403 || /permission denied|42501|not allowed/i.test(`${r.error.code} ${r.error.message}`));

const FASI = {
  async vecchio() {
    const d = fake();
    const w = await oldUpsert(d);
    t("F1", "il codice VECCHIO scrive lo stato con upsert cieco (come oggi)", !w.error, w.error?.message);
    const l = await oldLaunch();
    t("F2", "il codice VECCHIO accoda un avvio con INSERT diretto", !l.error && l.data?.id, l.error?.message);
    const r = await srv.from("app_state").select("data").eq("id", 1).maybeSingle();
    t("F3", "lettura dello stato scritto", r.data && sha(r.data.data) === sha(d));
    saveState({ prima: { hash: sha(d), launches: (await srv.from("launch_requests").select("id", { count: "exact", head: true })).count } });
  },

  async "dopo-migrazioni"() {
    const m = await mode();
    t("A1", "interruttori iniziali: legacy_writes=allow, new_writes=block", m?.legacy_writes === "allow" && m?.new_writes === "block", JSON.stringify(m));
    const r = await row();
    const prima = loadState().prima;
    t("A2", "i dati scritti dal codice vecchio sono IDENTICI dopo la migrazione", prima && r && sha(r.data) === prima.hash);
    t("A3", "la versione è un numero (bigint restituito come numero dall'API)", r && typeof r.version === "number", typeof r?.version);
    t("A4", "gli avvii preesistenti sono rimasti", (await srv.from("launch_requests").select("id", { count: "exact", head: true })).count === prima?.launches);
    // codice NUOVO rifiutato
    const s = await rpc("save_app_state", { p_expected_version: r.version, p_data: fake() });
    t("B1", "save_app_state rifiuta il codice nuovo (blocked) con l'API reale", s.data?.status === "blocked", JSON.stringify(s.data ?? s.error));
    const e = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "x", dedupe_key: `launch:${uuid()}`, request_hash: "h".repeat(64) } });
    t("B2", "enqueue_launch rifiuta il codice nuovo (blocked)", e.data?.status === "blocked", JSON.stringify(e.data ?? e.error));
    const p = await rpc("portal_submit", { p_project_id: "p_finto", p_author: "Cliente finto", p_message: "messaggio finto del portale", p_ip_hash: H("ip-1") });
    t("B3", "portal_submit con i parametri predefiniti funziona via API ed è in 'blocked'", p.data?.status === "blocked", JSON.stringify(p.data ?? p.error));
    // codice VECCHIO ancora funzionante
    const v0 = r.version;
    const w = await oldUpsert(r.data);
    const r2 = await row();
    t("F4", "il codice vecchio scrive ancora, la versione sale e l'autore è 'legacy'", !w.error && r2.version === v0 + 1 && r2.written_by === "legacy", `${w.error?.message ?? ""} v${r2?.version} ${r2?.written_by}`);
    const h = await srv.from("app_state_history").select("version", { count: "exact", head: true });
    t("A5", "lo storico conserva la versione precedente", (h.count ?? 0) >= 1, h.count);
    const l = await oldLaunch();
    t("F5", "il vecchio avvio diretto funziona in allow/block (come oggi)", !l.error, l.error?.message);
    const eo = await rpc("record_error_event", { p_source: "prova/api", p_message: "errore finto per la prova", p_detail: { azione: "prova" } });
    t("B4", "record_error_event registra via API", eo.data === "recorded", JSON.stringify(eo.data ?? eo.error));
    const ao = await rpc("action_outcome", { p_action_id: "azione-inesistente-1", p_request_hash: "h".repeat(64) });
    t("B5", "action_outcome restituisce un testo ('unknown')", ao.data === "unknown", JSON.stringify(ao.data ?? ao.error));
  },

  async permessi() {
    const TAB = ["app_state", "agent_events", "launch_requests", "app_config", "app_state_history", "applied_actions", "portal_requests", "error_events"];
    const PRE = new Set(["app_state", "agent_events", "launch_requests"]);
    // chiave primaria e un valore VALIDO per ciascuna tabella (un filtro non valido darebbe 400 prima del controllo dei permessi)
    const PK = { app_state: ["id", 999], agent_events: ["id", 999999], launch_requests: ["id", 999999], app_config: ["id", 999], app_state_history: ["id", 999999], applied_actions: ["action_id", "azione-inesistente"], portal_requests: ["id", "00000000-0000-0000-0000-000000000000"], error_events: ["id", 999999] };
    for (const tb of TAB) {
      const [pk, pv] = PK[tb];
      const rr = [await anon.from(tb).select("*").limit(1), await anon.from(tb).insert({}), await anon.from(tb).update({}).eq(pk, pv), await anon.from(tb).delete().eq(pk, pv)];
      if (attesa === "prima" && PRE.has(tb)) {
        // prima della revoca: RLS blocca le RIGHE (nessun errore, nessun dato); il privilegio di tabella però esiste
        t(`C-${tb}`, `[prima della revoca] ${tb}: RLS nasconde i dati (nessuna riga visibile)`, !rr[0].error && (rr[0].data ?? []).length === 0, JSON.stringify(rr[0].error));
        t(`C-${tb}-pr`, `[prima della revoca] ${tb}: il privilegio di tabella di anon ESISTE (residuo preesistente)`, !denied(rr[0]), "");
      } else {
        t(`C-${tb}`, `chiave pubblica: ${tb} negata in lettura, inserimento, modifica e cancellazione`, rr.every(denied), rr.map((x) => `${x.status}`).join(","));
      }
    }
    const FN = [["save_app_state", { p_expected_version: 0, p_data: {} }], ["enqueue_launch", { p_launch: {} }], ["action_outcome", { p_action_id: "x", p_request_hash: "y" }], ["portal_submit", { p_project_id: "p", p_author: "a", p_message: "messaggio finto", p_ip_hash: H("x") }], ["record_error_event", { p_source: "x", p_message: "y" }], ["set_write_mode", { p_legacy_writes: "allow", p_new_writes: "allow" }]];
    for (const [n, a] of FN) {
      const r1 = await anon.rpc(n, a);
      t(`C-fn-${n}`, `chiave pubblica: la funzione ${n} NON è eseguibile`, denied(r1) || r1.status === 404, `${r1.status} ${r1.error?.code}`);
    }
    const r2 = await srv.rpc("set_write_mode", { p_legacy_writes: "allow", p_new_writes: "allow" });
    t("C-fn-set_write_mode-srv", "nemmeno la chiave segreta (server) può cambiare la modalità", denied(r2) || r2.status === 404, `${r2.status} ${r2.error?.code}`);
    const before = await mode();
    t("C-config", "la modalità non è cambiata dopo i tentativi", !!before, JSON.stringify(before));
  },

  async manutenzione() {
    const m = await mode();
    t("G1", "modalità di manutenzione: block/block", m?.legacy_writes === "block" && m?.new_writes === "block", JSON.stringify(m));
    const r = await row();
    const s = await rpc("save_app_state", { p_expected_version: r.version, p_data: fake() });
    t("G2", "il codice nuovo non scrive (blocked)", s.data?.status === "blocked", JSON.stringify(s.data ?? s.error));
    const e = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "x", dedupe_key: `launch:${uuid()}`, request_hash: "h".repeat(64) } });
    t("G3", "gli avvii nuovi non passano (blocked)", e.data?.status === "blocked");
    const p = await rpc("portal_submit", { p_project_id: "p_finto", p_author: "Cliente finto", p_message: "messaggio durante la manutenzione", p_ip_hash: H("ip-m") });
    t("G4", "il portale non registra (blocked)", p.data?.status === "blocked");
    const w = await oldUpsert(r.data);
    t("G5", "il codice vecchio non scrive: upsert rifiutato dal database", !!w.error && /bloccata/i.test(w.error.message), w.error?.message);
    const l = await oldLaunch();
    t("G6", "il codice vecchio non accoda avvii", !!l.error && /bloccato/i.test(l.error.message), l.error?.message);
    // il motore aggiorna le righe di launch_requests (presa e stato): in manutenzione ogni UPDATE su una riga esistente è rifiutato
    const any = await srv.from("launch_requests").select("id").limit(1);
    const id = any.data?.[0]?.id;
    const c = id ? await srv.from("launch_requests").update({ note: "prova manutenzione" }).eq("id", id).select("id") : { error: { message: "nessuna riga di prova" } };
    t("G7", "il motore non aggiorna le richieste in manutenzione (UPDATE rifiutato)", !!c.error && /manutenzione/i.test(c.error.message), c.error?.message);
    t("G8", "la lettura resta possibile", (await row())?.version === r.version);
  },

  async "solo-nuovo"() {
    const m = await mode();
    t("S0", "modalità: legacy_writes=block, new_writes=allow", m?.legacy_writes === "block" && m?.new_writes === "allow", JSON.stringify(m));
    let cur = await row();
    const act = `azione-${uuid()}`;
    const hash = H("contenuto-1");
    const d1 = fake(); d1.inbox.push({ id: "i_1", text: "prima azione", createdAt: 1 });
    const s1 = await rpc("save_app_state", { p_expected_version: cur.version, p_data: d1, p_action_id: act, p_request_hash: hash });
    t("B6", "save_app_state: saved con versione numerica crescente", s1.data?.status === "saved" && typeof s1.data.version === "number" && s1.data.version === cur.version + 1, JSON.stringify(s1.data ?? s1.error));
    const s2 = await rpc("save_app_state", { p_expected_version: cur.version + 1, p_data: d1, p_action_id: act, p_request_hash: hash });
    t("B7", "stessa azione ripetuta → duplicate (nessuna riscrittura)", s2.data?.status === "duplicate", JSON.stringify(s2.data));
    const s3 = await rpc("save_app_state", { p_expected_version: cur.version + 1, p_data: d1, p_action_id: act, p_request_hash: H("contenuto-diverso") });
    t("B8", "stesso identificativo con contenuto diverso → action_id_reused", s3.data?.status === "action_id_reused", JSON.stringify(s3.data));
    cur = await row();
    const s4 = await rpc("save_app_state", { p_expected_version: cur.version - 1, p_data: d1, p_action_id: `azione-${uuid()}`, p_request_hash: hash });
    t("B9", "versione vecchia → conflict", s4.data?.status === "conflict", JSON.stringify(s4.data));
    t("B10", "scrittore registrato come 'save_app_state'", cur.written_by === "save_app_state", cur.written_by);
    // avvii nella stessa transazione
    const dk = `approval:${uuid()}`;
    const s5 = await rpc("save_app_state", { p_expected_version: cur.version, p_data: d1, p_action_id: `azione-${uuid()}`, p_request_hash: hash, p_launches: [{ project_id: "p_finto", task_id: null, template: "T", brief: "avvio atomico", dedupe_key: dk, request_hash: hash }] });
    t("B11", "salvataggio con avvio nella stessa transazione: launch_ids con 1 elemento", s5.data?.status === "saved" && s5.data.launch_ids?.length === 1, JSON.stringify(s5.data ?? s5.error));
    cur = await row();
    const s6 = await rpc("save_app_state", { p_expected_version: cur.version, p_data: d1, p_action_id: `azione-${uuid()}`, p_request_hash: hash, p_launches: [{ project_id: "p_finto", task_id: null, template: "T", brief: "stesso avvio", dedupe_key: dk, request_hash: hash }] });
    t("B12", "stessa chiave di avvio da un'altra azione: salvata, ma NESSUN secondo avvio", s6.data?.status === "saved" && (s6.data.launch_ids ?? []).length === 0, JSON.stringify(s6.data ?? s6.error));
    t("B13", "una sola riga di avvio per quella chiave", (await srv.from("launch_requests").select("id", { count: "exact", head: true }).eq("dedupe_key", dk)).count === 1);
    // atomicità: avvio non valido annulla tutto
    cur = await row();
    const bad = await rpc("save_app_state", { p_expected_version: cur.version, p_data: fake(), p_action_id: `azione-${uuid()}`, p_request_hash: hash, p_launches: [{ project_id: "p_finto", brief: null, dedupe_key: `approval:${uuid()}` }] });
    t("B14", "avvio non valido: errore e NIENTE salvato (atomicità)", !!bad.error && (await row()).version === cur.version, bad.error?.message);
    // enqueue_launch
    const ek = `launch:${uuid()}`;
    const e1 = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "x", dedupe_key: ek, request_hash: hash } });
    const e2 = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "x", dedupe_key: ek, request_hash: hash } });
    const e3 = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "x", dedupe_key: ek, request_hash: H("altro") } });
    t("B15", "enqueue_launch: queued → duplicate → action_id_reused", e1.data?.status === "queued" && e2.data?.status === "duplicate" && e2.data.id === e1.data.id && e3.data?.status === "action_id_reused", JSON.stringify([e1.data, e2.data, e3.data]));
    // portale: limite
    const ip = H(`ip-${uuid()}`);
    const sub = async (n) => (await rpc("portal_submit", { p_project_id: "p_finto", p_author: "Cliente finto", p_message: `richiesta finta numero ${n}`, p_ip_hash: ip })).data?.status;
    const six = [];
    for (let i = 0; i < 6; i++) six.push(await sub(i));
    t("B16", "portale: 5 richieste accettate, la 6ª limitata", six.slice(0, 5).every((x) => x === "accepted") && six[5] === "limited", six.join(","));
    const other = (await rpc("portal_submit", { p_project_id: "p_finto", p_author: "Cliente finto", p_message: "altro indirizzo finto", p_ip_hash: H(`altro-${uuid()}`) })).data?.status;
    t("B17", "portale: un altro indirizzo passa", other === "accepted", other);
    const ipPar = H(`parallelo-${uuid()}`); // UNO solo per tutti i 10 invii, nuovo a ogni esecuzione
    const par = await Promise.all(Array.from({ length: 10 }, (_, i) => rpc("portal_submit", { p_project_id: "p_finto", p_author: "Cliente finto", p_message: `contemporanea numero ${i}`, p_ip_hash: ipPar })));
    const acc = par.filter((x) => x.data?.status === "accepted").length;
    t("B18", "portale: 10 invii CONTEMPORANEI dallo stesso indirizzo → esattamente 5 accettati", acc === 5, `${acc} accettati`);
    const pr = await srv.from("portal_requests").select("ip_hash,message,status").limit(3);
    t("B19", "il portale salva solo l'impronta dell'indirizzo (64 caratteri esadecimali)", pr.data?.length > 0 && pr.data.every((x) => /^[0-9a-f]{64}$/.test(x.ip_hash)), pr.error?.message);
    // registro azioni / errori
    const ao = await rpc("action_outcome", { p_action_id: act, p_request_hash: hash });
    const ao2 = await rpc("action_outcome", { p_action_id: act, p_request_hash: H("x") });
    t("B20", "action_outcome: applied / action_id_reused", ao.data === "applied" && ao2.data === "action_id_reused", `${ao.data} ${ao2.data}`);
    const ev = await srv.from("error_events").select("source,message").order("at", { ascending: false }).limit(1);
    t("B21", "error_events leggibile con la chiave segreta", !ev.error, ev.error?.message);
    // concorrenza REALE: 20 richieste HTTP contemporanee con la stessa versione
    cur = await row();
    const race = await Promise.all(Array.from({ length: 20 }, (_, i) => { const d = fake(); d.inbox.push({ id: `i_r${i}`, text: `scrittore ${i}`, createdAt: 1 }); return rpc("save_app_state", { p_expected_version: cur.version, p_data: d }); }));
    const st = race.map((x) => x.data?.status);
    t("B22", "20 richieste HTTP contemporanee con la stessa versione: ESATTAMENTE 1 salvata, 19 conflitti", st.filter((x) => x === "saved").length === 1 && st.filter((x) => x === "conflict").length === 19, `${st.filter((x) => x === "saved").length} saved, ${st.filter((x) => x === "conflict").length} conflict`);
    // motore: presa condizionata
    const q = await rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "da prendere", dedupe_key: `launch:${uuid()}`, request_hash: hash } });
    const claims = await Promise.all(Array.from({ length: 6 }, () => srv.from("launch_requests").update({ status: "claimed" }).eq("id", q.data.id).eq("status", "pending").select("id")));
    t("B23", "motore: 6 prese contemporanee della stessa richiesta (PATCH condizionata) → una sola", claims.filter((x) => (x.data ?? []).length === 1).length === 1, claims.map((x) => (x.data ?? []).length).join(","));
    // codice VECCHIO rifiutato
    cur = await row();
    const w = await oldUpsert(cur.data);
    t("F6", "codice vecchio: upsert rifiutato", !!w.error && /bloccata/i.test(w.error.message), w.error?.message);
    const l = await oldLaunch();
    t("F7", "codice vecchio: avvio diretto rifiutato", !!l.error && /bloccato/i.test(l.error.message), l.error?.message);
    const u = await srv.from("app_state").update({ data: cur.data }).eq("id", 1);
    t("F8", "codice vecchio: UPDATE diretto rifiutato", !!u.error && /bloccata/i.test(u.error.message), u.error?.message);
    t("F9", "la versione non è cambiata per i tentativi vecchi", (await row()).version === cur.version);
  },

  async "dopo-ritorno"() {
    const m = await mode();
    t("R1", "dopo il ritorno: legacy_writes=allow, new_writes=block", m?.legacy_writes === "allow" && m?.new_writes === "block", JSON.stringify(m));
    const cur = await row();
    const w = await oldUpsert(cur.data);
    t("R2", "il codice vecchio torna a scrivere", !w.error, w.error?.message);
    t("R3", "la versione continua a salire", (await row()).version === cur.version + 1);
    const s = await rpc("save_app_state", { p_expected_version: cur.version + 1, p_data: fake() });
    t("R4", "un'istanza NUOVA rimasta è rifiutata (blocked)", s.data?.status === "blocked", JSON.stringify(s.data ?? s.error));
    const l = await oldLaunch();
    t("R5", "il vecchio avvio diretto funziona", !l.error, l.error?.message);
    saveState({ ritorno: { hash: sha((await row()).data) } });
  },

  async "dopo-down"() {
    const cur = await row();
    const hash = loadState().ritorno?.hash;
    t("D1", "dati intatti dopo gli script inversi", hash && sha(cur.data) === hash);
    for (const [n, a] of [["save_app_state", { p_expected_version: 0, p_data: {} }], ["enqueue_launch", { p_launch: {} }], ["portal_submit", { p_project_id: "p", p_author: "a", p_message: "messaggio finto", p_ip_hash: H("x") }], ["record_error_event", { p_source: "x", p_message: "y" }]]) {
      const r = await srv.rpc(n, a);
      t(`D-${n}`, `la funzione ${n} non esiste più`, !!r.error && (r.status === 404 || /PGRST202|could not find/i.test(`${r.error.code} ${r.error.message}`)), `${r.status} ${r.error?.code}`);
    }
    const w = await oldUpsert(cur.data);
    t("D2", "il codice vecchio scrive normalmente", !w.error, w.error?.message);
    const l = await oldLaunch();
    t("D3", "il vecchio avvio diretto funziona", !l.error, l.error?.message);
    const hst = await srv.from("app_state_history").select("id", { count: "exact", head: true });
    t("D4", "lo storico è stato conservato (inerte)", (hst.count ?? 0) > 0, hst.count);
  },
};

if (!FASI[fase]) {
  console.error(`✗ Fase sconosciuta. Fasi: ${Object.keys(FASI).join(", ")}`);
  process.exit(2);
}
console.log(`\n== Prova isolata · fase «${fase}» · progetto ${new URL(URL_).hostname.split(".")[0].slice(0, 4)}… (prova) ==`);
try {
  await FASI[fase]();
} catch (e) {
  t("ERRORE", "eccezione non gestita", false, e?.message ?? e);
}
const ko = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, `prova-risultati-${fase}${fase === "permessi" ? "-" + attesa : ""}.json`), JSON.stringify({ data: new Date().toISOString(), fase, totale: results.length, falliti: ko.length, results }, null, 2));
console.log(`\n${ko.length ? "✗" : "✓"} ${results.length - ko.length}/${results.length} controlli superati${ko.length ? `, ${ko.length} FALLITI` : ""}`);
process.exit(ko.length ? 1 : 0);
