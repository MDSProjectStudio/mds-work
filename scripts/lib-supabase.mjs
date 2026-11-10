/**
 * Accesso minimo a Supabase (REST) per gli script locali di MDS Work.
 * Le chiavi si leggono da .env.local di MDS Work: restano solo su questo PC.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/**
 * Dove sta .env.local:
 * - copia installata degli hook (~/.claude/mds/bin/vN/): runtime.json accanto a questo file indica il percorso
 *   (solo il percorso, mai le chiavi)
 * - repository MDS Work: <repo>/.env.local
 */
export function envFilePath() {
  try {
    const rt = JSON.parse(fs.readFileSync(path.join(HERE, "runtime.json"), "utf8"));
    if (rt.envFile) return rt.envFile;
  } catch {}
  return path.join(ROOT, ".env.local");
}

export function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(envFilePath(), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return { url: env.NEXT_PUBLIC_SUPABASE_URL ?? "", key: env.SUPABASE_SECRET_KEY ?? "" };
}

export function supabase(timeoutMs = 8000) {
  const { url, key } = loadEnv();
  if (!url || !key) return null;
  const req = async (method, table, query = "", body, returning = false) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${url}/rest/v1/${table}${query}`, {
        method,
        signal: ctrl.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: method === "GET" ? "" : returning ? "return=representation" : "return=minimal",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      return method === "GET" || returning ? r.json() : null;
    } finally {
      clearTimeout(t);
    }
  };
  return {
    select: (table, query) => req("GET", table, query),
    insert: (table, rows) => req("POST", table, "", rows),
    update: (table, query, patch) => req("PATCH", table, query, patch),
    /** Aggiornamento condizionato: restituisce le righe davvero modificate (vuoto = condizione non vera). */
    updateReturning: (table, query, patch) => req("PATCH", table, query, patch, true),
    remove: (table, query) => req("DELETE", table, query),
  };
}

/** Nome ruolo del kit → ruolo della dashboard (per la stanza). */
export function dashboardRole(kitRole) {
  const r = String(kitRole || "").replace(/^mds-/, "");
  const map = {
    capo: "chief", esploratore: "analyst", architetto: "analyst", mappa: "analyst",
    design: "design", frontend: "frontend", backend: "backend", database: "data",
    mobile: "mobile", game: "game", seo: "seo", qa: "qa", devops: "devops",
  };
  return map[r] ?? "chief";
}

export const ROLE_NAMES = {
  chief: "Atlas", analyst: "Nova", design: "Muse", frontend: "Flux", backend: "Forge", data: "Delta",
  mobile: "Pocket", game: "Joy", seo: "Vox", qa: "Sentinel", devops: "Rocket", triage: "Scout",
};
