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
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM", 24h — anything else falls back to a safe default below

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const { deviceId, subscription, summary } = body;

  const id = (typeof deviceId === "string" && deviceId.length >= 8)
    ? deviceId
    : crypto.randomUUID();
  const key = KEY_PREFIX + id;

  // subscription === null means "unsubscribe" (person turned the switch off)
  if (!subscription) {
    await redis.del(key);
    return res.status(200).json({ deviceId: id, removed: true });
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

  await redis.set(key, {
    subscription,
    summary: safeSummary,
    notified,              // { bills: "YYYY-MM-DD", budget: "YYYY-MM-DD", dailyLogMorning: "YYYY-MM-DD", dailyLogNight: "YYYY-MM-DD" } — last day each was sent, so nothing notifies more than once per day per kind. The two dailyLog* keys are written by the scheduler once that side is updated to match; this endpoint just preserves whatever keys already exist, unchanged.
    updatedAt: new Date().toISOString()
  });

  return res.status(200).json({ deviceId: id });
}
