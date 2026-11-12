import type { IntentTracker, SendOutcome } from "./action-intent";

/**
 * Invio di un'operazione con identificativo d'azione e classificazione dell'esito.
 * Usato dalla dashboard (lib/client.tsx) e da "Lavora con il team" (components/LaunchButton.tsx).
 *
 * - 2xx                         → confermato
 * - 4xx (400, 401, 403, 404, 409 dopo i ritentativi, 422, 423…) → rifiuto definitivo: il server
 *   risponde che NON l'ha applicata
 * - 5xx o nessuna risposta       → ritentativo automatico con lo STESSO id; se non basta: esito incerto
 */
export interface SendResult<T> {
  outcome: SendOutcome;
  actionId: string;
  status?: number;
  body?: T;
  error?: string;
}

export const UNCERTAIN_MESSAGE = "Esito non confermato: la modifica potrebbe essere già stata salvata. Riprova: non verrà duplicata.";

export async function sendWithIntent<T>(opts: {
  tracker: IntentTracker;
  op: unknown;
  send: (actionId: string) => Promise<Response>;
  retries?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<SendResult<T>> {
  const retries = opts.retries ?? 2;
  const wait = opts.wait ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const { actionId } = opts.tracker.begin(opts.op);
  let result: SendResult<T> = { outcome: "uncertain", actionId, error: UNCERTAIN_MESSAGE };
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const last = attempt === retries;
      let r: Response;
      try {
        r = await opts.send(actionId);
      } catch {
        if (!last) {
          await wait(400 * (attempt + 1));
          continue;
        }
        result = { outcome: "uncertain", actionId, error: UNCERTAIN_MESSAGE };
        break;
      }
      const body = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
      if (r.ok) {
        result = { outcome: "confirmed", actionId, status: r.status, body: body ?? undefined };
        break;
      }
      if (r.status >= 500 || r.status === 409) {
        if (!last) {
          await wait(400 * (attempt + 1));
          continue;
        }
        // 409 = il server conferma di NON aver salvato (troppi conflitti); 5xx = esito sconosciuto
        result =
          r.status === 409
            ? { outcome: "rejected", actionId, status: r.status, error: body?.error ?? "Troppe modifiche contemporanee: riprova" }
            : { outcome: "uncertain", actionId, status: r.status, error: UNCERTAIN_MESSAGE };
        break;
      }
      result = { outcome: "rejected", actionId, status: r.status, error: body?.error ?? "Errore" };
      break;
    }
  } finally {
    opts.tracker.end(opts.op, actionId, result.outcome);
  }
  return result;
}
