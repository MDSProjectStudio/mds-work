import { stableStringify } from "./stable";

/**
 * Quando RIUSARE lo stesso identificativo d'azione (actionId) e quando crearne uno nuovo.
 *
 * Ogni invio si conclude con uno di tre ESITI:
 *  - "confirmed": il server ha risposto con successo (salvata ora, o già salvata in precedenza);
 *  - "rejected":  il server ha risposto che NON l'ha applicata (dati non validi, manutenzione,
 *                 conflitti esauriti, accesso negato…): rifiuto definitivo;
 *  - "uncertain": nessuna risposta utile (rete, errore 5xx, tempo scaduto): l'operazione POTREBBE
 *                 essere stata salvata.
 *
 * Stesso identificativo (il server applica l'operazione UNA volta sola):
 *  - ritentativi automatici della stessa richiesta;
 *  - stessa operazione (stesso contenuto) ripetuta mentre la prima è in corso;
 *  - stessa operazione ripetuta entro `windowMs` (2 s) da un esito CONFERMATO (doppio clic);
 *  - stessa operazione ripetuta dopo un esito INCERTO, in qualsiasi momento, anche dopo aver
 *    ricaricato la pagina (l'esito incerto viene conservato nel browser) — finché un invio con
 *    quell'identificativo non riceve una risposta definitiva.
 *
 * Identificativo nuovo (il server la applica di nuovo):
 *  - contenuto diverso;
 *  - stessa operazione ripetuta dopo la finestra di un esito CONFERMATO (scelta intenzionale);
 *  - stessa operazione dopo un RIFIUTO definitivo (non era stata applicata).
 *
 * Limite noto: due operazioni identiche e intenzionali a meno di 2 s l'una dall'altra contano come una.
 */
export const DOUBLE_SUBMIT_WINDOW_MS = 2000;
/** Per quanto tempo il browser ricorda un esito incerto (il registro del server dura 30 giorni). */
export const UNCERTAIN_TTL_MS = 7 * 86_400_000;

export type SendOutcome = "confirmed" | "rejected" | "uncertain";

interface Entry {
  id: string;
  pending: number;
  /** momento dell'ultimo esito confermato (null = nessuno) */
  settledAt: number | null;
  /** momento in cui l'esito è diventato incerto (null = non incerto) */
  uncertainAt: number | null;
}

/** Conserva gli esiti incerti fra un caricamento della pagina e l'altro (es. localStorage). */
export interface IntentPersistence {
  load(): Record<string, { id: string; at: number }>;
  save(data: Record<string, { id: string; at: number }>): void;
}

/** Operazione con esito ancora incerto (da mostrare finché non viene risolta). */
export interface UncertainOp {
  key: string;
  op: unknown;
  since: number;
}

export interface IntentTracker {
  /** Identificativo da usare per questa operazione; `repeated` = riuso; `uncertain` = riprende un esito incerto. */
  begin(op: unknown): { actionId: string; repeated: boolean; uncertain: boolean };
  /** Da chiamare a fine invio con l'esito. */
  end(op: unknown, actionId: string, outcome: SendOutcome): void;
  /** Operazioni con esito incerto, NON in corso (array stabile finché non cambia: adatto a useSyncExternalStore). */
  uncertain(): readonly UncertainOp[];
  /** Avvisa a ogni cambiamento dell'elenco degli esiti incerti. */
  subscribe(cb: () => void): () => void;
}

