import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import pg from "pg";

/**
 * PostgreSQL VERO, locale e isolato, per le prove di concorrenza (Fase 1 · M2).
 * - Binari ufficiali PostgreSQL 17.10 per Windows (pacchetto @embedded-postgres/windows-x64,
 *   verificati identici all'archivio ufficiale EDB: vedi docs/fasi/FASE-1-M2.md).
 * - Cartella temporanea nuova, creata qui e rimossa alla fine: nessun dato esistente coinvolto.
 * - In ascolto SOLO su 127.0.0.1, porta libera casuale, password casuale (scram-sha-256).
 * - Nessun servizio Windows installato, nessun utente creato o modificato: è un processo
 *   avviato e fermato da pg_ctl durante i test.
 * - Nessun collegamento a Supabase: le variabili d'ambiente Supabase non vengono lette.
 */
declare module "vitest" {
  export interface ProvidedContext {
    pgAdmin: { host: string; port: number; user: string; password: string };
  }
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });

/** Ruoli come in Supabase (valgono per tutto il cluster): anon e authenticated = browser, service_role = server. */
async function createRoles(admin: { host: string; port: number; user: string; password: string }) {
  const c = new pg.Client({ ...admin, database: "postgres" });
  await c.connect();
  await c.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;`);
  await c.end();
}

export default async function setup(project: TestProject) {
  // CI (Linux): PostgreSQL già avviato come contenitore di servizio, isolato e usa-e-getta (vedi .github/workflows/ci.yml)
  if (process.env.MDS_TEST_PG_HOST) {
    const admin = {
      host: process.env.MDS_TEST_PG_HOST,
      port: Number(process.env.MDS_TEST_PG_PORT ?? 5432),
      user: process.env.MDS_TEST_PG_USER ?? "postgres",
      password: process.env.MDS_TEST_PG_PASSWORD ?? "",
    };
    if (!/^(localhost|127\.0\.0\.1)$/.test(admin.host)) throw new Error("Le prove PostgreSQL accettano solo un server locale (localhost)");
    await createRoles(admin);
    project.provide("pgAdmin", admin);
    return;
  }
  if (process.platform !== "win32") throw new Error("Senza MDS_TEST_PG_HOST le prove usano i binari PostgreSQL per Windows");
  // Pacchetto SOLO Windows (dipendenza opzionale): su Linux non è installato. Il nome sta in una variabile perché
  // il controllo dei tipi di `next build` (che include tests/) non deve cercare un modulo assente su Linux e fallire.
  const pacchetto = "@embedded-postgres/windows-x64";
  const { initdb, pg_ctl } = (await import(/* @vite-ignore */ pacchetto)) as { initdb: string; pg_ctl: string };

  const dir = mkdtempSync(path.join(os.tmpdir(), "mds-pg-prova-"));
  const data = path.join(dir, "data");
  const password = randomBytes(18).toString("hex");
  const pwfile = path.join(dir, "pw.txt");
  writeFileSync(pwfile, password);
  const port = await freePort();

  // stdio "ignore": il processo postgres avviato da pg_ctl erediterebbe le pipe e terrebbe bloccata l'attesa
  const run = (bin: string, args: string[]) => execFileSync(bin, args, { stdio: "ignore", windowsHide: true, timeout: 120_000 });
  run(initdb, ["-D", data, "-U", "postgres", `--pwfile=${pwfile}`, "--auth=scram-sha-256", "--encoding=UTF8", "--no-locale"]);
  rmSync(pwfile);
  run(pg_ctl, [
    "start", "-D", data, "-l", path.join(dir, "postgres.log"), "-w", "-t", "60",
    "-o", `-p ${port} -c listen_addresses=127.0.0.1 -c max_connections=80 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
  ]);

  const admin = { host: "127.0.0.1", port, user: "postgres", password };
  await createRoles(admin);

  project.provide("pgAdmin", admin);

  return () => {
    try {
      run(pg_ctl, ["stop", "-D", data, "-m", "fast", "-w", "-t", "60"]);
    } finally {
      // solo la cartella temporanea creata da questo setup
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
