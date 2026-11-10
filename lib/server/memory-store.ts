import type { DB } from "../types";
import type { EnqueueResult, LaunchRow, SaveRequest, SaveResult, StateStore } from "./state-types";

/**
 * Archivio in memoria con la STESSA semantica di save_app_state (versione, registro azioni, avvii).
 * Usato in modalità offline (sviluppo) e nei test unitari. Un solo processo: le operazioni sono
 * sincrone fra un `await` e l'altro, quindi ogni save è atomico.
 */
export interface MemoryStoreOptions {
  initial: () => DB;
  /** Chiamata dopo ogni salvataggio riuscito (es. scrittura del file .data/db.json). */
  persist?: (db: DB, version: number) => void;
  launches?: boolean;
}

export function createMemoryStore(opts: MemoryStoreOptions): StateStore & { launchRows: (LaunchRow & { id: number })[] } {
  let data: DB | null = null;
  let version = 0;
  const applied = new Map<string, { hash: string; version: number }>();
  const launchRows: (LaunchRow & { id: number })[] = [];
  let nextLaunchId = 1;

  const ensure = () => {
    if (!data) data = opts.initial();
    return data;
  };

  return {
    launches: opts.launches ?? false,
    launchRows,
    async load() {
      return { db: structuredClone(ensure()), version };
    },
    async save(req: SaveRequest): Promise<SaveResult> {
      ensure();
      if (req.actionId) {
        const prev = applied.get(req.actionId);
        if (prev) return prev.hash === req.requestHash ? { status: "duplicate", version } : { status: "action_id_reused", version };
      }
      if (req.expectedVersion !== version) return { status: "conflict", version };
      for (const l of req.launches ?? []) if (!l.dedupe_key) throw new Error("avvio senza dedupe_key");
      // tutto o niente: si prepara prima, poi si applica
      const ids: number[] = [];
      const newRows: (LaunchRow & { id: number })[] = [];
      for (const l of req.launches ?? []) {
        if (launchRows.some((r) => r.dedupe_key === l.dedupe_key) || newRows.some((r) => r.dedupe_key === l.dedupe_key)) continue;
        const row = { ...l, id: nextLaunchId + newRows.length };
        newRows.push(row);
        ids.push(row.id);
      }
      data = structuredClone(req.data);
      version += 1;
      if (req.actionId) applied.set(req.actionId, { hash: req.requestHash ?? "", version });
      launchRows.push(...newRows);
      nextLaunchId += newRows.length;
      opts.persist?.(data, version);
      return { status: "saved", version, launchIds: ids };
    },
    async enqueueLaunch(row): Promise<EnqueueResult> {
      const prev = launchRows.find((r) => r.dedupe_key === row.dedupe_key);
      if (prev) return prev.request_hash === row.request_hash ? { status: "duplicate", id: prev.id } : { status: "action_id_reused", id: prev.id };
      const id = nextLaunchId++;
      launchRows.push({ ...row, id });
      return { status: "queued", id };
    },
  };
}
