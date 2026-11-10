"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FolderKanban, Inbox, KeyRound, Library, Plus, Search, ShieldCheck, Sun, Wallet } from "lucide-react";
import clsx from "clsx";
import { useDB } from "@/lib/client";
import { ProjectDot } from "./ui";

interface Item {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({ open, onClose, onNewProject, onImport }: { open: boolean; onClose: () => void; onNewProject: () => void; onImport: () => void }) {
  const { db, dispatch } = useDB();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // all'apertura: ricerca vuota e prima voce selezionata (durante il render), poi il focus (effetto)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setSel(0);
    }
  }
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const base: Item[] = [
      { id: "new", label: "Nuovo progetto", hint: "azione", icon: <Plus size={15} />, run: () => { onClose(); onNewProject(); } },
      { id: "import", label: "Importa progetti già avviati", hint: "azione", icon: <FolderKanban size={15} />, run: () => { onClose(); onImport(); } },
      { id: "pipeline", label: "Pipeline clienti", hint: "pagina", icon: <Inbox size={15} />, run: go("/pipeline") },
      { id: "quotes", label: "Preventivi", hint: "pagina", icon: <Library size={15} />, run: go("/quotes") },
      { id: "today", label: "Oggi", hint: "pagina", icon: <Sun size={15} />, run: go("/") },
      { id: "projects", label: "Progetti", hint: "pagina", icon: <FolderKanban size={15} />, run: go("/projects") },
      { id: "approvals", label: "Approvazioni", hint: "pagina", icon: <ShieldCheck size={15} />, run: go("/approvals") },
      { id: "inbox", label: "Inbox", hint: "pagina", icon: <Inbox size={15} />, run: go("/inbox") },
      { id: "payments", label: "Incassi", hint: "pagina", icon: <Wallet size={15} />, run: go("/payments") },
      { id: "library", label: "Libreria blueprint e template", hint: "pagina", icon: <Library size={15} />, run: go("/library") },
      { id: "vault", label: "Cassaforte credenziali", hint: "pagina", icon: <KeyRound size={15} />, run: go("/vault") },
      ...(db?.projects ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.client, icon: <ProjectDot color={p.color} />, run: go(`/projects/${p.id}`) })),
    ];
    const s = q.trim().toLowerCase();
    const filtered = s ? base.filter((i) => (i.label + " " + i.hint).toLowerCase().includes(s)) : base;
    if (s.length > 2)
      filtered.push({
        id: "capture",
        label: `Aggiungi all'inbox: "${q.trim()}"`,
        hint: "cattura",
        icon: <Inbox size={15} />,
        run: () => {
          dispatch({ type: "addInbox", text: q.trim() });
          onClose();
        },
      });
    return filtered;
  }, [q, db, router, onClose, onNewProject, onImport, dispatch]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[sel]?.run(); }
    else if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#02040a]/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div className="glass-strong hud relative w-full max-w-xl overflow-hidden" initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -6, opacity: 0 }}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search size={16} className="text-neon" />
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={onKey}
                placeholder="Cerca o scrivi un'idea da salvare…"
                className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              <kbd className="mono rounded-md border border-line2 px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={it.run}
                  className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", i === sel ? "bg-cyan-400/10 text-fg" : "text-muted")}
                >
                  <span className={clsx("grid h-7 w-7 place-items-center rounded-lg border border-line", i === sel && "text-neon")}>{it.icon}</span>
                  <span className="flex-1 truncate">{it.label}</span>
                  <span className="kicker">{it.hint}</span>
                  {i === sel && <CornerDownLeft size={13} className="text-neon" />}
                </button>
              ))}
              {!items.length && <div className="px-3 py-6 text-center text-sm text-muted">Nessun risultato</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
