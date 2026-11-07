/**
 * Scanner OFFLINE per skill, plugin, agenti e server MCP di terzi.
 * Non sostituisce una revisione umana: segnala ciò che va guardato con attenzione
 * (pipeline DISCOVER → REVIEW SOURCE → PIN → SCAN → SANDBOX → APPROVE → INSTALL, skill mds-dependency-review).
 * Nessun dato lascia il PC.
 */
import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".venv"]);
const TEXT = /\.(md|mdx|txt|json|ya?ml|toml|js|mjs|cjs|ts|tsx|py|sh|bash|ps1|psm1|bat|cmd|rb|go|rs|html)$/i;

const RULES = [
  // prompt injection / tool poisoning
  { id: "prompt-injection", severity: "high", re: /(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|messages)|ignora\s+(tutte\s+)?le\s+istruzioni\s+precedenti/i, why: "Testo che tenta di annullare le istruzioni dell'agente" },
  { id: "hide-from-user", severity: "high", re: /(do not|don't|never)\s+(tell|inform|show|mention)\s+(this\s+to\s+)?the\s+user|without\s+(telling|informing)\s+the\s+user|non\s+dire\s+all'utente/i, why: "Istruzioni per nascondere azioni all'utente" },
  { id: "system-impersonation", severity: "medium", re: /<\/?(system|system-reminder|admin|important)>|\[\s*system\s*\]|as an? (system|administrator) message/i, why: "Finti messaggi di sistema (possibile tool poisoning)" },
  { id: "invisible-chars", severity: "high", re: /[​-‏‪-‮⁠-⁤﻿]/, why: "Caratteri invisibili: possono nascondere istruzioni" },
  { id: "long-base64", severity: "medium", re: /[A-Za-z0-9+/]{300,}={0,2}/, why: "Blob base64 lungo: contenuto offuscato" },
  // script pericolosi
  { id: "pipe-to-shell", severity: "critical", re: /(curl|wget|iwr|Invoke-WebRequest)[^\n|]*\|\s*(sh|bash|zsh|iex|powershell|pwsh|python|node)\b/i, why: "Scarica ed esegue codice da internet" },
  { id: "encoded-powershell", severity: "critical", re: /powershell[^\n]*-(enc|encodedcommand)\b|Invoke-Expression|\biex\s*\(/i, why: "Esecuzione di codice offuscato" },
  { id: "destructive-shell", severity: "high", re: /rm\s+-rf\s+(~|\/|\$HOME|%USERPROFILE%)|del\s+\/[sq][^\n]*[a-z]:\\|format\s+[a-z]:/i, why: "Cancellazione distruttiva" },
  { id: "dynamic-exec", severity: "medium", re: /\b(eval|new Function)\s*\(|child_process|subprocess\.(Popen|call|run)|os\.system\s*\(/i, why: "Esecuzione dinamica di comandi" },
  // credenziali
  { id: "credential-access", severity: "high", re: /(\.ssh\/|id_rsa|\.aws\/credentials|\.npmrc|\.netrc|\.git-credentials|Login Data|keychain|credential(s)?\.json|\.claude\.json|\.claude\/settings)/i, why: "Accesso a file di credenziali o configurazioni" },
  { id: "env-exfil", severity: "high", re: /process\.env[^\n]{0,80}(fetch|axios|http\.request|XMLHttpRequest)|(fetch|axios|requests\.(get|post))[^\n]{0,120}process\.env|os\.environ[^\n]{0,80}requests\./i, why: "Variabili d'ambiente inviate in rete" },
  { id: "hardcoded-secret", severity: "high", re: /(sk_live_[0-9a-z]{16,}|sk-ant-[a-z0-9_-]{20,}|ghp_[a-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|xox[bpa]-[a-z0-9-]{20,})/i, why: "Segreto scritto nel codice" },
  // rete e download
  { id: "raw-ip-download", severity: "high", re: /https?:\/\/\d{1,3}(\.\d{1,3}){3}|\.(exe|msi|scr|dll|bat)\b["'\s)]/i, why: "Download da IP diretto o di eseguibili" },
  { id: "network", severity: "low", re: /\b(fetch|axios|https?\.request|requests\.(get|post)|urllib|WebSocket)\b/, why: "Accesso alla rete: verifica a quali domini" },
  { id: "fs-broad", severity: "low", re: /os\.homedir\(\)|expanduser\(|%USERPROFILE%|\$HOME\b|fs\.(rmSync|rm|unlink)/i, why: "Accesso a file fuori dal progetto o cancellazioni" },
];

const SHADOW = /"name"\s*:\s*"(Read|Write|Edit|Bash|Grep|Glob|WebFetch|WebSearch|Agent|Task|read_file|write_file|execute_command|run_shell)"/;

export function scanPath(target) {
  const findings = [];
  const facts = { files: 0, hooks: false, mcp: false, agents: 0, skills: 0 };
  const walk = (p) => {
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      if (SKIP.has(path.basename(p))) return;
      for (const f of fs.readdirSync(p)) walk(path.join(p, f));
      return;
    }
    const rel = path.relative(target, p) || path.basename(p);
    if (/hooks[\\/]hooks\.json$|"hooks"\s*:/.test(rel)) facts.hooks = true;
    if (/(^|[\\/])\.mcp\.json$/.test(rel)) facts.mcp = true;
    if (/SKILL\.md$/i.test(rel)) facts.skills++;
    if (/(^|[\\/])agents[\\/][^\\/]+\.md$/i.test(rel)) facts.agents++;
    if (!TEXT.test(p) || st.size > 2_000_000) return;
    facts.files++;
    const text = fs.readFileSync(p, "utf8");
    if (/"hooks"\s*:\s*\{/.test(text)) facts.hooks = true;
    if (/"mcpServers"\s*:/.test(text)) facts.mcp = true;
    const lines = text.split(/\r?\n/);
    // Documentazione per umani (README, docs): un comando citato non viene eseguito da solo → gravità ridotta.
    // Istruzioni per l'AI (SKILL.md, agenti, comandi) restano a gravità piena: finiscono nel contesto del modello.
    const isDoc = /\.(md|mdx|txt)$/i.test(p) && !/SKILL\.md$|[\\/](agents|commands)[\\/]/i.test(rel);
    const LEVELS = ["critical", "high", "medium", "low"];
    const EXEC = new Set(["pipe-to-shell", "encoded-powershell", "destructive-shell", "dynamic-exec", "raw-ip-download"]);
    for (const r of RULES) {
      const i = lines.findIndex((l) => r.re.test(l));
      if (i < 0) continue;
      let severity = r.severity;
      if (isDoc) severity = LEVELS[Math.min(3, LEVELS.indexOf(severity) + (EXEC.has(r.id) ? 2 : 1))];
      findings.push({ severity, id: r.id, file: rel, line: i + 1, why: r.why + (isDoc ? " (citato nella documentazione)" : ""), sample: lines[i].trim().slice(0, 140) });
    }
    const sh = text.match(SHADOW);
    if (sh && /\.(json|js|ts|py)$/i.test(p)) findings.push({ severity: "medium", id: "tool-shadowing", file: rel, line: 0, why: `Definisce uno strumento con nome "${sh[1]}" uguale a uno nativo`, sample: sh[0] });
  };
  walk(target);
  if (facts.hooks) findings.push({ severity: "medium", id: "has-hooks", file: "-", line: 0, why: "Contiene hook: eseguono codice automaticamente a ogni evento. Leggili tutti prima di installare.", sample: "" });
  if (facts.mcp) findings.push({ severity: "low", id: "has-mcp", file: "-", line: 0, why: "Avvia server MCP: verifica comando, rete e permessi richiesti.", sample: "" });
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { target, facts, findings };
}

export function printReport({ target, facts, findings }) {
  console.log(`\nScansione offline: ${target}`);
  console.log(`  file letti ${facts.files} · skill ${facts.skills} · agenti ${facts.agents} · hook ${facts.hooks ? "sì" : "no"} · MCP ${facts.mcp ? "sì" : "no"}\n`);
  if (!findings.length) console.log("  Nessun segnale sospetto. Resta comunque obbligatoria la revisione del sorgente.");
  for (const f of findings) console.log(`  [${f.severity.toUpperCase()}] ${f.id} — ${f.why}\n      ${f.file}${f.line ? `:${f.line}` : ""}${f.sample ? `  «${f.sample}»` : ""}`);
  const bad = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  console.log(`\n  Esito: ${bad ? `❌ ${bad} segnali gravi: NON installare senza revisione riga per riga` : "⚠️ nessun segnale grave: procedi con revisione, versione pinnata e permessi minimi"}\n`);
}
