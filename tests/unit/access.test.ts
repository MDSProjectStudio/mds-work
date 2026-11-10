import { beforeAll, describe, expect, it } from "vitest";

/**
 * Controlli d'accesso della dashboard in modalità OFFLINE (senza chiavi Supabase).
 * Le variabili Supabase vengono svuotate prima dell'import: nessun collegamento alla produzione.
 */
let requireOwner: (req: Request) => Promise<Response | null>;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
  process.env.SUPABASE_SECRET_KEY = "";
  delete process.env.MDS_ALLOW_REMOTE;
  ({ requireOwner } = await import("@/lib/server/store"));
});

const req = (host: string, init: { method?: string; origin?: string } = {}) =>
  new Request(`http://${host}/api/state`, { method: init.method ?? "GET", headers: { host, ...(init.origin ? { origin: init.origin } : {}) } });

describe("requireOwner (offline)", () => {
  it("consente le richieste da localhost", async () => {
    expect(await requireOwner(req("localhost:3000"))).toBeNull();
    expect(await requireOwner(req("127.0.0.1:3000"))).toBeNull();
  });

  it("rifiuta le richieste da un host esterno", async () => {
    const r = await requireOwner(req("esempio.invalid"));
    expect(r?.status).toBe(403);
  });

  it("rifiuta una scrittura con origine diversa dall'host (protezione CSRF)", async () => {
    const r = await requireOwner(req("localhost:3000", { method: "POST", origin: "http://sito-malevolo.invalid" }));
    expect(r?.status).toBe(403);
  });

  it("accetta una scrittura con la stessa origine", async () => {
    expect(await requireOwner(req("localhost:3000", { method: "POST", origin: "http://localhost:3000" }))).toBeNull();
  });

  it("MDS_ALLOW_REMOTE=1 apre l'accesso remoto solo se impostato esplicitamente", async () => {
    process.env.MDS_ALLOW_REMOTE = "1";
    try {
      expect(await requireOwner(req("esempio.invalid"))).toBeNull();
    } finally {
      delete process.env.MDS_ALLOW_REMOTE;
    }
    expect((await requireOwner(req("esempio.invalid")))?.status).toBe(403);
  });
});
