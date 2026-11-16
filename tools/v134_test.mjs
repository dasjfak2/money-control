// v134: real, installable web manifest (Chrome "This app cannot be installed" fix)
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os';
const ROOT=process.argv[2]; let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const types={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const mk=(sub)=>http.createServer((q,r)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(sub){ if(!u.startsWith(sub)){r.statusCode=404;return r.end();} u='/'+u.slice(sub.length); } if(u.endsWith('/')) u+='index.html'; const fp=path.join(ROOT,u); if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){ r.statusCode=404; return r.end(); } r.setHeader('Content-Type',types[path.extname(fp)]||'application/octet-stream'); r.end(fs.readFileSync(fp)); }).listen(0);
for(const sub of ['','/money-control/']){
 console.log('== served at '+(sub||'/'));
 const srv=mk(sub); const port=srv.address().port; const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pw'));
 const ctx=await chromium.launchPersistentContext(dir,{channel:'chromium',args:['--no-sandbox'],viewport:{width:390,height:780}}); const p=ctx.pages()[0]||await ctx.newPage();
 const errs=[],bad=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('response',r=>{ if(r.status()>=400&&!/sentry|favicon/.test(r.url())) bad.push(r.status()+' '+r.url()); });
 await p.route(/sentry|accounts\.google|googleapis/,r=>r.abort());
 await p.goto(`http://localhost:${port}${sub||'/'}`,{waitUntil:'load'}); await p.waitForTimeout(3500);
 const c=await ctx.newCDPSession(p); const inst=(await c.send('Page.getInstallabilityErrors')).installabilityErrors; ok(inst.length===0,'Chrome installability errors: '+JSON.stringify(inst));
 const m=await c.send('Page.getAppManifest'); ok(m.errors.length===0,'manifest parse errors: '+JSON.stringify(m.errors.map(e=>e.message)));
 const mf=JSON.parse(m.data); ok(m.url===`http://localhost:${port}${sub||'/'}manifest.webmanifest`,'manifest is a real file URL: '+m.url);
 const base=`http://localhost:${port}${sub||'/'}`;
 const sw=await p.evaluate(async()=>{ const r=await navigator.serviceWorker.getRegistration(); return !!(r&&(r.active||r.waiting||r.installing)); }); ok(sw,'service worker registered');
 const parsed=await c.send('Page.getAppManifest'); ok(mf.name==='FexaFY - Money Tracker'&&mf.short_name==='FexaFY'&&mf.display==='standalone','name / short_name / standalone');
 ok(await p.evaluate(async(base)=>{ const m=await (await fetch(base+'manifest.webmanifest')).json(); const rs=await Promise.all(m.icons.map(i=>fetch(new URL(i.src,base+'manifest.webmanifest')).then(r=>r.ok))); return rs.every(Boolean)&&m.icons.some(i=>i.sizes==='192x192')&&m.icons.some(i=>i.sizes==='512x512')&&m.icons.some(i=>i.purpose==='maskable'); },base),'all icons load; 192, 512, maskable present');
 ok(await p.evaluate(()=>!document.querySelector('link[rel=manifest]').href.startsWith('blob:')&&!document.getElementById('manifestLink')),'no blob manifest any more');
 ok(await p.evaluate(()=>/default-src 'self'/.test(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)&&!/manifest-src/.test(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)),'CSP unchanged (default-src self covers the manifest file)');
 ok(await p.evaluate(()=>/^v1[34]\d$/.test(APP_VERSION)),'v134');
 ok(errs.length===0&&bad.length===0,'no page errors / 404s '+errs.concat(bad));
 const shortcuts=mf.shortcuts.map(s=>s.url); ok(shortcuts.length===2&&shortcuts.every(u=>u.startsWith('./?quickadd=')),'shortcuts kept');
 await ctx.close(); srv.close();
}
console.log('FAILS '+f); process.exit(f?1:0);
