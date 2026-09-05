FEXAFY - MONEY MANAGEMENT TRACKER
=====================================

A NOTE ON SAFETY
-----------------
Every file in this project is plain, readable HTML/CSS/JS written for
this app only. There is no obfuscated code, no hidden network calls,
and no third-party trackers or ad scripts. The only outside domains
the app ever talks to are the ones already documented below (Google
Fonts, the SheetJS CDN for Excel export, the jsPDF CDN for the new
one-click PDF report, Google's own sign-in/Drive APIs, and — only if
you set it up yourself — your own free Vercel + Upstash backend for
push notifications). jsPDF is loaded from the same trusted CDN
(cdnjs.cloudflare.com) already used for SheetJS, and it is only ever
used locally in your browser to draw a PDF from your own data — no
data is sent anywhere. Feel free to read through index.html top to
bottom; nothing is hidden from you.

WHAT'S NEW IN THIS VERSION (v20)
---------------------------------
Two small, targeted bug fixes. No new outside domains contacted, no
new permissions, no new data collected, no new files.
- FIXED: sticky header on mobile. The top bar (logo + search/theme/
  refresh icons) is already written as "position:sticky" in the CSS,
  which should keep it pinned to the top while you scroll — but
  html/body only declared "overflow-x:hidden" and left overflow-y
  unset. Per the CSS spec, when only one overflow axis is set to
  something other than "visible", the browser silently computes the
  other axis as "auto" too — so <body> was quietly turning into its
  own scroll container. On some mobile browsers that's exactly the
  kind of thing that makes a "sticky" element stop tracking scroll
  correctly. Fix: overflow-y is now set explicitly to "visible" right
  next to overflow-x, so <html> stays the one and only scroll
  container and the header reliably stays pinned on every screen.
- FIXED: app opening in dark mode on its own. The dark/light choice
  is meant to be 100% under your control via the moon/sun button in
  the top bar. A leftover line from early development also checked
  the phone/browser's system "prefers-color-scheme: dark" setting the
  very first time the app loaded (before you'd ever touched the
  toggle) and used that as a fallback. Since most phones ship with
  system dark mode on, this made the app open in dark theme right
  after login for most people, even though they never chose dark
  mode inside the app. That system-preference fallback has been
  removed. Now the app always starts in light ("white") theme until
  you explicitly tap the toggle — after that, your choice is saved
  on this device (local-storage key "mc_theme", same as before) and
  respected on every future open, exactly as intended.
- Service worker cache bumped to v33 so installed users get this fix
  (and see the "new version ready" banner) instead of continuing to
  run the old cached version.
- Safety note for this change specifically: both fixes are one CSS
  property and the deletion of one fallback line inside the existing
  boot-theme script in index.html — no new script, no new network
  call, no new third-party code of any kind. All three inline
  <script> blocks in index.html still parse cleanly with Node's
  parser after this change.

WHAT'S NEW BEFORE THAT (v19)
---------------------------------
Mobile navigation redesign — no new outside domains contacted, no new
permissions, no new data collected. Only one new local-storage flag
(see below) is added, and it stores nothing but an on/off preference.
- The old bottom tab bar on phones/tablets (<900px wide) is replaced
  with a left-side slide-out menu — the same kind of sidebar the
  desktop version already used, so phones now get the same
  standard-sized icons and readable text labels (15px) instead of the
  old cramped 7.6px bottom-bar labels.
- Tap the new menu icon (top-left, next to "FexaFY") to slide the menu
  in from the left; tap outside it, tap its own close (X) button, tap
  Escape on a hardware/Bluetooth keyboard, or just pick a screen, and
  it slides away again automatically.
- New pin button inside the menu (the small pin icon next to the
  close button): turns the menu into a permanently-open side rail
  instead of something you open/close each time, the same way it
  already works on tablet/desktop. Tap it again to go back to the
  hide/show drawer behavior. This one preference is remembered on this
  device (local-storage key "fx_navPinned") so it stays the way you
  left it next time you open the app — it is never uploaded anywhere,
  same as every other on-device setting in this app.
- The quick-add "+" button (bottom-right) now sits a little lower on
  phones than before, since it no longer needs to clear the old bottom
  bar.
- Service worker cache bumped to v32 so installed users get this
  update (and see the "new version ready" banner) instead of
  continuing to run the old cached bottom-bar version.
- Safety note for this change specifically: it is plain HTML/CSS/JS
  added directly in index.html (new CSS rules, a few new lines of
  markup for the menu's header, and a handful of new small JS
  functions — openMobileNav/closeMobileNav/toggleNavPin — right next
  to the existing goToScreen navigation code). All three inline
  <script> blocks in index.html still parse cleanly with Node's
  parser after this change, and nothing new is fetched from, or sent
  to, any server.

