import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIntentTracker } from "@/lib/action-intent";
import { sendWithIntent } from "@/lib/action-send";
import { seedDB } from "@/lib/engine";
import { createMemoryStore } from "@/lib/server/memory-store";
import { mutateWithRetry, requestHash } from "@/lib/server/mutate";
import type { DB } from "@/lib/types";

/**
 * REGRESSIONE (caso segnalato dal titolare): il server salva un incasso, il browser non riceve risposta,
 * i ritentativi automatici finiscono, l'utente riprova dopo 3 secondi → NON deve nascere un secondo incasso.
 * Si usano le route VERE (app/api/action, app/api/launch) con un archivio in memoria al posto del database.
 */
const NOW = Date.UTC(2026, 10, 10, 9);
const initial = (): DB => {
  const db = seedDB(NOW, false);
  db.projects.push({
    id: "p_finto", name: "Progetto finto", client: "Cliente finto", description: "x", kind: "website", status: "active",
    price: 0, color: "#000000", createdAt: NOW, token: "0123456789abcdef0123", agentsMode: "off", localPath: "C:\\finto",
  } as never);
  return db;
};
let store = createMemoryStore({ initial, launches: true });

vi.mock("@/lib/server/store", () => ({
  currentStore: () => store,
  loadDB: async () => (await store.load()).db,
  requireOwner: async () => null,
}));
vi.mock("@/lib/server/live", () => ({ withLiveEvents: async (db: DB) => db }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => {
    throw new Error("nessun Supabase nei test");
  },
}));

const { POST: actionPOST } = await import("@/app/api/action/route");
const { POST: launchPOST } = await import("@/app/api/launch/route");

/** Rete che consegna la richiesta al server ma "perde" le prime `n` risposte. */
function lossyNetwork(handler: (req: Request) => Promise<Response>, path: string) {
  let lost = 0;
  const calls: string[] = [];
  return {
    calls,
    loseNext(n: number) {
      lost = n;
    },
    async send(body: unknown): Promise<Response> {
      const res = await handler(
        new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": "application/json", host: "localhost:3000" }, body: JSON.stringify(body) }),
      );
      calls.push(res.headers.get("X-MDS-Action") ?? String(res.status));
      if (lost > 0) {
        lost--;
        throw new TypeError("Failed to fetch (risposta persa, simulata)");
      }
      return res;
    },
  };
}
const noWait = async () => {};

