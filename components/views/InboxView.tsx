"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Inbox, Trash } from "lucide-react";
import { useDB } from "@/lib/client";
import { fmtRel } from "@/lib/selectors";
import { Card, Empty, Loading, PageHeader } from "../ui";

export function InboxView() {
  const { db, dispatch, now } = useDB();
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Record<string, string>>({});
  if (!db) return <Loading />;
  const projects = db.projects.filter((p) => p.status !== "done");

  return (
    <>
      <PageHeader kicker="cattura veloce" title="Inbox" subtitle="Scrivi qui tutto quello che ti passa per la testa, senza pensare a dove va. Poi lo smisti in un progetto con un clic." />
      <Card hud className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            dispatch({ type: "addInbox", text });
            setText("");
          }}
        >
          <input className="field !py-3 text-[15px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Es. chiedere a FitZone il logo in alta risoluzione" autoFocus />
          <button className="btn btn-primary !py-3">
            <Inbox size={16} /> Salva
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">Suggerimento: puoi farlo anche da ovunque con <kbd className="mono rounded border border-line2 px-1">Ctrl K</kbd> o scrivendo ad Ari “nota: …”.</p>
      </Card>

      <div className="mt-5 space-y-2">
        {db.inbox.length === 0 && (
          <Card>
            <Empty icon={<Inbox size={20} />} title="Inbox vuota" text="Testa libera. Ottimo lavoro." />
          </Card>
        )}
        <AnimatePresence initial={false}>
          {db.inbox.map((i) => (
            <motion.div key={i.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="glass flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-[14px]">{i.text}</div>
                <div className="mono mt-0.5 text-[11px] text-muted">{fmtRel(i.createdAt, now)}</div>
              </div>
              <div className="flex items-center gap-2">
                <select aria-label="Progetto in cui spostarla" className="field !w-44 !py-1.5 text-[13px]" value={target[i.id] ?? ""} onChange={(e) => setTarget((t) => ({ ...t, [i.id]: e.target.value }))}>
                  <option value="">Sposta in…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-sm" disabled={!target[i.id]} onClick={() => dispatch({ type: "inboxToTask", id: i.id, projectId: target[i.id] })}>
                  Task <ArrowRight size={13} />
                </button>
                <button className="btn btn-sm btn-bad !px-2" onClick={() => dispatch({ type: "removeInbox", id: i.id })} aria-label="Elimina">
                  <Trash size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
