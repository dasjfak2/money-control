// Backend: (1) CORS preflight really works in a browser (old vs new register.js), (2) real check.js -> real web-push -> fake push service, payload decrypted
// usage: node v144_backend_test.mjs <register.js> <check.js> <old-register.js>
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import http from 'http'; import https from 'https'; import { pathToFileURL } from 'url'; import { execSync } from 'child_process';
import { chromium } from 'playwright';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const here = path.dirname(new URL(import.meta.url).pathname);
const WP = pathToFileURL(path.join(here, 'bk/node_modules/web-push/src/index.js')).href;
const webpush = (await import(WP)).default;
let f = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
const [regPath, chkPath, oldRegPath] = process.argv.slice(2).map(p => path.resolve(p));

// ---- in-memory redis ----
const kv = new Map(), zs = new Map();
globalThis.__R = { fromEnv: () => ({
  async get(k) { return kv.has(k) ? JSON.parse(kv.get(k)) : null; }, async set(k, v) { kv.set(k, JSON.stringify(v)); return 'OK'; }, async del(k) { kv.delete(k); },
  async incr(k) { const v = (+kv.get(k) || 0) + 1; kv.set(k, String(v)); return v; }, async expire() {},
  async zadd(k, { score, member }) { zs.set(member, score); }, async zrem(k, m) { zs.delete(m); },
  async zrange(k, a, b, o) { const ids = [...zs.entries()].filter(([, s]) => s <= b).map(([m]) => m); return ids.slice(o.offset || 0, (o.offset || 0) + o.count); },
  async scan(c, o) { const pre = o.match.replace('*', ''); return ['0', [...kv.keys()].filter(x => x.startsWith(pre))]; } }) };
globalThis.__W = webpush; // the REAL library
const tmp = fs.mkdtempSync(path.join(here, 'bk', 'run-'));
const load = (src, name) => { const s = fs.readFileSync(src, 'utf8').replace('import { Redis } from "@upstash/redis";', 'const Redis = globalThis.__R;').replace('import webpush from "web-push";', 'const webpush = globalThis.__W;'); const o = path.join(tmp, name); fs.writeFileSync(o, s); return import(pathToFileURL(o).href + '?' + Math.random()); };

// ---- VAPID + env ----
const vapid = webpush.generateVAPIDKeys();
const ORIGIN_PAGE_PORT = 41731, API_PORT = 41732;
const ORIGIN = `http://localhost:${ORIGIN_PAGE_PORT}`;
process.env.VAPID_PUBLIC_KEY = vapid.publicKey; process.env.VAPID_PRIVATE_KEY = vapid.privateKey; process.env.VAPID_SUBJECT = 'mailto:owner@example.org';
const CRON = crypto.randomBytes(12).toString('hex'); process.env.CRON_SECRET = CRON; process.env.PLUS_ALLOWED_ORIGIN = ORIGIN;
const regNew = (await load(regPath, 'register_new.js')).default;
const regOld = (await load(oldRegPath, 'register_old.js')).default;
const chk = (await load(chkPath, 'check.js')).default;

// ---- tiny vercel-like adapter ----
let current = regNew;
const api = http.createServer(async (req, res) => {
  let raw = ''; for await (const c of req) raw += c;
  const r = Object.assign(req, { body: raw, query: {} });
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  try { await current(r, res); } catch (e) { res.statusCode = 500; res.end(String(e)); }
}).listen(API_PORT);
const page = http.createServer((q, s) => { s.setHeader('Content-Type', 'text/html'); s.end('<!doctype html><title>x</title>'); }).listen(ORIGIN_PAGE_PORT);

// ---- browser: real cross-origin fetch exactly like the app does ----
const b = await chromium.launch({ args: ['--no-sandbox'] });
const subscription = (endpoint) => { const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const auth = crypto.randomBytes(16); return { sub: { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } }, ecdh, auth }; };
const probe = async (origin, label) => {
  const p = await (await b.newContext()).newPage(); await p.goto(origin);
  const r = await p.evaluate(async (url) => { try { const x = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'device-abcdef12', subscription: { endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }, summary: { bills: [], budgetOver: false, dailyLog: { enabled: false } } }) }); return { status: x.status, body: await x.json() }; } catch (e) { return { err: e.name + ': ' + e.message }; } }, `http://localhost:${API_PORT}/api/register`);
  await p.context().close(); return r;
};
current = regOld; let r = await probe(ORIGIN, 'old');
ok(!!r.err, 'OLD register.js: browser blocks the cross-origin request (' + (r.err || JSON.stringify(r)) + ')  <- the real cause of "Failed to fetch"');
current = regNew; kv.clear(); zs.clear(); r = await probe(ORIGIN, 'new');
ok(r.status === 200 && r.body.deviceId === 'device-abcdef12', 'NEW register.js: same request from the allowed origin succeeds: ' + JSON.stringify(r));
ok(kv.has('fexafy:device:device-abcdef12'), 'device record was stored');
// origin lock: another origin is still blocked
const other = http.createServer((q, s) => { s.setHeader('Content-Type', 'text/html'); s.end('<!doctype html><title>y</title>'); }).listen(41733);
r = await probe('http://localhost:41733', 'other'); ok(!!r.err, 'a different origin is still blocked (no wildcard): ' + (r.err || ''));
// preflight response shape
const pre = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
ok(pre.status === 204 && pre.headers.get('access-control-allow-origin') === ORIGIN && /POST/.test(pre.headers.get('access-control-allow-methods')) && /content-type/i.test(pre.headers.get('access-control-allow-headers')), 'preflight: 204 + exact-origin allow headers');
const pre2 = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
ok(pre2.status === 204 && !pre2.headers.get('access-control-allow-origin'), 'preflight from unknown origin gets no allow header');
const g = await fetch(`http://localhost:${API_PORT}/api/register`); ok(g.status === 405, 'GET is still 405');
const saved = process.env.PLUS_ALLOWED_ORIGIN; delete process.env.PLUS_ALLOWED_ORIGIN;
const pre3 = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'OPTIONS', headers: { Origin: ORIGIN } }); ok(!pre3.headers.get('access-control-allow-origin'), 'env var unset -> no CORS header at all (fails closed)');
process.env.PLUS_ALLOWED_ORIGIN = saved;
// validation / unsubscribe still behave
let bad = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: { endpoint: 'http://x', keys: {} } }) }); ok(bad.status === 400, 'invalid subscription still rejected (400)');
let un = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'device-abcdef12', subscription: null }) }); ok((await un.json()).removed === true && !kv.has('fexafy:device:device-abcdef12'), 'unsubscribe still removes the record');

