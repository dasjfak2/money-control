import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 const seed=(months)=>p.evaluate((months)=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}]; Object.assign(db.setup,{configured:true,income:60000});
  const mk=(back)=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-back); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
  db.tx=[]; months.forEach((a,k)=>{ if(a) db.tx.push({id:'t'+k,date:mk(k)+'-05',type:'Expense',accountId:'a1',category:'Food',description:'x',amount:a}); }); render(); goToScreen('dashboard'); },months);
 const card=()=>p.evaluate(()=>{ const c=[...document.querySelectorAll('#dashboard .card')].find(x=>/monthly spending trend/i.test(x.innerText)); const s=c.querySelector('#trendChartHolder svg'); return {link:(c.querySelector('.fx-link-btn')||{}).innerText||null, h:s?s.getAttribute('height'):null, vb:s?s.getAttribute('viewBox'):null, bars:s?s.querySelectorAll('rect').length:0, labels:s?[...s.querySelectorAll('text')].map(t=>t.textContent).join('|'):'' , cardH:Math.round(c.getBoundingClientRect().height)}; });
 await seed([45000,27000,32000,23000,35000,28000]); let c=await card();
 ok(/Details/.test(c.link||''),'"Details" link on the trend card: '+c.link);
 ok(c.h==='95'&&c.vb==='0 0 340 95','chart is compact (height 95): '+c.vb);
 ok(c.bars>=6&&/Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May/.test(c.labels)&&/45k/.test(c.labels),'6 months, labels and values still drawn: '+c.labels);
 ok(c.cardH<260,'card is shorter than before (old ~290): '+c.cardH+'px');
 await p.evaluate(()=>[...document.querySelectorAll('#dashboard .card')].find(x=>/monthly spending trend/i.test(x.innerText)).querySelector('.fx-link-btn').click()); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='analytics'),'Details opens Analytics');
 ok(await p.evaluate(()=>analyticsPeriodType==='6m'&&document.querySelector('.analytics-period-tab[data-period="6m"]').classList.contains('active')),'Analytics opens on the "6 Months" tab');
 await p.evaluate(()=>document.querySelector('.analytics-period-tab[data-period="month"]').click()); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>analyticsPeriodType==='month'&&document.querySelector('.analytics-period-tab[data-period="month"]').classList.contains('active')),'other Analytics tabs still work');
 await p.evaluate(()=>goToScreen('dashboard')); await p.waitForTimeout(200);
 await seed([0,0,0,0,0,0]); c=await card(); ok(c.h==='95'&&!!c.link,'no spending: chart/card still render: '+JSON.stringify(c));
 await seed([100]); c=await card(); ok(c.bars>=1,'single month of data renders');
 for(const [th,lang] of [['dark','en'],['light','ar'],['light','bn']]){
  await p.evaluate(([th,lang])=>{ document.documentElement.setAttribute('data-theme',th); setLanguage(lang); render(); },[th,lang]); await p.waitForTimeout(250);
  ok(await p.evaluate(()=>{ const c=[...document.querySelectorAll('#dashboard .card')].find(x=>x.querySelector('#trendChartHolder')); const r=c.getBoundingClientRect(); return document.documentElement.scrollWidth<=innerWidth+1&&r.left>=-1&&r.right<=innerWidth+1; }),'no overflow in '+th+'/'+lang);
 }
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
