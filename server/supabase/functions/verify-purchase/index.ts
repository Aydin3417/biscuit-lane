// Receipt check for src/js/17-billing.js (cordova-plugin-purchase's
// validator). Answers { ok: true } only when Apple or Google say the
// purchase is real, for this app, for the product claimed — and when the
// transaction has not already been redeemed by a different install.
//
// APPLE works with no configuration: the consumable is looked up in the
// app receipt through Apple's verifyReceipt endpoint, production first
// and the sandbox when Apple answers 21007. (Apple has marked
// verifyReceipt deprecated in favour of the App Store Server API; it
// still answers. If it ever stops, this is the one function to change.)
//
// GOOGLE needs one of two secrets, set with `supabase secrets set`:
//   GOOGLE_SERVICE_ACCOUNT   the JSON key of a service account granted
//                            "View financial data" in Play Console —
//                            the purchase is fetched from Google itself.
//   GOOGLE_PLAY_PUBLIC_KEY   the app's licensing key (Play Console ->
//                            Monetisation setup), base64 — the receipt's
//                            signature is checked against it. Weaker:
//                            it proves Google signed it, not that it is
//                            still valid.
// With neither, Android purchases are accepted on the store's word, as
// they were before this function existed, and the answer says so.
//
// Error codes are cordova-plugin-purchase's: 6778003 refused (do not
// grant), 6778001 could not tell (the plugin leaves the purchase open
// and asks again later).
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUNDLE = Deno.env.get("APP_BUNDLE_ID") || "com.pawtika.game";
const SKUS = new Set(["treats_pocket_40", "treats_bag_110", "treats_tin_240", "treats_sack_520",
  "treat_jar", "season_book", "starter_pack"]);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const REFUSED = 6778003, UNSURE = 6778001;
const answer = (ok: boolean, extra: Record<string, unknown> = {}, status = 200) =>
  new Response(JSON.stringify({ ok, ...extra }), { status, headers: cors });

type Verdict = { ok: true; tx: string; sku: string; env: string } | { ok: false; code: number; message: string };

// ---------- Apple ----------
async function apple(t: Record<string, unknown>, sku: string): Promise<Verdict> {
  const receipt = typeof t.appStoreReceipt === "string" ? t.appStoreReceipt : null;
  if (!receipt) return { ok: false, code: REFUSED, message: "no receipt" };
  const ask = (url: string) => fetch(url, {
    method: "POST",
    body: JSON.stringify({ "receipt-data": receipt, "exclude-old-transactions": true }),
  }).then((r) => r.json());
  let env = "production";
  let r = await ask("https://buy.itunes.apple.com/verifyReceipt");
  if (r && r.status === 21007) { env = "sandbox"; r = await ask("https://sandbox.itunes.apple.com/verifyReceipt"); }
  if (!r || typeof r.status !== "number") return { ok: false, code: UNSURE, message: "apple silent" };
  if (r.status === 21005 || r.status === 21009 || (r.status >= 21100 && r.status <= 21199)) {
    return { ok: false, code: UNSURE, message: "apple busy " + r.status };
  }
  if (r.status !== 0) return { ok: false, code: REFUSED, message: "apple status " + r.status };
  if (!r.receipt || r.receipt.bundle_id !== BUNDLE) return { ok: false, code: REFUSED, message: "wrong app" };
  const want = typeof t.id === "string" ? t.id : null;
  const items: Record<string, string>[] = [...(r.receipt.in_app || []), ...(r.latest_receipt_info || [])];
  const hit = items.find((x) => x.product_id === sku && (!want || x.transaction_id === want || x.original_transaction_id === want));
  if (!hit) return { ok: false, code: REFUSED, message: "not in receipt" };
  if (hit.cancellation_date) return { ok: false, code: REFUSED, message: "refunded" };
  return { ok: true, tx: hit.transaction_id, sku, env };
}

// ---------- Google ----------
function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const s = typeof bytes === "string" ? btoa(bytes) : btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemBody(pem: string): Uint8Array {
  const b = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}
