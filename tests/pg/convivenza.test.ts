import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAction } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import type { DB } from "@/lib/types";
import { NOW, UP, count, freshDb, legacyLaunchInsert, legacyUpsert, pgStore, setWriteMode, syntheticState, type TestDb } from "./helpers";

/**
 * Convivenza con il codice VECCHIO (scrittura "cieca" con upsert) durante il PASSAGGIO al codice nuovo.
 * Il ritorno indietro è in rollback.test.ts.
 */
let t: TestDb;
let store: StateStore;
let legacy: ReturnType<TestDb["pool"]>;
beforeAll(async () => {
  t = await freshDb({ migrate: false });
  // stato PRIMA della migrazione, scritto dal codice vecchio
  legacy = t.pool(2);
  await legacyUpsert(legacy, syntheticState());
});
afterAll(async () => {
  await t?.close();
});

const labels = (db: DB) => db.payments.map((p) => p.label);

describe("migrazione su dati esistenti", () => {
  it("la migrazione non tocca i dati: stesso contenuto, versione 0", async () => {
    const before = (await t.admin.query("select data from app_state where id = 1")).rows[0].data;
    await t.admin.query(UP);
    const after = await t.admin.query("select data, version, written_by from app_state where id = 1");
    expect(after.rows[0].data).toEqual(before);
    expect(Number(after.rows[0].version)).toBe(0);
    store = pgStore(t.pool(4));
  });
});

describe("modalità 'allow' (subito dopo la migrazione, codice vecchio ancora attivo)", () => {
  it("una scrittura vecchia incrementa comunque la versione e viene segnata come 'legacy'", async () => {
    const v0 = (await store.load()).version;
    const { db } = await store.load();
    await legacyUpsert(legacy, db);
    const r = (await t.admin.query("select version, written_by from app_state where id = 1")).rows[0];
    expect(Number(r.version)).toBe(v0 + 1);
    expect(r.written_by).toBe("legacy");
  });

  it("il codice nuovo che ha letto PRIMA di una scrittura vecchia riceve conflitto e ricalcola (niente sovrascrittura)", async () => {
    const stale = await store.load();
    const db = structuredClone(stale.db);
    db.inbox.push({ id: "i_vecchio", text: "scritto dal codice vecchio", createdAt: NOW });
    await legacyUpsert(legacy, db);
    const r = await store.save({ expectedVersion: stale.version, data: stale.db });
    expect(r.status).toBe("conflict");
    // con applyAction il ricalcolo conserva la scrittura vecchia E aggiunge la nuova
    const out = await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Nuovo dopo vecchio", amount: 1 }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    const now = (await store.load()).db;
    expect(now.inbox.some((i) => i.id === "i_vecchio")).toBe(true);
    expect(labels(now)).toContain("Nuovo dopo vecchio");
  });

  it("ORDINE PERICOLOSO: il vecchio legge, il nuovo salva, il vecchio scrive PER ULTIMO → in 'allow' il dato nuovo viene sovrascritto (resta nello storico)", async () => {
    const oldRead = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data; // il codice vecchio legge
    const out = await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Dato nuovo a rischio", amount: 5 }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    await legacyUpsert(legacy, oldRead); // il codice vecchio riscrive tutto, senza controllo
    const cur = (await store.load()).db;
    expect(labels(cur)).not.toContain("Dato nuovo a rischio"); // PERSO nello stato corrente
    const hist = await t.admin.query<{ data: DB }>("select data from app_state_history order by id desc limit 1");
    expect(labels(hist.rows[0].data)).toContain("Dato nuovo a rischio"); // ma recuperabile dallo storico
  });
});

describe("modalità 'block' (da attivare PRIMA del deploy del codice nuovo)", () => {
  it("lo stesso ordine pericoloso: la scrittura vecchia viene RIFIUTATA e il dato nuovo resta", async () => {
    await setWriteMode(t.admin, "block", "allow");
    const oldRead = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    const out = await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Dato nuovo protetto", amount: 6 }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    await expect(legacyUpsert(legacy, oldRead)).rejects.toThrow(/bloccata/);
    expect(labels((await store.load()).db)).toContain("Dato nuovo protetto");
  });

  it("bloccato anche un UPDATE diretto senza passare dalla funzione", async () => {
    await expect(legacy.query("update app_state set data = data where id = 1")).rejects.toThrow(/bloccata/);
  });

  it("il codice nuovo continua a salvare normalmente", async () => {
    const out = await applyAction(store, { type: "addInbox", text: "nuovo in block" }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
  });
});

describe("avvii del team con legacy_writes = 'block'", () => {
  const launches = () => count(t.admin, "select count(*) as n from launch_requests");

  it("un INSERT diretto del vecchio percorso (queueLaunch / api/launch) viene RIFIUTATO", async () => {
    const before = await launches();
    await expect(legacyLaunchInsert(legacy)).rejects.toThrow(/avvio diretto bloccato/);
    expect(await launches()).toBe(before);
  });

  it("VECCHIA approvazione: accoda il lavoro PRIMA di salvare lo stato → né avvio né stato vengono scritti", async () => {
    const before = { launches: await launches(), version: (await store.load()).version };
    // 1. il codice vecchio legge lo stato e approva il piano in memoria
    const oldDb = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    oldDb.inbox.push({ id: "i_approvazione_vecchia", text: "approvato dal codice vecchio", createdAt: NOW });
    // 2. queueLaunch (prima del salvataggio): rifiutato
    await expect(legacyLaunchInsert(legacy)).rejects.toThrow(/bloccato/);
    // 3. saveDB (upsert cieco): rifiutato
    await expect(legacyUpsert(legacy, oldDb)).rejects.toThrow(/bloccata/);
    expect(await launches()).toBe(before.launches);
    expect((await store.load()).version).toBe(before.version);
    expect((await store.load()).db.inbox.some((i) => i.id === "i_approvazione_vecchia")).toBe(false);
  });

  it("gli avvii autorizzati dalle funzioni nuove passano: approvazione nuova e 'Lavora con il team'", async () => {
    const { db, version } = await store.load();
    db.approvals.push({ id: "ap_nuova_block", projectId: "p_finto", kind: "plan", agent: "analyst", title: "Piano finto", detail: "prova", items: [], status: "pending", createdAt: NOW, meta: { steps: [{ title: "Passo finto block", role: "frontend" }], team: ["frontend"] } } as never);
    expect((await store.save({ expectedVersion: version, data: db })).status).toBe("saved");
    const out = await applyAction(store, { type: "resolveApproval", id: "ap_nuova_block", decision: "approved" }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    expect(await count(t.admin, "select count(*) as n from launch_requests where dedupe_key = 'approval:ap_nuova_block'")).toBe(1);
    const q = await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: `launch:${randomUUID()}`, request_hash: "h".repeat(64) });
    expect(q.status).toBe("queued");
  });

  it("il motore sul PC può ancora prendere le richieste (UPDATE condizionato)", async () => {
    const r = await legacy.query("update launch_requests set status = 'claimed' where dedupe_key = 'approval:ap_nuova_block' and status = 'pending' returning id");
    expect(r.rowCount).toBe(1);
  });
});
