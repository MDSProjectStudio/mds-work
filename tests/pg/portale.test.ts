import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAction, importPortalRequests, portalIpHash, portalRequestId } from "@/lib/server/mutate";
import type { StateStore } from "@/lib/server/state-types";
import { DOWN_M3, NOW, UP_M3, count, freshDb, initState, pgStore, setWriteMode, type Role, type TestDb } from "./helpers";

/** Fase 1 · M3 — portale clienti su tabella separata (PostgreSQL locale, dati finti). */
let t: TestDb;
let store: StateStore;
beforeAll(async () => {
  t = await freshDb();
  store = pgStore(t.pool(10));
  await initState(store);
  await setWriteMode(t.admin, "block", "allow"); // codice nuovo in produzione
});
afterAll(async () => {
  await t?.close();
});

const submit = (s: StateStore, ip: string, msg = "richiesta finta dal portale", project = "p_finto") =>
  s.portalSubmit({ project_id: project, author: "Cliente finto", message: msg, ip_hash: portalIpHash(ip) });

describe("invio dal portale", () => {
  it("non scrive lo stato della dashboard: solo una riga in portal_requests", async () => {
    const v = (await store.load()).version;
    const r = await submit(store, "203.0.113.1");
    expect(r.status).toBe("accepted");
    expect((await store.load()).version).toBe(v);
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBe(1);
  });

  it("l'IP non è salvato in chiaro: solo un'impronta di 64 caratteri", async () => {
    const r = await t.admin.query<{ ip_hash: string }>("select ip_hash from portal_requests limit 1");
    expect(r.rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.rows[0].ip_hash).not.toContain("203.0.113.1");
    expect(await count(t.admin, "select count(*) as n from portal_requests where ip_hash like '%203.0.113%'")).toBe(0);
  });

  it("limite: 10 invii CONTEMPORANEI dallo stesso indirizzo da 10 connessioni diverse → esattamente 5 accettati", async () => {
    const out = await Promise.all(Array.from({ length: 10 }, (_, i) => submit(pgStore(t.pool(1)), "198.51.100.7", `richiesta finta numero ${i}`)));
    expect(out.filter((r) => r.status === "accepted")).toHaveLength(5);
    expect(out.filter((r) => r.status === "limited")).toHaveLength(5);
  });

  it("il limite è per indirizzo e per progetto: un altro indirizzo passa", async () => {
    expect((await submit(store, "198.51.100.8")).status).toBe("accepted");
  });

  it("dopo 10 minuti il limite si libera (finestra provata spostando indietro le date)", async () => {
    expect((await submit(store, "198.51.100.7")).status).toBe("limited");
    await t.admin.query("update portal_requests set created_at = created_at - interval '11 minutes' where ip_hash = $1", [portalIpHash("198.51.100.7")]);
    expect((await submit(store, "198.51.100.7")).status).toBe("accepted");
  });

  it("in manutenzione il portale non registra nulla (risposta 'blocked')", async () => {
    await setWriteMode(t.admin, "block", "block");
    const n = await count(t.admin, "select count(*) as n from portal_requests");
    expect((await submit(store, "192.0.2.50")).status).toBe("blocked");
    expect(await count(t.admin, "select count(*) as n from portal_requests")).toBe(n);
    await setWriteMode(t.admin, "block", "allow");
  });
});

