import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const OFF='file://'+path.resolve(process.argv[2]);
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n);
 const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto(OFF); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); loginType='local'; db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:90000}]; Object.assign(db.setup,{configured:true,income:60000}); db.tx=[]; render(); goToScreen('budget'); });
 // ---- built-ins
 const B=await p.evaluate(()=>({e:BASE_EXPENSE_CATS,i:BASE_INCOME_CATS,fe:[...document.querySelectorAll('#categoryBudgetInputs input')].map(x=>x.dataset.cat)}));
 ok(['Groceries','Education','Insurance','Subscriptions','Mobile & Internet','Family & Kids','Gifts & Donations','Travel'].every(c=>B.e.includes(c)),'8 new expense categories present');
 ok(['Bonus','Rent Income','Interest'].every(c=>B.i.includes(c)),'3 new income categories present');
 ok(['Food','Transport','Rent/Housing','Utilities','Shopping','Health','Entertainment','Investment','Savings','Debt Payment','Credit Card Bill','Bill','Loan Payment','Emergency','Future','Other','Salary','Business','Freelance','Investment Return','Gift','Other Income'].every(c=>B.e.includes(c)||B.i.includes(c)),'all 22 original categories still present');
 ok(JSON.stringify(B.fe)===JSON.stringify(B.e),'limits form lists every expense category in order');
 // pickers
 const pick=(type)=>p.evaluate((type)=>{ closeModal(); openTx(type); const o=[...fCat.options].map(x=>x.value); closeModal(); return o; },type);
 ok(JSON.stringify(await pick('Expense'))===JSON.stringify(B.e)&&JSON.stringify(await pick('Income'))===JSON.stringify(B.i),'add-entry pickers match the lists (Expense & Income)');
 ok(await p.evaluate(()=>{ closeModal(); openRecurring(null); const o=[...rcCat.options].map(x=>x.value); closeModal(); return JSON.stringify(o)===JSON.stringify(BASE_EXPENSE_CATS); }),'recurring picker matches');
 // ---- add custom
 const addC=(type,name)=>p.evaluate(([type,name])=>{ document.querySelectorAll('.toast').forEach(e=>e.remove()); ccType.value=type; ccName.value=name; addCustomCat(); return {toast:(document.querySelector('.toast')||{}).textContent||'', list:document.getElementById('customCatList').innerText.replace(/\s+/g,' ')}; },[type,name]);
 let r=await addC('Expense','Pet care'); ok(/Pet care/.test(r.list)&&/Added/.test(r.toast),'add expense category "Pet care": '+r.list);
 r=await addC('Income','টিউশন আয়'); ok(/টিউশন আয়/.test(r.list),'Bangla name accepted (combining marks): '+r.list);
 ok(await p.evaluate(()=>db.customCats.expense.join()==='Pet care'&&db.customCats.income.join()==='টিউশন আয়'),'saved in db.customCats');
 ok((await pick('Expense')).includes('Pet care')&&!(await pick('Income')).includes('Pet care')&&(await pick('Income')).includes('টিউশন আয়'),'appears in the right picker only');
 ok(await p.evaluate(()=>{ const i=document.querySelector('#categoryBudgetInputs input[data-cat="Pet care"]'); return !!i&&!!document.querySelector('label[for="'+i.id+'"]'); }),'appears in Category limits form with working label');
 // limit + entry + warn + home + analytics render
 await p.evaluate(()=>{ document.querySelector('#categoryBudgetInputs input[data-cat="Pet care"]').value=1000; saveCategoryBudgets(); });
 await p.evaluate(()=>{ closeModal(); openTx('Expense'); fCat.value='Pet care'; fAmt.value=1500; document.querySelector('#modalBody .primary').click(); }); await p.waitForTimeout(100);
 ok(await p.evaluate(()=>/Pet care/.test(document.querySelector('#modalBody .bw-pop')?.innerText||'')),'custom category triggers the budget popup'); await p.evaluate(()=>closeModal());
 ok(await p.evaluate(()=>{ goToScreen('dashboard'); render(); return /Pet care is .* over budget/.test(document.getElementById('reminderList').innerText); }),'custom category over limit shows on Home');
 ok(await p.evaluate(()=>{ goToScreen('analytics'); render(); return !!document.getElementById('analytics'); })&&p.errs.length===0,'dashboard/analytics render with a custom category, no errors '+p.errs);
 // ---- validation
 const bad=async(name,re)=>{ const before=await p.evaluate(()=>db.customCats.expense.length); r=await addC('Expense',name); const after=await p.evaluate(()=>db.customCats.expense.length); ok(before===after&&re.test(r.toast),'rejected '+JSON.stringify(name)+' -> '+r.toast); };
 await p.evaluate(()=>goToScreen('budget'));
 await bad('',/Use 1-24/); await bad('<b>x</b>',/Use 1-24/); await bad('A&B',/Use 1-24/); await bad('say "hi"',/Use 1-24/); await bad('x'.repeat(25),/Use 1-24/); await bad('constructor',/Use 1-24/); await bad('__proto__',/Use 1-24/);
 await bad('food',/already exists/); await bad('PET CARE',/already exists/); await bad('Salary',/already exists/); await bad('  Pet   care ',/already exists/);
 // 20 cap
 await p.evaluate(()=>{ db.customCats.expense=[]; for(let i=0;i<20;i++) db.customCats.expense.push('C'+i); }); await bad('One more',/up to 20/);
 await p.evaluate(()=>{ db.customCats.expense=['Pet care']; save(); renderCustomCatList(); renderCategoryBudgetForm(); fillCategoryBudgetForm(); });
 // ---- editing an entry whose custom category was deleted keeps its label
 await p.evaluate(()=>{ db.tx.push({date:todayStr(),type:'Expense',category:'Pet care',description:'x',amount:50,accountId:'a1'}); save(); render(); });
 await p.evaluate(()=>{ document.querySelector('#customCatList button').click(); });
 ok(await p.evaluate(()=>db.customCats.expense.length===0&&!db.setup.categoryBudgets['Pet care']&&!document.querySelector('#categoryBudgetInputs input[data-cat="Pet care"]')&&!/Pet care/.test(customCatList.innerText)),'delete removes category, its limit and its form field');
 ok(await p.evaluate(()=>db.tx.filter(x=>x.category==='Pet care').length>=1),'existing entries keep their category name');
 ok(await p.evaluate(()=>{ const i=db.tx.findIndex(x=>x.category==='Pet care'); closeModal(); openTx('Expense',i); const v=fCat.value; const has=[...fCat.options].some(o=>o.value==='Pet care'); fAmt.value=60; document.querySelector('#modalBody .primary').click(); return v==='Pet care'&&has&&db.tx[i].category==='Pet care'&&db.tx[i].amount==60; }),'editing an entry of a deleted category keeps the category');
 ok(await p.evaluate(()=>{ for(const k of Object.keys(BASE_EXPENSE_CATS)) {} return !document.querySelector('#customCatList')?.innerText.includes('Food'); }),'built-in categories have no delete control');
 // restore of a backup: customCats migrates, form rebuilds
 ok(await p.evaluate(()=>{ const d=defaultDb(); delete d.customCats; migrateDb(d); const ok1=Array.isArray(d.customCats.expense)&&Array.isArray(d.customCats.income); const d2=defaultDb(); d2.customCats={expense:[5,'Ok'],income:'bad'}; migrateDb(d2); return ok1&&d2.customCats.expense.join()==='Ok'&&d2.customCats.income.length===0; }),'old/garbled backups migrate safely');
 ok(await p.evaluate(()=>{ db.customCats.expense=['Zed']; renderCategoryBudgetForm(); fillCategoryBudgetForm(); return !!document.querySelector('#categoryBudgetInputs input[data-cat="Zed"]'); }),'limits form rebuilds when the category list changes (e.g. after restore)');
 await p.evaluate(()=>{ db.customCats.expense=[]; renderCategoryBudgetForm(); });
 // voice detect: old behaviour unchanged + new ones
 const v=await p.evaluate(()=>[detectVoiceCategory('lunch 200','Expense'),detectVoiceCategory('grocery 500','Expense'),detectVoiceCategory('wifi bill','Expense'),detectVoiceCategory('zakat 1000','Expense'),detectVoiceCategory('school fee','Expense'),detectVoiceCategory('netflix','Expense'),detectVoiceCategory('bonus 5000','Income'),detectVoiceCategory('salary','Income')]);
 ok(JSON.stringify(v)==='["Food","Food","Utilities","Gifts & Donations","Education","Subscriptions","Bonus","Salary"]','voice detection: old matches unchanged, new categories detected '+JSON.stringify(v));
 // names with & render: pie legend, tx list, filter
 await p.evaluate(()=>{ db.tx=[{date:todayStr(),type:'Expense',category:'Mobile & Internet',description:'recharge',amount:300,accountId:'a1'},{date:todayStr(),type:'Expense',category:'Gifts & Donations',description:'z',amount:200,accountId:'a1'},{date:todayStr(),type:'Income',category:'Bonus',description:'b',amount:900,accountId:'a1'}]; save(); render(); goToScreen('dashboard'); });
 ok(await p.evaluate(()=>/Mobile & Internet/.test(document.getElementById('catTopHolder').innerText)&&document.querySelectorAll('#catTopHolder *').length>0),'"&" category names render in the dashboard legend');
 ok(await p.evaluate(()=>{ goToScreen('transactions'); render(); const o=[...document.querySelectorAll('#fsCategory option')].map(x=>x.value); return o.includes('Mobile & Internet')&&o.includes('Gifts & Donations')&&/Mobile & Internet/.test(document.getElementById('transactions').innerText); }),'"&" names in transaction list and filter');
 ok(await p.evaluate(()=>categoryIconHTML('Travel').includes('<path')&&categoryIconHTML('Pet care').includes('<path')),'icons for new built-ins and fallback for custom');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 ok(p.errs.length===0,'no page errors '+p.errs); await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
