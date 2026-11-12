import fs from "node:fs"; import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { envFilePath } from "../../scripts/lib-supabase.mjs";
const env = {}; for (const l of fs.readFileSync(envFilePath(), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
if (env.MDS_AMBIENTE !== "prova") throw new Error("non è il progetto di prova");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: row } = await sb.from("app_state").select("data,version").eq("id", 1).single();
const sicuro = String.raw`Z:\mds-prova-inesistente\progetto`; // unità e cartella inesistenti: il motore può solo fallire in modo pulito
if (fs.existsSync(String.raw`Z:\mds-prova-inesistente`) || fs.existsSync("Z:\\")) throw new Error("l'unità Z: esiste: percorso non sicuro, mi fermo");
row.data.projects[0].localPath = sicuro;
const s = await sb.rpc("save_app_state", { p_expected_version: row.version, p_data: row.data, p_action_id: "azione-" + crypto.randomUUID(), p_request_hash: "p".repeat(64) });
const salvato = (await sb.from("app_state").select("data").eq("id", 1).single()).data.data.projects[0].localPath;
console.log("percorso salvato:", salvato, "· esito:", s.data?.status);
for (let i = 0; i < 4; i++) await sb.rpc("enqueue_launch", { p_launch: { project_id: "p_finto", brief: "richiesta per la prova del motore " + i, dedupe_key: "launch:" + crypto.randomUUID(), request_hash: "h".repeat(64) } });
const st = await sb.from("launch_requests").select("status");
console.log("richieste per stato:", JSON.stringify(Object.entries(st.data.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {}))));