// ---- end-to-end delivery: register a REAL subscription -> cron check.js -> real web-push -> fake push service ----
fs.writeFileSync(path.join(tmp, 'k.pem'), execSync('openssl genrsa 2048 2>/dev/null'));
execSync(`openssl req -new -x509 -key ${tmp}/k.pem -out ${tmp}/c.pem -days 1 -subj /CN=localhost 2>/dev/null`);
const got = [];
const push = https.createServer({ key: fs.readFileSync(path.join(tmp, 'k.pem')), cert: fs.readFileSync(path.join(tmp, 'c.pem')) }, async (q, s) => {
  const chunks = []; for await (const c of q) chunks.push(c); got.push({ url: q.url, h: q.headers, body: Buffer.concat(chunks) });
  if (q.url.startsWith('/gone')) { s.statusCode = 410; return s.end(); } s.statusCode = 201; s.end();
}).listen(41734);
const sb = subscription('https://localhost:41734/send/abc');
const today = new Date().toISOString().slice(0, 10);
const reg1 = await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ deviceId: 'dev-e2e-0001', subscription: sb.sub, summary: { bills: [{ name: 'Rent', amount: 5000, due: today }], budgetOver: false, dailyLog: { enabled: false } } }) });
ok(reg1.status === 200, 'register real subscription: 200');
const call = async (secret) => { let code, json; const rq = { query: secret ? { secret } : {}, headers: {} }; const rs = { status(c) { code = c; return this; }, json(o) { json = o; return this; } }; await chk(rq, rs); return { code, json }; };
let c0 = await call('wrong'); ok(c0.code === 401, 'cron endpoint rejects a wrong secret');
const c1 = await call(CRON); ok(c1.code === 200 && c1.json.sent >= 1, 'cron run sends >=1 push: ' + JSON.stringify(c1.json));
const hit = got.find(x => x.url === '/send/abc'); ok(!!hit, 'fake push service received the request');
ok(hit && /^vapid t=.+, k=.+/.test(hit.h.authorization || ''), 'request carries VAPID Authorization');
ok(hit && hit.h['content-encoding'] === 'aes128gcm' && hit.body.length > 0, 'payload is aes128gcm-encrypted');
// decrypt per RFC 8291 to prove what the service worker will really receive
function decrypt(body, ecdh, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const uaPub = ecdh.getPublicKey(); const secret = ecdh.computeSecret(asPub);
  const hk = (s, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, len));
  const ikm = hk(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); let i = pt.length - 1; while (pt[i] === 0) i--; return pt.subarray(0, i).toString('utf8');
}
let payload = null; try { payload = JSON.parse(decrypt(hit.body, sb.ecdh, sb.auth)); } catch (e) { payload = { err: e.message }; }
ok(payload && payload.title === 'FexaFY — Bill due' && /Rent \(5000\)/.test(payload.body) && payload.tag === 'bills', 'decrypted payload is exactly what sw.js shows: ' + JSON.stringify(payload));
const c2 = await call(CRON); ok(c2.json.sent === 0, 'second run same day does not repeat the notification');
// dead subscription (410) is cleaned up
const sc = subscription('https://localhost:41734/gone/1');
await fetch(`http://localhost:${API_PORT}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'dev-gone-0001', subscription: sc.sub, summary: { bills: [{ name: 'X', amount: 1, due: today }], budgetOver: false, dailyLog: { enabled: false } } }) });
const c3 = await call(CRON); ok(c3.json.removed >= 1 && !kv.has('fexafy:device:dev-gone-0001'), 'expired subscription (410) is deleted: ' + JSON.stringify(c3.json));
console.log('FAILS ' + f); push.close(); api.close(); page.close(); other.close(); await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(f ? 1 : 0);
