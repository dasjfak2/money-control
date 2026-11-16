import { chromium, devices } from 'playwright'; import path from 'path';
const b=await chromium.launch({args:['--no-sandbox']}); let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const file='file://'+path.resolve(process.argv[2]);
async function open(dev){ const ctx=await b.newContext(dev); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(file); await p.waitForTimeout(500);
 await p.evaluate(()=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.accounts=[{id:'a1',name:'Cash',type:'cash',opening:5000}]; db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); render(); goToScreen('bills'); }); return p; }
const day=n=>`(()=>{const d=new Date();d.setDate(d.getDate()+(${n}));return localDateStr(d)})()`;
for(const [n,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
 console.log('== '+n); const p=await open(dev);
 ok(/^v1[34]\d$/.test(await p.evaluate(()=>APP_VERSION)),'v132');
 // add via the real form
 await p.evaluate(()=>openBill()); ok(await p.evaluate(()=>{const c=document.getElementById('bVar'); return c&&c.offsetParent!==null&&!c.checked&&c.getBoundingClientRect().width<30;}),'form has the checkbox, unticked, not stretched');
 await p.fill('#bName','Electricity'); await p.fill('#bDue',await p.evaluate(day(-20))); await p.fill('#bAmt','1000'); await p.check('#bVar'); await p.click('#modal button.primary');
 await p.evaluate(()=>openBill()); await p.fill('#bName','Rent'); await p.fill('#bDue',await p.evaluate(day(5))); await p.fill('#bAmt','8000'); await p.click('#modal button.primary');
 let r=await p.evaluate(()=>db.bills.map(b=>({n:b.name,v:b.varies===true,a:b.amount})));
 ok(r.length===2&&r[0].v&&!r[1].v&&await p.evaluate(()=>!('varies' in db.bills[1])),'varies saved only when ticked '+JSON.stringify(r));
 // non-varies: instant paid, no modal
 await p.evaluate(()=>toggleBill(1)); ok(await p.evaluate(()=>db.bills[1].paid==='Yes'&&document.getElementById('modal').classList.contains('hidden')),'normal bill: tick = paid at once (unchanged)');
 await p.evaluate(()=>toggleBill(1)); ok(await p.evaluate(()=>db.bills[1].paid==='No'),'normal bill: untick works');
 // varies: modal, validation, actual amount
 await p.evaluate(()=>toggleBill(0)); ok(await p.evaluate(()=>!document.getElementById('modal').classList.contains('hidden')&&document.getElementById('bActual').value==='1000'&&db.bills[0].paid==='No'),'usage bill: asks actual amount (prefilled), not paid yet');
 await p.fill('#bActual',''); await p.click('#modal button.primary'); ok(await p.evaluate(()=>db.bills[0].paid==='No'&&!document.getElementById('modal').classList.contains('hidden')&&/enter the bill amount/i.test(document.body.innerText)),'empty amount rejected with a toast');
 await p.fill('#bActual','1234'); await p.click('#modal button.primary');
 ok(await p.evaluate(()=>{const b=db.bills[0]; return b.amount===1234&&b.lastPaidAmount===1234&&b.lastPaidDate===localDateStr();}),'real amount recorded (late-paid bill then rolls straight to next cycle, as before)');
 // roll: due date is 20 days ago and paid -> next cycle automatically, unpaid, estimate
 await p.evaluate(()=>{ advanceBillCycles(); render(); });
 r=await p.evaluate(()=>{const b=db.bills[0]; const t=localDateStr(); return {due:b.due,future:b.due>=t,paid:b.paid,amt:b.amount,est:b.est,txt:document.getElementById('billList').innerText};});
 ok(r.future&&r.paid==='No'&&r.amt===1234&&r.est===true,'next month auto-created: unpaid, estimate = last real amount '+JSON.stringify([r.due,r.paid,r.amt,r.est]));
 ok(/≈/.test(r.txt)&&/Estimate \(last bill\)/.test(r.txt),'list shows ≈ and the estimate note');
 ok(await p.evaluate(()=>!/Estimate \(last bill\)/.test(document.querySelectorAll('#billList .item')[1].innerText)),'normal bill shows no estimate note');
 // edit keeps history + clears estimate
 await p.evaluate(()=>{ db.bills[0].id='b1'; openBill(0); }); await p.fill('#bAmt','1500'); await p.click('#modal button.primary');
 ok(await p.evaluate(()=>{const b=db.bills[0]; return b.amount===1500&&b.varies===true&&!('est' in b)&&b.id==='b1'&&b.lastPaidAmount===1234&&!!b.lastPaidDate&&b.paid==='No';}),'edit: new amount, id + last-paid history preserved, estimate cleared');
 await p.evaluate(()=>openBill(0)); await p.uncheck('#bVar'); await p.click('#modal button.primary'); ok(await p.evaluate(()=>!('varies' in db.bills[0])),'untick removes the flag');
 // normal bill roll unchanged
 r=await p.evaluate(()=>{ db.bills=[{name:'Net',due:(()=>{const d=new Date();d.setDate(d.getDate()-40);return localDateStr(d)})(),amount:700,paid:'Yes'}]; advanceBillCycles(); const b=db.bills[0]; return {paid:b.paid,amt:b.amount,est:'est' in b,future:b.due>=localDateStr()}; });
 ok(r.paid==='No'&&r.amt===700&&!r.est&&r.future,'normal bill roll-forward unchanged (same amount, no estimate)');
 // paid via expense link
 r=await p.evaluate(()=>{ db.bills=[{name:'Gas',due:(()=>{const d=new Date();d.setDate(d.getDate()+1);return localDateStr(d)})(),amount:900,paid:'No',varies:true},{name:'Fix',due:(()=>{const d=new Date();d.setDate(d.getDate()+1);return localDateStr(d)})(),amount:900,paid:'No'}]; payBillFromTx(0,1111,localDateStr()); payBillFromTx(1,1111,localDateStr()); return db.bills.map(b=>[b.amount,b.est===true,b.paid,b.lastPaidAmount]); });
 ok(JSON.stringify(r)==='[[1111,true,"No",1111],[900,false,"No",1111]]','expense-linked payment: usage bill takes actual as next estimate; normal bill amount untouched '+JSON.stringify(r));
 ok(await p.evaluate(()=>{ const s=JSON.stringify(db); return !!JSON.parse(s).bills; }),'db still serialises'); 
 ok(p.errs.length===0,'no page errors '+p.errs); await p.context().close();
}
// speed: slow Google Fonts must not block first paint; font CSS still applied when it arrives
for(const delay of [0,1500]){
 const ctx=await b.newContext(devices['Pixel 7']); const p=await ctx.newPage();
 await p.route(/fonts\.googleapis\.com/,async r=>{ await new Promise(s=>setTimeout(s,delay)); r.fulfill({status:200,contentType:'text/css',body:'/*fonts*/'}); });
 await p.route(/fonts\.gstatic|sentry|accounts\.google/,r=>r.abort());
 await p.goto(file,{waitUntil:'commit'}); await p.waitForFunction(()=>performance.getEntriesByType('paint').length>0,null,{timeout:20000});
 const fp=await p.evaluate(()=>Math.round(performance.getEntriesByType('paint')[0].startTime));
 ok(fp<(delay?900:900),`first paint ${fp}ms with font CSS delayed ${delay}ms (not blocked)`);
 await ctx.close();
}
console.log('FAILS '+f); await b.close(); process.exit(f?1:0);
