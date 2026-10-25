// FexaFY push backend — /api/check
// This is the endpoint the free cron-job.org scheduler calls every
// 15 minutes (see SETUP.md). It never runs on its own — nothing on
// Vercel wakes itself up. Requires ?secret=<CRON_SECRET> (or an
// x-cron-secret header) matching the CRON_SECRET env var, so nobody
// else can trigger it or read what's stored.
import { Redis } from "@upstash/redis";
import webpush from "web-push";
import crypto from "crypto";

const redis = Redis.fromEnv();
const KEY_PREFIX = "fexafy:device:";

/* PLUS-GATE-BEGIN (check.js) -- background push is a Plus feature.
   Only enforced when the Vercel env PLUS_PUSH_ENFORCE is exactly "true";
   otherwise behaviour is unchanged. A device is entitled during its 7-day
   trial or while a paid plan has not expired (both stored by register.js
   from a verified licence token). */
const PLUS_TRIAL_MS = 7 * 86400000;
function isPushEntitled(ent, now) {
  if (!ent) return false;
  if (typeof ent.trialStart === "number" && now < ent.trialStart + PLUS_TRIAL_MS) return true;
  return ent.plan === "plus" && Number(ent.expiry) > now;
}
/* PLUS-GATE-END */

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* ---- Constant-time secret comparison (2026-10-03, hardening) ----
   Plain `!==` on strings short-circuits at the first mismatched
   character, so in principle someone with enough attempts and a
   precise enough clock could infer CRON_SECRET one character at a
   time from response-time differences. crypto.timingSafeEqual takes
   the same time regardless of where the mismatch is — but it throws
   if the two buffers differ in length, so unequal-length inputs are
   rejected first via a length check. That length check alone leaks
   only "right length or not", never which character is wrong, which
   is an acceptable, standard trade-off here. */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

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

// A record that fails this many CONSECUTIVE send attempts in a row
// (not 404/410 — those are deleted immediately below, same as before)
// gets retired. Covers a subscription that register.js's new shape
// validation let through looking valid, but that never actually works
// (wrong keys, a push service that's permanently erroring, etc.) — the
// kind of junk that used to sit in Redis forever, since it would never
// hit the old 404/410-only cleanup path. ~5 cron runs is roughly 75
// minutes of persistent failure before giving up, which comfortably
// outlasts any ordinary transient network hiccup.
const FAIL_THRESHOLD = 5;

/* ---- Due-index (2026-10-14, Redis-cost redesign) ----
   Before this, EVERY run SCANned and GET'd every single device record,
   whether or not it had anything to send — the cost that set the real
   device ceiling on a free Redis plan. This section adds a sorted set,
   fexafy:due (member = deviceId, score = the next UTC ms this device
   could possibly have something to send), kept up to date from here and
   from register.js. A normal run now asks Redis for just the handful of
   members due <= now instead of fetching every device — the function
   bodies below are pasted identically into register.js; see the
   changelog for why duplicated rather than shared.
   Safety net: once every UTC day (tracked by RECONCILE_KEY), this still
   does the OLD full scan+rebuild once, so (a) devices registered before
   this change get indexed, and (b) any drift in the math below quietly
   self-heals within 24h worst case — this is deliberately NOT a bet-
   everything-on-new-math change. */
const DUE_KEY = "fexafy:due";
const RECONCILE_KEY = "fexafy:due:reconciledDate";
const DUE_PAGE_SIZE = 200;

function utcMidnightMs(dateStr) {
  const t = Date.parse(dateStr + "T00:00:00Z");
  return Number.isFinite(t) ? t : NaN;
}
function toMinutesOfDay(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || "");
  return m ? (Number(m[1]) * 60 + Number(m[2])) : 9 * 60; // default 09:00, mirrors register.js's own fallback
}
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function localMidnightUtcMs(localDateStr, offsetMinutes) {
  return utcMidnightMs(localDateStr) - offsetMinutes * 60000;
}
// Earliest UTC ms this device's daily-log reminder could next be due, given
// its last-known local offset/times and which local dates it has already
// been sent for. Mirrors the nowHHMM comparisons above exactly, just
// solved for "when" instead of "is it now".
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
/* ---- Monthly review push (2026-10-16) ----
   A generic "your review is ready" nudge, sent once on the 1st-3rd of
   each UTC month, covering the month that just ended. notified.monthlyReview
   stores the "YYYY-MM" of the month LAST reviewed this way, so it only ever
   fires once per month no matter how many times the 1st-3rd window is
   checked, and a device that was offline for months just gets the most
   recently completed month next time (never back-fills older ones) — same
   behavior as the app's own in-app review already has. Unconditional (every
   device is eventually a candidate), unlike bills/budget/daily-log which only
   apply if that data exists — there is no per-device on/off for this push
   itself; see the changelog for why. */
