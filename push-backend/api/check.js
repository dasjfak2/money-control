// FexaFY push backend — /api/check
// This is the endpoint the free cron-job.org scheduler calls every
// 15 minutes (see SETUP.md). It never runs on its own — nothing on
// Vercel wakes itself up. Requires ?secret=<CRON_SECRET> (or an
// x-cron-secret header) matching the CRON_SECRET env var, so nobody
// else can trigger it or read what's stored.
import { Redis } from "@upstash/redis";
import webpush from "web-push";

const redis = Redis.fromEnv();
const KEY_PREFIX = "fexafy:device:";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export default async function handler(req, res) {
  const provided = (req.query && req.query.secret) || req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = todayStr();
  let cursor = "0";
  let checked = 0, sent = 0, removed = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: KEY_PREFIX + "*", count: 100 });
    cursor = nextCursor;

    for (const key of keys) {
      checked++;
      const rec = await redis.get(key);
      if (!rec || !rec.subscription) continue;

      const notified = rec.notified || {};
      const bills = (rec.summary && rec.summary.bills) || [];
      const dueBills = bills.filter(b => b.due && b.due <= today);
      const budgetOver = !!(rec.summary && rec.summary.budgetOver);

      let tag = null, title = null, bodyText = null;
      if (dueBills.length && notified.bills !== today) {
        tag = "bills";
        title = dueBills.length === 1 ? "Bill due" : `${dueBills.length} bills due`;
        bodyText = dueBills.slice(0, 3).map(b => `${b.name} (${b.amount})`).join(", ");
      } else if (budgetOver && notified.budget !== today) {
        tag = "budget";
        title = "Over budget this month";
        bodyText = "You've gone over your budget for this month.";
      }
      if (!title) continue;

      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({
          title: `FexaFY — ${title}`,
          body: bodyText,
          tag,
          url: "./"
        }));
        sent++;
        const newNotified = { ...notified, [tag]: today };
        await redis.set(key, { ...rec, notified: newNotified });
      } catch (err) {
        // 404/410 means the browser subscription is gone (uninstalled, etc.) — clean it up
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await redis.del(key);
          removed++;
        }
      }
    }
  } while (cursor !== "0");

  return res.status(200).json({ checked, sent, removed, at: today });
}
