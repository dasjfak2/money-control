import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 // income/expense: monthly income I, expense E, committed C => capacity=I-E-C
 const run=(inc,exp,committed,goals)=>p.evaluate(([inc,exp,committed,goals])=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}];
  Object.assign(db.setup,{configured:true,income:inc,savings:committed,invest:0,emergencyMonthly:0,futureMonthly:0});
  const mk=(back)=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-back); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }; const T=[]; let n=0;
  [0,1,2].forEach(k=>{ if(inc) T.push({id:'t'+n++,date:mk(k)+'-02',type:'Income',accountId:'a1',category:'Salary',description:'x',amount:inc}); if(exp) T.push({id:'t'+n++,date:mk(k)+'-03',type:'Expense',accountId:'a1',category:'Rent/Housing',description:'x',amount:exp}); });
  db.tx=T; const y=new Date().getFullYear(); db.future=goals.map(([name,target,saved,dy,dm])=>({name,target,saved,date:(y+dy)+'-'+String(dm).padStart(2,'0')+'-01'})); render(); goToScreen('future');
  const plan=computeFuturePlan().plan; const rows=[...document.querySelectorAll('#futurePlanRows .fx-plan-order-item')].map(r=>({t:r.innerText.replace(/\s+/g,' '),btn:!!r.querySelector('button')}));
  return {plan:plan.map(g=>({name:g.name,status:g.status,sd:g.suggestedDate,al:Math.round(g.allocated)})),rows,all:document.getElementById('futurePlanCard').innerText}; },[inc,exp,committed,goals]);
 const clean=(r)=>!/NaN|Infinity|undefined|\b(2[1-9]\d\d|[3-9]\d{3}|\d{5,})\b/.test(r.all.replace(/\$[\d,]+/g,''));
 // 1) the reported case: nearer goal takes the whole capacity, farther one gets $0
 let r=await run(60000,43000,10000,[['New laptop',90000,10000,0,12],['Umrah trip',300000,40000,1,6]]);
 ok(r.plan.every(g=>g.status==='behind'),'both behind (capacity 7000 < needed)');
 const far=r.plan.find(g=>g.al===0); ok(!!far&&far.sd===null,'goal with $0 allocated gets NO suggested date');
 const fr=r.rows.find(x=>/Umrah/.test(x.t)); ok(/nothing for this goal/.test(fr.t)&&!fr.btn&&!/Use /.test(fr.t),'its row explains it and has no "Use ... →" button: '+fr.t);
 ok(clean(r),'no year 23693 / NaN / Infinity anywhere in the card');
 // 2) zero capacity: every goal gets the message
 r=await run(0,0,0,[['A',100000,0,1,6],['B',50000,0,2,1]]); ok(r.plan.every(g=>g.sd===null)&&r.rows.every(x=>!x.btn&&/nothing for this goal/.test(x.t))&&clean(r),'no income: every goal shows the message, no buttons');
 // 3) small but positive allocation within 10 years keeps a real date + working button
 r=await run(60000,43000,10000,[['Trip',100000,0,1,6]]); // capacity 7000, needed ~ 100000/~19 months => on track or behind with real date
 r=await run(60000,52000,6000,[['Car',500000,0,1,6]]); // capacity 2000/month for 500k => ~250 months > 120
 ok(r.plan[0].status==='behind'&&r.plan[0].sd===null&&/only about/.test(r.rows[0].t)&&!r.rows[0].btn,'tiny allocation needing >10 years: "only about $/month" message, no date: '+r.rows[0].t);
 r=await run(60000,47000,6000,[['Car',300000,0,1,6]]); // capacity 7000 => ~43 months < 120 => real date
 ok(r.plan[0].status==='behind'&&/^\d{4}-\d{2}-\d{2}$/.test(r.plan[0].sd)&&+r.plan[0].sd.slice(0,4)<new Date().getFullYear()+10&&r.rows[0].btn&&/Use /.test(r.rows[0].t),'reachable-within-10y keeps the real date and the "Use" button: '+r.rows[0].t);
 await p.evaluate(()=>{ [...document.querySelectorAll('#futurePlanRows button')][0].click(); }); await p.waitForTimeout(150);
 ok(await p.evaluate(()=>{ const g=computeFuturePlan().plan[0]; return g.status==='ok'&&/^\d{4}-/.test(db.future[0].date); }),'tapping "Use" moves the goal date and it becomes On track');
 // 4) on-track goal unaffected
 r=await run(60000,30000,5000,[['Phone',30000,0,1,6]]); ok(r.plan[0].status==='ok'&&/Set aside/.test(r.rows[0].t)&&!r.rows[0].btn,'on-track goal unchanged: '+r.rows[0].t);
 // 5) all goals already saved / past dates
 r=await run(60000,43000,10000,[['Done',1000,1000,0,12],['Past',5000,0,-1,1]]); ok(clean(r)&&p.errs.length===0,'completed/past goals render cleanly');
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
