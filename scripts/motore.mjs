#!/usr/bin/env node
/**
 * MDS Work — motore locale.  Avvio:  npm run motore   (lascialo aperto mentre lavori)
 *
 * Quando nella dashboard premi "Lavora con il team":
 *  1. riceve la richiesta,
 *  2. prepara il progetto con il kit (se serve),
 *  3. scrive il brief in .mds/brief.md,
 *  4. apre Claude Code nella cartella (se hai il comando `claude`),
 *     altrimenti apre la cartella e copia "/mds-team" negli appunti da incollare nell'app Claude.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { installProject, installUser, userKitInstalled } from "./kit.mjs";
import { supabase } from "./lib-supabase.mjs";

const sb = supabase();
if (!sb) {
  console.error("✗ Mancano le chiavi Supabase in .env.local: il motore non può collegarsi alla dashboard.");
  process.exit(1);
}

const hasClaudeCli = (() => {
  try {
    execSync("where claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const now = () => new Date().toLocaleTimeString("it-IT");
const say = (m) => console.log(`[${now()}] ${m}`);

async function event(projectId, text, level = "info", status = null, role = "chief") {
  try {
    await sb.insert("agent_events", [{ project_id: projectId, role, status, text, level }]);
  } catch {}
}

async function handle(req, projects) {
  const p = projects.find((x) => x.id === req.project_id);
  const fail = async (msg) => {
    say(`✗ ${msg}`);
    await sb.update("launch_requests", `?id=eq.${req.id}`, { status: "error", note: msg });
    if (p) await event(p.id, msg, "error");
  };
  if (!p) return fail("Progetto non trovato nella dashboard");
  if (!p.localPath) return fail(`"${p.name}": manca la cartella sul PC (Impostazioni del progetto)`);
  if (!fs.existsSync(p.localPath)) return fail(`"${p.name}": la cartella ${p.localPath} non esiste su questo PC`);

  if (!userKitInstalled()) {
    installUser({ quiet: true });
    say("✓ Kit della squadra installato sul PC");
  }
  installProject(p.localPath, { tipo: p.kind, template: req.template ?? "", id: p.id, nome: p.name, quiet: true });
  fs.mkdirSync(path.join(p.localPath, ".mds"), { recursive: true });
  fs.writeFileSync(path.join(p.localPath, ".mds", "brief.md"), req.brief);

  if (hasClaudeCli) {
    spawn("cmd", ["/c", "start", "MDS Team", "cmd", "/k", "claude /mds-team"], { cwd: p.localPath, detached: true, stdio: "ignore" }).unref();
    await event(p.id, "Brief pronto: Claude Code avviato con il team", "success", "working");
    say(`✓ ${p.name}: Claude Code avviato nella cartella del progetto`);
  } else {
    spawn("explorer", [p.localPath], { detached: true, stdio: "ignore" }).unref();
    try {
      execSync("clip", { input: "/mds-team" });
    } catch {}
    await event(p.id, "Brief pronto: apri questa cartella nell'app Claude e incolla /mds-team (è già negli appunti)", "success", "waiting");
    say(`✓ ${p.name}: brief pronto. Apri la cartella nell'app Claude e incolla /mds-team (già copiato)`);
  }
  await sb.update("launch_requests", `?id=eq.${req.id}`, { status: "started" });
}

let lastCleanup = 0;
async function tick() {
  try {
    const reqs = await sb.select("launch_requests", "?status=eq.pending&order=created_at.asc&limit=5");
    if (reqs.length) {
      const state = await sb.select("app_state", "?id=eq.1&select=data");
      const projects = state?.[0]?.data?.projects ?? [];
      for (const r of reqs) await handle(r, projects);
    }
    if (Date.now() - lastCleanup > 3_600_000) {
      lastCleanup = Date.now();
      const old = new Date(Date.now() - 14 * 86_400_000).toISOString();
      await sb.remove("agent_events", `?created_at=lt.${old}`);
    }
  } catch (e) {
    say(`… problema di collegamento (${String(e.message).slice(0, 80)}), riprovo`);
  }
}

console.log("\n  MDS Work · motore locale acceso");
console.log(`  ${hasClaudeCli ? "Claude Code (CLI) trovato: i lavori si apriranno da soli" : "Uso l'app Claude: ti apro la cartella e copio /mds-team negli appunti"}`);
console.log("  Lascia questa finestra aperta. Ctrl+C per fermare.\n");
if (!userKitInstalled()) {
  installUser({ quiet: true });
  say("✓ Kit della squadra installato sul PC");
}
await tick();
setInterval(tick, 4000);
