"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Plug, Terminal } from "lucide-react";
import arsenal from "@/kit/arsenal.json";
import { KIND_LABEL } from "@/lib/skills";
import type { AgentRole, ProjectKind } from "@/lib/types";
import { Sprite } from "./Sprite";
import { Card, SectionTitle } from "./ui";

type Plugin = { what: string; roles: string[]; optional?: boolean };
const PLUGINS = arsenal.plugins as Record<string, Plugin>;

/** Specialisti del kit: ruolo nel kit → ruolo della dashboard (per l'avatar), modello usato. */
const TEAM: { kit: string; role: AgentRole; name: string; label: string; model: "Haiku" | "Sonnet" | "Opus"; why: string }[] = [
  { kit: "capo", role: "chief", name: "Atlas", label: "Capo squadra (la tua sessione)", model: "Sonnet", why: "Organizza e delega: chiama solo chi serve" },
  { kit: "esploratore", role: "analyst", name: "Esploratore", label: "Trova e riassume", model: "Haiku", why: "Legge il codice al posto degli altri: costa pochissimo" },
  { kit: "architetto", role: "analyst", name: "Architetto", label: "Piani per lavori grandi", model: "Opus", why: "Ragionamento migliore dove un errore costa giorni" },
  { kit: "design", role: "design", name: "Muse", label: "Design Director", model: "Opus", why: "La grafica è il tuo punto di forza: il modello più forte" },
  { kit: "frontend", role: "frontend", name: "Flux", label: "Frontend", model: "Sonnet", why: "Ottimo rapporto qualità/consumo per scrivere interfacce" },
  { kit: "backend", role: "backend", name: "Forge", label: "Backend", model: "Sonnet", why: "API, pagamenti, sicurezza" },
  { kit: "database", role: "data", name: "Delta", label: "Database", model: "Sonnet", why: "Schema, permessi, migrazioni" },
  { kit: "mobile", role: "mobile", name: "Pocket", label: "App native", model: "Sonnet", why: "Expo / React Native" },
  { kit: "game", role: "game", name: "Joy", label: "Giochi", model: "Sonnet", why: "Unity, Roblox, web 3D" },
  { kit: "seo", role: "seo", name: "Vox", label: "Copy & SEO", model: "Sonnet", why: "Testi che vendono, SEO tecnica" },
  { kit: "qa", role: "qa", name: "Sentinel", label: "QA funzionale e visivo", model: "Sonnet", why: "Apre il browser e controlla tutto" },
  { kit: "devops", role: "devops", name: "Rocket", label: "Git e deploy", model: "Haiku", why: "Lavori operativi: modello veloce ed economico" },
  { kit: "mappa", role: "analyst", name: "Cartografo", label: "Mappa del progetto", model: "Haiku", why: "Tiene aggiornata la mappa che fa risparmiare a tutti" },
];

const MODEL_COLOR = { Haiku: "#a3e635", Sonnet: "#22d3ee", Opus: "#f472b6" };

function CopyLine({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="mono flex w-full items-center gap-2 rounded-lg border border-line bg-[#03060d] px-3 py-2 text-left text-[12px] text-neon transition hover:border-neon/50"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
    >
      <span className="flex-1 break-all">{text}</span>
      {ok ? <Check size={13} className="text-lime" /> : <Copy size={13} className="text-muted" />}
    </button>
  );
}

