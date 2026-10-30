#!/usr/bin/env node
// Pre-release secret check:  node scripts/check-secrets.mjs <folder-to-scan> [more folders/files...]
// Fails (exit 1) if anything that looks like a REAL secret is about to be published.
// Public-by-design values (Google OAuth Client ID, VAPID *public* key, Plus *public* key, Sentry DSN) are allowed.
import fs from "fs";
import path from "path";

const RULES = [
  ["Private JWK (has a private 'd' value)", /"d"\s*:\s*"[A-Za-z0-9_-]{30,}"/],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ["Google API key (AIza...)", /AIza[0-9A-Za-z_-]{30,}/],
  ["Google OAuth client SECRET (GOCSPX-...)", /GOCSPX-[A-Za-z0-9_-]{20,}/],
  ["OpenAI/Anthropic style secret key", /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Stripe secret key", /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["Upstash/Redis REST token assigned in code", /(?:UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN)\s*[:=]\s*["'][A-Za-z0-9=_-]{20,}["']/],
  ["Env secret assigned a literal value", /(?:PLUS_PRIVATE_JWK|ID_PEPPER|VAPID_PRIVATE_KEY|CRON_SECRET)\s*[:=]\s*["'][^"'\s]{16,}["']/],
  ["Password/secret/token literal", /(?:secret|passwd|password|private_?key)\s*[:=]\s*["'][A-Za-z0-9+\/=_-]{20,}["']/i]
];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const MAX = 20 * 1024 * 1024;
const hits = [];

function scanFile(f) {
  let st; try { st = fs.statSync(f); } catch (e) { return; }
  if (!st.isFile() || st.size > MAX) return;
  if (/\.(png|jpg|jpeg|gif|ico|webp|woff2?|zip|wasm)$/i.test(f)) return;
  let txt; try { txt = fs.readFileSync(f, "utf8"); } catch (e) { return; }
  if (/(^|\/)(VERCEL-PASTE-SHEET-PRIVATE|\.env)/.test(f)) hits.push([f, "Private/env file must never be published", 0]);
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].length > 4000 ? lines[i].slice(0, 4000) : lines[i];
    for (const [name, re] of RULES) if (re.test(line)) hits.push([f, name, i + 1]);
  }
}
function walk(p) {
  let st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { for (const n of fs.readdirSync(p)) if (!SKIP_DIRS.has(n)) walk(path.join(p, n)); }
  else scanFile(p);
}
const targets = process.argv.slice(2);
if (!targets.length) { console.error("usage: check-secrets.mjs <folder|file> ..."); process.exit(2); }
targets.forEach(walk);
if (hits.length) {
  console.error("\nSECRET CHECK FAILED — do NOT publish:\n");
  hits.forEach(([f, n, l]) => console.error(`  ${f}${l ? ":" + l : ""}  ${n}`));
  process.exit(1);
}
console.log("Secret check passed: nothing that looks like a private key or token.");
