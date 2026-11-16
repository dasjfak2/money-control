import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}]; Object.assign(db.setup,{configured:true,income:60000,categoryBudgets:{Food:3000,Transport:1000}}); db.tx=[]; render(); });
 // add through the real form; returns popup text or null
 const add=async(type,cat,amt,date)=>{ await p.evaluate(([type,cat,amt,date])=>{ closeModal(); openTx(type); fCat.value=cat; fAmt.value=amt; if(date) fDate.value=date; document.querySelector('#modalBody .primary').click(); },[type,cat,amt,date]); await p.waitForTimeout(80);
  return p.evaluate(()=>{ const m=document.getElementById('modal'); const bp=document.querySelector('#modalBody .bw-pop'); return (!m.classList.contains('hidden')&&bp)?bp.innerText.replace(/\s+/g,' '):null; }); };
 let r=await add('Expense','Food',2500); ok(r===null,'83% used -> no popup');
 r=await add('Expense','Food',300); ok(r&&/almost used/i.test(r)&&/Food/.test(r)&&/2,800|2800/.test(r)&&/200/.test(r),'93% -> "almost used" popup: '+r);
 ok(await p.evaluate(()=>{ const bp=document.querySelector('#modalBody .bw-pop'); const r=bp.getBoundingClientRect(); return r.width>0&&r.right<=innerWidth&&bp.querySelector('svg')&&bp.querySelector('button').getBoundingClientRect().height>=30; }),'popup fits screen, has icon and OK button');
 await p.click('#modalBody .bw-pop button'); ok(await p.evaluate(()=>document.getElementById('modal').classList.contains('hidden')),'OK closes popup');
 r=await add('Expense','Food',100); ok(r===null,'still 96% -> no repeat popup');
 r=await add('Expense','Food',200); ok(r&&/limit crossed/i.test(r)&&/100/.test(r),'crossing limit -> "limit crossed" popup: '+r);
 r=await add('Expense','Food',500); ok(r===null,'already over -> no repeat');
 // delete + re-add must not re-fire
 await p.evaluate(()=>{ db.tx.pop(); db.tx.pop(); save(); render(); }); r=await add('Expense','Food',900); ok(r===null,'delete then re-add same month -> flag keeps it quiet');
 // jump straight past limit: only "crossed", never near afterwards
 r=await add('Expense','Transport',1500); ok(r&&/limit crossed/i.test(r),'big single expense past limit -> only "crossed"');
 ok(await p.evaluate(()=>db.budgetWarned.k['Transport|near']===1&&db.budgetWarned.k['Transport|over']===1),'both levels flagged after a jump');
 // non-applicable cases
 r=await add('Expense','Health',99999); ok(r===null,'category without limit -> none');
 r=await add('Income','Salary',99999); ok(r===null,'income -> none');
 await p.evaluate(()=>{ db.setup.categoryBudgets.Shopping=1000; save(); }); r=await add('Expense','Shopping',2000,'2020-01-05'); ok(r===null,'old-month entry -> none');
 await p.evaluate(()=>{ db.settings.notifBudget=false; save(); }); r=await add('Expense','Shopping',2000); ok(r===null,'"Budget exceeded alerts" OFF -> none');
 await p.evaluate(()=>{ db.settings.notifBudget=true; db.tx=db.tx.filter(x=>x.category!=='Shopping'); save(); }); 
 // new month resets flags
 await p.evaluate(()=>{ db.budgetWarned={m:'2000-01',k:{'Shopping|over':1,'Shopping|near':1}}; save(); }); r=await add('Expense','Shopping',1200); ok(r&&/limit crossed/i.test(r),'flags from an old month are reset -> warns again');
 ok(await p.evaluate(()=>db.budgetWarned.m===thisMonth()),'flag store rolled to current month');
 // edit does not warn
 await p.evaluate(()=>{ db.budgetWarned={m:thisMonth(),k:{}}; db.setup.categoryBudgets.Other=1000; save(); }); r=await add('Expense','Other',100);
 await p.evaluate(()=>{ closeModal(); const i=db.tx.length-1; openTx('Expense',i); fAmt.value=2000; document.querySelector('#modalBody .primary').click(); }); await p.waitForTimeout(80);
 ok(await p.evaluate(()=>!document.querySelector('#modalBody .bw-pop')||document.getElementById('modal').classList.contains('hidden')),'editing an entry does not trigger the popup');
 // languages
 const l=await p.evaluate(()=>{ const o=[]; for(const x of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ setLanguage(x); for(const k of ['bw_near','bw_over','bw_near_sub','bw_over_sub']) if(!I18N[x][k]) o.push(x+k); if(!/\{n\}/.test(I18N[x].bw_near_sub)||!/\{n\}/.test(I18N[x].bw_over_sub)) o.push(x+' placeholder'); } setLanguage('en'); return o; }); ok(l.length===0,'10 languages have all 4 strings + placeholder '+l);
 await p.evaluate(()=>{ setLanguage('bn'); db.budgetWarned={m:thisMonth(),k:{}}; db.setup.categoryBudgets.Utilities=1000; save(); }); r=await add('Expense','Utilities',1500); ok(r&&/বাজেট/.test(r),'Bangla popup text: '+r);
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