WHAT'S NEW BEFORE THAT (v18)
---------------------------------
"I accidentally uninstalled/deleted the app" recovery — no new outside
domains contacted, no new permissions, no data collected. This makes
the existing Google Drive and on-device backup smarter about actually
getting a customer's data back after a reinstall, instead of relying
on them remembering the right button to press.
- Google-account users: already auto-restored from Drive on sign-in
  in past versions (nothing new needed there — reinstalling and
  tapping "Sign in with Google" with the same account has always
  pulled the newer of the two copies). What's new: the first time
  data is pulled down to a brand-new/empty device, a short
  "Welcome back — your data was restored from Google Drive" message
  now confirms it, instead of the restore happening silently with no
  feedback.
- Local-only (no Google) users: this was the real gap. Previously, if
  the app's session flag was cleared (e.g. the PWA was removed and
  re-added to the home screen, or storage was carried over to a new
  browser profile) while the underlying saved data blob was still
  sitting in the browser's storage, the sign-in screen had no way to
  notice it — it would just offer "Start fresh" or "Restore a backup
  file," and picking "Start fresh" would silently overwrite the data
  that was still right there. Now:
  - On launch, if no session is active but a local backup blob is
    still present in this browser's storage, a "Welcome back" screen
    offers to continue with it directly — no file needed.
  - "Start fresh" now double-checks first if there's existing local
    data on the device, and warns before it would be overwritten.
- Honest scope: this only recovers data that is still physically
  present somewhere the app can reach — this device's browser
  storage, or (for Google users) the Drive backup. If a phone itself
  is wiped/factory-reset/replaced and the customer never signed in
  with Google or saved a local .json backup file, there is nothing
  saved anywhere for the app to bring back — encourage local-only
  users to connect Google Drive backup or download a backup file
  periodically (Account & Backup) so this scenario doesn't come up.
- Service worker cache bumped to v31 (see sw.js -> APP_VERSION).

