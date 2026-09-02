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
  const safeSummary = {
    bills: bills.slice(0, 200).map(b => ({
      name: String((b && b.name) || "").slice(0, 120),
      amount: Number(b && b.amount) || 0,
      due: String((b && b.due) || "")
    })),
    budgetOver: !!(summary && summary.budgetOver)
  };

  const existing = await redis.get(key);
  const notified = (existing && existing.notified) || {};

  await redis.set(key, {
    subscription,
    summary: safeSummary,
    notified,              // { bills: "YYYY-MM-DD", budget: "YYYY-MM-DD" } — last day each was sent, so a bill/over-budget flag notifies once per day, not every 15 min
    updatedAt: new Date().toISOString()
  });

  return res.status(200).json({ deviceId: id });
}
