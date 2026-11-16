import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:1000}]; db.setup.configured=true;
  db.assets=[{name:'Bank',type:'Asset',amount:5000},{name:'Friend',type:'Debt',amount:2000}]; db.debts=[{id:'d1',name:'Car loan',start:9000,current:8000,min:500,extra:0,rate:9,dueDay:10}]; linkDebtsIntoAssets(db); render(); goToScreen('networth'); });
 const hint=()=>p.evaluate(()=>{ const h=document.getElementById('aDebtHint'); return h?getComputedStyle(h).display!=='none':null; });
 await p.evaluate(()=>{ closeModal(); openAsset(); }); await p.waitForTimeout(150);
 ok(await hint()===false,'new entry, type Asset: hint hidden');
 await p.selectOption('#aType','Debt'); ok(await hint()===true,'choosing Debt shows the hint');
 ok(await p.evaluate(()=>/Debt tab/.test(document.getElementById('aDebtHint').innerText)&&/automatically/.test(document.getElementById('aDebtHint').innerText)),'hint text is the intended one');
 await p.selectOption('#aType','Asset'); ok(await hint()===false,'switching back to Asset hides it');
 // saving still works for both types
 await p.evaluate(()=>{ aName.value='Gold'; aAmt.value=700; document.querySelector('#modalBody .primary').click(); }); await p.waitForTimeout(100);
 await p.evaluate(()=>{ closeModal(); openAsset(); aName.value='Shop credit'; aType.value='Debt'; aAmt.value=300; document.querySelector('#modalBody .primary').click(); }); await p.waitForTimeout(100);
 ok(await p.evaluate(()=>db.assets.some(x=>x.name==='Gold'&&x.type==='Asset'&&x.amount==700)&&db.assets.some(x=>x.name==='Shop credit'&&x.type==='Debt'&&x.amount==300)),'saving an Asset and a Debt still works');
 const t=await p.evaluate(()=>computeNetWorthTotals()); ok(t.totalAssets===5700&&t.totalDebts===10300&&t.netWorth===-4600,'totals correct: '+JSON.stringify(t));
 // edit existing manual debt: hint shown; edit asset: hidden
 await p.evaluate(()=>{ closeModal(); openAsset(db.assets.findIndex(x=>x.name==='Friend')); }); await p.waitForTimeout(100); ok(await hint()===true,'editing a manual Debt: hint shown');
 await p.evaluate(()=>{ closeModal(); openAsset(db.assets.findIndex(x=>x.name==='Bank')); }); await p.waitForTimeout(100); ok(await hint()===false,'editing an Asset: hint hidden');
 // linked debt still redirects to the Debt tab
 await p.evaluate(()=>{ closeModal(); openAsset(db.assets.findIndex(x=>x.linkedDebtId)); }); await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='debt'&&document.getElementById('modal').classList.contains('hidden')),'linked (synced) debt still redirects to the Debt tab, no form');
 // layout
 await p.evaluate(()=>{ goToScreen('networth'); closeModal(); openAsset(); aType.value='Debt'; aType.dispatchEvent(new Event('change')); }); await p.waitForTimeout(200);
 for(const th of ['light','dark']){ await p.evaluate((th)=>document.documentElement.setAttribute('data-theme',th),th); ok(await p.evaluate(()=>{ const r=document.getElementById('aDebtHint').getBoundingClientRect(); return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth+1; }),'hint fits the screen ('+th+')'); }
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
