import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { advanceAndSave, applyAction, requestHash } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import type { DB } from "@/lib/types";
import { DOWN, NOW, UP, count, freshDb, initState, legacyLaunchInsert, legacyUpsert, pgStore, setWriteMode, type TestDb } from "./helpers";

/**
 * RITORNO AL CODICE PRECEDENTE — sequenza corretta, provata su PostgreSQL locale:
 *   0. situazione di partenza: codice nuovo in produzione (legacy_writes='block', new_writes='allow')
 *   1. motore sul PC fermato
 *   2. MANUTENZIONE: set_write_mode('block','block') — attende le scritture in corso, poi nessuno scrive
 *   3. controllo delle richieste di avvio rimaste (pending / claimed)
 *   4. cambio del codice (deploy precedente) — qui simulato: da questo punto "scrive" solo il codice vecchio
 *   5. riapertura CONTROLLATA: set_write_mode('allow','block') — vecchio sì, nuovo no (istanze nuove rimaste: rifiutate)
 *   6. (facoltativo) migrazione inversa; riapplicazione possibile
 */
let t: TestDb;
let store: StateStore;
let legacy: ReturnType<TestDb["pool"]>;
const version = async () => count(t.admin, "select version as n from app_state where id = 1");
const launches = async () => count(t.admin, "select count(*) as n from launch_requests");

beforeAll(async () => {
  t = await freshDb();
  store = pgStore(t.pool(10));
  legacy = t.pool(2);
  await initState(store);
  // 0. codice nuovo in produzione
  await setWriteMode(t.admin, "block", "allow");
  // un'azione applicata (servirà per il controllo "già applicata" durante la manutenzione)
  await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Prima della manutenzione", amount: 1 }, "azione-finta-prima-manutenzione", NOW);
  // richieste di avvio: una in attesa, una presa dal motore
  for (const k of ["in-attesa", "presa"]) await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: `launch:${k}`, request_hash: "h".repeat(64) });
  await t.admin.query("update launch_requests set status = 'claimed' where dedupe_key = 'launch:presa'");
});
afterAll(async () => {
  await t?.close();
});

describe("passo 2 · manutenzione", () => {
  it("il cambio di modalità ATTENDE una scrittura già in corso, che si conclude regolarmente", async () => {
    const writer = await t.client("service_role");
    const { db, version: v } = await store.load();
    db.inbox.push({ id: "i_in_corso", text: "scrittura in corso durante il cambio", createdAt: NOW });
    await writer.query("begin");
    const r = await writer.query<{ r: { status: string } }>("select public.save_app_state($1, $2::jsonb) as r", [v, JSON.stringify(db)]);
    expect(r.rows[0].r.status).toBe("saved"); // salvata ma NON ancora confermata (transazione aperta)

    let done = false;
    const switching = setWriteMode(t.admin, "block", "block").then(() => (done = true));
    await new Promise((res) => setTimeout(res, 600));
    expect(done).toBe(false); // in attesa della scrittura in corso
    await writer.query("commit");
    await switching;
    expect(done).toBe(true);
    expect((await store.load()).db.inbox.some((i) => i.id === "i_in_corso")).toBe(true);
    await setWriteMode(t.admin, "block", "allow"); // si torna alla situazione di partenza per la prova successiva
  });

  it("con scritture del codice nuovo IN CORSO da 6 connessioni: dopo il cambio nessuna scrittura passa più", async () => {
    let stop = false;
    const results: string[] = [];
    const writers = Array.from({ length: 6 }, (_, w) =>
      (async () => {
        const s = pgStore(t.pool(1));
        for (let i = 0; !stop && i < 500; i++) {
          const r = await applyAction(s, { type: "addInbox", text: `scrittore ${w} n.${i}` }, randomUUID(), NOW);
          results.push(r.status);
          if (r.status === "blocked") break;
        }
      })(),
    );
    await new Promise((res) => setTimeout(res, 400)); // le scritture sono partite
    await setWriteMode(t.admin, "block", "block");
    const v = await version();
    const l = await launches();
    await Promise.all(writers);
    stop = true;
    expect(results.filter((s) => s === "saved").length).toBeGreaterThan(0); // scrivevano davvero
    expect(results.filter((s) => s === "blocked")).toHaveLength(6); // ognuno si è fermato con un rifiuto esplicito
    expect(await version()).toBe(v); // NIENTE è stato scritto dopo il cambio
    expect(await launches()).toBe(l);
  });

  it("in manutenzione nessuno scrive: codice nuovo, codice vecchio, avvii, motore", async () => {
    const v = await version();
    const { db, version: cur } = await store.load();
    expect((await store.save({ expectedVersion: cur, data: db })).status).toBe("blocked");
    expect((await applyAction(store, { type: "addInbox", text: "non deve passare" }, randomUUID(), NOW)).status).toBe("blocked");
    expect(await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: `launch:${randomUUID()}`, request_hash: "h".repeat(64) })).toEqual({ status: "blocked" });
    await expect(legacyUpsert(legacy, db)).rejects.toThrow(/bloccata/);
    await expect(legacyLaunchInsert(legacy)).rejects.toThrow(/bloccato/);
    await expect(legacy.query("update launch_requests set status = 'claimed' where dedupe_key = 'launch:in-attesa' and status = 'pending'")).rejects.toThrow(/manutenzione/);
    expect(await version()).toBe(v);
  });

  it("in manutenzione la lettura funziona e un'azione GIÀ applicata risulta 'duplicate' (il browser la chiude come confermata)", async () => {
    expect((await advanceAndSave(store, NOW + 60_000)).projects.length).toBeGreaterThan(0);
    const again = await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Prima della manutenzione", amount: 1 }, "azione-finta-prima-manutenzione", NOW);
    expect(again.status).toBe("duplicate");
    expect(await store.actionOutcome("azione-finta-prima-manutenzione", requestHash({ type: "addPayment", projectId: "p_finto", label: "Prima della manutenzione", amount: 1 }))).toBe("applied");
  });
});

