# FexaFY — True Background Push, Free Setup (no card, anywhere)

This lets FexaFY notify you about due bills / over-budget even when the
app is **fully closed** — not just open in a tab. It's entirely
optional; the app works completely fine without it.

Three free services, no credit card on any of them:
- **Upstash** — tiny free Redis database, stores each device's push
  subscription and a small reminder summary (never your transactions,
  balances, or profile).
- **Vercel** — hosts two small serverless functions (`/api/register`,
  `/api/check`) on their free "Hobby" plan.
- **cron-job.org** — free scheduler that "wakes up" `/api/check` every
  15 minutes, since Vercel's own free-tier cron only runs once a day.

Total time: about 10 minutes.

---

## Step 1 — Put this folder on GitHub

Vercel deploys from a GitHub repo.
1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (public or private, either is fine) and
   upload the contents of this `push-backend/` folder to it — either
   by dragging the files into GitHub's web uploader, or with git:
   ```
   cd push-backend
   git init
   git add .
   git commit -m "FexaFY push backend"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   (`.env` is already git-ignored — never commit real secrets.)

## Step 2 — Create a free Upstash Redis database

1. Sign up at https://upstash.com (free, no card).
2. Create a database → Redis → any region close to you → Free tier.
3. Open the database → "REST API" section → copy the **UPSTASH_REDIS_REST_URL**
   and **UPSTASH_REDIS_REST_TOKEN** values. You'll paste these into Vercel next.

## Step 3 — Deploy to Vercel

1. Sign up / log in at https://vercel.com (you can use your GitHub
   account — free "Hobby" plan, no card).
2. "Add New… → Project" → import the GitHub repo from Step 1.
3. Before clicking Deploy, open "Environment Variables" and add:

   | Name | Value |
   |---|---|
   | `VAPID_PUBLIC_KEY` | `BOyZ8u2MRrwkJwLWIEJo1PR-N74a8PqqBO0vu4D3R5ZBhAxMkuGaI-NV_A2jbd_fn2VI10XwKbB4KQSPYjTxrig` |
   | `VAPID_PRIVATE_KEY` | `UG7HVogbRMa2sh1HPiCOUOrLnpTfEK0lpvGP8EYXlQA` |
   | `VAPID_SUBJECT` | `mailto:you@example.com` (put a real address you control — some push services contact it if something's wrong) |
   | `UPSTASH_REDIS_REST_URL` | *(from Step 2)* |
   | `UPSTASH_REDIS_REST_TOKEN` | *(from Step 2)* |
   | `CRON_SECRET` | `33b9bc1cca80a95e292e5fe14029ff97b4e6a139e18f148b` |

   The `VAPID_*` and `CRON_SECRET` values above were generated fresh,
   offline, specifically for you — they are real, usable values, not
   placeholders. They belong to no one else. You're free to swap them
   for your own instead (see the commands in `.env.example`) — just
   don't reuse the ones printed in any public copy of this guide once
   you've actually deployed with them.
4. Click **Deploy**. When it finishes, copy your project's URL, e.g.
   `https://fexafy-push-yourname.vercel.app`.

Your two endpoints are now:
- `https://fexafy-push-yourname.vercel.app/api/register`
- `https://fexafy-push-yourname.vercel.app/api/check`

## Step 4 — Set up the free 15-minute scheduler

1. Sign up at https://cron-job.org (free, no card).
2. Create a new cron job:
   - **URL:** `https://fexafy-push-yourname.vercel.app/api/check?secret=33b9bc1cca80a95e292e5fe14029ff97b4e6a139e18f148b`
     (use your own `CRON_SECRET` here if you changed it in Step 3)
   - **Schedule:** every 15 minutes
   - **Request method:** GET
3. Save it, then use cron-job.org's "Run now" / test button once to
   confirm it returns `{"checked":0,"sent":0,...}` (0 is correct —
   no devices are registered yet).

## Step 5 — Point the app at your backend

Open `index.html`, find the two constants near the comment
`TRUE BACKGROUND PUSH` (search for `PUSH_ENDPOINT`), and set:

```js
const PUSH_ENDPOINT = "https://fexafy-push-yourname.vercel.app/api/register";
const PUSH_VAPID_PUBLIC_KEY = "BOyZ8u2MRrwkJwLWIEJo1PR-N74a8PqqBO0vu4D3R5ZBhAxMkuGaI-NV_A2jbd_fn2VI10XwKbB4KQSPYjTxrig";
```

(use your own public key here if you generated a fresh pair). Save,
redeploy/re-host the app, then in the app go to **Account & Backup →
Notifications & Sound** and turn on **"Background push"**.

That's it. From then on: the app periodically sends your due bills +
budget flag to `/api/register`; cron-job.org pings `/api/check` every
15 minutes; if something's due and hasn't already been sent today,
`/api/check` sends a real push notification to your device, even if
FexaFY is completely closed.

---

## What data ever leaves your device for this feature

Only: a device push subscription (no name, email, or account — just
an endpoint the browser gives you) and a short list of *unpaid bill
names, amounts, and due dates*, plus a yes/no "over budget this
month" flag. Never transactions, account balances, net worth, or your
profile. See `privacy-policy.html` section 4.

## Turning it off later

Turn the "Background push" switch off in the app (this tells
`/api/register` to delete your subscription), or just stop paying
attention to it — Vercel, Upstash, and cron-job.org's free tiers cost
nothing either way. To fully tear it down: delete the Vercel project,
delete the Upstash database, and delete the cron-job.org job.
