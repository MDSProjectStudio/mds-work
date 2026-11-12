import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIntentTracker } from "@/lib/action-intent";
import { sendWithIntent } from "@/lib/action-send";
import { applyAction, launchRow, requestHash } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import { NOW, count, freshDb, initState, pgStore, type TestDb } from "./helpers";

/** Doppio invio accidentale vs operazioni uguali ma intenzionali; riuso dell'id con contenuto diverso. */
let t: TestDb;
let store: StateStore;
beforeAll(async () => {
  t = await freshDb();
  store = pgStore(t.pool(10));
  await initState(store);
});
afterAll(async () => {
  await t?.close();
});

const paymentsLabelled = async (label: string) => (await store.load()).db.payments.filter((p) => p.label === label).length;

describe("doppio clic, ritentativi e operazioni intenzionali", () => {
  it("doppio clic accidentale: il browser riusa l'id, i due invii arrivano insieme → un solo incasso", async () => {
    const tracker = createIntentTracker();
    const op = { type: "addPayment" as const, projectId: "p_finto", label: "Doppio clic", amount: 50 };
    const first = tracker.begin(op);
    const second = tracker.begin(op); // secondo clic mentre il primo è in corso
    expect(second.actionId).toBe(first.actionId);
    const [r1, r2] = await Promise.all([applyAction(store, op, first.actionId, NOW), applyAction(pgStore(t.pool(1)), op, second.actionId, NOW)]);
    expect([r1.status, r2.status].sort()).toEqual(["duplicate", "saved"]);
    expect(await paymentsLabelled("Doppio clic")).toBe(1);
    expect(await count(t.admin, "select count(*) as n from applied_actions where action_id = $1", [first.actionId])).toBe(1);
  });

  it("risposta persa dopo il salvataggio: il ritentativo con lo stesso id non duplica", async () => {
    const op = { type: "addPayment" as const, projectId: "p_finto", label: "Risposta persa", amount: 70 };
    const id = randomUUID();
    // il primo salvataggio va a buon fine nel database, ma la risposta "si perde" (rete)
    let lost = true;
    const flaky: StateStore = {
      ...store,
      async save(req) {
        const r = await store.save(req);
        if (lost) {
          lost = false;
          throw new Error("fetch failed (risposta persa, simulata)");
        }
        return r;
      },
    };
    await expect(applyAction(flaky, op, id, NOW)).rejects.toThrow(/risposta persa/);
    const again = await applyAction(flaky, op, id, NOW); // il browser ritenta con lo stesso id
    expect(again.status).toBe("duplicate");
    expect(await paymentsLabelled("Risposta persa")).toBe(1);
  });

  it("REGRESSIONE esito incerto: salvato, nessuna risposta per tutti i tentativi automatici, nuovo clic dopo 3 s → un solo incasso", async () => {
    let clock = 0;
    const tracker = createIntentTracker({ now: () => clock });
    const op = { type: "addPayment" as const, projectId: "p_finto", label: "Esito incerto PG", amount: 40 };
    let lose = 3;
    // "rete": la richiesta arriva al server (salvataggio vero su PostgreSQL), la risposta si perde
    const send = async (actionId: string) => {
      const r = await applyAction(store, op, actionId, NOW);
      if (lose-- > 0) throw new TypeError("Failed to fetch (simulato)");
      return Response.json({ ok: true }, { headers: { "X-MDS-Action": r.status } });
    };
    const first = await sendWithIntent({ tracker, op, send, wait: async () => {} });
    expect(first.outcome).toBe("uncertain");
    clock += 3000;
    const second = await sendWithIntent({ tracker, op, send, wait: async () => {} });
    expect(second.actionId).toBe(first.actionId);
    expect(second.outcome).toBe("confirmed");
    expect(await paymentsLabelled("Esito incerto PG")).toBe(1);
  });

  it("due operazioni uguali ma INTENZIONALI (id diversi) → due incassi", async () => {
    let clock = 0;
    const tracker = createIntentTracker({ now: () => clock });
    const op = { type: "addPayment" as const, projectId: "p_finto", label: "Due rate uguali", amount: 100 };
    const a = tracker.begin(op);
    expect((await applyAction(store, op, a.actionId, NOW)).status).toBe("saved");
    tracker.end(op, a.actionId, "confirmed");
    clock += 10_000; // il titolare la ripete di proposito più tardi
    const b = tracker.begin(op);
    expect(b.actionId).not.toBe(a.actionId);
    expect((await applyAction(store, op, b.actionId, NOW)).status).toBe("saved");
    expect(await paymentsLabelled("Due rate uguali")).toBe(2);
  });

  it("stesso id con contenuto DIVERSO → errore chiaro, nulla cambia", async () => {
    const id = randomUUID();
    await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Originale", amount: 10 }, id, NOW);
    const before = await store.load();
    const r = await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Manomesso", amount: 999 }, id, NOW);
    expect(r.status).toBe("action_id_reused");
    const after = await store.load();
    expect(after.version).toBe(before.version);
    expect(await paymentsLabelled("Manomesso")).toBe(0);
  });

  it("incasso segnato due volte con setPaymentStatus (id diversi): resta incassato, nessun annullamento", async () => {
    await applyAction(store, { type: "addPayment", projectId: "p_finto", label: "Da incassare", amount: 30 }, randomUUID(), NOW);
    const pay = (await store.load()).db.payments.find((p) => p.label === "Da incassare")!;
    await applyAction(store, { type: "setPaymentStatus", id: pay.id, status: "paid" }, randomUUID(), NOW);
    await applyAction(store, { type: "setPaymentStatus", id: pay.id, status: "paid" }, randomUUID(), NOW);
    expect((await store.load()).db.payments.find((p) => p.id === pay.id)!.status).toBe("paid");
  });
});