describe("esito incerto: nessun doppione quando l'utente riprova", () => {
  beforeEach(() => {
    store = createMemoryStore({ initial, launches: true });
  });

  it("incasso: salvato, nessuna risposta per 3 tentativi, l'utente riprova dopo 3 s → UN solo incasso", async () => {
    let t = 1_000_000;
    const tracker = createIntentTracker({ now: () => t });
    const op = { type: "addPayment" as const, projectId: "p_finto", label: "Incasso a rischio", amount: 250 };
    const net = lossyNetwork(actionPOST, "/api/action");
    const count = async () => (await store.load()).db.payments.filter((p) => p.label === "Incasso a rischio").length;

    net.loseNext(3); // tentativo + 2 ritentativi automatici: tutte le risposte perse
    const first = await sendWithIntent<DB>({ tracker, op, wait: noWait, send: (actionId) => net.send({ actionId, action: op }) });
    expect(first.outcome).toBe("uncertain");
    expect(net.calls).toEqual(["saved", "duplicate", "duplicate"]); // il server l'aveva salvata al primo invio

    t += 3000; // l'utente riprova dopo 3 secondi
    const second = await sendWithIntent<DB>({ tracker, op, wait: noWait, send: (actionId) => net.send({ actionId, action: op }) });
    expect(second.actionId).toBe(first.actionId);
    expect(second.outcome).toBe("confirmed");
    expect(net.calls.at(-1)).toBe("duplicate");
    expect(await count()).toBe(1);

    // dopo la conferma, una ripetizione intenzionale oltre i 2 s è un'operazione nuova
    t += 2500;
    const third = await sendWithIntent<DB>({ tracker, op, wait: noWait, send: (actionId) => net.send({ actionId, action: op }) });
    expect(third.actionId).not.toBe(first.actionId);
    expect(await count()).toBe(2);
  });

  it("se al ritentativo l'azione non si può più ricalcolare (errore), il server risponde 'già applicata' e non un rifiuto", async () => {
    const id = "azione-finta-incerta-1";
    const hash = requestHash("op-finta");
    let calls = 0;
    const mutate = (draft: DB) => {
      if (++calls > 1) throw new Error("stato cambiato: non ricalcolabile");
      draft.inbox.push({ id: "i_unico", text: "applicata una volta", createdAt: NOW });
    };
    expect((await mutateWithRetry(store, id, hash, mutate)).status).toBe("saved");
    expect((await mutateWithRetry(store, id, hash, mutate)).status).toBe("duplicate"); // non "errore"
    expect((await mutateWithRetry(store, id, requestHash("altro"), mutate)).status).toBe("action_id_reused");
    await expect(mutateWithRetry(store, "azione-finta-mai-vista", hash, mutate)).rejects.toThrow(/non ricalcolabile/); // mai applicata: errore vero
    expect((await store.load()).db.inbox.filter((i) => i.id === "i_unico")).toHaveLength(1);
  });

  it("'Lavora con il team': richiesta in coda, nessuna risposta, nuovo clic dopo 3 s → UNA sola richiesta", async () => {
    let t = 1_000_000;
    const tracker = createIntentTracker({ now: () => t });
    const op = { launch: "p_finto", taskId: null };
    const net = lossyNetwork(launchPOST, "/api/launch");
    net.loseNext(3);
    const first = await sendWithIntent<{ id: number }>({ tracker, op, wait: noWait, send: (actionId) => net.send({ projectId: "p_finto", actionId }) });
    expect(first.outcome).toBe("uncertain");
    t += 3000;
    const second = await sendWithIntent<{ id: number; duplicate: boolean }>({ tracker, op, wait: noWait, send: (actionId) => net.send({ projectId: "p_finto", actionId }) });
    expect(second.actionId).toBe(first.actionId);
    expect(second.outcome).toBe("confirmed");
    expect(second.body).toMatchObject({ duplicate: true });
    expect(store.launchRows).toHaveLength(1);
  });

  it("'Lavora con il team': il ritentativo trova la richiesta anche se nel frattempo il progetto non ha più la cartella", async () => {
    let t = 1_000_000;
    const tracker = createIntentTracker({ now: () => t });
    const op = { launch: "p_finto", taskId: null };
    const net = lossyNetwork(launchPOST, "/api/launch");
    net.loseNext(3);
    const first = await sendWithIntent<{ id: number }>({ tracker, op, wait: noWait, send: (actionId) => net.send({ projectId: "p_finto", actionId }) });
    expect(first.outcome).toBe("uncertain");
    const { db, version } = await store.load();
    db.projects.find((p) => p.id === "p_finto")!.localPath = undefined;
    await store.save({ expectedVersion: version, data: db });
    t += 3000;
    const second = await sendWithIntent<{ id: number }>({ tracker, op, wait: noWait, send: (actionId) => net.send({ projectId: "p_finto", actionId }) });
    expect(second.outcome).toBe("confirmed");
    expect(store.launchRows).toHaveLength(1);
  });

  it("rifiuto definitivo (dati non validi) → niente salvato, id nuovo al tentativo successivo", async () => {
    const tracker = createIntentTracker();
    const bad = { type: "addTask" as const, projectId: "p_finto", title: undefined as unknown as string };
    const net = lossyNetwork(actionPOST, "/api/action");
    const before = (await store.load()).version;
    const r = await sendWithIntent<DB>({ tracker, op: bad, wait: noWait, send: (actionId) => net.send({ actionId, action: bad }) });
    expect(r.outcome).toBe("rejected");
    expect(r.status).toBe(400);
    expect((await store.load()).version).toBe(before);
    expect(tracker.begin(bad).actionId).not.toBe(r.actionId);
  });
});
