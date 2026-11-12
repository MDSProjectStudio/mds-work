import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAction } from "@/lib/server/mutate";
import { NOW, count, freshDb, initState, pgStore, syntheticState, type TestDb } from "./helpers";

/** Concorrenza su PostgreSQL vero con connessioni INDIPENDENTI (dati finti, nessun Supabase). */
let t: TestDb;
beforeAll(async () => {
  t = await freshDb();
});
afterAll(async () => {
  await t?.close();
});

const payment = (n: number) => ({ type: "addPayment" as const, projectId: "p_finto", label: `Incasso finto ${n}`, amount: n });

describe("concorrenza reale", () => {
  it("20 connessioni separate salvano con la stessa versione: ne vince esattamente una", async () => {
    const base = await initState(pgStore(t.pool(1)));
    const clients = await Promise.all(Array.from({ length: 20 }, () => t.client()));
    {
      const pids = new Set((await Promise.all(clients.map((c) => c.query<{ p: number }>("select pg_backend_pid() as p")))).map((r) => r.rows[0].p));
      expect(pids.size).toBe(20); // 20 processi server distinti = connessioni indipendenti
      const results = await Promise.all(
        clients.map((c, i) => {
          const db = syntheticState();
          db.inbox.push({ id: `i_${i}`, text: `scrittura ${i}`, createdAt: NOW });
          return c.query<{ r: { status: string } }>("select public.save_app_state($1, $2::jsonb) as r", [base, JSON.stringify(db)]);
        }),
      );
      const statuses = results.map((r) => r.rows[0].r.status);
      expect(statuses.filter((s) => s === "saved")).toHaveLength(1);
      expect(statuses.filter((s) => s === "conflict")).toHaveLength(19);
      expect(await count(t.admin, "select version as n from app_state where id = 1")).toBe(base + 1);
    }
  });

  it("50 coppie di azioni contemporanee da due 'istanze' del server: 100 incassi, nessuno perso, nessun doppione", async () => {
    const a = pgStore(t.pool(5));
    const b = pgStore(t.pool(5));
    const before = (await a.load()).db.payments.length;
    let retried = 0;
    for (let i = 0; i < 50; i++) {
      const [ra, rb] = await Promise.all([applyAction(a, payment(1000 + i), randomUUID(), NOW), applyAction(b, payment(2000 + i), randomUUID(), NOW)]);
      expect(ra.status).toBe("saved");
      expect(rb.status).toBe("saved");
      if ((ra.status === "saved" && ra.attempts > 1) || (rb.status === "saved" && rb.attempts > 1)) retried++;
    }
    const { db } = await a.load();
    const added = db.payments.slice(before);
    expect(added).toHaveLength(100);
    expect(new Set(added.map((p) => p.label)).size).toBe(100);
    expect(new Set(db.payments.map((p) => p.id)).size).toBe(db.payments.length);
    expect(retried).toBeGreaterThan(0); // i conflitti ci sono stati davvero e sono stati risolti col ritentativo
    console.info(`[concorrenza] coppie con almeno un ritentativo: ${retried}/50`);
  });

  it("12 azioni contemporanee: ognuna salvata una volta sola oppure rifiutata con errore esplicito (mai persa in silenzio)", async () => {
    const pools = Array.from({ length: 12 }, () => pgStore(t.pool(1)));
    const before = (await pools[0].load()).db.payments.length;
    const out = await Promise.all(pools.map((s, i) => applyAction(s, payment(3000 + i), randomUUID(), NOW, { maxAttempts: 4 })));
    const saved = out.filter((r) => r.status === "saved").length;
    const refused = out.filter((r) => r.status === "conflict_exhausted").length;
    expect(saved + refused).toBe(12);
    const { db } = await pools[0].load();
    expect(db.payments.length - before).toBe(saved); // ciò che risulta salvato c'è, una volta sola
    console.info(`[concorrenza] 12 simultanee: salvate ${saved}, rifiutate con errore ${refused}`);
  });

  it("il motore che prende un avvio: 6 connessioni contendono la stessa richiesta, una sola la prende", async () => {
    // la richiesta nasce dal percorso autorizzato (funzione nuova): un INSERT diretto è bloccato dal passaggio
    const q = await pgStore(t.pool(1)).enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "brief finto", dedupe_key: `launch:${randomUUID()}`, request_hash: "h".repeat(64) });
    if (q.status !== "queued") throw new Error("avvio non accodato");
    const id = q.id;
    const pool = t.pool(6);
    // stessa istruzione che il motore invia con PATCH ?id=eq.X&status=eq.pending
    const claims = await Promise.all(
      Array.from({ length: 6 }, () => pool.query("update launch_requests set status = 'claimed' where id = $1 and status = 'pending' returning id", [id])),
    );
    expect(claims.filter((r) => r.rowCount === 1)).toHaveLength(1);
  });
});