async function googleToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3000,
  }));
  const key = await crypto.subtle.importKey("pkcs8", pemBody(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const jwt = head + "." + claim + "." + b64url(sig);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  }).then((x) => x.json());
  if (!r.access_token) throw new Error("no token");
  return r.access_token;
}
async function google(t: Record<string, unknown>, sku: string): Promise<Verdict> {
  let rec: Record<string, unknown> = {};
  try { rec = typeof t.receipt === "string" ? JSON.parse(t.receipt) : {}; } catch { /* checked below */ }
  const token = (typeof t.purchaseToken === "string" && t.purchaseToken) || (rec.purchaseToken as string) || "";
  const pkg = (rec.packageName as string) || BUNDLE;
  const product = (rec.productId as string) || sku;
  if (!token) return { ok: false, code: REFUSED, message: "no token" };
  if (pkg !== BUNDLE || product !== sku) return { ok: false, code: REFUSED, message: "wrong app or product" };
  const txId = (rec.orderId as string) || (typeof t.id === "string" ? t.id : token.slice(0, 64));

  const saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
  if (saRaw) {
    let bearer: string;
    try { bearer = await googleToken(JSON.parse(saRaw)); } catch { return { ok: false, code: UNSURE, message: "google auth" }; }
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/products/${sku}/tokens/${encodeURIComponent(token)}`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + bearer } });
    if (r.status === 404 || r.status === 410) return { ok: false, code: REFUSED, message: "unknown purchase" };
    if (!r.ok) return { ok: false, code: UNSURE, message: "google " + r.status };
    const p = await r.json();
    if (p.purchaseState !== 0) return { ok: false, code: REFUSED, message: "state " + p.purchaseState };
    return { ok: true, tx: p.orderId || txId, sku, env: p.purchaseType === 0 ? "test" : "production" };
  }
  const pub = Deno.env.get("GOOGLE_PLAY_PUBLIC_KEY");
  if (pub) {
    const sig = typeof t.signature === "string" ? t.signature : "";
    if (!sig || typeof t.receipt !== "string") return { ok: false, code: REFUSED, message: "unsigned" };
    const key = await crypto.subtle.importKey("spki", pemBody(pub), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" }, false, ["verify"]);
    const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key,
      Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)), new TextEncoder().encode(t.receipt));
    if (!good) return { ok: false, code: REFUSED, message: "bad signature" };
    return { ok: true, tx: txId, sku, env: "signed" };
  }
  return { ok: true, tx: txId, sku, env: "unchecked" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return answer(false, { code: REFUSED, message: "method" }, 405);
  let payload: { body?: Record<string, unknown>; install?: number; platform?: string };
  try { payload = await req.json(); } catch { return answer(false, { code: REFUSED, message: "json" }, 400); }
  const body = payload.body || {};
  const t = (body.transaction || {}) as Record<string, unknown>;
  const sku = typeof body.id === "string" ? body.id : "";
  const install = typeof payload.install === "number" ? Math.floor(payload.install) : 0;
  if (!SKUS.has(sku)) return answer(false, { code: REFUSED, message: "unknown product" });

  let v: Verdict;
  try {
    v = t.type === "ios-appstore" ? await apple(t, sku)
      : t.type === "android-playstore" ? await google(t, sku)
      : { ok: false, code: REFUSED, message: "unknown store" };
  } catch (e) {
    v = { ok: false, code: UNSURE, message: "check failed" };
  }
  if (!v.ok) return answer(false, { code: v.code, message: v.message });

  // One transaction, one install. The same receipt presented again by the
  // install that bought it is fine (a retry, a restore); by another
  // install it is a shared or copied receipt.
  const { data: seen } = await db.from("purchases").select("install").eq("transaction_id", v.tx).maybeSingle();
  if (seen && seen.install !== install && install) return answer(false, { code: REFUSED, message: "already redeemed" });
  if (!seen) {
    await db.from("purchases").insert({
      transaction_id: v.tx, platform: t.type === "ios-appstore" ? "ios" : "android", sku, install, environment: v.env,
    });
  }
  return answer(true, { env: v.env });
});
