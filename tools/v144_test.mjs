// Client side of push: honest result on toggle, status line, no behaviour change when it works
import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const FILE='file://'+path.resolve(process.argv[2]);
const ctx=await b.newContext(devices['Pixel 7']); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
await p.goto(FILE); await p.waitForTimeout(500);
await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.setup.configured=true; render();
  window.PushManager=window.PushManager||function(){};
  window.__subs=0; window.__subErr=null;
  const reg={pushManager:{ getSubscription:async()=>null, subscribe:async()=>{ if(window.__subErr){const e=new Error('x'); e.name=window.__subErr; throw e;} window.__subs++; return {toJSON:()=>({endpoint:'https://push.example/abc',keys:{p256dh:'p',auth:'a'}}),unsubscribe:async()=>true}; } }};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg)}});
  window.notifPermission=()=>"granted"; window.__fetchMode='ok'; window.__calls=0;
  window.fetch=async()=>{ window.__calls++; if(window.__fetchMode==='net') throw new TypeError('Failed to fetch'); if(window.__fetchMode==='500') return {ok:false,status:500,json:async()=>({})}; return {ok:true,status:200,json:async()=>({deviceId:'dev-12345678'})}; };
  window.__toast=[]; const o=window.showToast; window.showToast=(m)=>{window.__toast.push(m); return o&&o(m);};
  goToScreen('sync'); renderTruePushBlock(); });
const st=()=>p.evaluate(()=>({on:!!db.settings.notifTruePush,toast:window.__toast.slice(-1)[0],line:(document.getElementById('truePushStatus')||{}).innerText||null,chk:(document.getElementById('swTruePush')||{}).checked}));
const reset=()=>p.evaluate(()=>{window.__toast=[]; localStorage.removeItem('mc_push_status'); localStorage.removeItem('mc_push_fail_count'); localStorage.removeItem('mc_push_last_fail_ts'); db.settings.notifTruePush=false; renderTruePushBlock();});
// 1 success
await p.evaluate(()=>{window.__fetchMode='ok'; return toggleTruePush(true);}); await p.waitForTimeout(150);
let s=await st(); ok(s.on&&s.chk&&/enabled/.test(s.toast)&&/Last sync OK/.test(s.line),'server OK -> switch stays on, "enabled" toast, status "Last sync OK" :: '+JSON.stringify(s));
ok(await p.evaluate(()=>localStorage.getItem('mc_push_device_id')==='dev-12345678'),'device id stored');
// 2 server 500
await reset(); await p.evaluate(()=>{window.__fetchMode='500'; return toggleTruePush(true);}); await p.waitForTimeout(150);
s=await st(); ok(!s.on&&!s.chk&&/Couldn't turn on/.test(s.toast)&&/\(500\)/.test(s.toast),'server 500 -> switch reverts OFF, honest toast with code :: '+s.toast);
// 3 network/CORS failure
await reset(); await p.evaluate(()=>{window.__fetchMode='net'; return toggleTruePush(true);}); await p.waitForTimeout(150);
s=await st(); ok(!s.on&&/reach the push server/.test(s.toast),'network/CORS failure -> OFF + "couldn\'t reach the push server" :: '+s.toast);
// 4 permission blocked at subscribe
await reset(); await p.evaluate(()=>{window.__fetchMode='ok'; window.__subErr='NotAllowedError'; return toggleTruePush(true);}); await p.waitForTimeout(150);
s=await st(); ok(!s.on&&/permission is blocked/.test(s.toast),'subscribe NotAllowed -> OFF + permission message :: '+s.toast);
// 5 push service unreachable
await reset(); await p.evaluate(()=>{window.__subErr='AbortError'; return toggleTruePush(true);}); await p.waitForTimeout(150);
s=await st(); ok(!s.on&&/push service/.test(s.toast),'subscribe Abort -> OFF + push-service message :: '+s.toast);
// 6 recover after failure
await reset(); await p.evaluate(()=>{window.__subErr=null; window.__fetchMode='ok'; return toggleTruePush(true);}); await p.waitForTimeout(150);
s=await st(); ok(s.on&&/Last sync OK/.test(s.line),'works again after earlier failures');
// 7 automatic sync failure shows the line and keeps the switch on
await p.evaluate(()=>{window.__fetchMode='500'; localStorage.removeItem('mc_push_fail_count'); return syncTruePush(true);}); await p.waitForTimeout(100);
await p.evaluate(()=>renderTruePushBlock()); s=await st(); ok(s.on&&/Last sync failed/.test(s.line),'auto-sync failure shows "Last sync failed" but keeps the switch ON (retries later) :: '+s.line);
// 8 turning OFF
await p.evaluate(()=>{window.__fetchMode='ok'; return toggleTruePush(false);}); await p.waitForTimeout(100);
s=await st(); ok(!s.on&&/disabled/.test(s.toast)&&s.line===null,'turning OFF works, no status line when off');
// 9 offline automatic sync does nothing and does not report failure
await reset(); const c0=await p.evaluate(()=>window.__calls); await p.evaluate(()=>{ db.settings.notifTruePush=true; Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}); return syncTruePush(true); });
ok(await p.evaluate(()=>window.__calls)===c0&&await p.evaluate(()=>localStorage.getItem('mc_push_status'))===null,'offline auto-sync: no request, no false failure');
// layout
await p.evaluate(()=>{ Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true}); localStorage.setItem('mc_push_status',JSON.stringify({ok:false,t:Date.now(),reason:"the push server answered with an error (500)"})); db.settings.notifTruePush=true; renderTruePushBlock(); });
for(const th of ['light','dark']){ await p.evaluate((th)=>document.documentElement.setAttribute('data-theme',th),th); ok(await p.evaluate(()=>{ const r=document.getElementById('truePushStatus').getBoundingClientRect(); return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth+1; }),'status line fits ('+th+')'); }
ok(/^v14\d$/.test(await p.evaluate(()=>APP_VERSION)),'version v14x');
ok(p.errs.length===0,'no page errors '+p.errs);
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
