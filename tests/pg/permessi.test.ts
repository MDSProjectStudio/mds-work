import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestHash } from "@/lib/server/mutate";
import { freshDb, initState, pgStore, syntheticState, type Role, type TestDb } from "./helpers";

/**
 * Permessi EFFETTIVI per ruolo sulle tabelle e funzioni nuove (non solo "RLS attiva").
 * Il database di prova riproduce i privilegi predefiniti di Supabase, che concedono tutto
 * ad anon e authenticated sugli oggetti nuovi: la migrazione deve revocarli.
 */
let t: TestDb;
beforeAll(async () => {
  t = await freshDb();
  await initState(pgStore(t.pool(1)));
});
afterAll(async () => {
  await t?.close();
});

const NEW_TABLES = ["app_config", "app_state_history", "applied_actions"];
const asRole = async (role: Role, sql: string, params: unknown[] = []) => {
  const c = await t.client(role);
  return c.query(sql, params);
};
const saveSql = "select public.save_app_state(0, $1::jsonb, $2, $3, '[]'::jsonb)";

describe("ruoli del browser (anon, authenticated): nessun accesso", () => {
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role}: non può eseguire save_app_state né enqueue_launch`, async () => {
      await expect(asRole(role, saveSql, [JSON.stringify(syntheticState()), randomUUID(), requestHash("p")])).rejects.toMatchObject({ code: "42501" });
      await expect(asRole(role, "select public.enqueue_launch('{}'::jsonb)")).rejects.toMatchObject({ code: "42501" });
    });

    for (const table of NEW_TABLES) {
      it(`${role}: nessun privilegio su ${table} (lettura, scrittura, svuotamento)`, async () => {
        for (const sql of [`select * from ${table}`, `delete from ${table}`, `truncate ${table}`]) {
          await expect(asRole(role, sql)).rejects.toMatchObject({ code: "42501" });
        }
        const privs = await t.admin.query<{ p: string }>(
          `select privilege_type as p from information_schema.role_table_grants where table_schema = 'public' and table_name = $1 and grantee = $2`,
          [table, role],
        );
        expect(privs.rows).toEqual([]);
      });
    }

    it(`${role}: non può scrivere nello stato nemmeno passando dalla tabella app_state`, async () => {
      // tabella esistente: RLS senza policy blocca righe; vedi il rapporto per i privilegi residui
      const r = await asRole(role, "select count(*)::int as n from app_state");
      expect(r.rows[0].n).toBe(0);
      await expect(asRole(role, "update app_state set data = '{}'::jsonb where id = 1")).resolves.toMatchObject({ rowCount: 0 });
    });
  }
});

describe("ruolo del server (service_role): accesso necessario e sufficiente", () => {
  it("può salvare, accodare avvii e leggere le tabelle nuove", async () => {
    const store = pgStore(t.pool(1, "service_role"));
    const { db, version } = await store.load();
    expect((await store.save({ expectedVersion: version, data: db, actionId: randomUUID(), requestHash: requestHash("ok") })).status).toBe("saved");
    const q = await store.enqueueLaunch({ project_id: "p_finto", task_id: null, template: null, brief: "x", dedupe_key: `launch:${randomUUID()}`, request_hash: requestHash("l") });
    expect(q.status).toBe("queued");
    for (const table of NEW_TABLES) await expect(asRole("service_role", `select count(*) from ${table}`)).resolves.toBeTruthy();
  });

  it("le funzioni di trigger non sono eseguibili da nessun ruolo del browser", async () => {
    for (const fn of ["app_state_before_write", "app_state_after_update"]) {
      for (const role of ["anon", "authenticated"]) {
        const r = await t.admin.query<{ ok: boolean }>(`select has_function_privilege($1, 'public.${fn}()', 'execute') as ok`, [role]);
        expect(r.rows[0].ok).toBe(false);
      }
    }
  });
});

describe("RLS", () => {
  it("attiva su tutte le tabelle, nuove ed esistenti", async () => {
    const r = await t.admin.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1",
    );
    expect(r.rows.map((x) => x.relname)).toEqual(["agent_events", "app_config", "app_state", "app_state_history", "applied_actions", "launch_requests"]);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });
});

describe("RISCHIO RESIDUO (tabelle esistenti, fuori dalla migrazione M2)", () => {
  it("con i privilegi predefiniti di Supabase anon conserva privilegi di tabella su app_state (es. TRUNCATE, non coperto da RLS)", async () => {
    // Fotografia, non correzione: l'API REST non espone TRUNCATE, ma la revoca è proposta a parte.
    const r = await t.admin.query<{ ok: boolean }>("select has_table_privilege('anon', 'public.app_state', 'TRUNCATE') as ok");
    expect(r.rows[0].ok).toBe(true);
  });
});
