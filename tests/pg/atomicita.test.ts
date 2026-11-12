import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestHash } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import { NOW, count, freshDb, pgStore, syntheticState, type TestDb } from "./helpers";

/** Stato, registro delle azioni e avvii: tutto o niente. */
let t: TestDb;
let store: StateStore;
beforeAll(async () => {
  t = await freshDb();
  store = pgStore(t.pool(4));
});
afterAll(async () => {
  await t?.close();
});

const snapshot = async () => ({
  version: await count(t.admin, "select coalesce(max(version), 0) as n from app_state"),
  actions: await count(t.admin, "select count(*) as n from applied_actions"),
  launches: await count(t.admin, "select count(*) as n from launch_requests"),
  history: await count(t.admin, "select count(*) as n from app_state_history"),
});

describe("atomicità del salvataggio", () => {
  it("primo salvataggio contemporaneo su tabella vuota: uno salva, l'altro riceve conflitto (nessun errore, nessun doppione)", async () => {
    const [a, b] = await Promise.all([pgStore(t.pool(1)).save({ expectedVersion: 0, data: syntheticState() }), pgStore(t.pool(1)).save({ expectedVersion: 0, data: syntheticState() })]);
    expect([a.status, b.status].sort()).toEqual(["conflict", "saved"]);
    expect(await count(t.admin, "select count(*) as n from app_state")).toBe(1);
  });

  it("un avvio non valido annulla TUTTO: niente stato nuovo, niente registro, niente avvii", async () => {
    const before = await snapshot();
    const { db, version } = await store.load();
    db.inbox.push({ id: "i_non_deve_esistere", text: "non deve essere salvato", createdAt: NOW });
    const id = randomUUID();
    await expect(
      store.save({
        expectedVersion: version,
        data: db,
        actionId: id,
        requestHash: requestHash("x"),
        launches: [
          { project_id: "p_finto", task_id: null, template: null, brief: "avvio valido", dedupe_key: `approval:${randomUUID()}` },
          { project_id: "p_finto", task_id: null, template: null, brief: null as unknown as string, dedupe_key: `approval:${randomUUID()}` }, // brief mancante: viola NOT NULL
        ],
      }),
    ).rejects.toThrow(/null value|not-null/i);
    expect(await snapshot()).toEqual(before);
    expect((await store.load()).db.inbox.some((i) => i.id === "i_non_deve_esistere")).toBe(false);
  });

  it("un avvio senza chiave anti-doppione viene rifiutato e annulla tutto", async () => {
    const before = await snapshot();
    const { db, version } = await store.load();
    await expect(store.save({ expectedVersion: version, data: db, launches: [{ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: "" }] })).rejects.toThrow(/dedupe_key/);
    expect(await snapshot()).toEqual(before);
  });

  it("in caso di conflitto non resta traccia: né registro dell'azione né avvii", async () => {
    const { db, version } = await store.load();
    const before = await snapshot();
    const id = randomUUID();
    const r = await store.save({
      expectedVersion: version - 1, // versione vecchia
      data: db,
      actionId: id,
      requestHash: requestHash("y"),
      launches: [{ project_id: "p_finto", task_id: null, template: null, brief: "non deve partire", dedupe_key: `approval:${randomUUID()}` }],
    });
    expect(r.status).toBe("conflict");
    expect(await snapshot()).toEqual(before);
  });

  it("salvataggio riuscito: stato, registro e avvio presenti insieme; storico della versione precedente", async () => {
    const { db, version } = await store.load();
    const before = await snapshot();
    const id = randomUUID();
    const r = await store.save({ expectedVersion: version, data: db, actionId: id, requestHash: requestHash("z"), launches: [{ project_id: "p_finto", task_id: null, template: null, brief: "parte", dedupe_key: `approval:${randomUUID()}` }] });
    expect(r.status).toBe("saved");
    expect(await snapshot()).toEqual({ version: before.version + 1, actions: before.actions + 1, launches: before.launches + 1, history: before.history + 1 });
    expect((await t.admin.query("select written_by from app_state where id = 1")).rows[0].written_by).toBe("save_app_state");
  });

  it("lo storico conserva al massimo 200 versioni", async () => {
    for (let i = 0; i < 210; i++) {
      const { db, version } = await store.load();
      expect((await store.save({ expectedVersion: version, data: db })).status).toBe("saved");
    }
    expect(await count(t.admin, "select count(*) as n from app_state_history")).toBe(200);
    const v = await count(t.admin, "select version as n from app_state where id = 1");
    expect(await count(t.admin, "select max(version) as n from app_state_history")).toBe(v - 1);
  });
});
