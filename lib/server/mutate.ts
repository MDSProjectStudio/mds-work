import { createHash, randomUUID } from "node:crypto";
import { advance, log, reduce, withIdSeed } from "../engine";
import { buildBrief } from "../brief";
import { stableStringify } from "../stable";
import { templateById } from "../templates";
import type { Action, DB, Project, Task } from "../types";
import type { LaunchRow, StateStore } from "./state-types";

/**
 * Applicazione sicura delle modifiche allo stato (Fase 1 · M2).
 * - Si lavora SEMPRE su una copia dello stato appena letto: un tentativo fallito non sporca il successivo.
 * - Gli id creati durante l'azione derivano dall'actionId: un ritentativo produce gli stessi id.
 * - Il salvataggio è condizionato alla versione letta; in caso di conflitto si rilegge e si ricalcola.
 * - Gli avvii del team sono DATI passati al salvataggio: vengono scritti nella stessa transazione.
 */

export const ACTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_:.-]{7,119}$/;

export const requestHash = (v: unknown) => createHash("sha256").update(stableStringify(v)).digest("hex");

export type MutateOutcome =
  | { status: "saved"; db: DB; version: number; launchIds: number[]; attempts: number }
  | { status: "duplicate"; db: DB; version: number; attempts: number }
  | { status: "action_id_reused"; attempts: number }
  | { status: "conflict_exhausted"; attempts: number };

export interface RetryOptions {
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function mutateWithRetry(
  store: StateStore,
  actionId: string,
  hash: string,
  mutate: (draft: DB) => LaunchRow[] | void,
  opts: RetryOptions = {},
): Promise<MutateOutcome> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { db, version } = await store.load();
    const draft = structuredClone(db);
    const launches = withIdSeed(actionId, () => mutate(draft)) ?? [];
    const r = await store.save({ expectedVersion: version, data: draft, actionId, requestHash: hash, launches });
    if (r.status === "saved") return { status: "saved", db: draft, version: r.version, launchIds: r.launchIds, attempts: attempt };
    if (r.status === "duplicate") {
      const cur = await store.load();
      return { status: "duplicate", db: cur.db, version: cur.version, attempts: attempt };
    }
    if (r.status === "action_id_reused") return { status: "action_id_reused", attempts: attempt };
    // conflitto: attesa breve e casuale, poi si rilegge e si ricalcola
    if (attempt < maxAttempts) await sleep(15 * attempt + Math.floor(Math.random() * 40));
  }
  return { status: "conflict_exhausted", attempts: maxAttempts };
}

/** Motivo per cui un avvio del team non è possibile (null = possibile). */
export function launchProblem(store: Pick<StateStore, "launches">, p: Project): string | null {
  if (!store.launches) return "Serve la dashboard collegata a Supabase";
  if (!p.localPath) return "Imposta prima la cartella del progetto sul PC (Impostazioni del progetto)";
  return null;
}

export function launchRow(db: DB, p: Project, dedupeKey: string, opts: { task?: Task; focus?: string; requestHash?: string } = {}): LaunchRow {
  return {
    project_id: p.id,
    task_id: opts.task?.id ?? null,
    template: templateById(p.templateId).name,
    brief: buildBrief(db, p, opts.task, opts.focus),
    dedupe_key: dedupeKey,
    request_hash: opts.requestHash ?? null,
  };
}

/** Azione del titolare dalla dashboard. */
export async function applyAction(store: StateStore, action: Action, actionId: string, now: number, opts: RetryOptions = {}): Promise<MutateOutcome> {
  return mutateWithRetry(
    store,
    actionId,
    requestHash(action),
    (draft) => {
      const wasPending =
        action.type === "resolveApproval" && draft.approvals.some((a) => a.id === action.id && a.status === "pending");
      reduce(draft, action, now);
      advance(draft, now);
      // Team reale: approvando una richiesta o un piano, il lavoro parte da solo sul PC.
      // Solo se l'approvazione è stata risolta ORA (non per un clic ripetuto su una già risolta).
      if (action.type !== "resolveApproval" || action.decision !== "approved" || !wasPending) return [];
      const ap = draft.approvals.find((a) => a.id === action.id);
      const p = ap && draft.projects.find((x) => x.id === ap.projectId);
      if (!ap || !p || p.agentsMode !== "off" || (ap.kind !== "request" && ap.kind !== "plan")) return [];
      const problem = launchProblem(store, p);
      log(draft, p.id, "chief", problem ? `Non posso avviare il team: ${problem}` : "Lavoro inviato al tuo PC: il team parte con Claude Code", problem ? "warn" : "success", now);
      if (problem) return [];
      const focus = `Il titolare ha approvato: **${ap.title}**.\n${ap.detail}\n\nEsegui le task aperte qui sotto con il team, in ordine, chiedendo l'ok prima di pubblicare.`;
      return [launchRow(draft, p, `approval:${ap.id}`, { focus })];
    },
    opts,
  );
}

/** Lettura periodica della dashboard: avanza la simulazione e salva solo se nessuno ha scritto nel frattempo. */
export async function advanceAndSave(store: StateStore, now: number): Promise<DB> {
  const { db, version } = await store.load();
  const draft = structuredClone(db);
  if (!advance(draft, now)) return db;
  const r = await store.save({ expectedVersion: version, data: draft });
  if (r.status === "saved") return draft;
  // conflitto: un'altra scrittura è arrivata prima; la prossima lettura ricalcolerà
  return (await store.load()).db;
}

/** Richiesta dal portale clienti (fino a M3: stesso salvataggio versionato, id generato dal server). */
export async function addPortalRequest(store: StateStore, projectId: string, author: string, message: string, now: number, opts: RetryOptions = {}) {
  const actionId = `portal:${randomUUID()}`;
  return mutateWithRetry(
    store,
    actionId,
    requestHash({ projectId, author, message }),
    (draft) => {
      draft.requests.push({ id: `rq_${actionId.slice(7).replace(/-/g, "").slice(0, 16)}`, projectId, author, message, status: "new", createdAt: now });
    },
    opts,
  );
}