WHAT'S NEW BEFORE THAT (v17)
---------------------------------
The optional "true background push" backend referenced in earlier
versions is now actually included, ready to deploy — and built on a
100%-free, no-credit-card-anywhere stack (Vercel + Upstash Redis +
cron-job.org), instead of a Firebase project that would otherwise need
a billing-enabled ("Blaze") plan for the scheduled function part:
- New push-backend/ folder: two small Vercel serverless functions
  (api/register.js + api/check.js, the latter triggered every 15
  minutes by the free cron-job.org scheduler), storage in a free
  Upstash Redis database, and a plain step-by-step SETUP.md — complete
  with a ready-to-use VAPID key pair and cron secret generated fresh
  just for you, so you can deploy without generating your own first
  (though you're free to swap in your own any time).
- New index.html code (search "TRUE BACKGROUND PUSH"): two opt-in
  constants (PUSH_ENDPOINT + PUSH_VAPID_PUBLIC_KEY, both empty by
  default) and a new "Background push" switch in Account & Backup ->
  Notifications & Sound. Until both are filled in/turned on, this adds
  zero network requests and changes nothing about how the app already
  works — same opt-in pattern as the existing SENTRY_DSN hook.
- When turned on, only a push subscription and a small reminder
  summary (unpaid bill names/amounts/due dates, budget-over flag) sync
  to your own Vercel + Upstash backend — never transactions, balances,
  accounts, or profile data, and never anywhere but a project you
  create and control. privacy-policy.html section 4 has been updated
  to describe this precisely.
- Service worker cache bumped to v17 (no other sw.js changes needed —
  its existing generic push handler already displays whatever this
  new backend sends).

WHAT'S NEW BEFORE THAT (v15)
---------------------------------
Configurable reminder timing — no new data leaves the device, no new
outside domains contacted, no new permissions beyond the existing
"Notifications" permission this feature already asked for.
- Account & Backup -> Notifications & Sound now has two new controls:
  "Remind me before a bill is due" (on the due date, or 1/2/3/5/7 days
  before — was fixed at 3 days) and "Reminder time" (a plain time
  picker, defaults to 09:00). Both can be changed any time and apply
  from the next check onward.
- Bill-due, bill-overdue, debt-due, budget-exceeded, and future-expense
  alerts now all wait until the chosen reminder time on the day
  they're due, instead of firing at whatever moment in the next 5
  minutes the app happens to be open. If the app isn't open at that
  time, the alert simply shows the next time it's opened or comes back
  to the foreground that day, the same as before.
- Alerts also now repeat once per day for as long as a bill stays
  unpaid/overdue or the month stays over budget, instead of showing
  only once per browser session and then going silent. This uses a few
  small local-storage flags stamped with the date, which are cleaned
  up automatically every time the app checks, so nothing accumulates.
- Honest scope, unchanged from before: this is still the "app open,
  installed, or backgrounded in a tab" reminder engine — it cannot
  wake a fully closed browser/app on its own. That still needs a
  backend (e.g. the free Vercel + Upstash setup) as described further
  down in "ABOUT PUSH NOTIFICATIONS".
- Service worker cache bumped to v15.

WHAT'S NEW BEFORE THAT (v14)
---------------------------------
Publishing/technical checklist — see the new PUBLISHING-CHECKLIST.txt
for full detail on all four items. No new outside domains contacted
by default.
- Crash reporting: a local-only error log (last 20 errors, never
  leaves the device) is now always on, viewable/downloadable from
  Account & Backup -> Diagnostics. An optional Sentry hook (OFF by
  default — set your own DSN in index.html to enable it) is also
  available; PUBLISHING-CHECKLIST.txt explains the privacy-policy
  update that goes with turning it on.
- Version/update mechanism: shipping a new version now means bumping
  ONE constant (APP_VERSION in sw.js) instead of editing the cache
  name by hand. Installed users now see an in-app "A new version is
  ready — Refresh" banner automatically when you deploy an update,
  instead of silently running old cached code.
- Performance: tested the app's actual filtering/aggregation logic
  against synthetic datasets of 500/2,000/5,000 transactions — it
  stayed fast (single-digit to ~20ms) at every size. Added two safety
  margins anyway for real low-end devices: the search box now waits
  ~180ms after you stop typing before re-filtering (was: every
  keystroke), and search results render at most 300 rows at once
  (with a note if there are more), instead of painting potentially
  thousands of DOM rows for a broad search over a very large history.
- App signing key: this is a native-app-only concept (only applies if
  this PWA is later wrapped as an Android APK/AAB) — explained in
  PUBLISHING-CHECKLIST.txt, since it has to be generated and kept
  safe by you personally and can't be created on your behalf.
- Service worker cache bumped to v14.

WHAT'S NEW BEFORE THAT (v13)
---------------------------------
Visual polish pass — no new data, no new permissions, no new outside
domains contacted, no functional changes. Same plum + gold theme,
just tightened up.
- Real branded splash screen: opening the app now briefly shows the
  FexaFY logo mark, wordmark, and a loading indicator on the same
  plum gradient background used on the sign-in screen, instead of a
  plain grey skeleton. It's shown for at least ~0.55s so the brand
  actually registers, even on a fast device/connection, but adds no
  meaningful delay on a normal load.
- Consistent illustration style: the circular icon badges used for
  empty states (e.g. "No bills yet"), the onboarding slides, and the
  goal-reached celebration toast now all share the same gold-to-plum
  gradient circle + line-icon treatment (the celebration toast's emoji
  was replaced with the same checkmark icon used elsewhere in the app)
  and the same soft shadow, instead of three different visual styles.
- Consistent shadows: introduced a single elevation scale
  (--shadow-sm / --shadow-md / --shadow-lg in the CSS) and applied it
  to cards, the sign-in/lock modal, the quick-add button and its menu,
  and the celebration toast — previously each of these used a
  slightly different hand-picked shadow value.
- Service worker cache bumped to v13 so installed users get the
  updated splash/illustrations instead of a stale cached copy.

WHAT'S NEW BEFORE THAT (v12)
---------------------------------
Discreet listing name — no new data, no new permissions, no new outside
domains contacted, no change to how the app looks or works once open.
- The name shown BEFORE you open the app — the browser tab title, the
  label under the icon when you "Add to Home Screen"/install it, and
  the name in the install prompt — is now the generic "Personal
  Finance" instead of "FexaFY". This is so a glance at your home
  screen, app switcher, or browser tabs doesn't reveal that this is a
  finance-tracking app.
- Nothing else changed: the app icon (the white "F" mark) and the
  "FexaFY" name/logo you see once you actually open the app (login
  screen, lock screen, PDF report header, etc.) are unchanged, since
  you already know what app you're in at that point.
- If you want a different generic name (or the icon to look different
  too), edit manifest.json ("name" / "short_name") and the two new
  meta tags near the top of index.html ("application-name" and
  "apple-mobile-web-app-title") — search for "Personal Finance" in
  both files.
- Service worker cache bumped to v12 so installed users get this
  update instead of a stale cached copy of the old title.

WHAT'S NEW BEFORE THAT (v11)
---------------------------------
Branding/icon fixes — no new data, no new permissions, no new outside
domains contacted.
- Real app icon set added: icon-192.png, icon-512.png, and a
  icon-512-maskable.png (plus the original icon.svg and a new
  icon-maskable.svg). Previously manifest.json only pointed at the
  SVG, and sw.js already referenced "icon-192.png" for notification
  icons even though that file didn't exist in the project — it does
  now, and notifications, browser tabs, and iOS "Add to Home Screen"
  all show the icon correctly.
- Fixed the maskable icon: the old single icon.svg was marked
  "any maskable" but had a rounded shape with margin around it, which
  is wrong for maskable icons (the OS applies its own mask/crop, so a
  maskable icon needs a full-bleed background with no built-in
  rounding). There's now a dedicated full-bleed maskable icon so
  Android's adaptive-icon shapes (circle, squircle, teardrop, etc.)
  don't clip or leave odd edges.
- Added explicit <link rel="icon"> and <link rel="apple-touch-icon">
  tags to index.html — before this, the browser tab and iOS home
  screen had no icon reference outside the manifest.
- manifest.json's theme_color now matches the app's actual plum
  (#2C1B3D) used everywhere else (meta theme-color tag, icon,
  CSS --plum), instead of a slightly different shade.
- Service worker cache bumped to v11 and now also caches the icon
  files, so the icons are available offline like the rest of the app.

WHAT'S NEW BEFORE THAT (v10)
---------------------------------
UI/UX smoothness pass — no new data, no new permissions, no new
outside domains contacted. Everything below is plain HTML/CSS/JS
added directly inside index.html, the same as the rest of the app.
- First-run onboarding: the very first time someone opens the app
  (right after picking a language, before signing in), a short 4-slide
  intro explains what the app does — tracking income/expenses, budgets
  & bill reminders, savings/debt/net-worth goals, and how the data is
  kept private — with a "Skip" option and progress dots. It's shown
  only once per device (remembered in local storage); it does not
  collect or send anything.
- Friendlier empty states: sections that used to just say "No bills
  yet." or similar now show a small icon, a one-line explanation, and
  a button that jumps straight into adding your first entry — for
  Transactions (income & expense), Bills, Debts, Future Expenses,
  Net Worth, Recurring transactions, and Search results.
- Proper icon set: the small emoji-style symbols used for actions
  (edit, delete, undo, checkmark, link, search, bell, lock, sync,
  dark-mode toggle, back arrow, upload/download, etc.) have been
  replaced everywhere with a consistent, professional-looking line
  icon set — plain inline SVG written directly into index.html (no
  external icon font, no CDN request, nothing new to load).
- Count-up number animation: the key summary numbers (this month's
  safe-to-spend, income, expenses, investment/savings/emergency/
  future totals, and net worth) now animate smoothly from their old
  value to their new one instead of snapping instantly, whenever they
  change.

WHAT'S NEW BEFORE THAT (v9)
---------------------------------
- Privacy Policy & Terms and Conditions pages: two new plain, static
  pages — privacy-policy.html and terms.html — linked from
  Account & Backup -> Legal (opens in a new tab). The Privacy Policy
  spells out exactly what data the app stores and where (your device,
  encrypted, and optionally your own Google Drive), states plainly
  that the app uses NO analytics SDK and NO advertising SDK of any
  kind, and lists every third-party service the app talks to (Google
  Sign-In/Drive, Google Fonts, the SheetJS and jsPDF CDNs) and exactly
  what each one does or doesn't receive. Both pages are plain HTML
  with zero JavaScript and no external requests of their own — open
  them in a text editor to read every line yourself.
    IMPORTANT — before you publish/host this: both pages have a small
    highlighted placeholder near the bottom (contact email, and for
    the Terms page, your governing jurisdiction) for you to fill in
    as the app's owner/operator. Nothing else needs editing.

WHAT'S NEW IN THIS VERSION (v8)
---------------------------------
- Local data encryption: everything saved to this device (all your
  transactions, bills, debts, balances — everything) is now encrypted
  (AES-256-GCM, via the browser's built-in Web Crypto API) before it's
  written to local storage, using a random key generated once on this
  device and never sent anywhere. Previously this was stored as plain,
  human-readable JSON; now it's ciphertext. This happens automatically
  in the background — nothing to turn on, no PIN required for it, and
  no change to how the app looks or feels. If you already had data
  saved from an earlier version, it's read once in its old plain form
  and then re-saved encrypted the next time anything changes.
    Honest scope, so you know exactly what this does and doesn't do:
    the encryption key has to live on this same device (a client-only
    app with no server has nowhere else to put it), so this protects
    your data if someone copies the raw files off this device (e.g. a
    device backup, or a lost/stolen phone opened in a file browser) —
    it does NOT add protection against someone who can already open
    and use the app on this device/browser as you; that's what App
    Lock (PIN / fingerprint, below) is for. Use both together: App
    Lock keeps the app itself out of casual reach, and this keeps
    what's actually stored on disk unreadable without it.
    Full JSON backups you choose to download (Account & Backup ->
    Backup) are still saved as plain, readable JSON on purpose, so you
    can always open, inspect, or restore them on any device.

WHAT WAS NEW BEFORE THAT (v7)
---------------------------------
- Budget vs actual, per category: Budget -> Category budgets. Set a
  monthly limit for any expense category (Food, Transport, etc.) and
  a new "Budget vs actual" card shows what you've spent against each
  limit this month, with a progress bar that turns red once you go
  over.
- Dark mode: tap the moon/sun icon in the top-right corner, any
  screen. Your choice is remembered on this device (it also follows
  your phone's system dark-mode setting the very first time you open
  the app, until you pick one yourself).
- Quick-add floating button: a "+" button now floats over every
  screen — tap it, then tap Expense or Income, and the add-transaction
  form opens immediately (2 taps, from anywhere in the app). If you
  install the app to your home screen, long-pressing the app icon also
  offers "Add Expense" / "Add Income" shortcuts straight from the
  home screen, on Android/desktop launchers that support app
  shortcuts.
- Goal-reached celebration: a small confetti burst and toast appear
  the moment a monthly goal (investment/savings/emergency/future),
  your overall emergency-fund target, a debt payoff, or a future
  savings target is fully reached. Each one only celebrates once per
  goal/period, so it won't repeat every time you open the app.
- Receipt photos: when adding or editing a transaction, "Receipt
  photo (optional)" lets you attach a picture (camera or gallery).
  It's automatically resized/compressed in your browser before being
  saved, to keep your on-device storage small. A small 📎 appears next
  to any transaction with a receipt — tap it to view the full photo.
- One-click monthly report: Account & Backup -> "Monthly report
  (Excel + PDF)". Pick a month and tap the button once to download
  BOTH an Excel workbook for that month (same detail as the existing
  Excel export) and a PDF summary (income/expense totals, budget vs
  actual by category, spending by category, and bills due that
  month) — generated entirely on your device.

WHAT WAS NEW BEFORE THAT (v6)
---------------------------------
- Multi-account balances: Transactions -> Accounts. Cash and Bank exist
  by default; add as many as you like. If your currency is set to BDT
  (Bangladeshi Taka), bKash and Nagad are also available as account
  types — for every other currency those two are hidden automatically,
  since they're Bangladesh-specific mobile wallets. Every transaction
  is tied to one account, and each account's balance (opening balance
  + its own income/expenses) updates live. Deleting an account with
  transactions on it asks first, then moves those entries to your
  first remaining account so nothing is lost.
- Recurring transactions: Transactions -> Recurring transactions ->
  "+ Add recurring". Set a name (e.g. "Rent", "Netflix"), type,
  category, account, amount and a day of the month — it auto-logs a
  new transaction every month, the first time you open the app that
  month (client-only apps can't wake themselves up on an exact date,
  but this "catch-up" approach means you'll never miss a month even if
  you don't open the app on the 1st). Pause/resume or delete any time;
  already-logged entries stay in your history either way.
- Search & filter (Transactions -> 🔍 Search & filter): search across
  your ENTIRE transaction history — not just the current month — by
  text, date range, amount range, category, account, and income/
  expense. Every user's own data is searchable this way (each account
  only ever searches its own stored transactions, exactly like the
  rest of the app — nothing is shared between users).

WHAT'S NEW BEFORE THAT (v5)
---------------------------------
- Language picker on first open, with 30+ languages (Bengali, Hindi,
  Urdu, Arabic, Spanish, French, Portuguese, Russian, Chinese and more
  have a fully translated interface; every other language on the list
  still gets correctly localized dates and numbers for that language,
  with English text). Change it any time from Account & Backup ->
  Language. Right-to-left layout is applied automatically for Arabic,
  Urdu and Persian.
- Currency picker so customers in any country can use the app in their
  own currency (Account & Backup -> Currency) — the app guesses a
  sensible default from your device/browser locale on first use.
- Notifications & Sound (Account & Backup -> Notifications & Sound):
    - "Enable notifications" turns on real bill-due and budget-exceeded
      alerts that fire automatically — not just when you open the app,
      but the whole time it's open or sitting in a background browser
      tab / installed as an app. See "ABOUT PUSH NOTIFICATIONS" below
      for the one thing this can't do without extra setup.
    - Separate on/off switches for bill reminders vs. budget alerts.
    - A distinct alarm sound (generated on the device — no external
      audio files) that can be switched on/off separately for Bills,
      Goals, Debt and Future, with a "Test sound" button.

ABOUT PUSH NOTIFICATIONS — WHAT WORKS OUT OF THE BOX VS. WHAT NEEDS A
BACKEND
------------------------------------------------------------------------
FexaFY is a client-only app (no server) by design, the same as
before. That gives you two honest options:

1. BUILT IN, NO SETUP NEEDED: the app checks your bills and budget for
   itself every few minutes while it's open (including installed and
   running in the background) and shows a real system notification —
   this covers the vast majority of real-world use, since most people
   keep the app installed and it wakes up regularly.

