import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAction } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import type { DB } from "@/lib/types";
import { DOWN, NOW, UP, count, freshDb, legacyUpsert, pgStore, syntheticState, type TestDb } from "./helpers";

/**
 * Convivenza con il codice VECCHIO (scrittura "cieca" con upsert) durante il passaggio,
 * e ritorno indietro. Ogni prova parte da un database nuovo.
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
const setMode = (m: "allow" | "block") => t.admin.query("update app_config set legacy_writes = $1, updated_at = now() where id = 1", [m]);

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
    await setMode("block");
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

describe("ritorno indietro", () => {
  it("passo 1 · si rimette 'allow': il codice vecchio torna a scrivere (con versione e storico)", async () => {
    await setMode("allow");
    const v = (await store.load()).version;
    await legacyUpsert(legacy, (await store.load()).db);
    expect((await store.load()).version).toBe(v + 1);
  });

  it("passo 2 · migrazione inversa: comportamento rimosso, dati intatti, codice vecchio funzionante", async () => {
    const before = (await t.admin.query("select data from app_state where id = 1")).rows[0].data;
    const hist = await count(t.admin, "select count(*) as n from app_state_history");
    await t.admin.query(DOWN);
    expect((await t.admin.query("select data from app_state where id = 1")).rows[0].data).toEqual(before);
    expect(await count(t.admin, "select count(*) as n from pg_proc where proname in ('save_app_state','enqueue_launch','app_state_before_write','app_state_after_update')")).toBe(0);
    expect(await count(t.admin, "select count(*) as n from pg_trigger where tgrelid = 'public.app_state'::regclass and not tgisinternal")).toBe(0);
    expect(await count(t.admin, "select count(*) as n from app_state_history")).toBe(hist); // storico conservato (inerte)
    const db = (await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data;
    db.inbox.push({ id: "i_dopo_rollback", text: "scritto dopo il rollback", createdAt: NOW });
    await legacyUpsert(legacy, db);
    expect((await t.admin.query<{ data: DB }>("select data from app_state where id = 1")).rows[0].data.inbox.some((i) => i.id === "i_dopo_rollback")).toBe(true);
  });

  it("passo 3 · la migrazione si può riapplicare: la versione riparte dal valore conservato e sale", async () => {
    const vBefore = await count(t.admin, "select version as n from app_state where id = 1");
    await t.admin.query(UP);
    await t.admin.query(UP); // idempotente
    const fresh = pgStore(t.pool(1));
    const out = await applyAction(fresh, { type: "addInbox", text: "dopo la riapplicazione" }, randomUUID(), NOW);
    expect(out.status).toBe("saved");
    expect((await fresh.load()).version).toBe(vBefore + 1);
    expect(await count(t.admin, "select count(*) as n from app_config")).toBe(1);
  });
});
