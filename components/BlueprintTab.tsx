"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BookmarkPlus, FileText, Palette, RefreshCw, Sparkles, Upload } from "lucide-react";
import { useDB } from "@/lib/client";
import { KIND_LABEL, ROLES, packsFor, teamFor } from "@/lib/skills";
import { TEMPLATES, templateById } from "@/lib/templates";
import { fmtRel } from "@/lib/selectors";
import type { Project, ProjectKind } from "@/lib/types";
import { Sprite } from "./Sprite";
import { TemplatePreview } from "./TemplatePreview";
import { Card, SectionTitle } from "./ui";

const ANALYSIS = {
  none: ["Nessun blueprint", "#64748b"],
  pending: ["Nova sta leggendo…", "#22d3ee"],
  proposed: ["Piano proposto: aspetta il tuo ok", "#fbbf24"],
  done: ["Piano approvato", "#a3e635"],
  rejected: ["Piano rifiutato", "#fb7185"],
} as const;

export function BlueprintTab({ project: p }: { project: Project }) {
  const { db, dispatch, now } = useDB();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  if (!db) return null;
  const tpl = templateById(p.templateId);
  const packs = packsFor(p.kind);
  const team = teamFor(p.kind);
  const [aLabel, aColor] = ANALYSIS[p.analysis];
  const tplOptions = [...TEMPLATES].sort((x, y) => Number(y.kinds.includes(p.kind)) - Number(x.kinds.includes(p.kind)));

  const upload = async (f?: File) => {
    setErr("");
    if (!f) return;
    if (f.size > 500_000 || !/\.(md|markdown|txt)$/i.test(f.name)) return setErr("Carica un file .md o .txt (max 500 KB)");
    dispatch({ type: "reanalyze", id: p.id, blueprint: { name: f.name, text: await f.text() } });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card hud className="p-5">
          <SectionTitle
            kicker="blueprint"
            title={p.blueprint ? p.blueprint.name : "Nessun blueprint caricato"}
            right={<span className="chip" style={{ color: aColor, borderColor: aColor + "55" }}>{aLabel}</span>}
          />
          {p.blueprint ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="chip"><Sparkles size={11} /> rilevato: {KIND_LABEL[p.blueprint.detectedKind]} ({Math.round(p.blueprint.confidence * 100)}%)</span>
                <span className="chip">caricato {fmtRel(p.blueprint.uploadedAt, now)}</span>
              </div>
              <pre className="mono mt-3 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-[#03060d] p-3 text-[12px] leading-relaxed text-[#b8c4da]">{p.blueprint.text}</pre>
            </>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea className="field h-32 resize-none text-[13px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Incolla qui il blueprint (markdown o testo)…" />
              <button className="btn btn-primary btn-sm" disabled={!paste.trim()} onClick={() => dispatch({ type: "reanalyze", id: p.id, blueprint: { name: "blueprint.md", text: paste } })}>
                <Sparkles size={14} /> Fai analizzare a Nova
              </button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> {p.blueprint ? "Carica nuova versione" : "Carica file"}
            </button>
            {p.blueprint && (
              <>
                <button className="btn btn-sm" onClick={() => dispatch({ type: "reanalyze", id: p.id })} disabled={p.analysis === "pending"}>
                  <RefreshCw size={14} /> Rianalizza
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    dispatch({ type: "saveLibrary", name: p.name, kind: p.kind, text: p.blueprint!.text });
                    setSaved(true);
                  }}
                  disabled={saved}
                >
                  <BookmarkPlus size={14} /> {saved ? "Salvato in libreria" : "Salva come modello"}
                </button>
              </>
            )}
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
          {err && <div className="mt-2 text-xs text-rose">{err}</div>}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="kicker">tipo di progetto</span>
            <select className="field !w-auto !py-1.5 text-[13px]" value={p.kind} onChange={(e) => dispatch({ type: "updateProject", id: p.id, patch: { kind: e.target.value as ProjectKind } })}>
              {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <span className="text-[11.5px] text-muted">Cambiandolo, il team e le skill si adattano.</span>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle kicker="direzione artistica" title="Template grafico" right={<Link href="/library" className="text-xs text-neon hover:underline">Libreria →</Link>} />
          <TemplatePreview t={tpl} className="mt-4" />
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{tpl.name}</div>
              <div className="text-[12.5px] text-muted">{tpl.vibe} · font {tpl.font}</div>
            </div>
            <div className="flex gap-1">{tpl.palette.map((c) => <span key={c} className="h-5 w-5 rounded-full border border-white/20" style={{ background: c }} />)}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{tpl.features.map((f) => <span key={f} className="chip">{f}</span>)}</div>
          <select className="field mt-4 !py-2 text-[13px]" value={p.templateId} onChange={(e) => dispatch({ type: "updateProject", id: p.id, patch: { templateId: e.target.value } })}>
            {tplOptions.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.vibe}{t.kinds.includes(p.kind) ? " ★" : ""}</option>)}
          </select>
          <p className="mt-2 text-[11.5px] text-muted">Muse (Design Director) parte da questo template e lo adatta al brand del cliente.</p>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle kicker={`team ${KIND_LABEL[p.kind].toLowerCase()}`} title={`${team.length} agenti assunti per questo progetto`} />
        <div className="mt-4 flex flex-wrap gap-3">
          {team.map((r) => (
            <div key={r} className="flex w-[92px] flex-col items-center rounded-xl border border-line bg-white/[0.02] p-2 text-center" title={ROLES[r].blurb}>
              <Sprite role={r} size={40} />
              <div className="mt-1 text-[12px] font-semibold" style={{ color: ROLES[r].color }}>{ROLES[r].name}</div>
              <div className="mono text-[9.5px] text-muted">{ROLES[r].label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <SectionTitle kicker="skill pack attivi" title="Cosa sa fare il team su questo progetto" className="mb-3" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((s) => (
            <Card key={s.id} className="p-4" style={s.core ? { borderColor: "rgba(244,114,182,.35)", boxShadow: "0 0 30px -14px #f472b6" } : undefined}>
              <div className="flex items-center gap-2">
                {s.core ? <Palette size={15} className="text-pink-400" /> : <FileText size={15} className="text-neon" />}
                <span className="font-semibold">{s.label}</span>
                {s.core && <span className="chip ml-auto !text-[9.5px] !text-pink-300">standard estetico</span>}
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted">{s.desc}</p>
              <ul className="mt-2.5 space-y-1 text-[12px] text-[#c3cee3]">
                {s.checklist.map((c) => <li key={c} className="flex gap-1.5"><span className="text-neon">›</span>{c}</li>)}
              </ul>
              <div className="mt-3 flex -space-x-1.5">
                {s.roles.filter((r) => team.includes(r)).map((r) => <Sprite key={r} role={r} size={22} />)}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
