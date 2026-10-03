// Analytics intake for src/js/18-telemetry.js.
//
// Takes a batch of up to 120 events, keeps only the fields the game
// sends and only in the shapes it sends them, and writes them with the
// service role. Anything identifying never reaches this far: the game
// strips free text before it queues, and anything that does not look
// like an event is dropped rather than stored.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// A crude per-instance brake: one install sending more than 20 batches a
// minute is a loop or a script, not a player.
const recent = new Map<number, number[]>();
function tooMany(install: number): boolean {
  const t = Date.now();
  const list = (recent.get(install) || []).filter((x) => t - x < 60_000);
  list.push(t);
  recent.set(install, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 20;
}

const NAME = /^[a-z0-9_]{1,32}$/;
const TOKEN = /^[\w.:-]{1,24}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: cors });
  let body: { events?: unknown[]; platform?: string };
  try { body = await req.json(); } catch { return new Response("json", { status: 400, headers: cors }); }
  const events = Array.isArray(body.events) ? body.events.slice(0, 120) : [];
  if (!events.length) return new Response(JSON.stringify({ ok: true, stored: 0 }), { headers: cors });
  const platform = typeof body.platform === "string" && TOKEN.test(body.platform) ? body.platform : null;

  const rows = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const name = typeof e.e === "string" && NAME.test(e.e) ? e.e : null;
    const install = typeof e.i === "number" && Number.isFinite(e.i) ? Math.floor(e.i) : null;
    if (!name || install === null) continue;
    const props: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(e)) {
      if (["e", "i", "v", "s", "t"].includes(k) || !/^[a-z]{1,12}$/i.test(k)) continue;
      if (typeof v === "number" && Number.isFinite(v)) props[k] = v;
      else if (typeof v === "string" && v.length <= 120) props[k] = v;
      if (Object.keys(props).length >= 16) break;
    }
    rows.push({
      install,
      version: typeof e.v === "string" && TOKEN.test(e.v) ? e.v : null,
      platform,
      session: typeof e.s === "number" ? Math.floor(e.s) : null,
      name,
      client_ms: typeof e.t === "number" ? Math.floor(e.t) : null,
      props,
    });
  }
  if (!rows.length) return new Response(JSON.stringify({ ok: true, stored: 0 }), { headers: cors });
  if (tooMany(rows[0].install)) return new Response("slow down", { status: 429, headers: cors });
  const { error } = await db.from("events").insert(rows);
  if (error) return new Response(JSON.stringify({ ok: false, why: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true, stored: rows.length }), { headers: { ...cors, "Content-Type": "application/json" } });
});