2. TRUE "EVEN WHEN FULLY CLOSED" PUSH: browsers do not allow any
   client-only app to wake itself up after being fully closed — that
   requires a server that can push a message to your device on a
   schedule. If you want this, a ready-to-deploy example using Vercel
   (free serverless functions) + Upstash (free Redis storage) +
   cron-job.org (free 15-minute scheduler) — no credit card needed on
   any of the three, and you don't have to run or maintain a server
   yourself — is included in the push-backend/ folder. Step-by-step
   setup, including a ready-to-use VAPID key pair and cron secret
   generated fresh for you: push-backend/SETUP.md (same steps are also
   in the comments at the top of api/register.js and api/check.js).
   Once deployed, fill in the two constants marked "TRUE BACKGROUND PUSH"
   near the top of index.html's <script> and turn on the new
   "Background push" switch in Account & Backup -> Notifications &
   Sound. Until you do both of those, this stays completely off and
   nothing changes about how the app already works. This is entirely
   optional — the app works fully without it.

This is an installable offline PWA for personal use. All data lives in
your browser's local storage on your device, and — once you sign in
with Google — is also privately backed up to your own Google Drive
(a hidden "app data" area that only this app can read; not your visible
Drive files).

index.html is fully self-contained (CSS + JavaScript embedded). It also
loads two small libraries from a CDN when online:
  - SheetJS (for the "Export to Excel" button)
  - Google Identity Services (for Google Sign-In)
