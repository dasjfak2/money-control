import { chromium, devices } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=process.argv[2]; let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const types={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,r)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/')) u+='index.html'; const fp=path.join(ROOT,u); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){ r.statusCode=404; return r.end('nf'); } r.setHeader('Content-Type',types[path.extname(fp)]||'application/octet-stream'); r.end(fs.readFileSync(fp)); }).listen(0);
const base='http://127.0.0.1:'+srv.address().port+'/';
const b=await chromium.launch({args:['--no-sandbox']}); const ctx=await b.newContext({...devices['Pixel 7'],serviceWorkers:'allow'}); const p=await ctx.newPage();
const reqs=[],errs=[],csp=[]; p.on('request',r=>reqs.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(/Refused to/.test(m.text())) csp.push(m.text().slice(0,160)); });
await p.goto(base,{waitUntil:'load'}); await p.waitForTimeout(1500);
await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); render(); document.getElementById('authGate').classList.add('hidden'); goToScreen('dashboard'); });
await p.waitForTimeout(800);
ok(/^v1[34]\d$/.test(await p.evaluate(()=>APP_VERSION)),'v133');
ok(!reqs.some(u=>/fonts\.(googleapis|gstatic)\.com/.test(u)),'no request to Google Fonts');
ok(['fraunces-latin','manrope-latin'].every(n=>reqs.some(u=>u.includes('/fonts/'+n+'.woff2'))),'latin font files requested from own origin');
ok(!csp.length&&!errs.length,'no CSP violations / page errors '+csp.concat(errs));
const loaded=await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/"/g,'')));
ok(loaded.includes('Fraunces')&&loaded.includes('Manrope'),'Fraunces + Manrope loaded: '+loaded);
ok(await p.evaluate(()=>{ const b=document.body; return [...document.querySelectorAll('h1,h2,h3,b')].some(e=>e.offsetParent!==null&&/Fraunces/.test(getComputedStyle(e).fontFamily))&&/Manrope/.test(getComputedStyle(b).fontFamily); }),'headings use Fraunces, body Manrope (computed)');
// glyph test: font actually renders (width differs from fallback)
ok(await p.evaluate(async()=>{ await document.fonts.ready; const w=(fam)=>{const s=document.createElement('span'); s.style.cssText='position:absolute;visibility:hidden;font:700 40px '+fam+';white-space:nowrap'; s.textContent='Budget Money 123 Rwmg'; document.body.appendChild(s); const x=s.getBoundingClientRect().width; s.remove(); return x;}; return w('Manrope,monospace')!==w('monospace')&&w('Fraunces,monospace')!==w('monospace'); }),'text really renders in the bundled fonts');
// russian -> cyrillic file only when needed
await p.evaluate(()=>{ setLanguage('ru'); goToScreen('more'); }); await p.waitForTimeout(600);
ok(reqs.some(u=>u.includes('manrope-cyrillic.woff2')),'Russian pulls the Cyrillic file on demand');
ok(!reqs.some(u=>u.includes('fraunces-latin-ext')),'no unused files requested');
await p.evaluate(()=>setLanguage('en'));
// service worker precaches fonts, offline reload keeps the look
await p.waitForFunction(()=>navigator.serviceWorker.controller||navigator.serviceWorker.ready.then(()=>true),null,{timeout:15000}); await p.waitForTimeout(1500);
const cached=await p.evaluate(async()=>{ const keys=await caches.keys(); const out=[]; for(const k of keys){ const c=await caches.open(k); (await c.keys()).forEach(r=>out.push(new URL(r.url).pathname)); } return out; });
ok(['fraunces-latin','manrope-latin','manrope-latin-ext','manrope-cyrillic'].every(n=>cached.includes('/fonts/'+n+'.woff2')),'service worker cached all 4 font files');
await ctx.setOffline(true); await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
ok(await p.evaluate(async()=>{ await document.fonts.ready; return document.fonts.check('16px Manrope')&&[...document.fonts].some(f=>f.family.includes('Fraunces')&&f.status==='loaded'); }),'offline reload: fonts still load from cache');
ok(errs.length===0,'no page errors offline '+errs);
await b.close(); srv.close(); console.log('FAILS '+f); process.exit(f?1:0);
