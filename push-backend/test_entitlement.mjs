import crypto from "crypto";
import { createHandler } from "./entitlement.js";
let fails = 0; const ck = (n, c, x = "") => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (x ? " " + x : "")); };
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const priv = privateKey.export({ format: "jwk" }), pub = publicKey.export({ format: "jwk" });
const store = new Map(), counters = new Map();
const redis = {
  async incr(k) { const v = (counters.get(k) || 0) + 1; counters.set(k, v); return v; },
  async expire() {},
  async set(k, v, o) { if (o && o.nx && store.has(k)) return null; store.set(k, JSON.stringify(v)); return "OK"; },
  async get(k) { return store.has(k) ? JSON.parse(store.get(k)) : null; }
};
const tokens = { boss: { aud: "CID", sub: "B1", email: "Owner@Me.com", email_verified: "true", expires_in: "3000" }, fake: { aud: "CID", sub: "B2", email: "owner@me.com", email_verified: "false", expires_in: "3000" }, good: { aud: "CID", sub: "SUBJECT_XYZ_42", email: "a@b.com", expires_in: "3000" }, other: { aud: "OTHER", sub: "9", expires_in: "3000" }, expired: { aud: "CID", sub: "5", expires_in: "0" } };
const fetchFn = async (url) => { const t = decodeURIComponent(url.split("access_token=")[1]); return tokens[t] ? { ok: true, json: async () => tokens[t] } : { ok: false, json: async () => ({}) }; };
let clock = 1_000_000_000_000;
const handler = createHandler({ redis, fetchFn, privateJwk: priv, clientId: "CID", pepper: "pep", allowedOrigin: "https://app.example", ownerEmails: [" owner@me.com "], now: () => clock });
const call = async (method, headers = {}) => { const r = { code: 0, h: {}, body: null, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; await handler({ method, headers: { origin: "https://app.example", ...headers } }, r); return r; };
// same verify logic as the client (WebCrypto, ieee-p1363)
async function verify(tok) { const [b, s] = tok.split("."); const u = x => new Uint8Array(Buffer.from(x, "base64url")); const key = await crypto.subtle.importKey("jwk", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]); return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, u(s), new TextEncoder().encode(b)); }

let r = await call("GET"); ck("GET -> 405", r.code === 405);
r = await call("OPTIONS"); ck("preflight 204 + CORS", r.code === 204 && r.h["Access-Control-Allow-Origin"] === "https://app.example");
r = await call("POST", { origin: "https://evil.example" }); ck("foreign origin -> 403", r.code === 403);
r = await call("POST"); ck("no token -> 401", r.code === 401);
r = await call("POST", { authorization: "Bearer nope" }); ck("unknown token -> 401", r.code === 401);
r = await call("POST", { authorization: "Bearer other" }); ck("wrong audience -> 401", r.code === 401);
r = await call("POST", { authorization: "Bearer expired" }); ck("expired google token -> 401", r.code === 401);
r = await call("POST", { authorization: "Bearer good" });
ck("first call -> 200 trial", r.code === 200 && r.body.plan === "trial" && r.body.trialStart === clock, JSON.stringify(r.body && { plan: r.body.plan }));
ck("token verifies with public key", await verify(r.body.token));
const first = r.body.trialStart;
const parts = r.body.token.split("."); const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[0], "base64url")), plan: "plus" })).toString("base64url") + "." + parts[1];
ck("tampered token rejected", !(await verify(tampered)));
clock += 3 * 86400000;
r = await call("POST", { authorization: "Bearer good" }); ck("later call keeps ORIGINAL trialStart (no restart)", r.body.trialStart === first);
clock += 10 * 86400000;
r = await call("POST", { authorization: "Bearer good" }); ck("after 13d still same trialStart (expired trial can't restart)", r.body.trialStart === first && r.body.plan === "trial");
const k = [...store.keys()].find(x => x.startsWith("fexafy:plus:"));
store.set(k, JSON.stringify({ trialStart: first, plan: "plus", expiry: clock + 5 * 86400000 }));
r = await call("POST", { authorization: "Bearer good" }); ck("plus plan -> plus + expiry", r.body.plan === "plus" && r.body.expiry === clock + 5 * 86400000);
store.set(k, JSON.stringify({ trialStart: first, plan: "plus", expiry: clock - 1000 }));
r = await call("POST", { authorization: "Bearer good" }); ck("lapsed plus -> trial/expired side", r.body.plan === "trial" && r.body.expiry === 0);
const stored = [...store.entries()].map(([a, b]) => a + b).join("");
ck("nothing identifying stored (no sub/email)", !stored.includes("SUBJECT_XYZ_42") && !stored.includes("a@b.com"), "");
ck("response has no email", !JSON.stringify(r.body).includes("a@b.com"));
// parallel first-time requests -> one trialStart
store.clear(); counters.clear(); clock += 1000; tokens.good.sub = "777";
const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => { clock += 1; return call("POST", { authorization: "Bearer good", "x-forwarded-for": "9.9.9." + i }); }));
ck("race: all 5 parallel callers get the same trialStart", new Set(rs.map(x => x.body.trialStart)).size === 1);
// rate limit
let last; for (let i = 0; i < 22; i++) last = await call("POST", { authorization: "Bearer good", "x-forwarded-for": "1.1.1.1" });
ck("rate limit -> 429", last.code === 429);
r = await call("POST", { authorization: "Bearer boss" });
ck("owner -> plus, owner flag, long expiry", r.body.plan === "plus" && r.body.owner === true && r.body.expiry > clock + 399 * 86400000);
const op = JSON.parse(Buffer.from(r.body.token.split(".")[0], "base64url"));
ck("owner token signed + owner claim", (await verify(r.body.token)) && op.owner === true);
ck("owner email not stored", ![...store.values()].join("").toLowerCase().includes("owner@me.com"));
r = await call("POST", { authorization: "Bearer fake" }); ck("unverified email never owner", r.body.owner === false && r.body.plan === "trial");
r = await call("POST", { authorization: "Bearer good" }); ck("normal user not owner", r.body.owner === false && !JSON.parse(Buffer.from(r.body.token.split(".")[0], "base64url")).owner);
console.log(fails ? "FAILS: " + fails : "ALL PASS");