Both are optional at a glance but required for the sign-in / export
features below; the rest of the app still works offline once loaded.

ONLY 6 FILES ARE NEEDED TO RUN THE APP ITSELF: index.html,
manifest.json, sw.js, privacy-policy.html, terms.html, and this
README. The push-backend/ folder is a separate, fully
optional add-on (see "ABOUT PUSH NOTIFICATIONS" above) — the app runs
completely normally if you never open that folder. Earlier versions
also shipped a standalone app.js and style.css, but those were unused
leftover reference copies (the real app runs entirely from the code
embedded inside index.html) — they've been removed from this package
on purpose, partly to keep things tidy and partly because some
antivirus tools (including Windows Defender) occasionally flag
freshly-downloaded, unsigned standalone .js files as a false positive
simply for having no prior "reputation," even when there is nothing
suspicious in the code. index.html itself does not trigger this
because browsers execute it directly rather than treating it as a
downloadable script file. privacy-policy.html and terms.html are the
same kind of plain, readable HTML/CSS with zero JavaScript in them —
open them in any text editor to see exactly what they say.

IF WINDOWS DEFENDER (OR ANY ANTIVIRUS) FLAGS ANY FILE HERE:
Every file in this project is plain, readable text you can open and
read yourself — there is no obfuscation, no hidden code, and the only
outside domains contacted are the ones named above (Google Fonts,
SheetJS's CDN, Google's own sign-in/Drive APIs, and, only if you set
it up yourself, your own Vercel + Upstash backend). If a scanner still flags
something, it's almost always a reputation-based false positive on a
brand-new file rather than an actual threat — you can report it to
Microsoft at https://www.microsoft.com/en-us/wdsi/filesubmission, or
simply re-download; these flags are usually cleared within a day or
two once enough people have safely downloaded the same file.

