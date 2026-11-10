"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Action, DB } from "./types";
import { createIntentTracker } from "./action-intent";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Ctx {
  db: DB | null;
  error: string | null;
  dispatch: (a: Action) => Promise<boolean>;
  now: number;
}

const DBContext = createContext<Ctx>({ db: null, error: null, dispatch: async () => false, now: 0 });

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
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
   * Ogni operazione viaggia con un actionId (lib/action-intent.ts):
   * - i ritentativi automatici (rete, errore del server, conflitto) riusano lo STESSO actionId;
   * - un doppio clic con lo stesso contenuto (entro 2 s o mentre la prima è in corso) riusa lo stesso actionId;
   * il server applica ogni actionId una volta sola.
   */
  const [tracker] = useState(() => createIntentTracker());
  const dispatch = useCallback(
    async (a: Action) => {
      const mine = ++seq.current;
      const { actionId } = tracker.begin(a);
      try {
        for (let attempt = 0; ; attempt++) {
          const retry = attempt < 2;
          let r: Response;
          try {
            r = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, action: a }) });
          } catch {
            if (retry) {
              await wait(400 * (attempt + 1));
              continue;
            }
            throw new Error("Server non raggiungibile");
          }
          // 401: l'aggiornamento periodico (refresh) porta già alla pagina di accesso
          const j = await r.json().catch(() => ({}));
          if ((r.status >= 500 || r.status === 409) && retry) {
            await wait(400 * (attempt + 1));
            continue;
          }
          if (!r.ok) throw new Error(j.error ?? "Errore");
          if (mine === seq.current) setDb(j);
          return true;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
        return false;
      } finally {
        tracker.end(a, actionId);
      }
    },
    [tracker],
  );

  return <DBContext.Provider value={{ db, error, dispatch, now }}>{children}</DBContext.Provider>;
}

export const useDB = () => useContext(DBContext);
