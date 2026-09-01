MONEY CONTROL - PERSONAL FINANCE APP
=====================================

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

Note: style.css and app.js in this folder are earlier, non-updated
copies kept only for reference — the app itself now runs entirely from
the code embedded inside index.html. Edit index.html for any changes.

WHAT'S NEW IN THIS VERSION
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
- Dashboard with reminders and monthly goal charts
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
