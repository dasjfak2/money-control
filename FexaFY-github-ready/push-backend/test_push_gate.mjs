// Integration test for the Plus push lock: runs the REAL register.js / check.js handlers against an in-memory Redis.
import fs from "fs"; import crypto from "crypto"; import path from "path"; import { pathToFileURL } from "url";
const here = path.dirname(new URL(import.meta.url).pathname);
const apiDir = process.env.API_DIR || here;                       // folder holding register.js + check.js
fs.mkdirSync(path.join(here, "_t"), { recursive: true });
const tmp = fs.mkdtempSync(path.join(here, "_t", "run-"));
// ---- in-memory Redis + fake web-push ----
const kv = new Map(), zs = new Map(), sent = [];
globalThis.__R = { fromEnv: () => ({
  async get(k){ return kv.has(k) ? JSON.parse(kv.get(k)) : null; },
  async set(k,v){ kv.set(k, JSON.stringify(v)); return "OK"; },
  async del(k){ kv.delete(k); },
  async incr(k){ const v=(+kv.get(k)||0)+1; kv.set(k,String(v)); return v; },
  async expire(){},
  async zadd(k,{score,member}){ zs.set(member,score); },
  async zrem(k,m){ zs.delete(m); },
  async zrange(k,a,b,o){ const ids=[...zs.entries()].filter(([,s])=>s<=b).map(([m])=>m); return ids.slice(o.offset||0,(o.offset||0)+o.count); },
  async scan(c,o){ const pre=o.match.replace("*",""); return ["0",[...kv.keys()].filter(x=>x.startsWith(pre))]; }
})};
globalThis.__W = { setVapidDetails(){}, async sendNotification(sub,payload){ sent.push({ep:sub.endpoint,payload:JSON.parse(payload)}); } };
for (const f of ["register.js","check.js"]) {
  let s = fs.readFileSync(path.join(apiDir,f),"utf8")
    .replace('import { Redis } from "@upstash/redis";','const Redis = globalThis.__R;')
    .replace('import webpush from "web-push";','const webpush = globalThis.__W;');
  fs.writeFileSync(path.join(tmp,f), s);
}
const reg = (await import(pathToFileURL(path.join(tmp,"register.js")))).default;
const chk = (await import(pathToFileURL(path.join(tmp,"check.js")))).default;
// ---- keys / tokens ----
const { privateKey } = crypto.generateKeyPairSync("ec",{namedCurve:"P-256"});
const other = crypto.generateKeyPairSync("ec",{namedCurve:"P-256"}).privateKey;
process.env.PLUS_PRIVATE_JWK = JSON.stringify(privateKey.export({format:"jwk"}));
process.env.CRON_SECRET = "s3cret"; process.env.VAPID_PUBLIC_KEY="x"; process.env.VAPID_PRIVATE_KEY="y";
const tok = (p,key=privateKey)=>{ const b=Buffer.from(JSON.stringify(p)).toString("base64url"); return b+"."+crypto.sign("sha256",Buffer.from(b),{key,dsaEncoding:"ieee-p1363"}).toString("base64url"); };
const D=86400000, now=Date.now();
let fails=0; const ck=(n,c,x="")=>{ if(!c)fails++; console.log((c?"PASS ":"FAIL ")+n+(x?" "+x:"")); };
const res=()=>({code:0,body:null,setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;return this;}});
let n=0;
async function register(id, token){
  const r=res();
  await reg({method:"POST",headers:{"x-forwarded-for":"7.7.7."+(++n)},body:{deviceId:id,plusToken:token,subscription:{endpoint:"https://push.example/"+id,keys:{p256dh:"a",auth:"b"}},summary:{bills:[{name:"Rent",amount:100,due:"2000-01-01"}],budgetOver:false}}},r);
  return r;
}
async function check(){ sent.length=0; const r=res(); await chk({query:{secret:"s3cret"},headers:{}},r); return {r,sent:[...sent]}; }
const pushedTo=(id)=>sent.some(x=>x.ep.endsWith(id));
async function scenario(id, token, enforce){
  process.env.PLUS_PUSH_ENFORCE = enforce ? "true":"false";
  await register(id, token);
  zs.set(id, 0); // due now
  const out = await check();
  return {pushed: out.sent.some(x=>x.ep.endsWith("/"+id)), locked: out.r.body.locked, inIndex: zs.has(id)};
}
const base={sub:"h1",iat:now,exp:now+D};
let r;
r=await scenario("dev-trial-ok", tok({...base,plan:"trial",trialStart:now-1*D,expiry:0}), true);
ck("enforce ON: active trial -> push sent", r.pushed);
r=await scenario("dev-trial-end", tok({...base,sub:"h2",plan:"trial",trialStart:now-10*D,expiry:0}), true);
ck("enforce ON: expired trial -> NO push, counted locked, dropped from index", !r.pushed && r.locked>=1 && !r.inIndex, JSON.stringify(r));
r=await scenario("dev-plus", tok({...base,sub:"h3",plan:"plus",trialStart:now-30*D,expiry:now+5*D}), true);
ck("enforce ON: paid plan -> push sent", r.pushed);
r=await scenario("dev-plus-lapsed", tok({...base,sub:"h4",plan:"plus",trialStart:now-30*D,expiry:now-1000}), true);
ck("enforce ON: lapsed plan -> NO push", !r.pushed);
r=await scenario("dev-forged", tok({...base,sub:"h5",plan:"plus",trialStart:now,expiry:now+9*D}, other), true);
ck("enforce ON: forged token -> no entitlement -> NO push", !r.pushed && !(await (async()=>JSON.parse(kv.get("fexafy:device:dev-forged")).ent)()));
r=await scenario("dev-notoken", undefined, true);
ck("enforce ON: no token -> NO push", !r.pushed);
r=await scenario("dev-notoken-off", undefined, false);
ck("enforce OFF: no token -> push sent (old behaviour unchanged)", r.pushed);
r=await scenario("dev-trial-end-off", tok({...base,sub:"h6",plan:"trial",trialStart:now-10*D,expiry:0}), false);
ck("enforce OFF: even expired trial still pushes (switch is off)", r.pushed);
// merge behaviour
await register("dev-merge", tok({...base,sub:"h7",plan:"plus",trialStart:now-30*D,expiry:now+5*D}));
await register("dev-merge", tok({...base,sub:"h7",plan:"trial",trialStart:now-30*D,expiry:0}));
let ent=JSON.parse(kv.get("fexafy:device:dev-merge")).ent;
ck("stale trial token does not downgrade a paid device", ent.plan==="plus" && ent.expiry>now, JSON.stringify(ent));
await register("dev-merge", tok({...base,sub:"h8",plan:"trial",trialStart:now,expiry:0}));
ent=JSON.parse(kv.get("fexafy:device:dev-merge")).ent;
ck("different account on same device replaces entitlement", ent.sub==="h8" && ent.plan==="trial");
await register("dev-merge", undefined);
ent=JSON.parse(kv.get("fexafy:device:dev-merge")).ent;
ck("registering without a token keeps the stored entitlement", ent && ent.sub==="h8");
const stored=[...kv.values()].join("");
ck("no email/personal data stored with devices", !/@/.test(stored.replace(/https:\/\/push\.example/g,"")) );
fs.rmSync(path.join(here,"_t"),{recursive:true,force:true});
console.log(fails?"FAILS: "+fails:"ALL PASS");
