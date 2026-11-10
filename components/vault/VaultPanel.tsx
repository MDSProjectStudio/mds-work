"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Download, Eye, EyeOff, GitBranch, Globe, KeyRound, Lock, LockOpen, Mail, Pencil, Plus, ShieldCheck, Trash, Triangle, Wand, Zap } from "lucide-react";
import { useDB } from "@/lib/client";
import { EMPTY_SECRET, createVault, decryptText, encryptText, generatePassword, passwordStrength, unlockVault, type Secret } from "@/lib/vault";
import type { VaultEntry, VaultProvider } from "@/lib/types";
import { Card, Empty, Field, Modal, ProjectDot, SectionTitle } from "../ui";
import { useVault } from "./VaultContext";

export const PROVIDERS: Record<VaultProvider, { label: string; color: string; icon: typeof GitBranch }> = {
  github: { label: "GitHub", color: "#e2e8f0", icon: GitBranch },
  supabase: { label: "Supabase", color: "#34d399", icon: Zap },
  vercel: { label: "Vercel", color: "#f8fafc", icon: Triangle },
  email: { label: "Email", color: "#60a5fa", icon: Mail },
  domain: { label: "Dominio", color: "#fbbf24", icon: Globe },
  other: { label: "Altro", color: "#a78bfa", icon: KeyRound },
};

function Strength({ pw }: { pw: string }) {
  const s = passwordStrength(pw);
  const color = ["#fb7185", "#fb7185", "#fbbf24", "#fbbf24", "#a3e635", "#22d3ee"][s.score];
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i < s.score ? color : "rgba(255,255,255,.08)" }} />)}</div>
      <span className="mono text-[10.5px]" style={{ color }}>{s.label}</span>
    </div>
  );
}

function Setup() {
  const { dispatch } = useDB();
  const { setKey } = useVault();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = pw.length >= 10 && pw === pw2 && ack;
  return (
    <Card hud className="mx-auto max-w-lg p-6">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-neon/40 bg-cyan-400/10 text-neon"><ShieldCheck size={22} /></div>
      <h3 className="text-lg font-semibold">Crea la password principale</h3>
      <p className="mt-1 text-[13px] text-muted">Cifra tutte le credenziali con AES-256 direttamente nel browser. Il server salva solo dati illeggibili, e la password principale non viene mai salvata da nessuna parte.</p>
      <div className="mt-5 space-y-3">
        <Field label="Password principale (min 10 caratteri)">
          <input type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          <Strength pw={pw} />
        </Field>
        <Field label="Ripeti">
          <input type="password" className="field" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <label className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/[0.06] p-3 text-[12.5px] text-amber">
          <input type="checkbox" className="mt-0.5 accent-amber-400" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          Ho capito: se dimentico questa password, le credenziali NON si possono recuperare. La scrivo in un posto sicuro.
        </label>
        <button
          className="btn btn-primary w-full"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            const { meta, key } = await createVault(pw);
            if (await dispatch({ type: "vaultInit", meta })) setKey(key);
            setBusy(false);
          }}
        >
          {busy ? "Genero la chiave…" : "Crea cassaforte"}
        </button>
      </div>
    </Card>
  );
}

function Unlock({ count }: { count: number }) {
  const { db } = useDB();
  const { setKey } = useVault();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card hud className="mx-auto max-w-md p-6 text-center">
      <motion.div animate={err ? { x: [0, -8, 8, -5, 5, 0] } : {}} className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line2 bg-white/[0.04] text-neon">
        <Lock size={24} />
      </motion.div>
      <h3 className="text-lg font-semibold">Cassaforte bloccata</h3>
      <p className="mt-1 text-[13px] text-muted">{count} credenziali protette. Si blocca da sola dopo 5 minuti di inattività.</p>
      <form
        className="mt-5 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!db?.vaultMeta || !pw) return;
          setBusy(true);
          setErr(false);
          const key = await unlockVault(pw, db.vaultMeta);
          setBusy(false);
          if (key) {
            setKey(key);
            setPw("");
          } else setErr(true);
        }}
      >
        <input type="password" className={clsx("field", err && "!border-rose")} placeholder="Password principale" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
        <button className="btn btn-primary" disabled={busy}>
          <LockOpen size={15} /> {busy ? "…" : "Sblocca"}
        </button>
      </form>
      {err && <div className="mt-2 text-xs text-rose">Password errata</div>}
    </Card>
  );
}

