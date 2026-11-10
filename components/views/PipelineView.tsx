"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CircleArrowRight, CalendarClock, FileText, Handshake, Mail, Pencil, Phone, Plus, Trash } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL } from "@/lib/skills";
import { daysTo, fmtDate, fmtMoney } from "@/lib/selectors";
import { quoteTotal } from "@/lib/engine";
import type { Lead, LeadStage, ProjectKind } from "@/lib/types";
import { Field, Loading, Modal, PageHeader, Stat } from "../ui";

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: "new", label: "Nuovi", color: "#38bdf8" },
  { key: "contacted", label: "Contattati", color: "#22d3ee" },
  { key: "quote", label: "Preventivo inviato", color: "#a78bfa" },
  { key: "won", label: "Acquisiti", color: "#a3e635" },
  { key: "lost", label: "Persi", color: "#64748b" },
];

function LeadModal({ lead, onClose }: { lead: Partial<Lead> | null; onClose: () => void }) {
  const { dispatch } = useDB();
  const [l, setL] = useState<Partial<Lead>>(lead ?? {});
  if (!lead) return null;
  const set = (k: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setL({ ...l, [k]: e.target.value });
  return (
    <Modal open={!!lead} onClose={onClose} title={l.id ? "Modifica contatto" : "Nuovo potenziale cliente"} kicker="pipeline" wide>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nome e cognome"><input className="field" value={l.name ?? ""} onChange={set("name")} autoFocus /></Field>
        <Field label="Azienda / attività"><input className="field" value={l.company ?? ""} onChange={set("company")} /></Field>
        <Field label="Da dove arriva"><input className="field" value={l.source ?? ""} onChange={set("source")} placeholder="Instagram, passaparola, TikTok…" /></Field>
        <Field label="Email"><input className="field" value={l.email ?? ""} onChange={set("email")} /></Field>
        <Field label="Telefono"><input className="field" value={l.phone ?? ""} onChange={set("phone")} /></Field>
        <Field label="Cosa gli serve">
          <select className="field" value={l.kind ?? ""} onChange={(e) => setL({ ...l, kind: (e.target.value || undefined) as ProjectKind | undefined })}>
            <option value="">—</option>
            {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </Field>
        <Field label="Valore stimato (€)"><input className="field mono" inputMode="numeric" value={l.value ?? ""} onChange={(e) => setL({ ...l, value: Number(e.target.value.replace(/\D/g, "")) || undefined })} /></Field>
        <Field label="Prossimo passo"><input className="field" value={l.nextStep ?? ""} onChange={set("nextStep")} placeholder="Richiamare, mandare preventivo…" /></Field>
        <Field label="Entro il"><input type="date" className="field mono" value={l.nextDate ?? ""} onChange={set("nextDate")} /></Field>
        <div className="md:col-span-3"><Field label="Note"><textarea className="field h-24 resize-none text-[13px]" value={l.notes ?? ""} onChange={set("notes")} placeholder="Cosa ha chiesto, budget, tempi, impressioni…" /></Field></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={!l.name?.trim()} onClick={async () => (await dispatch({ type: "saveLead", lead: { ...l, name: l.name!.trim() } })) && onClose()}>
          Salva
        </button>
      </div>
    </Modal>
  );
}

export function PipelineView() {
  const { db, dispatch } = useDB();
  const [edit, setEdit] = useState<Partial<Lead> | null>(null);
  if (!db) return <Loading />;
  const open = db.leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const value = open.reduce((s, l) => s + (l.value ?? 0), 0);
  const closed = db.leads.filter((l) => l.stage === "won" || l.stage === "lost");
  const rate = closed.length ? Math.round((db.leads.filter((l) => l.stage === "won").length / closed.length) * 100) : 0;
  const followups = open.filter((l) => l.nextDate && daysTo(l.nextDate) <= 0).length;

  return (
    <>
      <PageHeader
        kicker="nuovi clienti"
        title="Pipeline"
        subtitle="Chi ti ha contattato, a che punto sei e cosa fare dopo: nessun contatto si perde più."
        actions={<button className="btn btn-primary" onClick={() => setEdit({ stage: "new" })}><Plus size={16} /> Nuovo contatto</button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contatti aperti" value={open.length} icon={<Handshake size={16} />} />
        <Stat label="Valore potenziale" value={fmtMoney(value)} icon={<FileText size={16} />} color="#a78bfa" delay={0.05} />
        <Stat label="Tasso di chiusura" value={`${rate}%`} sub={`${closed.length} chiusi`} icon={<CircleArrowRight size={16} />} color="#a3e635" delay={0.1} />
        <Stat label="Da richiamare" value={followups} sub="oggi o in ritardo" icon={<CalendarClock size={16} />} color="#fbbf24" delay={0.15} />
      </div>

      <div className="overflow-x-auto pb-2" tabIndex={0} role="region" aria-label="Fasi della pipeline">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {STAGES.map((s) => {
            const list = db.leads.filter((l) => l.stage === s.key);
            return (
              <section key={s.key} className="min-w-0 rounded-2xl border border-line bg-white/[0.015] p-2.5">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                  <span className="text-[12.5px] font-semibold">{s.label}</span>
                  <span className="mono ml-auto text-[11px] text-muted">{list.length}</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {list.map((l) => {
                      const q = db.quotes.filter((x) => x.leadId === l.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
                      const late = l.nextDate && daysTo(l.nextDate) <= 0 && s.key !== "won" && s.key !== "lost";
                      return (
                        <motion.div key={l.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="group rounded-xl border border-line bg-[#0a1020]/80 p-3 hover:border-line2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-medium">{l.name}</div>
                              {l.company && <div className="truncate text-[11.5px] text-muted">{l.company}</div>}
                            </div>
                            {(l.value || q) && <span className="mono text-[12px] text-neon">{fmtMoney(q ? quoteTotal(q) : l.value!)}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {l.kind && <span className="chip !py-0 !text-[10px]">{KIND_LABEL[l.kind]}</span>}
                            {l.source && <span className="chip !py-0 !text-[10px]">{l.source}</span>}
                            {q && <span className="chip !py-0 !text-[10px]">prev. {q.number}</span>}
                          </div>
                          {l.nextStep && (
                            <div className={`mt-2 flex items-center gap-1.5 text-[11.5px] ${late ? "text-amber" : "text-muted"}`}>
                              <CalendarClock size={12} /> {l.nextStep}{l.nextDate ? ` · ${fmtDate(l.nextDate)}` : ""}
                            </div>
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center gap-1">
                            <select className="field !w-auto !py-1 !pl-2 !pr-6 text-[11px]" value={l.stage} onChange={(e) => dispatch({ type: "saveLead", lead: { ...l, stage: e.target.value as LeadStage } })} aria-label="Fase">
                              {STAGES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                            </select>
                            {l.email && <a className="btn btn-sm !p-1" href={`mailto:${l.email}`} aria-label="Email"><Mail size={12} /></a>}
                            {l.phone && <a className="btn btn-sm !p-1" href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Phone size={12} /></a>}
                            <Link className="btn btn-sm !p-1" href={`/quotes?lead=${l.id}`} title="Crea preventivo" aria-label="Crea preventivo"><FileText size={12} /></Link>
                            <button className="btn btn-sm !p-1" onClick={() => setEdit(l)} aria-label="Modifica"><Pencil size={12} /></button>
                            <button className="btn btn-sm !p-1" onClick={() => confirm(`Eliminare ${l.name}?`) && dispatch({ type: "deleteLead", id: l.id })} aria-label="Elimina"><Trash size={12} /></button>
                          </div>
                          {l.projectId ? (
                            <Link href={`/projects/${l.projectId}`} className="mt-2 block text-[11.5px] text-lime hover:underline">→ Apri il progetto</Link>
                          ) : (
                            (s.key === "quote" || s.key === "won") && (
                              <button className="btn btn-ok btn-sm mt-2 w-full" onClick={() => dispatch({ type: "convertLead", id: l.id })}>
                                <CircleArrowRight size={13} /> Acquisito: crea progetto
                              </button>
                            )
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {!list.length && <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-muted">Vuoto</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <LeadModal key={edit?.id ?? (edit ? "new" : "none")} lead={edit} onClose={() => setEdit(null)} />
    </>
  );
}
