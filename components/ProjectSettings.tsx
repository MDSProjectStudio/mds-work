"use client";

import { useState } from "react";
import { Bot, CalendarClock, Check, GitBranch, User } from "lucide-react";
import { useDB } from "@/lib/client";
import { fmtMoney } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { Card, Field, SectionTitle } from "./ui";

export function ProjectSettings({ project: p }: { project: Project }) {
  const { dispatch } = useDB();
  const [f, setF] = useState({
    client: p.client,
    clientEmail: p.clientEmail ?? "",
    clientPhone: p.clientPhone ?? "",
    repoUrl: p.repoUrl ?? "",
    localPath: p.localPath ?? "",
    deadline: p.deadline ?? "",
    price: String(p.price || ""),
    agentsMode: p.agentsMode ?? "sim",
    mActive: p.maintenance?.active ?? false,
    mMonthly: String(p.maintenance?.monthly ?? ""),
    mSince: p.maintenance?.since ?? new Date().toISOString().slice(0, 7),
    mDay: String(p.maintenance?.day ?? 5),
  });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  };

  const save = async () => {
    const ok = await dispatch({
      type: "updateProject",
      id: p.id,
      patch: {
        client: f.client.trim(),
        clientEmail: f.clientEmail.trim() || undefined,
        clientPhone: f.clientPhone.trim() || undefined,
        repoUrl: f.repoUrl.trim() || undefined,
        localPath: f.localPath.trim() || undefined,
        deadline: f.deadline || undefined,
        price: Number(f.price) || 0,
        agentsMode: f.agentsMode as "sim" | "off",
        maintenance: { active: f.mActive, monthly: Number(f.mMonthly) || 0, since: f.mSince, day: Number(f.mDay) || 5 },
      },
    });
    if (ok) setSaved(true);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle kicker="cliente" title={<span className="flex items-center gap-2"><User size={15} className="text-neon" /> Contatti</span>} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nome cliente"><input className="field" value={f.client} onChange={set("client")} /></Field>
          <Field label="Email"><input className="field" type="email" value={f.clientEmail} onChange={set("clientEmail")} placeholder="cliente@email.it" /></Field>
          <Field label="Telefono / WhatsApp" hint="Con prefisso, es. +39 333…"><input className="field" value={f.clientPhone} onChange={set("clientPhone")} /></Field>
          <Field label="Consegna"><input type="date" className="field mono" value={f.deadline} onChange={set("deadline")} /></Field>
          <Field label="Prezzo progetto (€)"><input className="field mono" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="codice" title={<span className="flex items-center gap-2"><GitBranch size={15} className="text-neon" /> Repo e cartella</span>} />
        <div className="mt-4 space-y-3">
          <Field label="Repo GitHub"><input className="field" value={f.repoUrl} onChange={set("repoUrl")} placeholder="https://github.com/…" /></Field>
          <Field label="Cartella sul PC" hint="Finisce nel brief per Claude Code, così sa dove lavorare."><input className="field mono text-[12.5px]" value={f.localPath} onChange={set("localPath")} placeholder="C:\Users\…\progetto" /></Field>
          <Field label="Agenti">
            <select className="field" value={f.agentsMode} onChange={set("agentsMode")}>
              <option value="sim">Attivi (simulazione: il team lavora da solo)</option>
              <option value="off">In pausa (ci lavoro io con Claude Code)</option>
            </select>
          </Field>
          <p className="flex gap-2 text-[11.5px] text-muted"><Bot size={13} className="mt-0.5 flex-none" /> In pausa, Scout continua comunque a leggere le richieste del portale clienti.</p>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <SectionTitle kicker="entrate ricorrenti" title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-neon" /> Canone di manutenzione</span>} />
        <div className="mt-4 grid items-end gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-black/20 px-3 py-2.5 text-sm">
            <input type="checkbox" className="accent-cyan-400" checked={f.mActive} onChange={set("mActive")} /> Attivo
          </label>
          <Field label="Importo mensile (€)"><input className="field mono" inputMode="numeric" value={f.mMonthly} onChange={(e) => setF({ ...f, mMonthly: e.target.value.replace(/\D/g, "") })} placeholder="49" /></Field>
          <Field label="Da (mese)"><input type="month" className="field mono" value={f.mSince} onChange={set("mSince")} /></Field>
          <Field label="Giorno di scadenza"><input className="field mono" inputMode="numeric" value={f.mDay} onChange={(e) => setF({ ...f, mDay: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></Field>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Ogni mese la rata {f.mMonthly ? `da ${fmtMoney(Number(f.mMonthly))} ` : ""}compare da sola in Incassi, con il suo promemoria. Valore annuo: <span className="mono text-fg">{fmtMoney((Number(f.mMonthly) || 0) * 12)}</span>.
        </p>
      </Card>

      <div className="flex items-center justify-end gap-3 lg:col-span-2">
        {saved && <span className="flex items-center gap-1.5 text-sm text-lime"><Check size={15} /> Salvato</span>}
        <button className="btn btn-primary" onClick={save}>Salva impostazioni</button>
      </div>
    </div>
  );
}
