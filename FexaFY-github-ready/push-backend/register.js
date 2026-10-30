// FexaFY push backend — /api/register
// Called by the app whenever the person turns "Background push" on/off,
// or periodically while it's open, to keep this device's subscription
// and small reminder summary up to date. Stores ONLY what's needed to
// decide "is anything due" — never transactions, balances, accounts,
// or profile data (see privacy-policy.html section 4).
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();
const KEY_PREFIX = "fexafy:device:";
const RATE_PREFIX = "fexafy:ratelimit:register:";
const DEVICE_TTL_SEC = 90 * 86400; // junk/abandoned records expire on their own; every re-register (app open) refreshes this
/* PLUS-GATE-BEGIN (register.js) -- FexaFY Plus entitlement stored with the device
   The app sends the signed licence token it got from /api/entitlement. We verify the
   signature (public key derived from PLUS_PRIVATE_JWK -- no extra env var needed) and
   keep ONLY: account-hash, trialStart, plan, expiry. check.js uses it to decide whether
   this device may receive background push. Nothing here is personal data. */
let _plusPubKey;
function plusPublicKey() {
  if (_plusPubKey !== undefined) return _plusPubKey;
  try { _plusPubKey = crypto.createPublicKey({ key: JSON.parse(process.env.PLUS_PRIVATE_JWK || "{}"), format: "jwk" }); }
  catch (e) { _plusPubKey = null; }
  return _plusPubKey;
}
function verifyPlusToken(tok) {
  try {
    const key = plusPublicKey();
    if (!key || typeof tok !== "string" || tok.length > 2000) return null;
    const parts = tok.split(".");
    if (parts.length !== 2) return null;
    const ok = crypto.verify("sha256", Buffer.from(parts[0]), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[1], "base64url"));
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!p || typeof p.sub !== "string" || typeof p.trialStart !== "number") return null;
    return { sub: p.sub, trialStart: p.trialStart, plan: p.plan === "plus" ? "plus" : "trial", expiry: Number(p.expiry) || 0 };
  } catch (e) { return null; }
}
function mergeEnt(prev, next) {
  if (!prev || prev.sub !== next.sub) return next;   // different account on this device -> replace
  return {
    sub: next.sub,
    trialStart: Math.min(prev.trialStart, next.trialStart),
    plan: (prev.plan === "plus" || next.plan === "plus") ? "plus" : "trial",
    expiry: Math.max(Number(prev.expiry) || 0, Number(next.expiry) || 0)
  };
}
/* PLUS-GATE-END */

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM", 24h — anything else falls back to a safe default below

/* ---- IP-based rate limit (2026-10-03, resource-abuse fix) ----
   This endpoint is public by design (a PushSubscription is itself a
   kind of bearer token, so there was never a per-user login to gate
   it behind) — which also means anyone who finds the URL could script
   repeated POSTs and, since omitting deviceId always creates a BRAND
   NEW Redis key via crypto.randomUUID(), generate unlimited junk
   records. Rather than add a new dependency for this, reuse the Redis
   connection already open here: a simple INCR+EXPIRE counter per IP,
   no extra service, no extra cost. This is a best-effort limit (an
   attacker rotating IPs isn't stopped by it), not a perfect one — but
   it closes the trivial single-script-hammering-the-endpoint case,
   which is the realistic threat for a small app like this. */
const RATE_LIMIT_MAX = 15;      // max requests...
const RATE_LIMIT_WINDOW = 60;   // ...per this many seconds, per IP
async function checkRateLimit(ip) {
  const key = RATE_PREFIX + ip;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
  return count <= RATE_LIMIT_MAX;
}

/* ---- Subscription shape validation (2026-10-03, resource-abuse fix) ----
   Previously only checked `subscription` was truthy, so literally any
   truthy value — "x", {}, {foo:1} — would be written to Redis and sit
   there forever: check.js's cleanup only fires on a REAL 404/410 from
   an actual push-service send attempt, which a shape like {} would
   never even reach (web-push would throw a different kind of error
   first). Validating the real PushSubscription shape here, before
   ever writing to Redis, is the cheapest place to stop junk — much
   cheaper than trying to clean it up later. */
