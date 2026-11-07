"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { BookOpen, Copy, Download, ExternalLink, LayoutTemplate, Link2, Plug, Plus, Search, Sparkles, Trash, Zap } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL, ROLES, SKILL_CATEGORIES, SKILL_PACKS } from "@/lib/skills";
import { TEMPLATES, TEMPLATE_STYLES } from "@/lib/templates";
import { POWERUPS, REFERENCES, REF_CATEGORIES, subagentFile } from "@/lib/arsenal";
import { detectKind } from "@/lib/analyze";
import type { AgentRole, ProjectKind } from "@/lib/types";
import { TemplatePreview } from "../TemplatePreview";
import { Sprite } from "../Sprite";
import { Card, Empty, Loading, PageHeader, SectionTitle } from "../ui";

type Tab = "templates" | "skills" | "refs" | "powerups" | "blueprints";
const TABS: [Tab, string, typeof LayoutTemplate][] = [
  ["templates", `Template grafici (${TEMPLATES.length})`, LayoutTemplate],
  ["skills", `Skill pack (${SKILL_PACKS.length})`, Sparkles],
  ["refs", `Riferimenti (${REFERENCES.length})`, Link2],
  ["powerups", "Potenziamenti agenti", Zap],
  ["blueprints", "Blueprint", BookOpen],
];

