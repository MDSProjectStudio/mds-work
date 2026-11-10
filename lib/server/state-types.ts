import type { DB } from "../types";

/**
 * Contratto unico del salvataggio versionato. Implementazioni:
 *  - Supabase (produzione): chiama la funzione SQL save_app_state / enqueue_launch;
 *  - PostgreSQL locale (solo test, tests/pg): chiama LE STESSE funzioni SQL;
 *  - offline (sviluppo senza Supabase): stessa logica in memoria, un solo processo.
 * Nessun modulo "server-only" qui: è importabile dai test.
 */
export interface LaunchRow {
  project_id: string;
  task_id: string | null;
  template: string | null;
  brief: string;
  dedupe_key: string;
  request_hash?: string | null;
}

export interface SaveRequest {
  expectedVersion: number;
  data: DB;
  actionId?: string;
  requestHash?: string;
  launches?: LaunchRow[];
}

export type SaveResult =
  | { status: "saved"; version: number; launchIds: number[] }
  | { status: "duplicate"; version: number }
  | { status: "blocked"; version: number }
  | { status: "conflict"; version: number }
  | { status: "action_id_reused"; version: number };

export type EnqueueResult = { status: "queued" | "duplicate"; id: number } | { status: "action_id_reused"; id: number } | { status: "blocked" };

export type ActionOutcome = "applied" | "action_id_reused" | "unknown";

export interface StateStore {
  /** true se gli avvii del team sono possibili (serve Supabase e il motore sul PC). */
  readonly launches: boolean;
  load(): Promise<{ db: DB; version: number }>;
  save(req: SaveRequest): Promise<SaveResult>;
  enqueueLaunch(row: LaunchRow & { request_hash: string }): Promise<EnqueueResult>;
  /** L'azione con questo identificativo è già stata applicata? (solo lettura) */
  actionOutcome(actionId: string, requestHash: string): Promise<ActionOutcome>;
  /** Avvio già in coda con questa chiave? (solo lettura) */
  findLaunch(dedupeKey: string): Promise<{ id: number; request_hash: string | null } | null>;
}

/** Converte la risposta JSON delle funzioni SQL nel tipo TypeScript (stessa logica per Supabase e test). */
export function parseSaveResult(raw: unknown): SaveResult {
  const r = (raw ?? {}) as { status?: string; version?: number | string; launch_ids?: (number | string)[] };
  const version = Number(r.version ?? 0);
  switch (r.status) {
    case "saved":
      return { status: "saved", version, launchIds: (r.launch_ids ?? []).map(Number) };
    case "duplicate":
    case "blocked":
    case "conflict":
    case "action_id_reused":
      return { status: r.status, version };
    default:
      throw new Error(`Risposta di save_app_state non riconosciuta: ${String(r.status)}`);
  }
}

export function parseEnqueueResult(raw: unknown): EnqueueResult {
  const r = (raw ?? {}) as { status?: string; id?: number | string };
  if (r.status === "queued" || r.status === "duplicate" || r.status === "action_id_reused") return { status: r.status, id: Number(r.id) };
  if (r.status === "blocked") return { status: "blocked" };
  throw new Error(`Risposta di enqueue_launch non riconosciuta: ${String(r.status)}`);
}