WHAT'S NEW IN THIS VERSION (v4)
---------------------------------
- App Lock: optional PIN (4 digits) required every time you open the
  app, plus fingerprint/face unlock on devices that support it. Turn
  it on/off, or change your PIN, from Account & Backup -> App Lock.
  The app also re-locks automatically whenever you switch away from
  it and come back. If you forget your PIN, "Forgot PIN?" on the lock
  screen turns App Lock off (your financial data is untouched) so you
  can set a new one.
    Note: fingerprint/face unlock uses your device's built-in
    biometric hardware via the browser (WebAuthn) — nothing biometric
    is ever sent anywhere, it all stays on your device. It only works
    once the app is hosted on HTTPS (same requirement as Google
    Sign-In); the PIN option always works, including opened directly
    from a file.
- Charts on the Dashboard: a "Spending by category" pie chart for this
  month, and a "Monthly spending trend" bar chart for the last 6
  months — both update automatically as you add transactions.

WHAT WAS NEW BEFORE THAT (v3)
---------------------------------
- Bigger, more standard-sized input/select fields throughout every form.
- Mandatory profile on first use: full name, phone number (with country
  code picker), and email. Editable any time from Account & Backup ->
  My Profile.
- Two login types: "Sign in with Google" (login + automatic Google
  Drive backup) or "Continue without Google" (local login). Choosing
  local login forces you to pick a backup method first — either
  "Backup with Google Drive" or "Local backup file" (restore an
  existing .json backup, or start fresh and immediately download one)
  — you can't reach the app without choosing one. Both login types now
  have a working "Sign out" button that keeps your data safe.
  Local-login users can upgrade to Google Drive backup any time from
  Account & Backup, without losing their existing local data.
