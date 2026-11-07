"use client";

import { Printer } from "lucide-react";
import { useDB } from "@/lib/client";
import { quoteTotal } from "@/lib/engine";
import { KIND_LABEL } from "@/lib/skills";
import { fmtMoney } from "@/lib/selectors";

/** Preventivo in formato A4 chiaro: "Stampa → Salva come PDF". */
export function QuotePrint({ id }: { id: string }) {
  const { db } = useDB();
  if (!db) return <div className="p-10 text-center text-sm text-muted">Caricamento…</div>;
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return <div className="p-10 text-center text-sm text-muted">Preventivo non trovato</div>;
  const s = db.studio;
  const sub = q.items.reduce((t, i) => t + i.hours * q.rate, 0);
  const total = quoteTotal(q);
  const date = new Date(q.updatedAt);
  const until = new Date(q.updatedAt + q.validDays * 86_400_000);
  const d = (x: Date) => x.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="quote-print min-h-screen py-8 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={15} /> Stampa / Salva PDF
        </button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[#0f172a] shadow-2xl print:shadow-none" style={{ fontFamily: "var(--font-geist-sans), system-ui" }}>
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="inline-grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-[12px] font-bold text-white">MDS</div>
            <div className="mt-3 text-lg font-semibold">{s.name}</div>
            <div className="text-[12px] text-slate-500">{[s.owner, s.email].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Preventivo</div>
            <div className="text-2xl font-semibold">N. {q.number}</div>
            <div className="mt-1 text-[12px] text-slate-500">Data: {d(date)}</div>
            <div className="text-[12px] text-slate-500">Valido fino al: {d(until)}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Per</div>
            <div className="mt-1 font-medium">{q.client}</div>
            {q.clientEmail && <div className="text-[12px] text-slate-500">{q.clientEmail}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Progetto</div>
            <div className="mt-1 font-medium">{q.title}</div>
            <div className="text-[12px] text-slate-500">{KIND_LABEL[q.kind]}</div>
          </div>
        </section>

        <table className="mt-8 w-full text-[13px]">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Attività</th>
              <th className="pb-2 text-right font-medium">Ore</th>
              <th className="pb-2 text-right font-medium">Importo</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((i, n) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="py-2.5 pr-3 text-slate-400">{String(n + 1).padStart(2, "0")}</td>
                <td className="py-2.5 pr-3">{i.label}</td>
                <td className="py-2.5 text-right tabular-nums">{i.hours}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtMoney(i.hours * q.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <div className="w-72 space-y-1.5 text-[13px]">
            <div className="flex justify-between text-slate-500"><span>Subtotale ({q.items.reduce((t, i) => t + i.hours, 0)} h × {fmtMoney(q.rate)})</span><span className="tabular-nums">{fmtMoney(sub)}</span></div>
            {q.discount > 0 && <div className="flex justify-between text-slate-500"><span>Sconto {q.discount}%</span><span className="tabular-nums">− {fmtMoney(sub - total)}</span></div>}
            <div className="flex items-end justify-between border-t-2 border-slate-900 pt-2"><span className="text-[11px] uppercase tracking-[0.2em]">Totale</span><span className="text-2xl font-semibold tabular-nums">{fmtMoney(total)}</span></div>
            <div className="text-right text-[11px] text-slate-400">{s.vatNote}</div>
          </div>
        </section>

        {q.notes && (
          <section className="mt-8 rounded-xl bg-slate-50 p-4 text-[12.5px] leading-relaxed whitespace-pre-line text-slate-700">{q.notes}</section>
        )}
        <footer className="mt-10 border-t border-slate-200 pt-4 text-[11.5px] leading-relaxed text-slate-500 whitespace-pre-line">
          {s.quoteFooter}
          <div className="mt-8 grid grid-cols-2 gap-10 text-[11px]">
            <div className="border-t border-slate-300 pt-1.5">Firma {s.name}</div>
            <div className="border-t border-slate-300 pt-1.5">Firma per accettazione</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
