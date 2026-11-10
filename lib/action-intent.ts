import { stableStringify } from "./stable";

/**
 * Quando RIUSARE lo stesso identificativo d'azione (actionId) e quando crearne uno nuovo.
 *
 * Stesso identificativo (il server applica l'operazione UNA volta sola):
 *  - ritentativi automatici della stessa richiesta (rete caduta, errore del server, conflitto);
 *  - stessa operazione, con lo STESSO contenuto, ripetuta mentre la prima è ancora in corso
 *    oppure entro `windowMs` (2 s) dalla sua conclusione: è un doppio clic/invio accidentale.
 *
 * Identificativo nuovo (il server la applica di nuovo):
 *  - operazione con contenuto diverso;
 *  - stessa operazione ripetuta DOPO la finestra: è una scelta intenzionale
 *    (es. due incassi identici registrati di proposito).
 *
 * Limite noto: due operazioni identiche e intenzionali a meno di 2 s l'una dall'altra
 * vengono trattate come doppio clic (una sola applicata).
 */
export const DOUBLE_SUBMIT_WINDOW_MS = 2000;

interface Entry {
  id: string;
  pending: number;
  settledAt: number;
}

export interface IntentTracker {
  /** Identificativo da usare per questa operazione; `repeated` = riuso per doppio invio. */
  begin(op: unknown): { actionId: string; repeated: boolean };
  /** Da chiamare quando la richiesta è conclusa (con successo o no). */
  end(op: unknown, actionId: string): void;
}

export function createIntentTracker(opts: { windowMs?: number; now?: () => number; newId?: () => string } = {}): IntentTracker {
  const windowMs = opts.windowMs ?? DOUBLE_SUBMIT_WINDOW_MS;
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const entries = new Map<string, Entry>();

  const prune = (t: number) => {
    for (const [k, e] of entries) if (e.pending === 0 && t - e.settledAt >= windowMs) entries.delete(k);
  };

  return {
    begin(op) {
      const t = now();
      prune(t);
      const key = stableStringify(op);
      const e = entries.get(key);
      if (e && (e.pending > 0 || t - e.settledAt < windowMs)) {
        e.pending++;
        return { actionId: e.id, repeated: true };
      }
      const fresh: Entry = { id: newId(), pending: 1, settledAt: 0 };
      entries.set(key, fresh);
      return { actionId: fresh.id, repeated: false };
    },
    end(op, actionId) {
      const e = entries.get(stableStringify(op));
      if (!e || e.id !== actionId || e.pending === 0) return;
      e.pending--;
      if (e.pending === 0) e.settledAt = now();
    },
  };
}
