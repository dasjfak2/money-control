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
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) — used for bills/budget, which are already date-only fields
}

/* ---- Daily add-transaction reminder — per-device LOCAL time ----
   Bills/budget above only ever need to compare dates, so server UTC
   is fine. This one needs actual time-of-day ("is it past 9pm FOR
   THIS PERSON"), and the server has no idea what timezone a device
   is in beyond the utcOffsetMinutes it told us in /api/register. Both
   helpers below take that raw minute offset and manually shift a UTC
   timestamp by it — deliberately NOT using any timezone-name/DST
   library, since we were only ever given a numeric offset, not a
   zone name. (This does mean a device's offset can go briefly stale
   across a DST change until the app next re-registers — same
   trade-off the rest of this backend already accepts elsewhere.) */
function localDateStr(utcOffsetMinutes) {
  const shifted = new Date(Date.now() + utcOffsetMinutes * 60000);
  return shifted.toISOString().slice(0, 10);
}
function localHHMM(utcOffsetMinutes) {
  const shifted = new Date(Date.now() + utcOffsetMinutes * 60000);
  return String(shifted.getUTCHours()).padStart(2, "0") + ":" + String(shifted.getUTCMinutes()).padStart(2, "0");
}
// Exact same two messages the app itself shows when it's open (see
// dailyLogMessage() in index.html) — kept identical on purpose so the
// wording matches whether this device notices it via a closed-app
// push or the in-app nudge.
const DAILY_LOG_MESSAGES = {
  night: { title: "Before you sleep 🌙", body: "Quick check — add anything you spent or earned today so tomorrow's numbers start accurate." },
  morning: { title: "Good morning ☀️", body: "Got a minute? Log today's income or expenses before the day gets busy." }
};

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

      // Daily add-transaction reminder — only even considered if the
      // person has it turned on AND hasn't logged anything yet today
      // (both told to us by the client in /api/register; loggedToday
      // is re-sent fresh each time the client syncs, so this can go
      // briefly stale between syncs the same way bills/budget already
      // do — not a new trade-off).
      let dailyLogSlot = null, dailyLogLocalToday = null;
      const dailyLog = rec.summary && rec.summary.dailyLog;
      if (dailyLog && dailyLog.enabled && !dailyLog.loggedToday) {
        const offset = Number.isFinite(dailyLog.utcOffsetMinutes) ? dailyLog.utcOffsetMinutes : 0;
        dailyLogLocalToday = localDateStr(offset);
        const nowHHMM = localHHMM(offset);
        const morningTime = dailyLog.morningTime || "09:00";
        const nightTime = dailyLog.nightTime || "21:00";
        // Mirrors the app's own client-side reasoning exactly: once
        // night time has passed, send just that (skip a redundant
        // morning nudge for someone whose device only just checked in
        // for the first time that day, already in the evening).
        if (nowHHMM >= nightTime && notified.dailyLogNight !== dailyLogLocalToday) {
          dailyLogSlot = "night";
        } else if (nowHHMM >= morningTime && nowHHMM < nightTime && notified.dailyLogMorning !== dailyLogLocalToday) {
          dailyLogSlot = "morning";
        }
      }

      let tag = null, title = null, bodyText = null;
      if (dueBills.length && notified.bills !== today) {
        tag = "bills";
        title = dueBills.length === 1 ? "Bill due" : `${dueBills.length} bills due`;
        bodyText = dueBills.slice(0, 3).map(b => `${b.name} (${b.amount})`).join(", ");
      } else if (budgetOver && notified.budget !== today) {
        tag = "budget";
        title = "Over budget this month";
        bodyText = "You've gone over your budget for this month.";
      } else if (dailyLogSlot) {
        tag = dailyLogSlot === "night" ? "dailyLogNight" : "dailyLogMorning";
        title = DAILY_LOG_MESSAGES[dailyLogSlot].title;
        bodyText = DAILY_LOG_MESSAGES[dailyLogSlot].body;
      }
      if (!title) continue;

      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({
          title: (tag === "dailyLogNight" || tag === "dailyLogMorning") ? title : `FexaFY — ${title}`,
          body: bodyText,
          tag,
          url: "./"
        }));
        sent++;
        // Bills/budget stamp the shared UTC "today"; the two daily-log
        // tags stamp THIS device's own local date, so each resets at
        // this person's actual midnight, not the server's.
        const stampDate = (tag === "dailyLogNight" || tag === "dailyLogMorning") ? dailyLogLocalToday : today;
        const newNotified = { ...notified, [tag]: stampDate };
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
