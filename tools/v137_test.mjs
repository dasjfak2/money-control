import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 const setup=(lim)=>p.evaluate((lim)=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}]; Object.assign(db.setup,{configured:true,income:60000,categoryBudgets:lim}); db.tx=[]; render(); },lim);
 const add=(cat,amt,date)=>p.evaluate(([cat,amt,date])=>{ closeModal(); openTx('Expense'); fCat.value=cat; fAmt.value=amt; if(date) fDate.value=date; document.querySelector('#modalBody .primary').click(); closeModal(); },[cat,amt,date]);
 const rem=()=>p.evaluate(()=>({items:[...document.querySelectorAll('#reminderList .reminder-item')].map(e=>({t:e.innerText.trim(),c:e.className})), btn:(document.querySelector('#reminderList .fx-link-btn')||{}).innerText||null}));
 await setup({Food:3000,Transport:1000,Shopping:2000,Health:500});
 await add('Food',2800); let r=await rem(); ok(!r.items.some(i=>/over budget/.test(i.t))&&!r.btn,'90%+ but not over -> nothing extra on Home');
 await add('Food',700); r=await rem(); let ov=r.items.filter(i=>/over budget/.test(i.t));
 ok(ov.length===1&&/Food is .*500 over budget/.test(ov[0].t)&&/r-danger/.test(ov[0].c)&&!r.btn,'1 over -> one red line, no More button: '+JSON.stringify(ov.map(i=>i.t)));
 ok(r.items[0]===ov[0]||r.items[0].t===ov[0].t,'over line is first in Reminders');
 await add('Transport',1900); r=await rem(); ov=r.items.filter(i=>/over budget/.test(i.t));
 ok(ov.length===2&&/Transport/.test(ov[0].t)&&/Food/.test(ov[1].t)&&!r.btn,'2 over -> both shown (biggest first), no More button: '+JSON.stringify(ov.map(i=>i.t)));
 await add('Shopping',2300); r=await rem(); ov=r.items.filter(i=>/over budget/.test(i.t));
 ok(ov.length===2&&/Transport is .*900 over budget/.test(ov[0].t)&&/Food/.test(ov[1].t)&&/^More \(1\)$/.test(r.btn),'3 over -> top 2 + "More (1)": '+JSON.stringify(ov.map(i=>i.t))+' '+r.btn);
 await p.click('#reminderList .fx-link-btn'); r=await rem(); ov=r.items.filter(i=>/over budget/.test(i.t));
 ok(ov.length===3&&/Food/.test(ov[1].t)&&/Shopping/.test(ov[2].t)&&r.btn==='Show less','More -> all 3 sorted by overspend, button becomes "Show less": '+ov.map(i=>i.t).join(' / '));
 ok(await p.evaluate(()=>{const c=document.getElementById('reminderList').getBoundingClientRect(); return c.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth+1;}),'no horizontal overflow when expanded');
 await add('Health',100); await p.waitForTimeout(100); r=await rem(); ok(r.btn==='Show less','stays expanded after a new entry (render())');
 await p.click('#reminderList .fx-link-btn'); r=await rem(); ok(r.items.filter(i=>/over budget/.test(i.t)).length===2&&/^More \(1\)$/.test(r.btn),'Show less collapses again to 2');
 // other reminders untouched
 ok(r.items.some(i=>!/over budget/.test(i.t)),'other reminders still listed after the over lines');
 // settings switch off
 await p.evaluate(()=>{ db.settings.notifBudget=false; save(); render(); }); r=await rem(); ok(!r.items.some(i=>/over budget/.test(i.t))&&!r.btn,'"Budget exceeded alerts" OFF -> no over lines');
 await p.evaluate(()=>{ db.settings.notifBudget=true; save(); render(); });
 // old month spending not counted; going back under limit removes the line
 await setup({Food:3000}); await add('Food',5000,'2020-01-05'); r=await rem(); ok(!r.items.some(i=>/over budget/.test(i.t)),'last-month overspend ignored (month rolled over)');
 await add('Food',3500); r=await rem(); ok(r.items.some(i=>/Food is/.test(i.t)),'over -> line shown'); await p.evaluate(()=>{ db.tx.pop(); save(); render(); }); r=await rem(); ok(!r.items.some(i=>/over budget/.test(i.t)),'deleting the entry (back under limit) removes the line');
 // exactly at limit is not "over"
 await add('Food',3000); r=await rem(); ok(!r.items.some(i=>/over budget/.test(i.t)),'exactly at limit -> no "0 over" line');
 // languages
 const l=await p.evaluate(()=>{ const o=[]; for(const x of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ for(const k of ['bw_rem_over','bw_more','bw_less']) if(!I18N[x][k]) o.push(x+k); if(!/\{c\}/.test(I18N[x].bw_rem_over)||!/\{n\}/.test(I18N[x].bw_rem_over)) o.push(x+' ph'); } return o; }); ok(l.length===0,'10 languages complete '+l);
 await setup({Food:1000}); await add('Food',1500); await p.evaluate(()=>{setLanguage('bn'); render();}); r=await rem(); ok(r.items.some(i=>/Food: .*বেশি খরচ/.test(i.t)),'Bangla line: '+r.items[0].t);
 await p.evaluate(()=>setLanguage('ar')); r=await rem(); ok(await p.evaluate(()=>document.documentElement.dir==='rtl')&&r.items.some(i=>/Food/.test(i.t)),'Arabic/RTL renders');
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
