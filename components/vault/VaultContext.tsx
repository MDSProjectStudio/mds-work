"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Tiene la chiave della cassaforte SOLO in memoria. Si blocca da sola dopo 5 minuti di inattività. */
const AUTO_LOCK_MS = 5 * 60_000;

const Ctx = createContext<{ key: CryptoKey | null; setKey: (k: CryptoKey) => void; lock: () => void }>({ key: null, setKey: () => {}, lock: () => {} });

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [key, setKeyState] = useState<CryptoKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lock = useCallback(() => {
    setKeyState(null);
    clearTimeout(timer.current);
  }, []);

  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKeyState(null), AUTO_LOCK_MS);
  }, []);

  const setKey = useCallback(
    (k: CryptoKey) => {
      setKeyState(k);
      arm();
    },
    [arm],
  );

  useEffect(() => {
    if (!key) return;
    const reset = () => arm();
    const evs = ["pointerdown", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, reset));
    return () => evs.forEach((e) => window.removeEventListener(e, reset));
  }, [key, arm]);

  return <Ctx.Provider value={{ key, setKey, lock }}>{children}</Ctx.Provider>;
}

export const useVault = () => useContext(Ctx);