function isValidSubscription(sub) {
  return !!sub
    && typeof sub === "object"
    && typeof sub.endpoint === "string"
    && sub.endpoint.length > 0
    && sub.endpoint.length < 2048
    && sub.endpoint.startsWith("https://")
    && !!sub.keys
    && typeof sub.keys === "object"
    && typeof sub.keys.p256dh === "string"
    && sub.keys.p256dh.length > 0
    && typeof sub.keys.auth === "string"
    && sub.keys.auth.length > 0;
}

/* ---- Due-index (2026-10-14, Redis-cost redesign) ----
   Keeps fexafy:due (a sorted set: member = deviceId, score = the next
   UTC ms this device could possibly have something to send) up to
   date whenever a device's data changes here, so check.js's normal
   runs don't have to fetch every device every 15 minutes. These
   function bodies are pasted identically into check.js — see the
   changelog for why duplicated rather than shared, and check.js for
   the daily full-scan safety net that self-heals this index regardless
   of anything below. A failure anywhere in this block never blocks
   registration itself — it's wrapped in its own try/catch below. */
const DUE_KEY = "fexafy:due";

function utcMidnightMs(dateStr) {
  const t = Date.parse(dateStr + "T00:00:00Z");
  return Number.isFinite(t) ? t : NaN;
}
function toMinutesOfDay(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || "");
  return m ? (Number(m[1]) * 60 + Number(m[2])) : 9 * 60; // default 09:00, mirrors the fallback a few lines up
}
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function localMidnightUtcMs(localDateStr, offsetMinutes) {
  return utcMidnightMs(localDateStr) - offsetMinutes * 60000;
}
function nextDailyLogAt(now, dl, notified) {
  const offset = Number.isFinite(dl.utcOffsetMinutes) ? dl.utcOffsetMinutes : 0;
  const morningMin = toMinutesOfDay(dl.morningTime || "09:00");
  const nightMin = toMinutesOfDay(dl.nightTime || "21:00");
  const today = new Date(now + offset * 60000).toISOString().slice(0, 10);
  const todayMidnightUtc = localMidnightUtcMs(today, offset);
  const pending = [];
  if (notified.dailyLogMorning !== today) pending.push(Math.max(todayMidnightUtc + morningMin * 60000, now));
  if (notified.dailyLogNight !== today) pending.push(Math.max(todayMidnightUtc + nightMin * 60000, now));
  if (pending.length) return Math.min(...pending);
  const tomorrow = addDaysToDateStr(today, 1);
  return localMidnightUtcMs(tomorrow, offset) + morningMin * 60000;
}
function monthKeyFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 7); // "YYYY-MM", UTC
}
// See check.js for the full explanation (monthly review push, 2026-10-16) --
// this copy only needs to feed the index, never decides to send anything.
function nextMonthlyReviewAt(now, notified) {
  const d = new Date(now);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const prevMonthKey = monthKeyFromMs(Date.UTC(y, m - 1, 1));
  if (day <= 3 && notified.monthlyReview !== prevMonthKey) return now;
  return Date.UTC(y, m + 1, 1);
}
function computeNextCheckAt(now, summary, notified) {
  notified = notified || {};
  const today = new Date(now).toISOString().slice(0, 10);
  const candidates = [];

  const bills = (summary && Array.isArray(summary.bills)) ? summary.bills : [];
  if (bills.length && notified.bills !== today) {
    const dueTimes = bills.map(b => (b && b.due) ? utcMidnightMs(b.due) : NaN).filter(Number.isFinite);
    if (dueTimes.length) candidates.push(Math.max(Math.min(...dueTimes), now));
  }

  if (summary && summary.budgetOver && notified.budget !== today) {
    candidates.push(now);
  }

  const dl = summary && summary.dailyLog;
  if (dl && dl.enabled && !dl.loggedToday) {
    candidates.push(nextDailyLogAt(now, dl, notified));
  }

  candidates.push(nextMonthlyReviewAt(now, notified));

  return candidates.length ? Math.min(...candidates) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel sets x-forwarded-for reliably at the edge; take the first
  // (client) address in the list. Falls back to "unknown" so a missing
  // header can never crash the handler — worst case, every caller
  // without one shares a single bucket, which is still strictly safer
  // than no limit at all.
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  try {
    const withinLimit = await checkRateLimit(ip);
    if (!withinLimit) {
      return res.status(429).json({ error: "Too many requests, please slow down" });
    }
  } catch (err) {
    // If the rate-limit check itself fails (e.g. a transient Redis
    // hiccup), fail OPEN rather than break registration for everyone
    // over a side-concern — the validation below still applies either way.
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const { deviceId, subscription, summary, plusToken } = body;

  const id = (typeof deviceId === "string" && deviceId.length >= 8 && deviceId.length <= 128)
    ? deviceId
    : crypto.randomUUID();
  const key = KEY_PREFIX + id;

  // subscription === null means "unsubscribe" (person turned the switch off)
  if (!subscription) {
    await redis.del(key);
    try { await redis.zrem(DUE_KEY, id); } catch (e) { /* index-only; see check.js's daily reconcile */ }
    return res.status(200).json({ deviceId: id, removed: true });
  }

  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  // Keep only the small, non-sensitive fields the scheduler needs.
  const bills = Array.isArray(summary && summary.bills) ? summary.bills : [];
  // Daily add-transaction reminder (new) — same "just enough to decide,
  // nothing else" rule as bills/budgetOver above: an on/off flag, the
  // two chosen times, whether today has an entry yet, and this device's
  // UTC offset (the scheduler has no other way to know what "9pm" means
  // for this particular person). Never any transaction content.
  const dl = summary && summary.dailyLog;
  const dailyLog = (dl && dl.enabled) ? {
    enabled: true,
    morningTime: (typeof dl.morningTime === "string" && HHMM_RE.test(dl.morningTime)) ? dl.morningTime : "09:00",
    nightTime: (typeof dl.nightTime === "string" && HHMM_RE.test(dl.nightTime)) ? dl.nightTime : "21:00",
    loggedToday: !!dl.loggedToday,
    // Clamped to the real-world range of UTC offsets (-12:00 to +14:00)
    // so a garbled/malicious value can't push the "is it 9pm yet" math
    // out of range.
    utcOffsetMinutes: Math.max(-720, Math.min(840, Number.isFinite(Number(dl.utcOffsetMinutes)) ? Number(dl.utcOffsetMinutes) : 0))
  } : { enabled: false };
  const safeSummary = {
    bills: bills.slice(0, 200).map(b => ({
      name: String((b && b.name) || "").slice(0, 120),
      amount: Number(b && b.amount) || 0,
      due: String((b && b.due) || "")
    })),
    budgetOver: !!(summary && summary.budgetOver),
    dailyLog
  };

  const existing = await redis.get(key);
  const notified = (existing && existing.notified) || {};
  let ent = existing && existing.ent;                 // Plus entitlement (see PLUS-GATE above)
  const verifiedEnt = verifyPlusToken(plusToken);
  if (verifiedEnt) ent = mergeEnt(ent, verifiedEnt);

  await redis.set(key, {
    subscription,
    summary: safeSummary,
    notified,              // { bills: "YYYY-MM-DD", budget: "YYYY-MM-DD", dailyLogMorning: "YYYY-MM-DD", dailyLogNight: "YYYY-MM-DD" } — last day each was sent, so nothing notifies more than once per day per kind. The two dailyLog* keys are written by the scheduler once that side is updated to match; this endpoint just preserves whatever keys already exist, unchanged.
    ...(ent ? { ent } : {}),
    failCount: 0,           // consecutive non-404/410 send failures, reset on every successful send or fresh registration — see check.js for how this retires a record that never actually works
    updatedAt: new Date().toISOString()
  }, { ex: DEVICE_TTL_SEC });

  try {
    const next = computeNextCheckAt(Date.now(), safeSummary, notified);
    if (next === null) await redis.zrem(DUE_KEY, id);
    else await redis.zadd(DUE_KEY, { score: next, member: id });
  } catch (e) {
    // Scheduling-index-only — a failure here never blocks registration
    // itself; check.js's daily full-scan reconcile repairs it regardless.
  }

  return res.status(200).json({ deviceId: id });
}
