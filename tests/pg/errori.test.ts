import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportError } from "@/lib/server/errors";
import type { StateStore } from "@/lib/server/state-types";
import { DOWN_M6, UP_M6, count, freshDb, pgStore, type Role, type TestDb } from "./helpers";

/** M6 — registro interno degli errori su PostgreSQL locale (dati finti). */
let t: TestDb;
let store: StateStore;
beforeAll(async () => {
  t = await freshDb();
  store = pgStore(t.pool(2));
});
afterAll(async () => {
  await t?.close();
});

describe("registro degli errori", () => {
  it("registra un errore ripulito e lo restituisce fra i recenti", async () => {
    await reportError(store, "api/prova", new Error("errore finto per prova@esempio.invalid"), { azione: "addTask" });
    const [e] = await store.recentErrors(5);
    expect(e.source).toBe("api/prova");
    expect(e.message).not.toContain("prova@");
    expect(e.detail).toEqual({ azione: "addTask" });
  });

  it("tetto anti-inondazione: oltre 200 errori in un'ora i successivi vengono saltati", async () => {
    await t.admin.query("insert into error_events (source, message) select 'api/ciclo', 'errore ripetuto' from generate_series(1, 205)");
    const r = await t.admin.query<{ r: string }>("select public.record_error_event('api/ciclo', 'ancora', '{}') as r");
    expect(r.rows[0].r).toBe("skipped");
  });

  it("conservazione: gli errori più vecchi di 30 giorni vengono rimossi alla registrazione successiva", async () => {
    await t.admin.query("delete from error_events");
    await t.admin.query("insert into error_events (at, source, message) values (now() - interval '31 days', 'vecchio', 'vecchio')");
    await store.recordError("nuovo", "nuovo", {});
    expect(await count(t.admin, "select count(*) as n from error_events where source = 'vecchio'")).toBe(0);
  });

  it("vincoli: messaggio vuoto o dettagli enormi rifiutati", async () => {
    await expect(t.admin.query("insert into error_events (source, message) values ('x', '')")).rejects.toThrow();
    await expect(t.admin.query("insert into error_events (source, message, detail) values ('x', 'y', $1::jsonb)", [JSON.stringify({ a: "z".repeat(5000) })])).rejects.toThrow();
  });
});

describe("permessi", () => {
  const asRole = async (role: Role, sql: string) => (await t.client(role)).query(sql);
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role}: nessun accesso a error_events, alla sua sequenza e alla funzione`, async () => {
      for (const sql of ["select * from error_events", "delete from error_events", "select public.record_error_event('x', 'y', '{}')", "select setval(pg_get_serial_sequence('public.error_events', 'id'), 1)"]) {
        await expect(asRole(role, sql)).rejects.toMatchObject({ code: "42501" });
      }
    });
  }
});

describe("rollback", () => {
  it("la migrazione inversa toglie la funzione, conserva la tabella; il codice tollera l'assenza", async () => {
    const n = await count(t.admin, "select count(*) as n from error_events");
    await t.admin.query(DOWN_M6);
    await expect(reportError(store, "api/prova", "senza funzione")).resolves.toBeUndefined();
    expect(await count(t.admin, "select count(*) as n from error_events")).toBe(n);
    await t.admin.query(UP_M6);
    await t.admin.query(UP_M6);
    await store.recordError("api/prova", "dopo la riapplicazione", {});
    expect(await count(t.admin, "select count(*) as n from error_events")).toBe(n + 1);
  });
});