function Editor({ open, onClose, entry, secret, projectId }: { open: boolean; onClose: () => void; entry?: VaultEntry; secret?: Secret; projectId?: string }) {
  const { db, dispatch } = useDB();
  const { key } = useVault();
  const [provider, setProvider] = useState<VaultProvider>("github");
  const [label, setLabel] = useState("");
  const [pid, setPid] = useState("");
  const [s, setS] = useState<Secret>(EMPTY_SECRET);
  const [show, setShow] = useState(false);

  // Riempie il modulo all'APERTURA, al cambio di voce o quando il segreto decifrato arriva per la prima volta.
  // Prima si riempiva a ogni aggiornamento automatico (ogni 2 s), cancellando le modifiche in corso.
  const [filled, setFilled] = useState<{ open: boolean; entryId?: string; hasSecret: boolean }>({ open: false, hasSecret: false });
  if (!open && filled.open) setFilled({ open: false, hasSecret: false });
  if (open && (!filled.open || filled.entryId !== entry?.id || (!filled.hasSecret && !!secret))) {
    setFilled({ open: true, entryId: entry?.id, hasSecret: !!secret });
    setProvider(entry?.provider ?? "github");
    setLabel(entry?.label ?? "");
    setPid(entry?.projectId ?? projectId ?? "");
    setS(secret ?? EMPTY_SECRET);
    setShow(false);
  }

  const save = async () => {
    if (!key || !db) return;
    const { iv, ct } = await encryptText(key, JSON.stringify(s));
    const ok = await dispatch({
      type: "vaultSave",
      entry: { id: entry?.id ?? "v_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14), provider, label: label || PROVIDERS[provider].label, projectId: pid || undefined, iv, ct, updatedAt: Date.now() },
    });
    if (ok) onClose();
  };
  const set = (k: keyof Secret) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={entry ? "Modifica credenziale" : "Nuova credenziale"} kicker="cassaforte cifrata" wide>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(PROVIDERS) as VaultProvider[]).map((p) => {
          const P = PROVIDERS[p];
          const Icon = P.icon;
          return (
            <button key={p} type="button" onClick={() => setProvider(p)} className={clsx("chip !py-1.5 !text-[12px] transition", provider === p && "!border-neon/70 !bg-cyan-400/10 !text-fg")}>
              <Icon size={13} style={{ color: P.color }} /> {P.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome">
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${PROVIDERS[provider].label} — account cliente`} />
        </Field>
        <Field label="Progetto">
          <select className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">— Generale —</option>
            {db?.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={provider === "email" ? "Indirizzo email" : "Username / email di login"}>
          <input className="field" value={s.login} onChange={set("login")} autoComplete="off" />
        </Field>
        <Field label="Password">
          <div className="flex gap-1.5">
            <input type={show ? "text" : "password"} className="field mono" value={s.password} onChange={set("password")} autoComplete="new-password" />
            <button type="button" className="btn btn-sm !px-2.5" onClick={() => setShow(!show)} aria-label="Mostra password">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button type="button" className="btn btn-sm !px-2.5" onClick={() => { setS({ ...s, password: generatePassword() }); setShow(true); }} title="Genera password forte" aria-label="Genera password">
              <Wand size={14} />
            </button>
          </div>
          {s.password && <Strength pw={s.password} />}
        </Field>
        <Field label="URL / dashboard">
          <input className="field" value={s.url} onChange={set("url")} placeholder="https://…" />
        </Field>
        <Field label="2FA (dove arriva il codice)">
          <input className="field" value={s.twofa} onChange={set("twofa")} placeholder="App authenticator su iPhone, SMS…" />
        </Field>
        <Field label="Codici di recupero">
          <textarea className="field mono h-20 resize-none text-[12px]" value={s.recovery} onChange={set("recovery")} />
        </Field>
        <Field label="Note">
          <textarea className="field h-20 resize-none text-[13px]" value={s.notes} onChange={set("notes")} placeholder="Project ref, region, team…" />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted"><Lock size={12} /> Cifrato nel browser prima di essere salvato</span>
        <div className="flex gap-2">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save}>Salva</button>
        </div>
      </div>
    </Modal>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn btn-sm !px-2"
      disabled={!value}
      aria-label={`Copia ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
    >
      {ok ? <Check size={13} className="text-lime" /> : <Copy size={13} />}
    </button>
  );
}

function Row({ e, s, onEdit, showProject }: { e: VaultEntry; s?: Secret; onEdit: () => void; showProject: boolean }) {
  const { db, dispatch } = useDB();
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(false), 15_000);
    return () => clearTimeout(t);
  }, [reveal]);
  const P = PROVIDERS[e.provider];
  const Icon = P.icon;
  const proj = e.projectId ? db?.projects.find((p) => p.id === e.projectId) : undefined;
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass glass-hover flex flex-col gap-3 p-3.5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-line2 bg-white/[0.04]" style={{ color: P.color }}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{e.label}</span>
            {showProject && proj && <span className="chip !py-0 !text-[10px]"><ProjectDot color={proj.color} size={5} /> {proj.name}</span>}
          </div>
          <div className="mono truncate text-[12px] text-muted">{s ? s.login || "—" : "decifratura…"}</div>
        </div>
      </div>
      {s && (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="mono flex h-8 min-w-[150px] items-center rounded-lg border border-line bg-black/30 px-2.5 text-[12px]">{reveal ? s.password || "—" : s.password ? "•".repeat(12) : "—"}</div>
          <button className="btn btn-sm !px-2" onClick={() => setReveal(!reveal)} aria-label={reveal ? "Nascondi" : "Mostra"}>{reveal ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <CopyBtn value={s.login} label="login" />
          <CopyBtn value={s.password} label="password" />
          {s.url && /^https?:\/\//.test(s.url) && <a className="btn btn-sm !px-2" href={s.url} target="_blank" rel="noreferrer noopener" aria-label="Apri link"><Globe size={13} /></a>}
          <button className="btn btn-sm !px-2" onClick={onEdit} aria-label="Modifica"><Pencil size={13} /></button>
          <button className="btn btn-sm !px-2" onClick={() => confirm(`Eliminare "${e.label}"?`) && dispatch({ type: "vaultDelete", id: e.id })} aria-label="Elimina"><Trash size={13} /></button>
        </div>
      )}
    </motion.div>
  );
}

export function VaultPanel({ projectId }: { projectId?: string }) {
  const { db } = useDB();
  const { key, lock } = useVault();
  const [secrets, setSecrets] = useState<Record<string, Secret>>({});
  const [edit, setEdit] = useState<{ open: boolean; entry?: VaultEntry }>({ open: false });
  const [filter, setFilter] = useState<VaultProvider | "all">("all");

  const entries = useMemo(() => (db?.vault ?? []).filter((v) => !projectId || v.projectId === projectId), [db?.vault, projectId]);

  // bloccando la cassaforte (chiave tolta) i segreti decifrati spariscono dalla memoria
  useEffect(() => () => setSecrets({}), [key]);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    (async () => {
      const out: Record<string, Secret> = {};
      for (const e of entries) {
        try {
          out[e.id] = { ...EMPTY_SECRET, ...JSON.parse(await decryptText(key, e.iv, e.ct)) };
        } catch {}
      }
      if (alive) setSecrets(out);
    })();
    return () => {
      alive = false;
    };
  }, [key, entries]);

  if (!db) return null;
  if (!db.vaultMeta) return <Setup />;
  if (!key) return <Unlock count={entries.length} />;

  const shown = entries.filter((e) => filter === "all" || e.provider === filter);
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ app: "mds-work", exportedAt: new Date().toISOString(), vaultMeta: db.vaultMeta, vault: db.vault }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mds-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ open: true })}>
          <Plus size={14} /> Nuova credenziale
        </button>
        <div className="flex flex-wrap gap-1">
          {(["all", ...Object.keys(PROVIDERS)] as (VaultProvider | "all")[]).map((p) => (
            <button key={p} onClick={() => setFilter(p)} className={clsx("chip !py-1 transition", filter === p && "!border-neon/70 !bg-cyan-400/10 !text-fg")}>
              {p === "all" ? `Tutte (${entries.length})` : `${PROVIDERS[p].label} (${entries.filter((e) => e.provider === p).length})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {!projectId && (
            <button className="btn btn-sm" onClick={exportBackup} title="Scarica un backup (resta cifrato)">
              <Download size={14} /> Backup cifrato
            </button>
          )}
          <button className="btn btn-sm" onClick={lock}>
            <Lock size={14} /> Blocca
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((e) => <Row key={e.id} e={e} s={secrets[e.id]} showProject={!projectId} onEdit={() => setEdit({ open: true, entry: e })} />)}
        </AnimatePresence>
        {!shown.length && (
          <Card>
            <Empty
              icon={<KeyRound size={20} />}
              title="Nessuna credenziale"
              text={projectId ? "Salva qui GitHub, Supabase, Vercel e le email create per questo progetto." : "Inizia salvando gli account che usi per i progetti."}
              action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ open: true })}><Plus size={14} /> Aggiungi</button>}
            />
          </Card>
        )}
      </div>
      <Editor open={edit.open} onClose={() => setEdit({ open: false })} entry={edit.entry} secret={edit.entry ? secrets[edit.entry.id] : undefined} projectId={projectId} />
    </div>
  );
}

export function VaultIntro() {
  return (
    <Card className="mb-5 p-4">
      <SectionTitle kicker="come funziona" title="Sicurezza della cassaforte" />
      <div className="mt-3 grid gap-3 text-[12.5px] text-muted md:grid-cols-3">
        <div className="flex gap-2"><Lock size={15} className="mt-0.5 flex-none text-neon" /> AES-256-GCM con chiave derivata dalla tua password (PBKDF2, 600.000 iterazioni).</div>
        <div className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 flex-none text-neon" /> La cifratura avviene nel browser: sul server finisce solo testo illeggibile.</div>
        <div className="flex gap-2"><Download size={15} className="mt-0.5 flex-none text-neon" /> Fai un backup cifrato ogni tanto: se perdi la password principale non c'è recupero.</div>
      </div>
    </Card>
  );
}