function nextMonthlyReviewAt(now, notified) {
  const d = new Date(now);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const prevMonthKey = monthKeyFromMs(Date.UTC(y, m - 1, 1));
  if (day <= 3 && notified.monthlyReview !== prevMonthKey) return now;
  return Date.UTC(y, m + 1, 1); // 1st of next month, UTC midnight -- when the next day<=3 window opens
}
// Earliest UTC ms this device could next have ANYTHING to send -- the
// minimum across bills/budget/daily-log/monthly-review, each only counted
// while it hasn't already been notified for today (UTC for bills/budget,
// this device's own local date for daily-log, the reviewed month for
// monthly-review — exactly how the decision logic below decides "already
// sent or not"). null means nothing is pending at all given the data we
// currently have for this device.
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
  const provided = (req.query && req.query.secret) || req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || !safeCompare(provided, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = Date.now();
  const today = todayStr();
  let checked = 0, sent = 0, removed = 0, retired = 0, locked = 0;

  async function updateDueIndex(id, summary, notified) {
    try {
      const next = computeNextCheckAt(now, summary, notified);
      if (next === null) await redis.zrem(DUE_KEY, id);
      else await redis.zadd(DUE_KEY, { score: next, member: id });
    } catch (e) {
      // The index is a scheduling optimization only — a failure here
      // never undoes a send that already happened. Worst case this one
      // device gets re-swept by the daily reconcile below.
    }
  }

  // Exact same decide → send → clean-up logic as before this change,
  // just wrapped as a per-device function so both the fast (due-only)
  // path and the once-a-day full-scan path below can share it unchanged.
  async function processDevice(id) {
    const key = KEY_PREFIX + id;
    checked++;
    const rec = await redis.get(key);
    if (!rec || !rec.subscription) {
      // Stale index entry pointing at a record that's gone or never had
      // a subscription — drop it so it isn't re-fetched every run for nothing.
      try { await redis.zrem(DUE_KEY, id); } catch (e) {}
      return;
    }

    // Plus gate: devices without a valid trial/plan get no push, and are dropped from
    // the due-index (they re-enter the next time the app registers with a valid token).
    if (process.env.PLUS_PUSH_ENFORCE === "true" && !isPushEntitled(rec.ent, now)) {
      try { await redis.zrem(DUE_KEY, id); } catch (e) {}
      locked++;
      return;
    }

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

    // Monthly review -- lowest priority of the four (least time-sensitive);
    // see nextMonthlyReviewAt above for why this is UTC-day-of-month based
    // rather than per-device local time like daily-log.
    const nowDateUTC = new Date(now);
    const monthlyReviewKey = monthKeyFromMs(Date.UTC(nowDateUTC.getUTCFullYear(), nowDateUTC.getUTCMonth() - 1, 1));
    const monthlyReviewDue = nowDateUTC.getUTCDate() <= 3 && notified.monthlyReview !== monthlyReviewKey;

    let tag = null, title = null, bodyText = null, url = "./";
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
    } else if (monthlyReviewDue) {
      // Deliberately generic -- this backend never sees anyone's actual
      // transactions, so it can't say what last month looked like. The
      // real numbers render on-device, from on-device data, the moment
      // this is tapped (see handleMonthlyReviewShortcut() in index.html,
      // which this exact url triggers).
      tag = "monthlyReview";
      title = "Your monthly review is ready";
      bodyText = "See how last month went vs your budget.";
      url = "./?review=1";
    }
    if (!title) {
      // Nothing to send THIS run (e.g. the bill that made this device
      // "due" got paid since) — re-index from the current record so it
      // isn't fetched again for nothing before it's genuinely due.
      await updateDueIndex(id, rec.summary, notified);
      return;
    }

    try {
      const noPrefixTags = tag === "dailyLogNight" || tag === "dailyLogMorning" || tag === "monthlyReview";
      await webpush.sendNotification(rec.subscription, JSON.stringify({
        title: noPrefixTags ? title : `FexaFY — ${title}`,
        body: bodyText,
        tag,
        url
      }));
      sent++;
      // Bills/budget stamp the shared UTC "today"; the two daily-log tags
      // stamp THIS device's own local date, so each resets at this
      // person's actual midnight, not the server's; monthly-review stamps
      // the "YYYY-MM" of the month just reviewed, so it only fires once
      // per month regardless of how many times the 1st-3rd window is hit.
      const stampDate = (tag === "dailyLogNight" || tag === "dailyLogMorning") ? dailyLogLocalToday
        : (tag === "monthlyReview") ? monthlyReviewKey
        : today;
      const newNotified = { ...notified, [tag]: stampDate };
      // A send that actually worked proves this subscription is
      // real — clear any accumulated failCount so a one-off bad
      // patch earlier doesn't still count against it.
      await redis.set(key, { ...rec, notified: newNotified, failCount: 0 });
      await updateDueIndex(id, rec.summary, newNotified);
    } catch (err) {
      // 404/410 means the browser subscription is gone (uninstalled, etc.) — clean it up immediately, same as before.
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await redis.del(key);
        try { await redis.zrem(DUE_KEY, id); } catch (e) {}
        removed++;
        return;
      }
      // Any other failure (malformed keys, a push service that's
      // permanently erroring, etc.) — this is the record a fake or
      // never-actually-valid subscription leaves behind. Count it
      // and retire the record once it's failed too many times in a
      // row, instead of letting it sit in Redis forever.
      const failCount = (Number(rec.failCount) || 0) + 1;
      if (failCount >= FAIL_THRESHOLD) {
        await redis.del(key);
        try { await redis.zrem(DUE_KEY, id); } catch (e) {}
        retired++;
      } else {
        await redis.set(key, { ...rec, failCount });
        // Score deliberately left untouched — a still-failing device
        // stays due and gets retried every run, same cadence as before
        // this change, until it succeeds or hits FAIL_THRESHOLD above.
      }
    }
  }

  // ---- Once a day: full scan to (re)build the index from scratch. ----
  // Runs on the first invocation after a new UTC date (including the
  // very first deploy of this change, when RECONCILE_KEY doesn't exist
  // yet) — this is what picks up devices registered before the index
  // existed, and self-heals any drift in the scheduling math above.
  let reconciled = false;
  const lastReconcile = await redis.get(RECONCILE_KEY);
  if (lastReconcile !== today) {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: KEY_PREFIX + "*", count: 100 });
      cursor = nextCursor;
      for (const key of keys) {
        await processDevice(key.slice(KEY_PREFIX.length));
      }
    } while (cursor !== "0");
    await redis.set(RECONCILE_KEY, today);
    reconciled = true;
  }

  // ---- Every other run: only fetch devices the index says are due now. ----
  if (!reconciled) {
    try {
      let offset = 0;
      for (;;) {
        const ids = await redis.zrange(DUE_KEY, 0, now, { byScore: true, offset, count: DUE_PAGE_SIZE });
        for (const id of ids) await processDevice(id);
        if (ids.length < DUE_PAGE_SIZE) break;
        offset += DUE_PAGE_SIZE;
      }
    } catch (e) {
      // The index lookup itself failed (e.g. a transient Redis hiccup or
      // an unexpected API response) — fail safe by scanning everything
      // for this one run instead, exactly like every run used to work
      // before this change, rather than silently sending nothing.
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: KEY_PREFIX + "*", count: 100 });
        cursor = nextCursor;
        for (const key of keys) await processDevice(key.slice(KEY_PREFIX.length));
      } while (cursor !== "0");
    }
  }

  return res.status(200).json({ checked, sent, removed, retired, locked, reconciled, at: today });
}
