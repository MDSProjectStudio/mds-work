"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Action, DB } from "./types";
import { createIntentTracker, localStoragePersistence, type UncertainOp } from "./action-intent";
import { sendWithIntent } from "./action-send";

interface Ctx {
  db: DB | null;
  /** collegamento al server (aggiornamento periodico) */
  error: string | null;
  dispatch: (a: Action) => Promise<boolean>;
  now: number;
  /** operazioni con esito NON confermato: restano visibili finché non vengono risolte */
  uncertain: readonly UncertainOp[];
  /** ripete un'operazione incerta con lo STESSO identificativo (nessun doppione) */
  retryUncertain: (key: string) => Promise<boolean>;
  /** ultimo rifiuto di un'operazione (resta finché non lo chiudi o la prossima riesce) */
  actionError: string | null;
  clearActionError: () => void;
}

const NO_UNCERTAIN: readonly UncertainOp[] = [];
const DBContext = createContext<Ctx>({
  db: null, error: null, dispatch: async () => false, now: 0,
  uncertain: NO_UNCERTAIN, retryUncertain: async () => false, actionError: null, clearActionError: () => {},
});

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Errore");
      if (mine === seq.current) {
        setDb(j);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Server non raggiungibile");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, [refresh]);

  /**
   * Ogni operazione viaggia con un actionId (lib/action-intent.ts, lib/action-send.ts):
   * - ritentativi automatici e doppi clic riusano lo STESSO actionId;
   * - se l'esito resta INCERTO (nessuna risposta), l'actionId viene conservato (anche dopo un ricaricamento)
   *   e riusato al prossimo tentativo della stessa operazione: il server non la duplica.
   */
  const [tracker] = useState(() => createIntentTracker({ persistence: localStoragePersistence("mds:azioni-incerte") }));
  const dispatch = useCallback(
    async (a: Action) => {
      const mine = ++seq.current;
      try {
        const r = await sendWithIntent<DB>({
          tracker,
          op: a,
          send: (actionId) => fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, action: a }) }),
        });
        if (r.outcome === "uncertain") return false; // l'avviso persistente lo mostra (uncertain)
        if (r.outcome !== "confirmed" || !r.body) throw new Error(r.error ?? "Errore");
        if (mine === seq.current) setDb(r.body);
        setActionError(null);
        return true;
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Errore");
        return false;
      }
    },
    [tracker],
  );

  const uncertain = useSyncExternalStore(tracker.subscribe, tracker.uncertain, () => NO_UNCERTAIN);
  const retryUncertain = useCallback(
    async (key: string) => {
      const item = tracker.uncertain().find((u) => u.key === key);
      return item ? dispatch(item.op as Action) : false;
    },
    [tracker, dispatch],
  );
  const clearActionError = useCallback(() => setActionError(null), []);

  return (
    <DBContext.Provider value={{ db, error, dispatch, now, uncertain, retryUncertain, actionError, clearActionError }}>{children}</DBContext.Provider>
  );
}

export const useDB = () => useContext(DBContext);
