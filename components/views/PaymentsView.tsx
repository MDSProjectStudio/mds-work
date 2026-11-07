"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { Check, CircleDollarSign, Clock, Plus, Trash, Wallet } from "lucide-react";
import { useDB } from "@/lib/client";
import { daysTo, fmtDate, fmtMoney, money, today } from "@/lib/selectors";
import { Card, Loading, PageHeader, ProjectDot, Progress, SectionTitle, Stat } from "../ui";

export function PaymentsList({ projectId }: { projectId?: string }) {
  const { db, dispatch } = useDB();
  const [form, setForm] = useState({ projectId: projectId ?? "", label: "", amount: "", dueDate: "" });
  if (!db) return null;
  const t = today();
  const rows = db.payments
    .filter((p) => !projectId || p.projectId === projectId)
    .sort((a, b) => (a.status === b.status ? (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9") : a.status === "due" ? -1 : 1));

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle kicker="movimenti" title="Pagamenti" />
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1.4fr_0.8fr_0.9fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const pid = projectId ?? form.projectId;
          if (!pid || !form.amount) return;
          dispatch({ type: "addPayment", projectId: pid, label: form.label || "Pagamento", amount: Number(form.amount), dueDate: form.dueDate || undefined });
          setForm({ projectId: projectId ?? "", label: "", amount: "", dueDate: "" });
        }}
      >
        {!projectId && (
          <select className="field !py-2 text-[13px]" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Progetto…</option>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input className={clsx("field !py-2 text-[13px]", projectId && "sm:col-span-2")} placeholder="Voce (es. Seconda rata)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input className="field mono !py-2 text-[13px]" placeholder="€" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })} />
        <input type="date" className="field mono !py-2 text-[13px]" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <button className="btn btn-primary btn-sm">
          <Plus size={14} /> Aggiungi
        </button>
      </form>
      <div className="mt-4 divide-y divide-line">
        {rows.map((p) => {
          const proj = db.projects.find((x) => x.id === p.projectId);
          const late = p.status === "due" && p.dueDate && p.dueDate < t;
          const d = p.dueDate ? daysTo(p.dueDate) : null;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <span className={clsx("grid h-8 w-8 flex-none place-items-center rounded-lg border", p.status === "paid" ? "border-lime/40 bg-lime/10 text-lime" : late ? "border-rose/40 bg-rose/10 text-rose" : "border-line2 text-muted")}>
                {p.status === "paid" ? <Check size={15} /> : late ? <Clock size={15} /> : <CircleDollarSign size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.label}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  {!projectId && proj && <><ProjectDot color={proj.color} size={6} /> {proj.name} ·</>}
                  {p.status === "paid" ? "incassato" : p.dueDate ? (late ? <span className="text-rose">scaduto da {-(d ?? 0)} giorni</span> : `scade ${fmtDate(p.dueDate)}`) : "senza scadenza"}
                </div>
              </div>
              <span className={clsx("mono font-semibold", p.status === "paid" ? "text-lime" : late ? "text-rose" : "")}>{fmtMoney(p.amount)}</span>
              <button className={clsx("btn btn-sm", p.status === "paid" ? "" : "btn-ok")} onClick={() => dispatch({ type: "markPaid", id: p.id })}>
                {p.status === "paid" ? "Annulla" : "Incassato"}
              </button>
              <button className="btn btn-sm !px-2" onClick={() => dispatch({ type: "deletePayment", id: p.id })} aria-label="Elimina pagamento">
                <Trash size={13} />
              </button>
            </div>
          );
        })}
        {!rows.length && <div className="py-6 text-center text-sm text-muted">Nessun pagamento registrato</div>}
      </div>
    </Card>
  );
}

export function PaymentsView() {
  const { db } = useDB();
  if (!db) return <Loading />;
  const m = money(db);
  const portfolio = db.projects.reduce((s, p) => s + p.price, 0);

  return (
    <>
      <PageHeader kicker="soldi" title="Incassi" subtitle="Chi ti ha pagato, chi ti deve ancora pagare e chi è in ritardo." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Incassato" value={fmtMoney(m.paid)} icon={<Check size={16} />} color="#a3e635" />
        <Stat label="Da incassare" value={fmtMoney(m.due)} icon={<Wallet size={16} />} delay={0.05} />
        <Stat label="In ritardo" value={fmtMoney(m.late)} sub={`${m.lateCount} pagamenti`} icon={<Clock size={16} />} color="#fb7185" delay={0.1} />
        <Stat label="Valore progetti" value={fmtMoney(portfolio)} sub={`${db.projects.length} progetti`} icon={<CircleDollarSign size={16} />} color="#a78bfa" delay={0.15} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card className="p-4 sm:p-5">
          <SectionTitle kicker="per progetto" title="Situazione clienti" />
          <div className="mt-4 space-y-4">
            {db.projects.map((p) => {
              const pays = db.payments.filter((x) => x.projectId === p.id);
              const paid = pays.filter((x) => x.status === "paid").reduce((s, x) => s + x.amount, 0);
              const tot = Math.max(p.price, pays.reduce((s, x) => s + x.amount, 0));
              return (
                <Link key={p.id} href={`/projects/${p.id}?tab=money`} className="block rounded-xl p-2 transition hover:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-sm">
                    <ProjectDot color={p.color} />
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="mono text-xs text-muted">
                      {fmtMoney(paid)} / {fmtMoney(tot)}
                    </span>
                  </div>
                  <Progress value={tot ? (paid / tot) * 100 : 0} color={p.color} className="mt-2" />
                </Link>
              );
            })}
          </div>
        </Card>
        <PaymentsList />
      </div>
    </>
  );
}
