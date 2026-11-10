import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Lo schema attuale (supabase/schema.sql) applicato a un Postgres in memoria (PGlite):
 * nessun servizio esterno, solo dati sintetici. È la base per i test SQL di M2.
 * Nota: PGlite ha una sola connessione, quindi NON prova la concorrenza reale (vedi il piano, M2).
 */
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8"));
});
afterAll(async () => {
  await db.close();
});

describe("supabase/schema.sql su PGlite", () => {
  it("crea le tre tabelle previste", async () => {
    const r = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' order by 1");
    expect(r.rows.map((x) => x.table_name)).toEqual(["agent_events", "app_state", "launch_requests"]);
  });

  it("RLS attiva su tutte le tabelle", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('app_state','agent_events','launch_requests')");
    expect(r.rows).toHaveLength(3);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });

  it("app_state accetta una sola riga (id = 1)", async () => {
    await db.query("insert into app_state (id, data) values (1, $1)", [JSON.stringify({ projects: [{ id: "p_finto", name: "Progetto finto" }] })]);
    await expect(db.query("insert into app_state (id, data) values (2, '{}')")).rejects.toThrow();
    const r = await db.query<{ data: { projects: { name: string }[] } }>("select data from app_state where id = 1");
    expect(r.rows[0].data.projects[0].name).toBe("Progetto finto");
  });

  it("lo schema si può rieseguire senza errori (idempotente)", async () => {
    await expect(db.exec(readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8"))).resolves.not.toThrow();
  });
});