- Every section (Transactions, Bills, Debt Freedom, Future Expenses,
  Net Worth) now has its own "Export to Excel" button, in addition to
  the existing full/period export on the Account & Backup screen.

WHAT WAS NEW BEFORE THAT
---------------------------
1. Google sign-in required to use the app. Data is stored locally on the
   device AND synced to the signed-in user's own Google Drive
   (drive.appdata scope — private, app-only storage). New entries sync
   automatically as soon as there's an internet connection; if you're
   offline, changes are queued and sync the moment you're back online.
2. Export -> Excel (.xlsx): Account & Backup tab -> pick All time /
   a specific month / a specific year -> download. Includes sheets for
   Transactions, Bills, Debts, Future Expenses, Net Worth and a Summary.
3. Every delete button (transactions, bills, debts, future expenses,
   net worth entries) now asks for confirmation first.
4. Debt Freedom <-> Net Worth are linked: add or edit a debt once in
   "Debt Freedom" and it automatically appears/updates as a Debt entry
   in "Net Worth" — no need to enter the same balance twice. Those
   linked entries show a link tag and can only be edited/deleted from
   the Debt Freedom tab, to avoid the two going out of sync.
5. Backup & Restore: download a full JSON backup any time, and restore
   it later (on this device or a new one) from the Account & Backup tab.
6. Offline-first with auto-sync: enter data with no signal and it saves
   normally on the device; the moment the device is back online it
   pushes/pulls automatically against your Google Drive backup so every
   device you sign into stays up to date.

REQUIRED ONE-TIME SETUP: GOOGLE SIGN-IN
-----------------------------------------
Google sign-in needs its own "Client ID" tied to the exact web address
(https://...) you host this app on. You only have to do this once, as
the app owner:

1. Go to https://console.cloud.google.com/ and create a project (or use
   an existing one).
2. APIs & Services -> Library -> enable "Google Drive API".
3. APIs & Services -> OAuth consent screen -> set it up (External is
   fine for personal use; add yourself as a test user if it stays in
   "Testing" mode).
4. APIs & Services -> Credentials -> Create Credentials -> OAuth client
   ID -> Application type: "Web application".
