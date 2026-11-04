import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']});
let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const file='file://'+path.resolve(process.argv[2]);
async function open(cc,pre){ const ctx=await b.newContext({...devices['Pixel 7']}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(()=>{ try{ localStorage.setItem('fx_calcShowAll','1'); }catch(e){} }); // stale value left by old versions
  await p.goto(file); await p.waitForTimeout(500);
  await p.evaluate(c=>{ db=defaultDb(); db.profile={name:"T",countryCode:c,phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta=db.meta||{}; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); db.meta.onboardingSeen=true; render(); refreshCalcNavItems(); },cc); return p; }
const vis=p=>p.evaluate(()=>[...document.querySelectorAll('#more .calc-nav-item')].filter(b=>b.offsetParent!==null).map(b=>b.dataset.calc));
// 1. BD user with the OLD sticky "show all" flag: only BD rows (+EOSB which is always-on)
let p=await open('+880'); await p.evaluate(()=>goToScreen('more'));
let v=await vis(p); console.log('BD rows',v);
ok(!['uk','au','ca','sg','my','taxUS'].some(x=>v.includes(x)),'BD: no other-country rows despite stale flag');
ok(v.includes('tax')&&v.includes('loan')&&v.includes('deposit'),'BD: loan/deposit/BD tax shown');
// 2. tapping Income Tax shows ONLY the tax calculator
await p.evaluate(()=>document.querySelector('#more .calc-nav-item[data-calc="tax"]').click());
const r=await p.evaluate(()=>({row:getComputedStyle(document.getElementById('calcModeRow')).display, title:document.getElementById('calcTitle').textContent, sub:getComputedStyle(document.getElementById('calcSub')).display,
  panels:['Loan','Deposit','Zakat','Tax','TaxUS'].filter(n=>{const e=document.getElementById('calcPanel'+n); return e&&e.style.display!=='none';})}));
console.log(r);
ok(r.row==='none','tile grid hidden'); ok(r.title==='Income Tax Calculator','title = picked calculator'); ok(r.sub==='none','loan/deposit blurb hidden'); ok(r.panels.join()==='Tax','only Tax panel visible: '+r.panels);
// 3. Loan row -> loan only, blurb shown
await p.evaluate(()=>openCalcFromNav('loan'));
ok(await p.evaluate(()=>document.getElementById('calcTitle').textContent==='Loan Calculator'&&getComputedStyle(document.getElementById('calcSub')).display!=='none'&&document.getElementById('calcPanelDeposit').style.display==='none'),'loan: own title, only loan panel');
// 4. UK user sees UK (and not AU/CA/SG/MY)
p=await open('+44'); await p.evaluate(()=>goToScreen('more')); v=await vis(p); console.log('UK rows',v);
ok(v.includes('uk')&&!['au','ca','sg','my','tax','zakat','taxUS'].some(x=>v.includes(x)),'UK: only UK');
await p.evaluate(()=>document.querySelector('#more .calc-nav-item[data-calc="uk"]').click());
ok(await p.evaluate(()=>document.getElementById('calcPanelUk').style.display!=='none'&&document.getElementById('calcTitle').textContent.length>3),'UK opens, title='+await p.evaluate(()=>document.getElementById('calcTitle').textContent));
// 5. the opt-in toggle: works, lives in More, not remembered
await p.evaluate(()=>goToScreen('more'));
ok(await p.evaluate(()=>{ const t=document.getElementById('fxCalcAllToggle'); return !!t&&!!t.closest('#more')&&t.offsetParent!==null; }),'toggle sits in More');
await p.evaluate(()=>fxCalcToggleAll()); v=await vis(p); ok(['au','ca','sg','my'].every(x=>v.includes(x)),'toggle on -> other countries listed');
ok(await p.evaluate(()=>localStorage.getItem('fx_calcShowAll')==='1'),'(old key untouched, ignored)');
await p.reload(); await p.waitForTimeout(400);
await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+44",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); render(); refreshCalcNavItems(); goToScreen('more'); });
v=await vis(p); ok(!v.includes('au'),'after restart: back to own country only');
// 6. rows look identical (same font/size) incl. injected ones
p=await open('+44'); await p.evaluate(()=>goToScreen('more'));
const fs=await p.evaluate(()=>[...document.querySelectorAll('#more .calc-nav-item')].filter(b=>b.offsetParent).map(b=>{const c=getComputedStyle(b); return c.fontSize+'|'+c.fontWeight+'|'+c.fontFamily.slice(0,20)+'|'+c.color;}));
ok(new Set(fs).size===1,'all calc rows same typography '+[...new Set(fs)].join(' ; '));
// 7. all 10 languages: title never raw key
const bad=await p.evaluate(()=>{const o=[]; for(const l of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ setLanguage(l); goToScreen('more'); openCalcFromNav('loan'); const t=document.getElementById('calcTitle').textContent; if(!t||/^calc_/.test(t)) o.push(l); } setLanguage('en'); return o;});
ok(bad.length===0,'title ok in 10 languages '+bad);
ok(p.errs.length===0,'no page errors '+p.errs);
console.log('FAILS',f); await b.close(); process.exit(f?1:0);
