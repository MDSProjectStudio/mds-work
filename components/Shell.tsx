"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Bell, FileText, FolderKanban, Handshake, Inbox, KeyRound, Library, LogOut, Menu, Plus, Search, ShieldCheck, Sun, Wallet, X } from "lucide-react";
import { authEnabled } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useDB } from "@/lib/client";
import { money, pendingApprovals } from "@/lib/selectors";
import { ProjectDot } from "./ui";
import { Sprite } from "./Sprite";
import { CommandPalette } from "./CommandPalette";
import { NewProjectModal } from "./NewProjectModal";
import { ImportProjectsModal } from "./ImportProjectsModal";
import { Chatbot } from "./Chatbot";

const UIContext = createContext<{ openNewProject: () => void; openPalette: () => void; openImport: () => void }>({ openNewProject: () => {}, openPalette: () => {}, openImport: () => {} });
export const useUI = () => useContext(UIContext);

export function Shell({ children }: { children: React.ReactNode }) {
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  useEffect(() => setMobileNav(false), [pathname]);

  return (
    <UIContext.Provider value={{ openNewProject: () => setNewOpen(true), openPalette: () => setPalette(true), openImport: () => setImportOpen(true) }}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[264px] flex-none p-3 lg:block">
          <Sidebar />
        </aside>
        <AnimatePresence>
          {mobileNav && (
            <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
              <motion.div className="absolute inset-y-0 left-0 w-[280px] p-3" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
                <Sidebar onClose={() => setMobileNav(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileNav(true)} />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-2 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewProject={() => setNewOpen(true)} onImport={() => setImportOpen(true)} />
      <ImportProjectsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
      <Chatbot />
    </UIContext.Provider>
  );
}

function NavItem({ href, icon, label, badge, badgeColor = "#22d3ee" }: { href: string; icon: React.ReactNode; label: string; badge?: number; badgeColor?: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all",
        active ? "bg-gradient-to-r from-cyan-400/15 to-violet-500/5 text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
      )}
    >
      {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-neon shadow-[0_0_12px_#22d3ee]" />}
      <span className={clsx("transition-colors", active ? "text-neon" : "text-muted group-hover:text-fg")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="mono rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: badgeColor, background: badgeColor + "1c", border: `1px solid ${badgeColor}44` }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { db } = useDB();
  const pending = db ? pendingApprovals(db).length : 0;
  const late = db ? money(db).lateCount : 0;
  const rooms = db ? db.projects.filter((p) => p.status !== "done") : [];
  const working = db ? db.agents.filter((a) => a.status === "working") : [];

  return (
    <div className="glass-strong flex h-full flex-col overflow-hidden !rounded-[22px]">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 shadow-[0_0_24px_-4px_#22d3ee]">
          <span className="mono text-[13px] font-bold text-[#03121a]">MDS</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight">MDS Work</div>
          <div className="kicker !text-[9px]">studio · os</div>
        </div>
        {onClose && (
          <button className="btn btn-sm !p-1.5" onClick={onClose} aria-label="Chiudi menu">
            <X size={15} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-3">
        <div>
          <div className="kicker px-3 pb-1.5 pt-2">Operativo</div>
          <NavItem href="/" icon={<Sun size={17} />} label="Oggi" />
          <NavItem href="/projects" icon={<FolderKanban size={17} />} label="Progetti" />
          <NavItem href="/approvals" icon={<ShieldCheck size={17} />} label="Approvazioni" badge={pending} badgeColor="#fbbf24" />
          <NavItem href="/inbox" icon={<Inbox size={17} />} label="Inbox" badge={db?.inbox.length} />
          <NavItem href="/payments" icon={<Wallet size={17} />} label="Incassi" badge={late} badgeColor="#fb7185" />
        </div>
        <div>
          <div className="kicker px-3 pb-1.5">Clienti</div>
          <NavItem href="/pipeline" icon={<Handshake size={17} />} label="Pipeline" badge={db?.leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length} badgeColor="#a78bfa" />
          <NavItem href="/quotes" icon={<FileText size={17} />} label="Preventivi" />
        </div>
        <div>
          <div className="kicker px-3 pb-1.5">Studio</div>
          <NavItem href="/library" icon={<Library size={17} />} label="Libreria" />
          <NavItem href="/vault" icon={<KeyRound size={17} />} label="Cassaforte" />
        </div>
        <div>
          <div className="kicker flex items-center justify-between px-3 pb-1.5">
            <span>Stanze</span>
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              <span className="led led-pulse text-lime" style={{ width: 5, height: 5 }} />
              live
            </span>
          </div>
          {rooms.map((p) => {
            const busy = db!.agents.filter((a) => a.projectId === p.id && a.status === "working").length;
            const wait = db!.approvals.some((a) => a.projectId === p.id && a.status === "pending");
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] text-muted transition hover:bg-white/[0.04] hover:text-fg">
                <ProjectDot color={p.color} size={7} />
                <span className="flex-1 truncate">{p.name}</span>
                {wait && <span className="led led-pulse text-amber" style={{ width: 6, height: 6 }} title="Aspetta il tuo ok" />}
                {busy > 0 && <span className="mono text-[10.5px] text-neon">{busy}⚡</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="m-2.5 rounded-2xl border border-line bg-gradient-to-br from-cyan-400/10 to-violet-500/10 p-3">
        <div className="flex items-center justify-between">
          <span className="kicker">Team AI</span>
          <span className="mono text-[11px] text-neon">{working.length} al lavoro</span>
        </div>
        <div className="mt-2 flex h-10 items-end -space-x-2">
          {(working.length ? working : db?.agents.slice(0, 5) ?? []).slice(0, 6).map((a) => (
            <Sprite key={a.id} role={a.role} status={a.status} size={30} />
          ))}
        </div>
      </div>
      {authEnabled && (
        <button
          className="mx-2.5 mb-2.5 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-muted transition hover:bg-white/[0.04] hover:text-fg"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut size={14} /> Esci
        </button>
      )}
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { db, error } = useDB();
  const { openNewProject, openPalette } = useUI();
  const router = useRouter();
  const [clock, setClock] = useState("");
  useEffect(() => {
    const f = () => setClock(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  const pending = db ? pendingApprovals(db).length : 0;

  return (
    <header className="sticky top-0 z-30 px-4 pb-3 pt-3 sm:px-6 lg:px-8">
      <div className="glass flex items-center gap-2 !rounded-2xl px-2.5 py-2 sm:gap-3" style={{ background: "linear-gradient(180deg, rgba(13,19,36,.9), rgba(8,12,24,.88))" }}>
        <button className="btn btn-sm !p-2 lg:hidden" onClick={onMenu} aria-label="Apri menu">
          <Menu size={16} />
        </button>
        <button onClick={openPalette} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-black/20 px-3 py-2 text-left text-sm text-muted transition hover:border-line2 sm:max-w-md">
          <Search size={15} />
          <span className="flex-1 truncate">Cerca progetti, pagine, azioni…</span>
          <kbd className="mono hidden rounded-md border border-line2 px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {error ? (
            <span className="chip !text-rose" title={error}>
              <span className="led text-rose" style={{ width: 6, height: 6 }} /> offline
            </span>
          ) : (
            <span className="chip hidden md:inline-flex" title="Fase 1: gli agenti simulano il lavoro. In fase 2 lavorano davvero sui repo.">
              <span className="led led-pulse text-lime" style={{ width: 6, height: 6 }} /> agenti · simulazione
            </span>
          )}
          <span className="mono hidden text-xs text-muted sm:inline">{clock}</span>
          <button className="btn btn-sm relative !p-2" onClick={() => router.push("/approvals")} aria-label="Approvazioni in attesa">
            <Bell size={16} />
            {pending > 0 && <span className="mono absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-1 text-[9.5px] font-bold text-black">{pending}</span>}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNewProject}>
            <Plus size={15} />
            <span className="hidden sm:inline">Nuovo progetto</span>
          </button>
        </div>
      </div>
    </header>
  );
}