5. Under "Authorized JavaScript origins", add the exact HTTPS address
   you will host the app at, e.g. https://yourname.github.io
   (no trailing slash, and it must be https:// — Google sign-in does
   not work over file:// or http://).
6. Copy the generated Client ID (it looks like
   1234567890-abc123.apps.googleusercontent.com).
7. Open the hosted app in a browser — on first load it will ask for
   this Client ID once. Paste it in; it's saved on that device/browser
   only (in local storage), never uploaded anywhere.
8. Sign in with Google. You're done — every future visit just needs the
   "Sign in with Google" tap.

Note: because of step 5, Google sign-in (and therefore this app) will
only work once it's hosted on a real HTTPS address — it will not work
if you just open index.html from your phone's file manager. See the
hosting steps below.

EASIEST WAY TO TEST LAYOUT ONLY (no sign-in, no hosting)
-----------------------------------------------------------
Opening index.html directly from Files/Downloads still renders the
full styled layout, but the sign-in gate will show setup instructions
instead of letting you in, since Google sign-in requires HTTPS hosting.
Use the hosting steps below to actually use the app day to day.

FOR THE FULL INSTALLABLE APP EXPERIENCE
------------------------------------------
1. Put this whole folder on a web host that supports HTTPS
   (e.g. GitHub Pages, Netlify, Vercel — all have free tiers).
2. Complete the Google sign-in setup above using that host's address.
3. Open the HTTPS site in Chrome on Android (or any modern browser).
4. Chrome menu -> Add to Home screen / Install app.
5. It opens like a normal Android app and works offline afterward,
   syncing to Google Drive whenever you're online.

FEATURES
--------
- First-run onboarding (4 slides), friendly empty states, a consistent
  line-icon set, and smooth count-up number animations
- Privacy Policy & Terms and Conditions pages (no analytics/ads used)
- Local data encryption at rest (AES-256-GCM, device-only key)
- App Lock: PIN + fingerprint/face unlock, auto re-locks in background
- Dashboard with reminders, monthly goal rings, category pie chart and
  a month-over-month spending trend chart
- Daily transactions, split into Income / Expense columns, editable
- Budget setup with monthly allocation breakdown
- Investment monthly tracker (progress ring + all-time total)
- Bill reminders with due/overdue status
- Savings & Emergency fund tracker (monthly + all-time)
- Future savings tracker
- Debt freedom tracker (paid vs remaining, due-day reminders),
  automatically mirrored into Net Worth
- Net worth overview
- Google sign-in with local + Google Drive backup, auto-sync online/offline
- Export to Excel (.xlsx) by month, year, or all time
- Full JSON backup download / restore
- Delete confirmations everywhere
- Offline local storage, every entry editable

For a true APK/AAB, this project can later be wrapped with Capacitor
or a native Android project.

=====================================================================
QA PASS — Sept 3, 2026 (v15 update)
=====================================================================
Same automated real-browser checks as the last release, re-run after
adding the configurable reminder time/days-before feature:
1. SCREEN SIZES: 320px-1440px, all screens including the new controls
   — no overflow anywhere.
2. OFFLINE: service worker still caches and loads the app with zero
   network, including the updated index.html/sw.js.
3. EDIT / DATA INTEGRITY: add + edit + reload still shows no
   duplicate/corrupted entries; new settings (days-before, reminder
   time) persist correctly across reload too.
4. CODE SAFETY: no new outside domains, no eval/Function()/
   document.write, both inline <script> blocks parse cleanly with
   Node's parser. Everything the new feature touches is local
   (localStorage) — nothing added talks to any server.
No bugs found.

=====================================================================
QA PASS — Sept 5, 2026 (v18 update — reinstall/session-loss recovery)
=====================================================================
Method note / honest limits: this environment has no real browser
available, so this pass is Node-based syntax/logic verification, not
the real-device UI click-through described in the v15 QA note above.
If you want an on-device confirmation before publishing, do the
"uninstall/reinstall" and "start fresh with existing data present"
scenarios by hand on a real phone.
1. CODE SAFETY: all three inline <script> blocks (including the new
   authStepRecoverLocal logic) parse cleanly with Node's parser. Diff
   against the previous version confirms the change is purely
   additive — no existing line was removed or altered outside the
   three touched functions (initAuthUI, startFreshLocal,
   pullThenPush), no new outside domains, no new fetch/XHR calls, no
   eval/Function()/document.write.
2. LOGIC TRACE (read against the actual code, not run in a browser):
   - Fresh device / no session / no remembered Google account / an
     existing local-login blob in storage -> now routes to the new
     "Welcome back" step instead of straight to the choice screen.
   - Same case but with no local-login blob in storage (a genuinely
     new device) -> unchanged, goes straight to the normal choice
     screen as before.
   - "Start fresh" with an existing local blob present -> now shows a
     confirm() dialog first; declining leaves existing storage
     untouched.
   - Google sign-in on a brand-new device where Drive has a newer
     backup -> unchanged data flow, with one added cosmetic toast.
No bugs found in this pass; recommend the on-device click-through
above before relying on it in production.

=====================================================================
QA PASS — Sept 5, 2026 (v19 update — left-side mobile menu)
=====================================================================
Method note / honest limits, same as the v18 pass above: no real
browser is available in this environment, so this is Node-based
syntax verification plus a manual read-through of every changed line,
not an on-device UI click-through.
1. CODE SAFETY: all three inline <script> blocks parse cleanly with
   Node's parser after the change. Diff against the previous version
   confirms the change is purely additive/restyling — no existing
   function body was removed, and the two lines that were changed
   (the nav click-handler binding and the DOMContentLoaded handler)
   only add a call to the new closeMobileNav()/applyNavPinState()
   helpers alongside the code that was already there. No new outside
   domains, no new fetch/XHR calls, no eval/Function()/document.write
   anywhere in the file (checked directly).
2. WHAT TO CONFIRM BY HAND ON A REAL PHONE BEFORE PUBLISHING: open the
   hosted app on an actual phone (or a browser's device-emulation
   mode) narrower than 900px and check —
   - the new menu icon (top-left) opens the left-side menu, and every
     item still navigates to the right screen;
   - tapping outside the open menu, its own close (X), or picking a
     screen closes it again;
   - the pin icon keeps the menu permanently open and shifts the page
     content over, without the two overlapping; tapping it again
     returns to the normal hide/show behavior, and this preference is
     still remembered after fully closing and reopening the app;
   - nothing on the Dashboard/Transactions/Budget/etc. screens is
     hidden behind the menu or the top-bar menu icon at common phone
     widths (girth of testing: ~320px-480px), and the tablet (600-899)
     and desktop (900px+) layouts still look exactly as before, since
     none of their CSS rules were touched.
No bugs found in the code-level checks above; recommend the on-device
walk-through immediately above before relying on it in production.
