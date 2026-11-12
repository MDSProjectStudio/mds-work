import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedDB } from "@/lib/engine";
import { createMemoryStore } from "@/lib/server/memory-store";
import type { DB } from "@/lib/types";

/** Route VERE del portale (M3) e importazione dalla lettura della dashboard, con archivio in memoria. */
const NOW = Date.UTC(2026, 10, 11, 9);
const TOKEN = "0123456789abcdef0123";
const initial = (): DB => {
  const db = seedDB(NOW, false);
  db.projects.push({ id: "p_finto", name: "Progetto finto", client: "Cliente finto", description: "x", kind: "website", status: "active", price: 0, color: "#000000", createdAt: NOW, token: TOKEN, agentsMode: "sim" } as never);
  return db;
};
let store = createMemoryStore({ initial });
vi.mock("@/lib/server/store", () => ({ currentStore: () => store, loadDB: async () => (await store.load()).db, requireOwner: async () => null }));
vi.mock("@/lib/server/live", () => ({ withLiveEvents: async (db: DB) => db }));

const portal = await import("@/app/api/portal/[token]/route");
const state = await import("@/app/api/state/route");
const ctx = { params: Promise.resolve({ token: TOKEN }) };
const post = (body: unknown, ip = "203.0.113.5") =>
  portal.POST(new Request(`http://localhost/api/portal/${TOKEN}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }), ctx);

describe("portale clienti (route vera)", () => {
  beforeEach(() => {
    store = createMemoryStore({ initial });
  });

  it("la richiesta va nella tabella del portale, NON nello stato; la dashboard la importa alla lettura, una volta sola", async () => {
    const v = (await store.load()).version;
    expect((await post({ author: "Mario", message: "Vorrei cambiare il colore dei pulsanti" })).status).toBe(200);
    expect((await store.load()).version).toBe(v);
    expect(store.portalRows).toHaveLength(1);
    const view = (await (await state.GET(new Request("http://localhost/api/state", { headers: { host: "localhost" } }))).json()) as DB;
    expect(view.requests.filter((r) => r.message === "Vorrei cambiare il colore dei pulsanti")).toHaveLength(1);
    await state.GET(new Request("http://localhost/api/state", { headers: { host: "localhost" } }));
    expect((await store.load()).db.requests.filter((r) => r.message === "Vorrei cambiare il colore dei pulsanti")).toHaveLength(1);
    expect(store.portalRows[0].status).toBe("merged");
  });

  it("6ª richiesta in 10 minuti dallo stesso indirizzo → 429; altro indirizzo → accettata", async () => {
    for (let i = 0; i < 5; i++) expect((await post({ message: `richiesta finta ${i}` })).status).toBe(200);
    expect((await post({ message: "richiesta finta 6" })).status).toBe(429);
    expect((await post({ message: "richiesta finta 6" }, "203.0.113.99")).status).toBe(200);
  });

  it("validazione e antispam invariati: testo troppo corto, troppo lungo, honeypot", async () => {
    expect((await post({ message: "corto" })).status).toBe(400);
    expect((await post({ message: "x".repeat(2001) })).status).toBe(400);
    expect((await post({ message: "messaggio di un robot", website: "spam" })).status).toBe(200);
    expect(store.portalRows).toHaveLength(0); // il robot non viene registrato
  });

  it("link non valido → 404, nessuna registrazione", async () => {
    const r = await portal.POST(new Request("http://localhost/api/portal/zzz", { method: "POST", body: JSON.stringify({ message: "messaggio valido ma link sbagliato" }) }), { params: Promise.resolve({ token: "zzz" }) });
    expect(r.status).toBe(404);
    expect(store.portalRows).toHaveLength(0);
  });
});