describe("passo 3 · richieste di avvio rimaste", () => {
  it("si possono leggere per decidere: 'pending' le prenderà il motore vecchio, 'claimed' va verificata a mano", async () => {
    const r = await t.admin.query<{ dedupe_key: string; status: string }>("select dedupe_key, status from launch_requests where status in ('pending', 'claimed') order by dedupe_key");
    expect(r.rows).toEqual([
      { dedupe_key: "launch:in-attesa", status: "pending" },
      { dedupe_key: "launch:presa", status: "claimed" },
    ]);
  });
});

describe("passo 5 · riapertura controllata: solo il codice vecchio", () => {
  it("dopo il cambio del codice: vecchio sì (con versione e storico), nuovo NO (istanze rimaste rifiutate)", async () => {
    await setWriteMode(t.admin, "allow", "block");
    const v = await version();
    const db = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    db.inbox.push({ id: "i_vecchio_dopo_rollback", text: "codice vecchio dopo il rollback", createdAt: NOW });
    await legacyUpsert(legacy, db);
    expect(await version()).toBe(v + 1);
    expect(await count(t.admin, "select count(*) as n from app_state_history where version = $1", [v])).toBe(1);
    await legacyLaunchInsert(legacy); // il vecchio queueLaunch torna a funzionare
    // un'istanza del codice nuovo ancora raggiungibile (es. vecchio indirizzo di deploy): rifiutata
    expect((await applyAction(store, { type: "addInbox", text: "istanza nuova rimasta" }, randomUUID(), NOW)).status).toBe("blocked");
    expect(await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: `launch:${randomUUID()}`, request_hash: "h".repeat(64) })).toEqual({ status: "blocked" });
    // il motore (vecchio o nuovo) può di nuovo prendere le richieste
    expect((await legacy.query("update launch_requests set status = 'claimed' where dedupe_key = 'launch:in-attesa' and status = 'pending'")).rowCount).toBe(1);
  });

  it("PERCHÉ non si riapre con il codice nuovo ancora attivo: con entrambi 'allow' una scrittura nuova viene sovrascritta dal vecchio", async () => {
    await setWriteMode(t.admin, "allow", "allow"); // procedura SBAGLIATA, solo per mostrare il rischio
    const oldRead = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    expect((await applyAction(store, { type: "addInbox", text: "scritta dal codice nuovo" }, randomUUID(), NOW)).status).toBe("saved");
    await legacyUpsert(legacy, oldRead);
    expect((await store.load()).db.inbox.some((i) => i.text === "scritta dal codice nuovo")).toBe(false); // persa
    await setWriteMode(t.admin, "allow", "block"); // si ripristina la modalità corretta
  });
});

describe("passo 6 · migrazione inversa (facoltativa) e riapplicazione", () => {
  it("migrazione inversa: comportamento rimosso, dati e storico intatti, codice vecchio funzionante", async () => {
    const before = (await t.admin.query("select data from app_state where id = 1")).rows[0].data;
    const hist = await count(t.admin, "select count(*) as n from app_state_history");
    await t.admin.query(DOWN);
    expect((await t.admin.query("select data from app_state where id = 1")).rows[0].data).toEqual(before);
    expect(
      await count(t.admin, "select count(*) as n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('save_app_state','enqueue_launch','action_outcome','set_write_mode','app_state_before_write','app_state_after_update','launch_requests_before_write')"),
    ).toBe(0);
    expect(await count(t.admin, "select count(*) as n from pg_trigger where tgrelid in ('public.app_state'::regclass, 'public.launch_requests'::regclass) and not tgisinternal")).toBe(0);
    expect(await count(t.admin, "select count(*) as n from app_state_history")).toBe(hist);
    const db = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    db.inbox.push({ id: "i_dopo_down", text: "scritto dopo la migrazione inversa", createdAt: NOW });
    await legacyUpsert(legacy, db);
    await legacyLaunchInsert(legacy);
    expect((await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data.inbox.some((i) => i.id === "i_dopo_down")).toBe(true);
  });

  it("la migrazione si può riapplicare (idempotente): la modalità conservata resta, la versione sale", async () => {
    const vBefore = await version();
    await t.admin.query(UP);
    await t.admin.query(UP);
    const mode = (await t.admin.query("select legacy_writes, new_writes from app_config where id = 1")).rows[0];
    expect(mode).toEqual({ legacy_writes: "allow", new_writes: "block" }); // nessuna riapertura automatica del codice nuovo
    await setWriteMode(t.admin, "block", "allow"); // nuovo passaggio, come da procedura
    const out = await applyAction(pgStore(t.pool(1)), { type: "addInbox", text: "dopo la riapplicazione" }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    expect(await version()).toBe(vBefore + 1);
  });
});
