# FexaFY — Security rules (read before adding ANY API / key / paid service)

## 1. What may live in the app code (index.html, sw.js) — it is PUBLIC
Allowed (public by design): Google OAuth *Client ID*, VAPID *public* key, Plus *public* verify key, Sentry DSN, API URLs.
**Never** in app code or this repo: private keys, client *secrets*, API keys that cost money or can read data, database tokens, passwords, pepper/salt values.
Hiding or "obfuscating" a key in JavaScript does NOT protect it — anyone can read it in the browser.

## 2. How to use a real/secret API key (the pattern to follow every time)
1. Keep the key only in **Vercel → Project → Settings → Environment Variables** (mark *Sensitive*). Code reads `process.env.NAME`.
2. The app calls **our own Vercel endpoint**; the endpoint calls the paid API. The key never reaches the browser.
3. Every such endpoint must have ALL of these:
   - **Who is calling:** require the signed-in user's Google token (verify `aud` = our Client ID) — see `entitlement.js`.
   - **Origin lock:** CORS allows only `https://dasjfak2.github.io` (`PLUS_ALLOWED_ORIGIN`).
   - **Rate limit:** per-IP and per-user (Redis counter), small numbers, short window.
   - **Hard caps:** max request size, max items, max tokens/seconds; reject anything else.
   - **Budget guard:** a daily/monthly spend limit set in the provider dashboard AND an alert email.
   - **Least privilege:** a restricted key (only the one API, only needed scopes); separate keys for test and live.
   - **No secrets in logs or error messages.**
4. If a key must be used in the browser (rare): make it a *restricted* key (HTTP-referrer = our site only, only the one API enabled, quota capped).
5. Payments: verify purchases **on the server** (Google Play Developer API / SSLCommerz IPN). Never trust the app's word that someone paid.

## 3. Before every release
```
node push-backend/scripts/check-secrets.mjs .
```
It must print "Secret check passed". Never upload `VERCEL-PASTE-SHEET-PRIVATE.txt` or any `.env`.

## 4. If a secret is ever exposed
Rotate it immediately (new key in the provider dashboard → update Vercel env var → redeploy), then delete the old one. Removing it from GitHub is NOT enough — assume it was copied.

## 5. One-time settings YOU do in the dashboards
- **Google Cloud Console → APIs & Services → Credentials → your OAuth client:** Authorized JavaScript origins = only `https://dasjfak2.github.io`. Remove anything else.
- **GitHub → repo → Settings → Code security:** turn ON *Secret scanning* and *Push protection*.
- **Sentry → Project Settings → Client Keys (DSN) / Security & Privacy:** set *Allowed Domains*, a rate limit on the key, and enable spam/inbound filters. (Or leave the DSN empty to keep crash reports local.)
- **Vercel → Settings → Billing / Spend Management:** set a spend limit + alert. Mark env vars as *Sensitive*.
- **Upstash → database:** set usage/budget alerts.
- **Before taking payments:** rotate the Plus signing key (new `PLUS_PRIVATE_JWK` + new public key in index.html).

## 6. Built-in protections already in the backend
Per-IP rate limits (`register` 15/min, `entitlement` 20/min), CORS origin lock on `entitlement`, `CRON_SECRET` on `check`, signed Plus tokens (ECDSA P-256),
constant-time secret compares, payload size/shape validation, and (since v118) push device records auto-expire after 90 days without a refresh.
