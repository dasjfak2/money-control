# FexaFY — Money Management Tracker

A single-file, installable Progressive Web App (PWA) for personal finance:
transactions, budgets, loan/deposit calculators, Zakat calculator, a
Bangladesh income-tax estimator, and a US income-tax estimator — all
running entirely on-device. No backend, no account, no data leaves the
browser (except the optional push-notification backend described below).

**Current version:** v127

## Running it

This app is a single HTML file. To use it:

1. Open `index.html` directly in a browser, **or**
2. Serve the folder with any static file server (needed for the service
   worker / "Add to Home Screen" install prompt to work), e.g.:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```
3. Open the served URL in a browser. On mobile, use "Add to Home Screen"
   (Android/Chrome) or "Add to Home Screen" from the Share sheet (iOS/Safari)
   to install it like a native app.

## Files

- `index.html` — the entire app (UI, styles, and logic all inlined). This is the **release build**: identical to the commented source except that comments are removed (proved by `tools/build-release.mjs`). Keep the commented source (`source/index.html`) wherever you edit.
- `sw.js` — the service worker: handles offline caching and is
  push-notification-ready. `APP_VERSION` in this file is kept in sync with
  the one inside `index.html`; bump both together when shipping a new
  version so installed devices pick up the update.
- `lib/` — Excel, PDF and receipt-scan libraries. They load only when a user
  opens those tools (keeps first load fast) and are cached for offline use by
  `sw.js`. Keep this folder next to `index.html`. The receipt scanner also
  needs the existing `tesseract/` folder (worker/core/language files).
- `push-backend/` — an optional, separate Node backend for sending real
  background push notifications (e.g. a monthly review reminder) even
  when the app is fully closed. Not required for the app to work; only
  needed if you want to wire up true background push.
- `changelogs/` — a dated changelog for every shipped change, in plain
  text, oldest to newest by filename.

## Versioning

`APP_VERSION` (a string like `"v106"`) lives in both `index.html` and
`sw.js`. When either file changes, bump this constant in **both** places
— the app uses it to detect and prompt users to refresh to the latest
cached version, and to tag any crash reports with the release they came
from.

## Notable features

- **Transactions, budgets, analytics** — core day-to-day tracking.
- **Loan EMI & Deposit (FDR/DPS) calculators.**
- **Zakat calculator** (Nisab-based).
- **Bangladesh income-tax estimator** — NBR's individual tax slabs.
- **US income-tax estimator** — federal + FICA + state + (NYC/Philadelphia)
  local tax, standard or itemized deductions, Child Tax Credit. Shown only
  for profiles with a `+1` country code. See
  `changelogs/CHANGELOG-2026-10-18-us-tax-estimator.txt` and
  `changelogs/CHANGELOG-2026-10-21-us-tax-validation-pass.txt` for how this
  was built and validated, and what simplifications are disclosed in-app.
- Bilingual UI: English and Bengali.
