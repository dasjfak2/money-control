FexaFY — Push-notification backend bundle
Generated: 2026-09-21

WHAT'S IN HERE
--------------
package.json     Dependencies (@upstash/redis, web-push)
register.js      /api/register — stores each device's push subscription
                 and a small summary (bills, budget-over, daily-log
                 reminder state). Called by the app whenever the
                 person toggles "Background push" on/off, or
                 periodically while it's open.
check.js         /api/check — the endpoint a free cron-job.org
                 scheduler calls every 15 minutes. Reads every stored
                 device, decides what's actually due (bill, over
                 budget, or the morning/night daily-log nudge), and
                 sends the push via web-push. Protected by a
                 CRON_SECRET so only your scheduler can call it.

WHAT CHANGED IN THIS ROUND (vs. what you originally uploaded)
-----------------------------------------------------------------
Both files were extended to also handle the daily add-transaction
reminder (morning/night) being deliverable even when the app is fully
closed — originally these two files only handled bills and
over-budget notifications. See the chat for the full before/after
diff and the 9 test scenarios (including negative UTC offsets and
day-boundary resets) run against this exact code before it was
handed over.

DEPLOYMENT REMINDER
--------------------
Both register.js and check.js need to be updated together — if only
one is deployed, the two sides of the daily-log feature won't agree
with each other (the client will start sending data the old check.js
doesn't know how to read, or vice versa).

This bundle intentionally does NOT include any .env file or secrets
(CRON_SECRET, VAPID_PRIVATE_KEY, Upstash credentials, etc.) — set
those directly in your Vercel project's environment variables, the
same way you already have them configured there.