export function createIntentTracker(
  opts: { windowMs?: number; now?: () => number; newId?: () => string; persistence?: IntentPersistence } = {},
): IntentTracker {
  const windowMs = opts.windowMs ?? DOUBLE_SUBMIT_WINDOW_MS;
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const entries = new Map<string, Entry>();

  try {
    const saved = opts.persistence?.load() ?? {};
    const t = now();
    for (const [k, v] of Object.entries(saved)) {
      if (v && typeof v.id === "string" && t - v.at < UNCERTAIN_TTL_MS) entries.set(k, { id: v.id, pending: 0, settledAt: null, uncertainAt: v.at });
    }
  } catch {
    // memoria del browser non disponibile: si continua senza
  }

  const listeners = new Set<() => void>();
  let snapshot: readonly UncertainOp[] = [];
  const recompute = () => {
    const next: UncertainOp[] = [];
    for (const [k, e] of entries) {
      if (e.uncertainAt === null || e.pending > 0) continue;
      let op: unknown = null;
      try {
        op = JSON.parse(k);
      } catch {
        continue;
      }
      next.push({ key: k, op, since: e.uncertainAt });
    }
    const same = next.length === snapshot.length && next.every((x, i) => x.key === snapshot[i].key && x.since === snapshot[i].since);
    if (!same) {
      snapshot = next;
      listeners.forEach((l) => l());
    }
  };

  const persist = () => {
    recompute();
    if (!opts.persistence) return;
    const out: Record<string, { id: string; at: number }> = {};
    for (const [k, e] of entries) if (e.uncertainAt !== null) out[k] = { id: e.id, at: e.uncertainAt };
    try {
      opts.persistence.save(out);
    } catch {
      // ignorato
    }
  };

  const prune = (t: number) => {
    let changed = false;
    for (const [k, e] of entries) {
      if (e.pending > 0) continue;
      if (e.uncertainAt !== null) {
        if (t - e.uncertainAt >= UNCERTAIN_TTL_MS) {
          entries.delete(k);
          changed = true;
        }
      } else if (e.settledAt !== null && t - e.settledAt >= windowMs) entries.delete(k);
    }
    if (changed) persist();
  };
  recompute();

  return {
    begin(op) {
      const t = now();
      prune(t);
      const key = stableStringify(op);
      const e = entries.get(key);
      if (e && (e.pending > 0 || e.uncertainAt !== null || (e.settledAt !== null && t - e.settledAt < windowMs))) {
        e.pending++;
        if (e.uncertainAt !== null) recompute(); // in corso: non più "in attesa di risoluzione" finché non finisce
        return { actionId: e.id, repeated: true, uncertain: e.uncertainAt !== null };
      }
      entries.set(key, { id: newId(), pending: 1, settledAt: null, uncertainAt: null });
      return { actionId: entries.get(key)!.id, repeated: false, uncertain: false };
    },
    uncertain: () => snapshot,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    end(op, actionId, outcome) {
      const key = stableStringify(op);
      const e = entries.get(key);
      if (!e || e.id !== actionId || e.pending === 0) return;
      e.pending--;
      const t = now();
      if (outcome === "confirmed") {
        // applicata (ora o prima): da qui vale solo la finestra del doppio clic
        e.uncertainAt = null;
        e.settledAt = t;
      } else if (outcome === "uncertain") {
        // potrebbe essere stata applicata: l'identificativo resta finché non arriva una risposta definitiva
        // (se un altro invio con lo stesso id è già stato confermato, l'operazione è applicata: nulla da ricordare)
        if (e.settledAt === null) e.uncertainAt = e.uncertainAt ?? t;
      } else if (e.pending === 0 && e.settledAt === null) {
        // rifiuto definitivo e nessun invio confermato: non era stata applicata, il prossimo tentativo è nuovo
        entries.delete(key);
      } else if (e.pending === 0) {
        e.uncertainAt = null;
      }
      persist();
    },
  };
}

/** Persistenza su localStorage, protetta da errori (modalità privata, memoria piena…). */
export function localStoragePersistence(key: string): IntentPersistence {
  return {
    load() {
      try {
        return JSON.parse(globalThis.localStorage?.getItem(key) ?? "{}") ?? {};
      } catch {
        return {};
      }
    },
    save(data) {
      try {
        if (Object.keys(data).length) globalThis.localStorage?.setItem(key, JSON.stringify(data));
        else globalThis.localStorage?.removeItem(key);
      } catch {
        // ignorato
      }
    },
  };
}
