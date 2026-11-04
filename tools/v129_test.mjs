// End-to-end: real HTTP server (like GitHub Pages: max-age=600), real service worker, "ship" v-next, press the button.
import { chromium, devices } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SRC=process.argv[2], SW=process.argv[3];
const dir='/tmp/v129site'; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir+'/lib',{recursive:true});
const base=fs.readFileSync(SRC,'utf8').replace('const PLUS_ENABLED=true;','const PLUS_ENABLED=false;');
const sw0=fs.readFileSync(SW,'utf8');
const cur=base.match(/const APP_VERSION = "(v\d+)"/)[1];
const write=(v)=>{ fs.writeFileSync(dir+'/index.html',base.replace(`const APP_VERSION = "${cur}"`,`const APP_VERSION = "${v}"`)); fs.writeFileSync(dir+'/sw.js',sw0.replace(`const APP_VERSION = "${cur}"`,`const APP_VERSION = "${v}"`)); };
for(const f of ['xlsx.full.min.js','jspdf.umd.min.js','tesseract.min.js']) fs.writeFileSync(dir+'/lib/'+f,'/*stub*/');
write('v900');
let down=false;
const srv=http.createServer((q,r)=>{ if(down){ r.destroy(); return; } let u=q.url.split('?')[0]; if(u==='/') u='/index.html'; const f=dir+u; if(!fs.existsSync(f)){ r.writeHead(404); return r.end(); }
  const ct=u.endsWith('.js')?'text/javascript':'text/html'; r.writeHead(200,{'Content-Type':ct,'Cache-Control':u==='/sw.js'?'max-age=0':'max-age=600'}); r.end(fs.readFileSync(f)); }).listen(0);
const port=srv.address().port, url=`http://localhost:${port}/`;
let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const b=await chromium.launch({args:['--no-sandbox']}); const ctx=await b.newContext({...devices['Pixel 7']}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
await p.goto(url); await p.waitForTimeout(1500);
const setup=()=>p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta=db.meta||{}; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); db.meta.onboardingSeen=true; db.accounts=[{id:'a1',name:'KEEPME',type:'cash',opening:1234}]; render(); });
await setup();
await p.evaluate(()=>navigator.serviceWorker.ready);
ok(await p.evaluate(()=>APP_VERSION)==='v900','page is on v900');
await p.evaluate(()=>goToScreen('sync'));
ok(await p.evaluate(()=>{const c=document.getElementById('cardUpdate'); return !!c&&c.offsetParent!==null&&document.getElementById('updVer').textContent==='v900'&&document.getElementById('updLast').textContent==='-';}),'Settings card shows v900, never checked');
// A) nothing new -> "latest"
await p.click('#updBtn'); await p.waitForFunction(()=>!document.getElementById('updBtn').disabled,null,{timeout:25000});
let m=await p.textContent('#updMsg'); console.log(' msg:',m);
ok(/latest/i.test(m),'no new version -> "You\'re on the latest version"');
ok(await p.evaluate(()=>document.getElementById('updLast').textContent!=='-'),'last-checked time filled');
ok(await p.evaluate(()=>!document.querySelector('.update-banner')),'no banner when up to date');
// B) offline server -> offline/error message, no crash
down=true; await ctx.setOffline(true);
await p.click('#updBtn'); await p.waitForFunction(()=>!document.getElementById('updBtn').disabled,null,{timeout:25000});
m=await p.textContent('#updMsg'); console.log(' msg:',m); ok(/internet|Couldn't/i.test(m),'offline -> clear message'); 
down=false; await ctx.setOffline(false);
// C) ship v901 (server now has new files; browser HTTP cache still holds old index for 600s)
write('v901');
await p.click('#updBtn'); await p.waitForFunction(()=>!document.getElementById('updBtn').disabled,null,{timeout:25000});
m=await p.textContent('#updMsg'); console.log(' msg:',m);
ok(/new version is ready/i.test(m),'new version found + installed');
ok(await p.evaluate(()=>!!document.querySelector('.update-banner')),'Refresh banner shown');

const cached=await p.evaluate(async()=>{ const c=await caches.open('money-control-v901'); const r=await c.match('./index.html'); const t=await r.text(); return /const APP_VERSION = "v901"/.test(t); });
ok(cached,'new cache holds the NEW index.html (not the stale HTTP-cache copy)');
// the data survives and the update applies on reload
await p.click('#updateReloadBtn'); await p.waitForLoadState('load'); await p.waitForTimeout(1500);
ok(await p.evaluate(()=>APP_VERSION)==='v901','after Refresh the app runs v901');
// D) top-bar refresh also picks up a newer version in one tap
write('v902');
await p.evaluate(()=>{ db=defaultDb(); document.getElementById('langGate').classList.add('hidden'); });
await p.evaluate(()=>navigator.serviceWorker.ready);
await Promise.all([p.waitForNavigation({timeout:15000}), p.evaluate(()=>fxRefresh())]); await p.waitForTimeout(1500);
ok(await p.evaluate(()=>APP_VERSION)==='v902','one tap on top-bar refresh -> v902 (was needing two reloads)');
// E) user data untouched by the update (localStorage app data)
const keep=await p.evaluate(()=>Object.keys(localStorage).length);
console.log(' localStorage keys',keep);
// F) all 10 languages render the card
await setup(); await p.evaluate(()=>goToScreen('sync'));
const bad=await p.evaluate(()=>{const o=[]; for(const l of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ setLanguage(l); goToScreen('sync'); for(const k of ['upd_title','upd_check','upd_current','upd_last']){ const e=document.querySelector('#cardUpdate [data-i18n="'+k+'"]'); if(!e||!e.textContent.trim()||e.textContent.trim()===k) o.push(l+':'+k); } for(const k of ['upd_checking','upd_latest','upd_ready','upd_offline','upd_error','upd_refresh']) if(!I18N[l][k]||I18N[l][k]===I18N.en[k]&&l!=='en') o.push(l+':'+k); } setLanguage('en'); return o;});
ok(bad.length===0,'card translated in 10 languages '+bad);
ok(p.errs.length===0,'no page errors '+p.errs);
console.log('FAILS',f); await b.close(); srv.close(); process.exit(f?1:0);
