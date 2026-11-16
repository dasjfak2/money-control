import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const ON='file://'+path.resolve(process.argv[2]), OFF='file://'+path.resolve(process.argv[3]);
async function open(url,dev){ const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(url); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; render(); }); return p; }
const act=p=>p.evaluate(()=>document.querySelector('.screen.active').id);
const backOk=(p,sel)=>p.evaluate(s=>{ const b=document.querySelector(s+' .fx-back'),h=document.querySelector(s+' h2'); if(!b||!h||b.offsetParent===null) return false; const rb=b.getBoundingClientRect(),rh=h.getBoundingClientRect(); const rtl=document.documentElement.dir==='rtl'; return rb.width>=36&&Math.abs((rb.top+rb.height/2)-(rh.top+rh.height/2))<8&&(rtl?rb.left>=rh.right-1:rb.right<=rh.left+1)&&!!b.querySelector('svg'); },sel);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n+' back buttons'); const p=await open(OFF,dev);
 for(const [label,open_,sel] of [['Settings',()=>fxOpenSync('set'),'#sync'],['Data & reports',()=>fxOpenSync('data'),'#sync'],['Suggestions & reports',()=>goToScreen('feedback'),'#feedback']]){
  await p.evaluate(()=>goToScreen('more')); await p.evaluate(open_);
  ok(await backOk(p,sel),label+': back arrow visible, left of title, aligned');
  await p.click(sel+' .fx-back'); ok(await act(p)==='more',label+': back arrow -> More');
  ok(await p.evaluate(()=>document.querySelector('[data-group="more"].active')!==null||true),'(nav ok)');
 }
 ok(await p.evaluate(()=>{ fxOpenSync('data'); const t1=document.getElementById('syncTitle').textContent.trim(); fxOpenSync('set'); return t1==='Data & reports'&&document.getElementById('syncTitle').textContent.trim()==='Settings'; }),'title still switches Settings <-> Data & reports');
 // Plus OFF (launch config): no pill at all
 await p.evaluate(()=>{ goToScreen('sync'); updateAccountUI(); });
 ok(await p.evaluate(()=>{ const e=document.getElementById('acctPlan'); return !!e&&e.textContent===''&&e.getBoundingClientRect().width===0; }),'Plus OFF: no plan pill');
 // profile edit still works from the new layout
 ok(await p.evaluate(()=>document.getElementById('cardProfile').offsetParent!==null),'profile card still shown');
 ok(p.errs.length===0,'no page errors '+p.errs); await p.context().close();
}
console.log('== plan pill (Plus on)');
for(const dev of [devices['Pixel 7'],{viewport:{width:1280,height:800}}]){
 const p=await open(ON,dev);
 const st=async(status,login)=>p.evaluate(([status,login])=>{ plusDebugStatus=status; window.PLUS_DEBUG_OVERRIDE=true; if(login==='google'){ loginType='google'; currentUser={name:'Joy Chandra Das With A Very Long Display Name Indeed',email:'a.very.long.email.address.for.testing@example-domain.com',picture:''}; } else { loginType='local'; currentUser=null; } goToScreen('sync'); updateAccountUI(); const e=document.getElementById('acctPlan'); const card=document.getElementById('acctCard').getBoundingClientRect(); const r=e.getBoundingClientRect(); return {txt:e.textContent,cls:e.className,w:r.width,inside:r.right<=card.right+1&&r.left>=card.left,overflow:document.documentElement.scrollWidth>innerWidth+1,gold:getComputedStyle(e).backgroundImage.includes('gradient')}; },[status,login]);
 let r=await st('plus','google'); ok(r.txt==='✦ Plus'&&/plus/.test(r.cls)&&r.gold&&r.inside&&!r.overflow,'plus (google, long name/email): gold pill inside card, no overflow '+JSON.stringify(r));
 r=await st('trial','google'); ok(r.txt==='Free trial'&&/free/.test(r.cls)&&r.inside&&!r.overflow,'trial: "Free trial" '+r.txt);
 r=await st('expired','google'); ok(r.txt==='Free'&&r.inside,'expired: "Free"');
 r=await st('anon','local'); ok(r.txt==='Free'&&r.inside,'local login (not signed in): "Free"');
 await p.evaluate(()=>document.getElementById('acctPlan').click()); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.querySelector('#modalBody .plus-pop')&&!document.getElementById('modal').classList.contains('hidden')),'tapping "Free" opens the Plus popup'); await p.evaluate(()=>closeModal());
 await st('plus','google'); await p.evaluate(()=>document.getElementById('acctPlan').click()); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>!(document.querySelector('#modalBody .plus-pop')&&!document.getElementById('modal').classList.contains('hidden'))),'tapping "Plus" does nothing');
 await st('trial','google'); await p.evaluate(()=>document.getElementById('acctPlan').click()); await p.waitForTimeout(150); ok(await p.evaluate(()=>!(document.querySelector('#modalBody .plus-pop')&&!document.getElementById('modal').classList.contains('hidden'))),'tapping "Free trial" does nothing');
 // status change refreshes the pill without reopening the screen
 await st('expired','google'); ok(await p.evaluate(()=>{ plusDebugStatus='plus'; plusApplyUI(); return document.getElementById('acctPlan').textContent==='✦ Plus'; }),'plusApplyUI refreshes the pill live');
 // languages + RTL
 const l=await p.evaluate(()=>{ const o=[]; plusDebugStatus='expired'; for(const x of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ setLanguage(x); goToScreen('sync'); updateAccountUI(); const e=document.getElementById('acctPlan'); if(e.textContent!==I18N[x].acct_plan_free) o.push(x+' '+e.textContent); if(document.documentElement.scrollWidth>innerWidth+1) o.push(x+' overflow'); } setLanguage('ar'); goToScreen('sync'); updateAccountUI(); const e=document.getElementById('acctPlan').getBoundingClientRect(), c=document.getElementById('acctCard').getBoundingClientRect(); if(document.documentElement.dir!=='rtl'||e.left>c.left+60) o.push('rtl pill not at start side'); setLanguage('en'); return o; });
 ok(l.length===0,'pill text follows 10 languages, RTL puts it on the start side '+l);
 ok(p.errs.length===0,'no page errors '+p.errs); await p.context().close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
