import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const file='file://'+path.resolve(process.argv[2]); const shot=process.argv[3]||'';
async function open(dev){ const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(file); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); render(); }); return p; }
const act=p=>p.evaluate(()=>document.querySelector('.screen.active').id);
const vis=(p,sel)=>p.evaluate(s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent!==null).map(e=>e.dataset.calc),sel);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n); const p=await open(dev);
 ok(await p.evaluate(()=>APP_VERSION)==='v131','v131');
 await p.evaluate(()=>goToScreen('more'));
 ok(await p.evaluate(()=>document.querySelector('#more .fx-more-card h3').textContent.trim())==='Calculators','More header says Calculators (not Calc)');
 await p.click('#more .calc-nav-item[data-calc="loan"]');
 ok(await act(p)==='calculators','Loan opens'); ok(await p.evaluate(()=>document.getElementById('calcTitle').textContent.trim())==='Loan Calculator','title Loan Calculator');
 ok(await p.evaluate(()=>{const b=document.querySelector('.fx-back'),h=document.getElementById('calcTitle'); const rb=b.getBoundingClientRect(),rh=h.getBoundingClientRect(); return b.offsetParent!==null&&rb.width>=36&&rb.right<=rh.left+1&&Math.abs((rb.top+rb.height/2)-(rh.top+rh.height/2))<6&&!!b.querySelector('svg');}),'back button visible, left of title, aligned, has icon');
 if(shot) await p.screenshot({path:`${shot}/${n}_loan.png`});
 { const o=await vis(p,'#calcOthers .calc-nav-item'); await p.evaluate(()=>goToScreen('more')); const m=(await vis(p,'#more .calc-nav-item')).filter(x=>x!=='loan'); await p.evaluate(()=>openCalcFromNav('loan')); ok(JSON.stringify(o)===JSON.stringify(m)&&o.length>=1,'Other calculators = every calculator visible in More except current: '+o); }
 // switch from the bottom list, no trip to More
 await p.evaluate(()=>{ window.scrollTo(0,document.body.scrollHeight); }); await p.click('#calcOthers .calc-nav-item[data-calc="deposit"]');
 ok(await act(p)==='calculators'&&await p.evaluate(()=>document.getElementById('calcTitle').textContent.trim())==='Deposit Calculator','tap Deposit in bottom list -> Deposit opens');
 ok(await p.evaluate(()=>scrollY)===0,'scrolled back to top');
 ok((await vis(p,'#calcOthers .calc-nav-item')).includes('loan')&&!(await vis(p,'#calcOthers .calc-nav-item')).includes('deposit'),'current (Deposit) hidden, Loan listed');
 ok(await p.evaluate(()=>document.getElementById('calcPanelDeposit')?getComputedStyle(document.getElementById('calcPanelDeposit')).display!=='none':true),'deposit panel shown');
 // back button
 await p.click('.fx-back'); ok(await act(p)==='more','back arrow returns to More');
 ok(await p.evaluate(()=>document.querySelector('.nav [data-group="more"].active, #fxTabbar [data-group="more"].active')!==null),'More tab highlighted');
 // country-gated calculators appear in the bottom list too
 await p.evaluate(()=>{ fxCalcToggleAll&&fxCalcToggleAll(); }); await p.click('#more .calc-nav-item[data-calc="zakat"]');
 const all=await vis(p,'#calcOthers .calc-nav-item'); ok(all.includes('loan')&&all.includes('deposit')&&all.includes('tax')&&!all.includes('zakat'),'show-all: others list has every calculator except current: '+all);
 await p.evaluate(()=>{ window.scrollTo(0,document.body.scrollHeight); }); await p.click('#calcOthers .calc-nav-item[data-calc="tax"]');
 ok(await p.evaluate(()=>/Income Tax/.test(document.getElementById('calcTitle').textContent)),'switch Zakat -> Tax from bottom list');
 // extra (Gulf EOSB) rows get injected into the bottom list as well
 ok(await p.evaluate(()=>!!document.querySelector('#calcOthers .calc-nav-item[data-calc="eosb"]')),'EOSB row injected in bottom list too');
 await p.click('.fx-back'); ok(await act(p)==='more','back from Tax');
 ok(p.errs.length===0,'no page errors '+p.errs); await p.context().close();
}
{ const p=await open(devices['Pixel 7']);
 const bad=await p.evaluate(()=>{ const o=[]; for(const l of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ if(!I18N[l].calc_others) o.push(l+' others'); if(l!=='en'&&l!=='bn'&&!I18N[l].calc) o.push(l+' calc'); setLanguage(l); goToScreen('more'); const h=document.querySelector('#more .fx-more-card h3').textContent.trim(); if(h!==(I18N[l].calc||I18N.en.calc)) o.push(l+' hdr '+h); openCalcFromNav('loan'); const oh=document.querySelector('#calcOthers h3').textContent.trim(); if(oh!==I18N[l].calc_others) o.push(l+' oth '+oh);} setLanguage('en'); return o; });
 ok(bad.length===0,'10 languages: header + other-calculators title '+bad);
 await p.evaluate(()=>{setLanguage('ar'); openCalcFromNav('loan');}); ok(await p.evaluate(()=>document.documentElement.dir==='rtl'&&getComputedStyle(document.querySelector('.fx-back svg')).transform!=='none'),'Arabic: back arrow flipped');
 if(shot) await p.screenshot({path:`${shot}/ar_loan.png`});
 ok(p.errs.length===0,'no page errors '+p.errs); await p.context().close(); }
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
