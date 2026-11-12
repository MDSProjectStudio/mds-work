"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { ExternalLink, FileText, Plus, Save, Settings2, Sparkles, Trash } from "lucide-react";
import { useDB } from "@/lib/client";
import { estimateQuote, QUOTE_STATUS } from "@/lib/quotes";
import { quoteTotal } from "@/lib/engine";
import { detectKind } from "@/lib/analyze";
import { KIND_LABEL } from "@/lib/skills";
import { fmtMoney, fmtRel } from "@/lib/selectors";
import type { ProjectKind, Quote, QuoteItem } from "@/lib/types";
import { Card, Empty, Field, Loading, Modal, PageHeader, SectionTitle } from "../ui";

type Draft = Partial<Quote> & { title: string; client: string; kind: ProjectKind; items: QuoteItem[] };
const rid = () => Math.random().toString(36).slice(2, 10);

function StudioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, dispatch } = useDB();
  const [s, setS] = useState(db?.studio);
  // Riempie il modulo all'APERTURA (o all'arrivo dei dati). Prima si riempiva a ogni aggiornamento
  // automatico (ogni 2 s), cancellando le modifiche in corso.
  const [filledOpen, setFilledOpen] = useState(false);
  if (open !== filledOpen && (!open || db?.studio)) {
    setFilledOpen(open);
    if (open) setS(db?.studio);
  }
  if (!s) return null;
  return (
    <Modal open={open} onClose={onClose} title="Dati dello studio" kicker="compaiono sui preventivi">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome studio"><input className="field" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
        <Field label="Il tuo nome"><input className="field" value={s.owner} onChange={(e) => setS({ ...s, owner: e.target.value })} /></Field>
        <Field label="Email"><input className="field" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
        <Field label="Tariffa oraria (€)"><input className="field mono" inputMode="numeric" value={s.rate} onChange={(e) => setS({ ...s, rate: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
        <div className="sm:col-span-2"><Field label="Nota fiscale"><input className="field" value={s.vatNote} onChange={(e) => setS({ ...s, vatNote: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Condizioni (piè di pagina)"><textarea className="field h-20 resize-none text-[13px]" value={s.quoteFooter} onChange={(e) => setS({ ...s, quoteFooter: e.target.value })} /></Field></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={async () => (await dispatch({ type: "updateStudio", patch: s })) && onClose()}>Salva</button>
      </div>
    </Modal>
  );
}

function Editor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { db, dispatch } = useDB();
  const [q, setQ] = useState<Draft>(draft);
  const [bpText, setBpText] = useState("");
  const [shownDraft, setShownDraft] = useState(draft);
  if (shownDraft !== draft) {
    setShownDraft(draft);
    setQ(draft);
  }
  if (!db) return null;
  const rate = q.rate ?? db.studio.rate;
  const full = { items: q.items, rate, discount: q.discount ?? 0 };
  const total = quoteTotal(full);
  const hours = q.items.reduce((s, i) => s + i.hours, 0);
  const projectsWithBp = db.projects.filter((p) => p.blueprint?.text);

  const generate = (text: string, kind?: ProjectKind) => {
    const k = kind ?? detectKind(text).kind;
    setQ({ ...q, kind: k, items: estimateQuote(k, text) });
  };
  const setItem = (id: string, p: Partial<QuoteItem>) => setQ({ ...q, items: q.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  const save = async (status?: Quote["status"]) => {
    const ok = await dispatch({ type: "saveQuote", quote: { ...q, rate, status: status ?? q.status } });
    if (ok) onClose();
  };

  return (
    <Card hud className="p-5">
      <SectionTitle kicker={q.number ? `preventivo ${q.number}` : "nuovo preventivo"} title={q.title || "Senza titolo"} right={<button className="btn btn-sm" onClick={onClose}>Chiudi</button>} />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><Field label="Titolo"><input className="field" value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} placeholder="Sito vetrina per…" /></Field></div>
        <Field label="Cliente"><input className="field" value={q.client} onChange={(e) => setQ({ ...q, client: e.target.value })} /></Field>
        <Field label="Email cliente"><input className="field" value={q.clientEmail ?? ""} onChange={(e) => setQ({ ...q, clientEmail: e.target.value })} /></Field>
        <Field label="Tipo">
          <select className="field" value={q.kind} onChange={(e) => setQ({ ...q, kind: e.target.value as ProjectKind })}>
            {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </Field>
        <Field label="Progetto collegato">
          <select className="field" value={q.projectId ?? ""} onChange={(e) => setQ({ ...q, projectId: e.target.value || undefined })}>
            <option value="">—</option>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Contatto in pipeline">
          <select className="field" value={q.leadId ?? ""} onChange={(e) => setQ({ ...q, leadId: e.target.value || undefined })}>
            <option value="">—</option>
            {db.leads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.company ? ` · ${l.company}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Stato">
          <select className="field" value={q.status ?? "draft"} onChange={(e) => setQ({ ...q, status: e.target.value as Quote["status"] })}>
            {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-neon/25 bg-cyan-400/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-neon"><Sparkles size={15} /> Genera le voci dal blueprint</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {projectsWithBp.map((p) => (
            <button key={p.id} className="chip hover:border-neon/60" onClick={() => generate(p.blueprint!.text, p.kind)}>
              {p.name}
            </button>
          ))}
          {db.library.map((l) => (
            <button key={l.id} className="chip hover:border-neon/60" onClick={() => generate(l.text, l.kind)}>
              📚 {l.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea className="field h-16 resize-none text-[12.5px]" value={bpText} onChange={(e) => setBpText(e.target.value)} placeholder="…oppure incolla qui la richiesta del cliente o il blueprint" />
          <button className="btn btn-sm self-end" disabled={!bpText.trim()} onClick={() => generate(bpText)}>Genera</button>
        </div>
        <p className="mt-2 text-[11.5px] text-muted">Le ore sono una stima di partenza: correggile tu. Se c'erano voci, vengono sostituite.</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="kicker text-left">
              <th className="pb-2 font-normal">Voce</th>
              <th className="w-24 pb-2 text-right font-normal">Ore</th>
              <th className="w-28 pb-2 text-right font-normal">Importo</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {q.items.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="py-1.5 pr-2"><input className="field !py-1.5 text-[13px]" value={i.label} onChange={(e) => setItem(i.id, { label: e.target.value })} /></td>
                <td className="py-1.5"><input className="field mono !py-1.5 text-right text-[13px]" inputMode="decimal" value={i.hours} onChange={(e) => setItem(i.id, { hours: Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 })} /></td>
                <td className="mono py-1.5 text-right">{fmtMoney(i.hours * rate)}</td>
                <td className="py-1.5 text-right"><button className="btn btn-sm !p-1.5" onClick={() => setQ({ ...q, items: q.items.filter((x) => x.id !== i.id) })} aria-label="Rimuovi voce"><Trash size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-sm mt-2" onClick={() => setQ({ ...q, items: [...q.items, { id: rid(), label: "", hours: 1 }] })}><Plus size={13} /> Aggiungi voce</button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_300px]">
        <Field label="Note per il cliente"><textarea className="field h-28 resize-none text-[13px]" value={q.notes ?? ""} onChange={(e) => setQ({ ...q, notes: e.target.value })} placeholder="Tempi di consegna, cosa è escluso, revisioni incluse…" /></Field>
        <div className="space-y-2.5 rounded-2xl border border-line bg-black/20 p-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label="€/ora"><input className="field mono !py-1.5" inputMode="numeric" value={rate} onChange={(e) => setQ({ ...q, rate: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Sconto %"><input className="field mono !py-1.5" inputMode="numeric" value={q.discount ?? 0} onChange={(e) => setQ({ ...q, discount: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Validità gg"><input className="field mono !py-1.5" inputMode="numeric" value={q.validDays ?? 30} onChange={(e) => setQ({ ...q, validDays: Number(e.target.value.replace(/\D/g, "")) || 30 })} /></Field>
          </div>
          <div className="flex justify-between text-sm text-muted"><span>{hours} ore</span><span className="mono">{fmtMoney(hours * rate)}</span></div>
          {!!q.discount && <div className="flex justify-between text-sm text-muted"><span>Sconto {q.discount}%</span><span className="mono">− {fmtMoney(hours * rate - total)}</span></div>}
          <div className="flex items-end justify-between border-t border-line pt-2"><span className="kicker">totale</span><span className="mono text-2xl font-semibold text-neon">{fmtMoney(total)}</span></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn" onClick={() => save()} disabled={!q.title.trim() || !q.client.trim()}><Save size={15} /> Salva</button>
        <button className="btn btn-primary" onClick={() => save(q.status === "draft" || !q.status ? "sent" : q.status)} disabled={!q.title.trim() || !q.client.trim()}>Salva come inviato</button>
      </div>
    </Card>
  );
}

export function QuotesView() {
  const { db, dispatch, now } = useDB();
  const search = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [studio, setStudio] = useState(false);

  // ?lead=… o ?project=… apre UNA volta un preventivo precompilato (durante il render, senza effetto).
  // Prima, chiudendo l'editor con il parametro ancora nell'indirizzo, si riapriva a ogni aggiornamento.
  const leadId = search.get("lead");
  const projectId = search.get("project");
  const paramKey = leadId || projectId ? `${leadId}|${projectId}` : null;
  const [usedParam, setUsedParam] = useState<string | null>(null);
  if (db && !draft && paramKey && usedParam !== paramKey) {
    const lead = leadId ? db.leads.find((l) => l.id === leadId) : undefined;
    const proj = projectId ? db.projects.find((p) => p.id === projectId) : undefined;
    setUsedParam(paramKey);
    if (lead) setDraft({ title: `Preventivo per ${lead.company || lead.name}`, client: lead.name, clientEmail: lead.email, kind: lead.kind ?? "website", items: [], leadId: lead.id });
    else if (proj) setDraft({ title: proj.name, client: proj.client, clientEmail: proj.clientEmail, kind: proj.kind, items: proj.blueprint ? estimateQuote(proj.kind, proj.blueprint.text) : [], projectId: proj.id });
  }

  if (!db) return <Loading />;
  const quotes = [...db.quotes].sort((a, b) => b.updatedAt - a.updatedAt);
  const open = quotes.filter((q) => q.status === "sent").reduce((s, q) => s + quoteTotal(q), 0);
  const won = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + quoteTotal(q), 0);

  return (
    <>
      <PageHeader
        kicker="commerciale"
        title="Preventivi"
        subtitle={`${fmtMoney(open)} in attesa di risposta · ${fmtMoney(won)} accettati`}
        actions={
          <>
            <button className="btn" onClick={() => setStudio(true)}><Settings2 size={15} /> Dati studio</button>
            <button className="btn btn-primary" onClick={() => setDraft({ title: "", client: "", kind: "website", items: [] })}><Plus size={16} /> Nuovo preventivo</button>
          </>
        }
      />
      {draft && <div className="mb-6"><Editor draft={draft} onClose={() => setDraft(null)} /></div>}
      {quotes.length === 0 && !draft ? (
        <Card><Empty icon={<FileText size={20} />} title="Nessun preventivo" text="Crea il primo: le voci si generano dal blueprint e il PDF è pronto da inviare." action={<button className="btn btn-primary" onClick={() => setDraft({ title: "", client: "", kind: "website", items: [] })}>Nuovo preventivo</button>} /></Card>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const st = QUOTE_STATUS[q.status];
            return (
              <div key={q.id} className="glass glass-hover flex flex-wrap items-center gap-3 p-3.5">
                <span className="mono w-20 text-xs text-muted">{q.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{q.title}</div>
                  <div className="text-xs text-muted">{q.client} · {KIND_LABEL[q.kind]} · aggiornato {fmtRel(q.updatedAt, now)}</div>
                </div>
                <span className="chip" style={{ color: st.color, borderColor: st.color + "55" }}>{st.label}</span>
                <span className="mono w-24 text-right font-semibold">{fmtMoney(quoteTotal(q))}</span>
                <div className="flex gap-1.5">
                  <button className="btn btn-sm" onClick={() => setDraft({ ...q })}>Modifica</button>
                  <a className="btn btn-sm" href={`/print/quotes/${q.id}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> PDF</a>
                  <button className={clsx("btn btn-sm !px-2")} onClick={() => confirm(`Eliminare il preventivo ${q.number}?`) && dispatch({ type: "deleteQuote", id: q.id })} aria-label="Elimina"><Trash size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <StudioModal open={studio} onClose={() => setStudio(false)} />
    </>
  );
}
