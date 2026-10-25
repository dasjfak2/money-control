// FexaFY Plus -- /api/entitlement   (Phase 1 foundation)
// Tells the app "which plan is this Google account on, and when did its
// free trial start?" and hands back a SIGNED licence token the app can
// verify offline with the public key.
//
// PRIVACY: this server stores ONLY: sha256(Google account id), trial start,
// plan, plan expiry. Never the email, name, transactions, budgets, balances.
// The Google account id and email are used in memory for the request and
// are not written anywhere.
//
// ENV (Vercel project settings):
//   GOOGLE_CLIENT_ID     the same OAuth client id the app uses (token audience check)
//   PLUS_PRIVATE_JWK     private signing key from scripts/gen-license-key.mjs (JSON string)
//   PLUS_ALLOWED_ORIGIN  the app's origin, e.g. https://your-name.github.io  (CORS)
//   OWNER_EMAILS         comma-separated Google emails that always get full Plus + the state switcher
//   ID_PEPPER            any long random string (so ids can't be reversed by guessing)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (already used by the push backend)
import crypto from "crypto";

const KEY_PREFIX = "fexafy:plus:";
const RATE_PREFIX = "fexafy:ratelimit:plus:";
const TRIAL_MS = 7 * 86400000;
const TOKEN_TTL_MS = 24 * 3600000;
const RATE_MAX = 20, RATE_WINDOW = 60;

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function createHandler(deps) {
  const { redis, fetchFn, privateJwk, clientId, pepper, allowedOrigin } = deps;
  // Owner/tester emails (lowercase). Matched in memory against Google's verified email; never stored.
  const ownerEmails = (deps.ownerEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  const now = deps.now || (() => Date.now());
  const privateKey = crypto.createPrivateKey({ key: privateJwk, format: "jwk" });

  function cors(req, res) {
    const origin = req.headers.origin;
    if (allowedOrigin && origin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
  }

  async function verifyGoogleToken(accessToken) {
    const r = await fetchFn("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(accessToken));
    if (!r.ok) return null;
    const j = await r.json();
    const aud = j.aud || j.azp;
    if (!clientId || aud !== clientId) return null;      // token must have been issued to OUR app
    const sub = j.sub || j.user_id;
    if (!sub) return null;
    if (j.expires_in !== undefined && !(+j.expires_in > 0)) return null;
    const email = String(j.email || "").toLowerCase();
    const owner = !!email && (j.email_verified === true || j.email_verified === "true") && ownerEmails.includes(email);
    return { sub: String(sub), owner };
  }

  return async function handler(req, res) {
    cors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") { res.setHeader("Allow", "POST, OPTIONS"); return res.status(405).json({ error: "Method not allowed" }); }
    if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) return res.status(403).json({ error: "Forbidden" });

    try {
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const rk = RATE_PREFIX + ip;
      const count = await redis.incr(rk);
      if (count === 1) await redis.expire(rk, RATE_WINDOW);
      if (count > RATE_MAX) return res.status(429).json({ error: "Too many requests" });

      const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || "");
      if (!m) return res.status(401).json({ error: "Missing token" });
      const who = await verifyGoogleToken(m[1]);
      if (!who) return res.status(401).json({ error: "Invalid token" });

      const id = crypto.createHash("sha256").update((pepper || "") + "|" + who.sub).digest("hex");
      const key = KEY_PREFIX + id;
      const t = now();
      // Atomic: only the very first request ever creates the record, so the trial can't be restarted or raced.
      await redis.set(key, { trialStart: t, plan: "trial", expiry: 0 }, { nx: true });
      let rec = await redis.get(key);
      if (typeof rec === "string") { try { rec = JSON.parse(rec); } catch (e) { rec = null; } }
      if (!rec || typeof rec.trialStart !== "number") return res.status(500).json({ error: "Record unavailable" });

      let plan = rec.plan === "plus" && +rec.expiry > t ? "plus" : "trial";
      let expiry = plan === "plus" ? +rec.expiry : 0;
      if (who.owner) { plan = "plus"; expiry = t + 400 * 86400000; } // owner: everything unlocked, re-issued on every refresh
      const payload = { sub: id, plan, trialStart: rec.trialStart, expiry, iat: t, exp: t + TOKEN_TTL_MS };
      if (who.owner) payload.owner = true;
      const body = b64u(JSON.stringify(payload));
      const sig = crypto.sign("sha256", Buffer.from(body), { key: privateKey, dsaEncoding: "ieee-p1363" });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ token: body + "." + b64u(sig), plan, trialStart: rec.trialStart, expiry, owner: !!who.owner, trialEnds: rec.trialStart + TRIAL_MS });
    } catch (e) {
      return res.status(500).json({ error: "Server error" });
    }
  };
}

let _default;
export default async function handler(req, res) {
  if (!_default) {
    const { Redis } = await import("@upstash/redis");
    _default = createHandler({
      redis: Redis.fromEnv(),
      fetchFn: fetch,
      privateJwk: JSON.parse(process.env.PLUS_PRIVATE_JWK || "{}"),
      clientId: process.env.GOOGLE_CLIENT_ID,
      pepper: process.env.ID_PEPPER,
      allowedOrigin: process.env.PLUS_ALLOWED_ORIGIN,
      ownerEmails: (process.env.OWNER_EMAILS || "").split(",")
    });
  }
  return _default(req, res);
}