describe("approvazioni e avvii del team senza doppioni", () => {
  const addPendingPlan = async (apId: string) => {
    const { db, version } = await store.load();
    db.approvals.push({ id: apId, projectId: "p_finto", kind: "plan", agent: "analyst", title: "Piano finto", detail: "prova", items: [], status: "pending", createdAt: NOW, meta: { steps: [{ title: "Passo finto A", role: "frontend" }, { title: "Passo finto B", role: "qa" }], team: ["frontend", "qa"] } } as never);
    expect((await store.save({ expectedVersion: version, data: db })).status).toBe("saved");
  };
  const tasksOf = async (title: string) => (await store.load()).db.tasks.filter((x) => x.title === title).length;

  it("approvazione inviata due volte in parallelo con lo STESSO id: task una volta, un solo avvio", async () => {
    await addPendingPlan("ap_finta_1");
    const id = randomUUID();
    const act = { type: "resolveApproval" as const, id: "ap_finta_1", decision: "approved" as const };
    const out = await Promise.all([applyAction(store, act, id, NOW), applyAction(pgStore(t.pool(1)), act, id, NOW)]);
    expect(out.map((r) => r.status).sort()).toEqual(["duplicate", "saved"]);
    expect(await tasksOf("Passo finto A")).toBe(1);
    expect(await count(t.admin, "select count(*) as n from launch_requests where dedupe_key = 'approval:ap_finta_1'")).toBe(1);
  });

  it("stessa approvazione con id DIVERSI (due schede aperte): applicata una volta, un solo avvio", async () => {
    await addPendingPlan("ap_finta_2");
    const act = { type: "resolveApproval" as const, id: "ap_finta_2", decision: "approved" as const };
    const out = await Promise.all([applyAction(store, act, randomUUID(), NOW), applyAction(pgStore(t.pool(1)), act, randomUUID(), NOW)]);
    expect(out.every((r) => r.status === "saved")).toBe(true); // entrambe salvate, ma la seconda non cambia nulla
    expect(await tasksOf("Passo finto B")).toBe(2); // 1 da ap_finta_1 + 1 da ap_finta_2
    expect(await count(t.admin, "select count(*) as n from launch_requests where dedupe_key = 'approval:ap_finta_2'")).toBe(1);
  });

  it("'Lavora con il team': 5 invii con lo stesso id → una richiesta; contenuto diverso → rifiutato; id nuovo → nuova richiesta", async () => {
    const { db } = await store.load();
    const p = db.projects.find((x) => x.id === "p_finto")!;
    const id = randomUUID();
    const row = { ...launchRow(db, p, `launch:${id}`), request_hash: requestHash({ projectId: p.id, taskId: null }) };
    const res = await Promise.all(Array.from({ length: 5 }, () => pgStore(t.pool(1)).enqueueLaunch(row)));
    expect(res.filter((r) => r.status === "queued")).toHaveLength(1);
    expect(new Set(res.map((r) => ("id" in r ? r.id : 0))).size).toBe(1);
    const other = await store.enqueueLaunch({ ...row, request_hash: requestHash({ projectId: p.id, taskId: "t_altra" }) });
    expect(other.status).toBe("action_id_reused");
    const fresh = await store.enqueueLaunch({ ...row, dedupe_key: `launch:${randomUUID()}` });
    expect(fresh.status).toBe("queued");
    expect(await count(t.admin, "select count(*) as n from launch_requests where dedupe_key = $1", [`launch:${id}`])).toBe(1);
  });
});
