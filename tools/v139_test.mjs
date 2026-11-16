import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(OFF); await p.waitForTimeout(500);
 const seed=(cats,assets)=>p.evaluate(([cats,assets])=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}]; Object.assign(db.setup,{configured:true,income:60000}); db.assets=assets;
  const d=thisMonth()+'-'; db.tx=cats.map(([c,a],i)=>({id:'t'+i,date:d+'05',type:'Expense',accountId:'a1',category:c,description:'x',amount:a})); render(); goToScreen('dashboard'); },[cats,assets]);
 const info=()=>p.evaluate(()=>({rows:[...document.querySelectorAll('#catTopHolder .cat-top-row')].map(r=>r.innerText.replace(/\s+/g,' ')), more:(document.querySelector('#catTopHolder button')||{}).innerText||null, txt:document.getElementById('catTopHolder').innerText.replace(/\s+/g,' '), pie:!!document.getElementById('pieChartHolder')}));
 // 11 categories
 const C=[['Rent/Housing',15000],['Savings',8000],['Groceries',7400],['Investment',4500],['Food',4200],['Transport',3400],['Utilities',3100],['Shopping',2600],['Education',2500],['Health',1200],['Entertainment',900]];
 await seed(C,[{name:'Bank',type:'Asset',amount:180000},{name:'Gold',type:'Asset',amount:60000},{name:'Car loan',type:'Debt',amount:90000}]);
 let r=await info();
 ok(!r.pie,'old pie/legend removed from Home');
 ok(r.rows.length===4&&/Rent\/Housing.*15,000/.test(r.rows[0])&&/Groceries/.test(r.rows[1])&&/Food/.test(r.rows[2])&&/Transport/.test(r.rows[3])&&!r.rows.some(x=>/Savings|Investment/.test(x)),'top 4 everyday categories, biggest first, no Savings/Investment: '+JSON.stringify(r.rows));
 ok(r.more&&/\+ 5 more categories/.test(r.more),'"+ 5 more categories" button: '+r.more);
 ok(await p.evaluate(()=>{ const w=[...document.querySelectorAll('#catTopHolder .budget-bar i')].map(i=>parseFloat(i.style.width)); return w[0]===100&&w.every((x,i)=>i===0||x<w[i-1]); }),'bars scale to the biggest and shrink in order');
 ok(await p.evaluate(()=>{ render(); const home=[...document.querySelectorAll('#catTopHolder .cat-top-row')].map(r=>r.innerText.replace(/\s+/g,' ')); const an=[...document.querySelectorAll('#anDonutLegend .legend-row')].slice(0,4).map(r=>r.innerText.replace(/\s+/g,' ')); const norm=x=>x.replace(/[\s$,·]/g,''); return home.length===4&&an.length===4&&home.every((h,i)=>norm(h)===norm(an[i])); }),'Home top-4 (name, amount, %) matches Analytics exactly');
 // click "+N more" -> Analytics, category card in view
 await p.click('#catTopHolder button'); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='analytics'),'+N more opens Analytics');
 ok(await p.evaluate(()=>{ const r=document.getElementById('anCatCard').getBoundingClientRect(); return r.top<innerHeight&&r.bottom>0; }),'Analytics "Spending by category" card is scrolled into view');
 await p.evaluate(()=>goToScreen('dashboard')); await p.waitForTimeout(150);
 await p.evaluate(()=>[...document.querySelectorAll('#dashboard .card')].find(c=>/see all/i.test(c.innerText)&&/spending by category/i.test(c.innerText)).querySelector('.fx-link-btn').click()); await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='analytics'),'"See all" opens Analytics');
 // few categories
 await seed([['Food',500],['Transport',300],['Other',200],['Health',100]],[]); r=await info(); ok(r.rows.length===4&&r.more===null,'exactly 4 categories -> no "more" button');
 await seed([['Food',500]],[]); r=await info(); ok(r.rows.length===1&&/100%/.test(r.rows[0])&&r.more===null,'single category -> one bar at 100%');
 await seed([],[]); r=await info(); ok(r.rows.length===0&&/Add some expenses/.test(r.txt),'no spending -> friendly message');
 await seed([['Mobile & Internet',900],['Gifts & Donations',100]],[]); r=await info(); ok(/Mobile & Internet/.test(r.rows[0])&&/Gifts & Donations/.test(r.rows[1]),'"&" names render');
 await p.evaluate(()=>{ db.customCats.expense=['Pet care']; db.tx.push({id:'z',date:thisMonth()+'-06',type:'Expense',accountId:'a1',category:'Pet care',description:'x',amount:5000}); render(); }); r=await info(); ok(/Pet care/.test(r.rows[0]),'custom category shows');
 // net worth
 await seed(C,[{name:'Bank',type:'Asset',amount:180000},{name:'Gold',type:'Asset',amount:60000},{name:'Car loan',type:'Debt',amount:90000}]); await p.waitForTimeout(900);
 const nw=()=>p.evaluate(()=>({t:document.getElementById('netWorth').innerText,a:document.getElementById('netWorthAssets').innerText,d:document.getElementById('netWorthDebts').innerText}));
 let w=await nw(); ok(/150,000/.test(w.t)&&/240,000/.test(w.a)&&/90,000/.test(w.d),'net worth / assets / debts: '+JSON.stringify(w));
 await seed(C,[{name:'Bank',type:'Asset',amount:1000},{name:'Loan',type:'Debt',amount:5000}]); await p.waitForTimeout(900); w=await nw(); ok(/4,000/.test(w.t)&&/-|−/.test(w.t)&&/1,000/.test(w.a)&&/5,000/.test(w.d),'negative net worth: '+JSON.stringify(w));
 await seed(C,[]); await p.waitForTimeout(700); w=await nw(); ok(/0/.test(w.t)&&/0/.test(w.a)&&/0/.test(w.d),'no assets/debts -> zeros: '+JSON.stringify(w));
 await p.evaluate(()=>[...document.querySelectorAll('#dashboard .card')].find(c=>c.classList.contains('fx-nw')).click()); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='networth'),'tapping the Net worth card opens the Net Worth screen');
 await p.evaluate(()=>goToScreen('dashboard')); await p.waitForTimeout(150);
 await p.focus('.fx-nw'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
 ok(await p.evaluate(()=>document.querySelector('.screen.active').id==='networth'),'keyboard: Enter on the focused card opens it');
 // tab order: card is focusable
 ok(await p.evaluate(()=>document.querySelector('.fx-nw').tabIndex===0&&document.querySelector('.fx-nw').getAttribute('role')==='button'),'card is a labelled, focusable button');
 await p.evaluate(()=>goToScreen('dashboard')); await p.waitForTimeout(150);
 // themes / RTL / overflow
 for(const [th,lang] of [['dark','en'],['light','ar'],['light','bn']]){
  await p.evaluate(([th,lang])=>{ document.documentElement.setAttribute('data-theme',th); setLanguage(lang); render(); },[th,lang]); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#catTopHolder .cat-top-row, .fx-nw-box')].every(e=>{const r=e.getBoundingClientRect(); return r.left>=-1&&r.right<=innerWidth+1;})),'no overflow in '+th+'/'+lang);
 }
 await p.evaluate(()=>{ document.documentElement.setAttribute('data-theme','light'); setLanguage('en'); });
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