export function PowerupsPanel() {
  const [kind, setKind] = useState<ProjectKind>("webapp");
  const all = Object.keys(PLUGINS).filter((p) => !PLUGINS[p].optional);
  const installAll = all.map((p) => `/plugin install ${p}@${arsenal.marketplace}`).join("\n");
  const forKind = (arsenal.byKind as Record<string, string[]>)[kind] ?? [];

  return (
    <div className="space-y-5">
      <Card hud className="p-5">
        <SectionTitle kicker="attivazione" title="Il kit della squadra in 3 passi" />
        <ol className="mt-4 grid gap-4 text-[13px] lg:grid-cols-3">
          <li className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="mb-2 font-semibold">1 · Specialisti e skill sul PC</div>
            <p className="mb-2 text-[12px] text-muted">Una volta sola, nel terminale dentro la cartella MDS Work:</p>
            <CopyLine text="npm run kit -- installa" />
            <p className="mt-2 text-[11.5px] text-muted">Aggiungi <code className="mono">--risparmio</code> per usare Sonnet anche per design e architetto.</p>
          </li>
          <li className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="mb-2 font-semibold">2 · Plugin ufficiali (una volta)</div>
            <p className="mb-2 text-[12px] text-muted">In Claude Code incolla un comando alla volta (oppure <code className="mono">/plugin</code> → Discover). Sono del marketplace ufficiale Anthropic; ogni progetto poi attiva solo quelli che gli servono.</p>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {installAll.split("\n").map((line) => <CopyLine key={line} text={line} />)}
            </div>
          </li>
          <li className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="mb-2 font-semibold">3 · Motore locale</div>
            <p className="mb-2 text-[12px] text-muted">Quando lavori, tieni aperto (riceve i clic «Lavora con il team»):</p>
            <CopyLine text="npm run motore" />
          </li>
        </ol>
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="la squadra" title="Chi fa cosa e con quale modello" right={<span className="text-[11.5px] text-muted">Haiku = economico · Sonnet = equilibrato · Opus = il più forte</span>} />
        <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {TEAM.map((t) => {
            const plugins = Object.entries(PLUGINS).filter(([, v]) => v.roles.includes(t.kit)).map(([k]) => k);
            return (
              <div key={t.kit} className="rounded-xl border border-line bg-white/[0.02] p-3">
                <div className="flex items-center gap-2.5">
                  <Sprite role={t.role} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{t.name} <span className="mono text-[10.5px] text-muted">mds-{t.kit}</span></div>
                    <div className="truncate text-[11.5px] text-muted">{t.label}</div>
                  </div>
                  <span className="chip !py-0 !text-[10px]" style={{ color: MODEL_COLOR[t.model], borderColor: MODEL_COLOR[t.model] + "55" }}>{t.model}</span>
                </div>
                <div className="mt-2 text-[11.5px] text-[#b8c4da]">{t.why}</div>
                {!!plugins.length && <div className="mt-2 flex flex-wrap gap-1">{plugins.map((p) => <span key={p} className="chip !py-0 !text-[10px]">{p}</span>)}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <SectionTitle
            kicker="plugin ufficiali verificati"
            title="Arsenale per tipo di progetto"
            right={
              <select className="field !w-auto !py-1.5 text-[12.5px]" value={kind} onChange={(e) => setKind(e.target.value as ProjectKind)}>
                {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            }
          />
          <p className="mt-2 text-[12px] text-muted">Il kit li attiva da solo nei progetti di tipo {KIND_LABEL[kind].toLowerCase()}: dove non servono restano spenti e non consumano.</p>
          <ul className="mt-3 space-y-1.5">
            {forKind.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[12.5px]">
                <Plug size={13} className="mt-0.5 flex-none text-neon" />
                <span><b>{p}</b> <span className="text-muted">— {PLUGINS[p]?.what}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <div className="kicker mb-2">extra opzionali</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PLUGINS).filter(([, v]) => v.optional).map(([k, v]) => <span key={k} className="chip" title={v.what}>{k}</span>)}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle kicker="community (selezionati)" title="Da GitHub" />
          <ul className="mt-3 space-y-2.5">
            {arsenal.community.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="group flex items-start gap-2 text-[12.5px]">
                  <ExternalLink size={13} className="mt-0.5 flex-none text-neon" />
                  <span><b className="group-hover:text-neon">{c.name}</b> <span className="text-muted">— {c.note}</span></span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex gap-2 text-[11.5px] text-muted"><Terminal size={13} className="mt-0.5 flex-none" /> I plugin di terzi girano sul tuo PC: installa solo questi selezionati, e chiedimi una verifica prima di aggiungerne altri.</p>
        </Card>
      </div>
    </div>
  );
}