describe("importazione nella dashboard senza doppioni", () => {
  const inState = async () => (await store.load()).db.requests.filter((r) => r.id.startsWith("rq_") && r.author === "Cliente finto").length;

  it("importa tutte le richieste nuove una volta sola e le segna 'merged'", async () => {
    const waiting = await count(t.admin, "select count(*) as n from portal_requests where status = 'new'");
    const r = await importPortalRequests(store, 100);
    expect(r.imported).toBe(waiting);
    expect(await inState()).toBe(waiting);
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBe(0);
    expect(await importPortalRequests(store, 100)).toEqual({ imported: 0, discarded: 0 });
    expect(await inState()).toBe(waiting);
  });

  it("4 importazioni CONTEMPORANEE (più schede/istanze) → ogni richiesta una volta sola", async () => {
    for (let i = 0; i < 3; i++) await submit(store, `192.0.2.${10 + i}`, `richiesta contesa ${i}`);
    const before = await inState();
    await Promise.all(Array.from({ length: 4 }, () => importPortalRequests(pgStore(t.pool(1)), 100)));
    expect(await inState()).toBe(before + 3);
    const ids = (await store.load()).db.requests.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("se la segnatura 'merged' fallisce dopo il salvataggio, la volta dopo NON duplica", async () => {
    await submit(store, "192.0.2.77", "richiesta con segnatura persa");
    const flaky: StateStore = { ...store, markPortalRequests: async () => { throw new Error("segnatura persa (simulata)"); } };
    await expect(importPortalRequests(flaky, 100)).rejects.toThrow(/segnatura persa/);
    const before = await inState();
    const r = await importPortalRequests(store, 100);
    expect(r.imported).toBe(1); // segnata ora
    expect(await inState()).toBe(before); // ma non aggiunta di nuovo
  });

  it("richiesta per un progetto eliminato nel frattempo → 'discarded', niente nello stato", async () => {
    const a = await submit(store, "192.0.2.90", "progetto che verrà eliminato", "p_eliminato");
    expect(a.status).toBe("accepted");
    const r = await importPortalRequests(store, 100);
    expect(r.discarded).toBe(1);
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'discarded'")).toBe(1);
    expect((await store.load()).db.requests.some((q) => q.projectId === "p_eliminato")).toBe(false);
  });

  it("richiesta dal portale contemporanea a un'azione del titolare: nessuna perdita", async () => {
    await submit(store, "192.0.2.120", "richiesta contemporanea al titolare");
    const [out] = await Promise.all([
      applyAction(pgStore(t.pool(1)), { type: "addInbox", text: "azione del titolare contemporanea" }, randomUUID(), NOW),
      importPortalRequests(pgStore(t.pool(1)), 100),
    ]);
    expect(out.status).toBe("saved");
    await importPortalRequests(store, 100); // nel caso abbia perso il conflitto, si completa alla lettura successiva
    const db = (await store.load()).db;
    expect(db.inbox.some((i) => i.text === "azione del titolare contemporanea")).toBe(true);
    expect(db.requests.some((q) => q.message === "richiesta contemporanea al titolare")).toBe(true);
  });

  it("in manutenzione l'importazione non salva e non segna: riprende dopo", async () => {
    await submit(store, "192.0.2.130", "richiesta durante la manutenzione");
    await setWriteMode(t.admin, "block", "block");
    expect(await importPortalRequests(store, 100)).toEqual({ imported: 0, discarded: 0 });
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBe(1);
    await setWriteMode(t.admin, "block", "allow");
    expect((await importPortalRequests(store, 100)).imported).toBe(1);
  });

  it("l'id della richiesta nello stato è stabile e deriva dalla riga", async () => {
    const row = (await t.admin.query<{ id: string }>("select id from portal_requests where status = 'merged' limit 1")).rows[0];
    expect((await store.load()).db.requests.some((q) => q.id === portalRequestId(row.id))).toBe(true);
  });

  it("conservazione: le righe gestite da oltre 30 giorni vengono rimosse al prossimo invio; quelle nuove restano", async () => {
    await t.admin.query("update portal_requests set merged_at = now() - interval '31 days' where status <> 'new'");
    await submit(store, "192.0.2.200", "richiesta dopo la scadenza");
    expect(await count(t.admin, "select count(*) as n from portal_requests where status <> 'new'")).toBe(0);
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBe(1);
  });
});

describe("permessi del portale", () => {
  const asRole = async (role: Role, sql: string) => (await t.client(role)).query(sql);
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role}: nessun accesso a portal_requests né a portal_submit`, async () => {
      for (const sql of ["select * from portal_requests", "delete from portal_requests", "truncate portal_requests", "select public.portal_submit('p', 'a', 'messaggio finto', repeat('a', 64))"]) {
        await expect(asRole(role, sql)).rejects.toMatchObject({ code: "42501" });
      }
    });
  }
  it("PUBLIC: nessun privilegio; RLS attiva", async () => {
    await t.admin.query("do $$ begin if not exists (select 1 from pg_roles where rolname = 'ruolo_qualunque') then create role ruolo_qualunque nologin; end if; end $$");
    const r = await t.admin.query<{ a: boolean; b: boolean; rls: boolean }>(
      "select has_table_privilege('ruolo_qualunque', 'public.portal_requests', 'SELECT') as a, has_function_privilege('ruolo_qualunque', 'public.portal_submit(text, text, text, text, int, interval)', 'EXECUTE') as b, (select relrowsecurity from pg_class where oid = 'public.portal_requests'::regclass) as rls",
    );
    expect(r.rows[0]).toEqual({ a: false, b: false, rls: true });
  });
});

describe("rollback di M3", () => {
  it("con richieste in attesa la procedura si ferma (controllo), poi la migrazione inversa toglie la funzione e conserva la tabella", async () => {
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBeGreaterThan(0); // da importare prima
    await importPortalRequests(store, 100);
    expect(await count(t.admin, "select count(*) as n from portal_requests where status = 'new'")).toBe(0);
    const rows = await count(t.admin, "select count(*) as n from portal_requests");
    await t.admin.query(DOWN_M3);
    expect(await count(t.admin, "select count(*) as n from pg_proc where proname = 'portal_submit'")).toBe(0);
    expect(await count(t.admin, "select count(*) as n from portal_requests")).toBe(rows);
    await t.admin.query(UP_M3);
    await t.admin.query(UP_M3); // idempotente
    expect((await submit(store, "192.0.2.250", "dopo la riapplicazione")).status).toBe("accepted");
  });
});