function download(filename: string, content: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function LibraryView() {
  const { db, dispatch } = useDB();
  const [tab, setTab] = useState<Tab>("templates");
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<ProjectKind | "all">("all");
  const [style, setStyle] = useState("all");
  const [cat, setCat] = useState("all");
  const [apply, setApply] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", text: "" });
  const s = q.trim().toLowerCase();

  const tpls = useMemo(
    () => TEMPLATES.filter((t) => (kindFilter === "all" || t.kinds.includes(kindFilter)) && (style === "all" || t.style === style) && (!s || `${t.name} ${t.vibe} ${t.sector} ${t.style}`.toLowerCase().includes(s))),
    [kindFilter, style, s],
  );
  const packs = SKILL_PACKS.filter((p) => (cat === "all" || (p.category ?? "Core") === cat) && (!s || `${p.label} ${p.desc} ${p.checklist.join(" ")}`.toLowerCase().includes(s)));
  const refs = REFERENCES.filter((r) => (cat === "all" || r.cat === cat) && (!s || `${r.name} ${r.desc}`.toLowerCase().includes(s)));

  if (!db) return <Loading />;

  return (
    <>
      <PageHeader kicker="arsenale del team" title="Libreria" subtitle="Tutto quello che gli agenti usano per fare lavori di livello: stili, standard, riferimenti e strumenti." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-black/20 p-1">
          {TABS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => { setTab(k); setCat("all"); setQ(""); }} className={clsx("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition", tab === k ? "bg-cyan-400/15 text-fg" : "text-muted hover:text-fg")}>
              <Icon size={14} /> {l}
            </button>
          ))}
        </div>
        {tab !== "powerups" && tab !== "blueprints" && (
          <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field !py-2 !pl-9 text-sm" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        )}
        {tab === "templates" && (
          <>
            <select className="field !w-auto !py-2 text-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ProjectKind | "all")}>
              <option value="all">Tutti i tipi</option>
              {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <select className="field !w-auto !py-2 text-sm" value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="all">Tutti gli stili</option>
              {TEMPLATE_STYLES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </>
        )}
        {(tab === "skills" || tab === "refs") && (
          <div className="flex flex-wrap gap-1">
            {["all", ...(tab === "skills" ? SKILL_CATEGORIES : REF_CATEGORIES)].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={clsx("chip !py-1 transition", cat === c && "!border-neon/70 !bg-cyan-400/10 !text-fg")}>
                {c === "all" ? "Tutte" : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "templates" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tpls.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <Card hover className="group p-3">
                <div className="overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-[1.015]">
                  <TemplatePreview t={t} />
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{t.name}</div>
                    <div className="flex gap-1">{t.palette.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: c }} />)}</div>
                  </div>
                  <div className="text-[12.5px] text-muted">{t.vibe}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="chip !text-[10px] !text-pink-300">{t.style}</span>
                    <span className="chip !text-[10px]">{t.sector}</span>
                    <span className="chip !text-[10px]">{t.font}</span>
                  </div>
                  <div className="mt-2 text-[11.5px] text-muted">{t.features.join(" · ")}</div>
                  <div className="mt-3 flex gap-2">
                    <select className="field !py-1.5 text-[12.5px]" value={apply[t.id] ?? ""} onChange={(e) => setApply({ ...apply, [t.id]: e.target.value })}>
                      <option value="">Usa nel progetto…</option>
                      {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.templateId === t.id ? " (attuale)" : ""}</option>)}
                    </select>
                    <button className="btn btn-sm btn-primary" disabled={!apply[t.id]} onClick={() => { dispatch({ type: "updateProject", id: apply[t.id], patch: { templateId: t.id } }); setApply({ ...apply, [t.id]: "" }); }}>
                      Applica
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
          {!tpls.length && <Card className="md:col-span-2 xl:col-span-3"><Empty icon={<LayoutTemplate size={20} />} title="Nessun template con questi filtri" /></Card>}
        </div>
      )}

      {tab === "skills" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((p) => (
            <Card key={p.id} className="p-4" style={p.core ? { borderColor: "rgba(244,114,182,.35)" } : undefined}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{p.label}</span>
                <span className={clsx("chip ml-auto !text-[9.5px]", p.core && "!text-pink-300")}>{p.core ? "standard estetico" : p.category ?? "Core"}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted">{p.desc}</p>
              <ul className="mt-2.5 space-y-1 text-[12px] text-[#c3cee3]">
                {p.checklist.map((c) => <li key={c} className="flex gap-1.5"><span className="text-neon">›</span>{c}</li>)}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
                <div className="flex -space-x-1.5">{p.roles.map((r) => <Sprite key={r} role={r} size={20} />)}</div>
                <span>{p.kinds === "all" ? "tutti i progetti" : p.kinds === "ui" ? "progetti con interfaccia" : p.kinds.map((k) => KIND_LABEL[k]).join(", ")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "refs" && (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {refs.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer noopener" className="glass glass-hover group flex items-start gap-3 p-3.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line2 bg-white/[0.04] text-neon"><ExternalLink size={15} /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium group-hover:text-neon">{r.name}</span><span className="chip !py-0 !text-[9.5px]">{r.cat}</span></div>
                <div className="text-[12px] text-muted">{r.desc}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {tab === "powerups" && (
        <>
          <Card hud className="mb-5 p-5">
            <SectionTitle kicker="come funziona" title="Rendere ogni agente un esperto della sua categoria" />
            <div className="mt-3 grid gap-3 text-[12.5px] text-muted md:grid-cols-3">
              <div><b className="text-fg">1. Sotto-agenti.</b> Scarica il file di un ruolo e mettilo in <code className="mono text-neon">.claude/agents/</code> del progetto (o nella tua cartella utente per averlo ovunque). Claude Code lo usa quando serve quel tipo di lavoro.</div>
              <div><b className="text-fg">2. MCP.</b> Collega a Claude Code i server MCP del ruolo: Figma per il design, Playwright per vedere davvero la pagina, Supabase/Stripe/Vercel per backend e deploy.</div>
              <div><b className="text-fg">3. Brief.</b> Il pulsante "Brief per Claude Code" su ogni task include già template, palette e checklist del ruolo giusto.</div>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {(Object.keys(POWERUPS) as AgentRole[]).map((role) => {
              const p = POWERUPS[role];
              const r = ROLES[role];
              const packsCount = SKILL_PACKS.filter((s) => s.roles.includes(role)).length;
              return (
                <Card key={role} className="p-4">
                  <div className="flex items-center gap-3">
                    <Sprite role={role} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold" style={{ color: r.color }}>{r.name} <span className="mono text-[11px] text-muted">· {r.label}</span></div>
                      <div className="truncate text-[12px] text-muted">{r.blurb}</div>
                    </div>
                    <button className="btn btn-sm" onClick={() => { const f = subagentFile(role); download(f.filename, f.content); }} title="Scarica la definizione per .claude/agents/">
                      <Download size={13} /> Sotto-agente
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="chip !py-0">{packsCount} skill pack</span>
                    {p.libs.map((l) => <span key={l} className="chip !py-0">{l}</span>)}
                  </div>
                  {!!p.mcp.length && (
                    <div className="mt-3 space-y-1.5">
                      {p.mcp.map((m) => (
                        <a key={m.name} href={m.url} target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 rounded-lg px-2 py-1 text-[12.5px] transition hover:bg-white/[0.04]">
                          <Plug size={13} className="mt-0.5 flex-none text-neon" />
                          <span><b>{m.name}</b> <span className="text-muted">— {m.what}</span></span>
                        </a>
                      ))}
                    </div>
                  )}
                  <ul className="mt-2 space-y-0.5 pl-2 text-[12px] text-[#c3cee3]">{p.rules.map((x) => <li key={x}>› {x}</li>)}</ul>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {tab === "blueprints" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card hud className="h-fit p-5">
            <SectionTitle kicker="nuovo modello" title="Salva un blueprint riutilizzabile" />
            <div className="mt-3 space-y-2.5">
              <input className="field" placeholder="Nome (es. Landing ristorante)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="field mono h-44 resize-none text-[12.5px]" placeholder={"# Titolo\n- Funzionalità 1\n- Funzionalità 2"} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
              <button className="btn btn-primary btn-sm" disabled={!form.name.trim() || !form.text.trim()} onClick={() => { dispatch({ type: "saveLibrary", name: form.name, kind: detectKind(form.text).kind, text: form.text }); setForm({ name: "", text: "" }); }}>
                <Plus size={14} /> Salva in libreria
              </button>
            </div>
          </Card>
          <div className="space-y-3">
            {db.library.length === 0 && <Card><Empty icon={<BookOpen size={20} />} title="Libreria vuota" /></Card>}
            {db.library.map((l) => (
              <Card key={l.id} className="p-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-neon" />
                  <span className="font-semibold">{l.name}</span>
                  <span className="chip">{KIND_LABEL[l.kind]}</span>
                  <div className="ml-auto flex gap-1.5">
                    <button className="btn btn-sm !px-2" onClick={() => navigator.clipboard?.writeText(l.text).catch(() => {})} aria-label="Copia testo"><Copy size={13} /></button>
                    <button className="btn btn-sm !px-2" onClick={() => dispatch({ type: "deleteLibrary", id: l.id })} aria-label="Elimina"><Trash size={13} /></button>
                  </div>
                </div>
                <pre className="mono mt-2.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#03060d] p-3 text-[11.5px] text-[#b8c4da]">{l.text}</pre>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
