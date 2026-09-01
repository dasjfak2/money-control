const KEY="money-control-v2";
let db=JSON.parse(localStorage.getItem(KEY)||'null')||{
  setup:{income:50000,invest:5000,savings:5000,emergency:100000,emergencyMonthly:2000,futureMonthly:0},
  tx:[], bills:[], goals:{emergency:0,savings:0,investment:0}, debts:[], future:[], assets:[]
};

// migration for older saved data
db.setup.emergencyMonthly = db.setup.emergencyMonthly || 0;
db.setup.futureMonthly = db.setup.futureMonthly || 0;
db.goals.investment = db.goals.investment || 0;
db.goals.savings = db.goals.savings || 0;
db.goals.emergency = db.goals.emergency || 0;
db.debts.forEach(d=>{ if(d.dueDay===undefined) d.dueDay=null; });

const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const taka=n=>"৳"+Number(n||0).toLocaleString("en-BD",{maximumFractionDigits:0});
const monthKey=d=>{let x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")};
const thisMonth=()=>monthKey(new Date());

function ring(pct,color,size=72){
  pct=Math.max(0,Math.min(100,Number(pct)||0));
  const r=(size-11)/2, c=2*Math.PI*r, off=c*(1-pct/100);
  const mid=size/2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring">
    <circle cx="${mid}" cy="${mid}" r="${r}" stroke="#EDE6D6" stroke-width="8" fill="none"/>
    <circle cx="${mid}" cy="${mid}" r="${r}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${mid} ${mid})"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" class="ring-text">${Math.round(pct)}%</text>
  </svg>`;
}

function debtDue(d){
  let today=new Date(); today.setHours(0,0,0,0);
  let day=Math.min(28,+d.dueDay||1);
  let due=new Date(today.getFullYear(),today.getMonth(),day);
  if(due<today) due=new Date(today.getFullYear(),today.getMonth()+1,day);
  let days=Math.round((due-today)/86400000);
  let status = days<=7 ? "DUE SOON" : "UPCOMING";
  return {days,status,due};
}

function futureMonthlyNeed(){
  let total=0;
  db.future.forEach(x=>{
    let months=Math.max(1,Math.ceil((new Date(x.date)-new Date())/(30.44*86400000)));
    let need=Math.max(0,(x.target-x.saved)/months);
    total+=need;
  });
  return total;
}

function totals(){
  let tx=db.tx.filter(x=>monthKey(x.date)==thisMonth());
  let income=tx.filter(x=>x.type=="Income").reduce((a,x)=>a+ +x.amount,0);
  let expense=tx.filter(x=>x.type=="Expense").reduce((a,x)=>a+ +x.amount,0);
  let invest=tx.filter(x=>x.type=="Expense"&&x.investment=="Yes").reduce((a,x)=>a+ +x.amount,0);
  let savings=tx.filter(x=>x.type=="Expense"&&x.category=="Savings").reduce((a,x)=>a+ +x.amount,0);
  let emergency=tx.filter(x=>x.type=="Expense"&&x.category=="Emergency").reduce((a,x)=>a+ +x.amount,0);
  let future=tx.filter(x=>x.type=="Expense"&&x.category=="Future").reduce((a,x)=>a+ +x.amount,0);
  let bills=db.bills.filter(x=>x.paid!="Yes").reduce((a,x)=>a+ +x.amount,0);
  let totalInvest=db.tx.filter(x=>x.type=="Expense"&&x.investment=="Yes").reduce((a,x)=>a+ +x.amount,0)+ +db.goals.investment;
  let totalSavings=db.tx.filter(x=>x.type=="Expense"&&x.category=="Savings").reduce((a,x)=>a+ +x.amount,0)+ +db.goals.savings;
  let totalEmergency=db.tx.filter(x=>x.type=="Expense"&&x.category=="Emergency").reduce((a,x)=>a+ +x.amount,0)+ +db.goals.emergency;
  let futureNeed=futureMonthlyNeed();
  let committed=(+db.setup.invest||0)+(+db.setup.savings||0)+(+db.setup.emergencyMonthly||0)+(+db.setup.futureMonthly||0)+futureNeed;
  let safeSpending=Math.max(0,(+db.setup.income||0)-committed);
  return {income,expense,invest,savings,emergency,future,bills,remaining:db.setup.income-expense,totalInvest,totalSavings,totalEmergency,safeSpending,committed,futureNeed};
}

function reminders(){
  const z=totals();
  let list=[];
  db.bills.forEach(b=>{
    if(b.paid=="Yes") return;
    let d=Math.ceil((new Date(b.due)-new Date())/86400000);
    if(d<0) list.push({level:"danger",text:`Bill overdue — ${b.name} • ${taka(b.amount)}`});
    else if(d<=7) list.push({level:"warn",text:`Bill due in ${d}d — ${b.name} • ${taka(b.amount)}`});
  });
  db.debts.forEach(d=>{
    if(!d.dueDay) return;
    let info=debtDue(d);
    if(info.status=="DUE SOON") list.push({level:"warn",text:`Debt payment due in ${info.days}d — ${d.name} • ${taka((+d.min||0)+(+d.extra||0))}`});
  });
  let day=new Date().getDate();
  if(day>=1){
    if(db.setup.invest && z.invest<db.setup.invest) list.push({level:"info",text:`Investment goal — ${taka(db.setup.invest-z.invest)} left this month`});
    if(db.setup.savings && z.savings<db.setup.savings) list.push({level:"info",text:`Savings goal — ${taka(db.setup.savings-z.savings)} left this month`});
    if(db.setup.emergencyMonthly && z.emergency<db.setup.emergencyMonthly) list.push({level:"info",text:`Emergency fund — ${taka(db.setup.emergencyMonthly-z.emergency)} left this month`});
    if(db.setup.futureMonthly && z.future<db.setup.futureMonthly) list.push({level:"info",text:`Future savings — ${taka(db.setup.futureMonthly-z.future)} left this month`});
  }
  return list;
}

function render(){
  const z=totals();
  document.getElementById("remaining").textContent=taka(z.safeSpending);
  document.getElementById("mIncome").textContent=taka(z.income);
  document.getElementById("mExpense").textContent=taka(z.expense);
  document.getElementById("mInvest").textContent=taka(z.invest);
  document.getElementById("mSave").textContent=taka(z.savings);
  document.getElementById("mEmergency").textContent=taka(z.emergency);
  document.getElementById("mFuture").textContent=taka(z.future);

  let rl=reminders();
  document.getElementById("reminderList").innerHTML = rl.length
    ? rl.map(r=>`<div class="reminder-item r-${r.level}"><span class="dot"></span>${r.text}</div>`).join("")
    : '<div class="muted">No reminders right now — you\'re on track.</div>';

  document.getElementById("ringInvest").innerHTML=ring(db.setup.invest?z.invest/db.setup.invest*100:0,"var(--invest)");
  document.getElementById("ringSavings").innerHTML=ring(db.setup.savings?z.savings/db.setup.savings*100:0,"var(--savings)");
  document.getElementById("ringEmergency").innerHTML=ring(db.setup.emergencyMonthly?z.emergency/db.setup.emergencyMonthly*100:0,"var(--income)");
  document.getElementById("ringFuture").innerHTML=ring(db.setup.futureMonthly?z.future/db.setup.futureMonthly*100:0,"var(--future)");

  const assets=db.assets.filter(x=>x.type=="Asset").reduce((a,x)=>a+ +x.amount,0), debts=db.assets.filter(x=>x.type=="Debt").reduce((a,x)=>a+ +x.amount,0);
  document.getElementById("netWorth").textContent=taka(assets-debts);

  document.getElementById("monthlyIncome").value=db.setup.income;
  document.getElementById("investmentBudget").value=db.setup.invest;
  document.getElementById("savingsGoal").value=db.setup.savings;
  document.getElementById("emergencyTarget").value=db.setup.emergency;
  document.getElementById("emergencyMonthlyTarget").value=db.setup.emergencyMonthly;
  document.getElementById("futureMonthlyTarget").value=db.setup.futureMonthly;
  document.getElementById("investOpening").value=db.goals.investment;

  document.getElementById("allocIncome").textContent=taka(db.setup.income);
  document.getElementById("allocInvest").textContent=taka(db.setup.invest);
  document.getElementById("allocSavings").textContent=taka(db.setup.savings);
  document.getElementById("allocEmergency").textContent=taka(db.setup.emergencyMonthly);
  document.getElementById("allocFuture").textContent=taka(db.setup.futureMonthly + z.futureNeed);
  document.getElementById("allocCommitted").textContent=taka(z.committed);
  document.getElementById("allocSafe").textContent=taka(z.safeSpending);

  document.getElementById("investRing").innerHTML=ring(db.setup.invest?z.invest/db.setup.invest*100:0,"var(--invest)");
  document.getElementById("investMonthText").textContent=`${taka(z.invest)} / ${taka(db.setup.invest)}`;
  document.getElementById("investReminder").textContent = z.invest>=db.setup.invest && db.setup.invest ? "This month's investment goal is reached." : `${taka(Math.max(0,db.setup.invest-z.invest))} left to reach this month's goal.`;
  document.getElementById("investTotalText").textContent=taka(z.totalInvest);

  document.getElementById("savingsOpening").value=db.goals.savings;
  document.getElementById("emergencyOpening").value=db.goals.emergency;
  document.getElementById("savingsRing").innerHTML=ring(db.setup.savings?z.savings/db.setup.savings*100:0,"var(--savings)");
  document.getElementById("savingsMonthText").textContent=`${taka(z.savings)} / ${taka(db.setup.savings)}`;
  document.getElementById("savingsReminder").textContent = z.savings>=db.setup.savings && db.setup.savings ? "This month's savings goal is reached." : `${taka(Math.max(0,db.setup.savings-z.savings))} left to reach this month's goal.`;
  document.getElementById("savingsTotalText").textContent=taka(z.totalSavings);
  document.getElementById("emergencyMonthRing").innerHTML=ring(db.setup.emergencyMonthly?z.emergency/db.setup.emergencyMonthly*100:0,"var(--income)");
  document.getElementById("emergencyMonthText").textContent=`${taka(z.emergency)} / ${taka(db.setup.emergencyMonthly)}`;
  document.getElementById("emergencyReminder").textContent = z.emergency>=db.setup.emergencyMonthly && db.setup.emergencyMonthly ? "This month's emergency saving target is reached." : `${taka(Math.max(0,db.setup.emergencyMonthly-z.emergency))} left to reach this month's target.`;
  document.getElementById("goalEmergencyText").textContent=`${taka(z.totalEmergency)} / ${taka(db.setup.emergency)}`;
  document.getElementById("goalEmergencyBar").style.width=Math.min(100,db.setup.emergency?z.totalEmergency/db.setup.emergency*100:0)+"%";

  document.getElementById("futureMonthRing").innerHTML=ring(db.setup.futureMonthly?z.future/db.setup.futureMonthly*100:0,"var(--future)");
  document.getElementById("futureMonthText").textContent=`${taka(z.future)} / ${taka(db.setup.futureMonthly)}`;
  document.getElementById("futureReminder").textContent = z.future>=db.setup.futureMonthly && db.setup.futureMonthly ? "This month's future savings goal is reached." : `${taka(Math.max(0,db.setup.futureMonthly-z.future))} left to reach this month's goal.`;

  renderTx();renderBills();renderDebts();renderFuture();renderAssets();
}

function renderTx(){
  const monthTx = db.tx.filter(x=>monthKey(x.date)==thisMonth()).slice().reverse();
  const incomeTx = monthTx.filter(x=>x.type=="Income");
  const expenseTx = monthTx.filter(x=>x.type=="Expense");

  const incByCat = {};
  incomeTx.forEach(x=>{ incByCat[x.category]=incByCat[x.category]||[]; incByCat[x.category].push(x); });
  const expByCat = {};
  expenseTx.forEach(x=>{ expByCat[x.category]=expByCat[x.category]||[]; expByCat[x.category].push(x); });

  let incHtml = '';
  let incTotal = 0;
  for(const [cat,items] of Object.entries(incByCat)){
    let catTotal = items.reduce((a,x)=>a+ +x.amount,0);
    incTotal += catTotal;
    incHtml += `<div class="tx-cat-group">
      <div class="tx-cat-header"><span>${cat}</span><b>${taka(catTotal)}</b></div>
      ${items.map((x)=>{
        const realIdx = db.tx.indexOf(x);
        return `<div class="tx-row">
          <div class="tx-info">
            <div class="tx-title">${x.description||x.category}</div>
            <div class="tx-meta">${x.date} • ${taka(x.amount)}</div>
          </div>
          <div class="tx-actions">
            <button onclick="openTx('Income',${realIdx})" title="Edit">&#9998;</button>
            <button onclick="delTx(${realIdx})" title="Delete">&#215;</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  if(!incomeTx.length) incHtml = '<div class="muted center">No income this month</div>';

  let expHtml = '';
  let expTotal = 0;
  for(const [cat,items] of Object.entries(expByCat)){
    let catTotal = items.reduce((a,x)=>a+ +x.amount,0);
    expTotal += catTotal;
    expHtml += `<div class="tx-cat-group">
      <div class="tx-cat-header exp"><span>${cat}</span><b>${taka(catTotal)}</b></div>
      ${items.map((x)=>{
        const realIdx = db.tx.indexOf(x);
        return `<div class="tx-row">
          <div class="tx-info">
            <div class="tx-title">${x.description||x.category}</div>
            <div class="tx-meta">${x.date} • ${taka(x.amount)}${x.investment=="Yes"?" • Investment":""} • ${x.need||""}</div>
          </div>
          <div class="tx-actions">
            <button onclick="openTx('Expense',${realIdx})" title="Edit">&#9998;</button>
            <button onclick="delTx(${realIdx})" title="Delete">&#215;</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  if(!expenseTx.length) expHtml = '<div class="muted center">No expenses this month</div>';

  document.getElementById("txIncomeCol").innerHTML = `
    <div class="tx-col-header"><span>Income</span><b>${taka(incTotal)}</b></div>
    ${incHtml}`;
  document.getElementById("txExpenseCol").innerHTML = `
    <div class="tx-col-header exp"><span>Expense</span><b>${taka(expTotal)}</b></div>
    ${expHtml}`;
}

function renderBills(){
  let el=document.getElementById("billList");
  el.innerHTML=db.bills.map((x,i)=>{
    let days=Math.ceil((new Date(x.due)-new Date())/86400000);
    let st=x.paid=="Yes"?"PAID":days<0?"OVERDUE":days<=7?"DUE SOON":"UPCOMING";
    let cls=st=="PAID"?"tag good":st=="OVERDUE"?"tag danger":st=="DUE SOON"?"tag warn":"tag";
    return `<div class="item"><div class="row"><b>${x.name}</b><span class="${cls}">${st}</span></div>
      <div class="row"><span class="muted">${x.due} • ${taka(x.amount)}</span>
      <span class="item-actions">
        <button onclick="openBill(${i})" title="Edit">&#9998;</button>
        <button onclick="toggleBill(${i})">${x.paid=="Yes"?"&#8617;":"&#10003;"}</button>
        <button onclick="db.bills.splice(${i},1);save();render()">&#215;</button>
      </span></div></div>`;
  }).join("")||'<div class="card muted">No bills yet.</div>';
}

function renderDebts(){
  document.getElementById("debtList").innerHTML=db.debts.map((x,i)=>{
    let paid=Math.max(0,(+x.start||0)-(+x.current||0));
    let pct=x.start?Math.min(100,Math.max(0,paid/x.start*100)):0;
    let payment=(+x.min||0)+(+x.extra||0);
    let dueTxt="";
    if(x.dueDay){ let info=debtDue(x); dueTxt=`<div class="muted">Next due day ${x.dueDay} • ${info.status=="DUE SOON"?`in ${info.days}d`:`in ${info.days}d`}</div>`; }
    return `<div class="item"><div class="row"><b>${x.name}</b>
      <span class="item-actions">
        <button onclick="openDebt(${i})" title="Edit">&#9998;</button>
        <button onclick="db.debts.splice(${i},1);save();render()">&#215;</button>
      </span></div>
      <div class="trackrow">
        ${ring(pct,"var(--expense)",60)}
        <div class="trackinfo">
          <div class="muted">Paid ${taka(paid)} of ${taka(x.start)}</div>
          <div class="muted">Remaining ${taka(x.current)}</div>
          <div class="muted">Monthly payment ${taka(payment)}</div>
          ${dueTxt}
        </div>
      </div></div>`;
  }).join("")||'<div class="card muted">No debts yet.</div>';
}

function renderFuture(){
  document.getElementById("futureList").innerHTML=db.future.map((x,i)=>{
    let months=Math.max(1,Math.ceil((new Date(x.date)-new Date())/(30.44*86400000)));
    let need=Math.max(0,(x.target-x.saved)/months);
    let pct=x.target?Math.min(100,Math.max(0,x.saved/x.target*100)):0;
    return `<div class="item"><div class="row"><b>${x.name}</b>
      <span class="item-actions">
        <button onclick="openFuture(${i})" title="Edit">&#9998;</button>
        <button onclick="db.future.splice(${i},1);save();render()">&#215;</button>
      </span></div>
      <div class="trackrow">
        ${ring(pct,"var(--gold-dark)",60)}
        <div class="trackinfo">
          <div class="muted">${x.date} • target ${taka(x.target)}</div>
          <div class="muted">Saved ${taka(x.saved)}</div>
          <div class="muted">Need ${taka(need)}/month</div>
        </div>
      </div></div>`;
  }).join("")||'<div class="card muted">No future expenses yet.</div>';
}

function renderAssets(){
  let A=0,D=0;
  document.getElementById("assetList").innerHTML=db.assets.map((x,i)=>{
    if(x.type=="Asset") A+=+x.amount; else D+=+x.amount;
    return `<div class="item"><div class="row"><b>${x.name}</b>
      <span class="item-actions">
        <button onclick="openAsset(${i})" title="Edit">&#9998;</button>
        <button onclick="db.assets.splice(${i},1);save();render()">&#215;</button>
      </span></div>
      <div class="muted">${x.type} • ${taka(x.amount)}</div></div>`;
  }).join("")||'<div class="card muted">No assets/debts yet.</div>';
  document.getElementById("assetsTotal").textContent=taka(A);
  document.getElementById("debtsTotal").textContent=taka(D);
  document.getElementById("nwTotal").textContent=taka(A-D);
}

function openTx(type, idx=null){
  const d = idx!==null ? db.tx[idx] : null;
  const isEdit = idx!==null;
  const categories = type=="Income"
    ? ["Salary","Business","Freelance","Investment Return","Gift","Other Income"]
    : ["Food","Transport","Rent/Housing","Utilities","Shopping","Health","Entertainment","Investment","Savings","Debt Payment","Emergency","Future","Other"];
  const catOptions = categories.map(c=>`<option value="${c}" ${d&&d.category==c?'selected':''}>${c}</option>`).join('');
  modal(`<h3>${isEdit?'Edit':'Add'} ${type}</h3><div class="form">
    <label>Date<input id="fDate" type="date" value="${d?d.date:new Date().toISOString().slice(0,10)}"></label>
    <label>Category<select id="fCat">${catOptions}</select></label>
    <label>Description<input id="fDesc" placeholder="What was it?" value="${d?d.description||'':''}"></label>
    <label>Amount<input id="fAmt" type="number" inputmode="decimal" placeholder="0" value="${d?d.amount:''}"></label>
    ${type=="Expense"?`<label>Need/Want<select id="fNW"><option ${d&&d.need=="Need"?'selected':''}>Need</option><option ${d&&d.need=="Want"?'selected':''}>Want</option></select></label>
    <label>Investment? <select id="fInv"><option ${d&&d.investment=="No"?'selected':''}>No</option><option ${d&&d.investment=="Yes"?'selected':''}>Yes</option></select></label>`:''}
    <button class="primary" onclick="${isEdit?`saveTx(${idx})`:`addTx('${type}')`}">${isEdit?'Update':'Save'}</button></div>`);
}
function addTx(type){
  db.tx.push({date:fDate.value,type,category:fCat.value,description:fDesc.value,amount:+fAmt.value||0,need:type=="Expense"?fNW.value:"",investment:type=="Expense"?fInv.value:"No"});
  save();closeModal();render();
}
function saveTx(idx){
  const t = db.tx[idx];
  t.date=fDate.value; t.category=fCat.value; t.description=fDesc.value; t.amount=+fAmt.value||0;
  if(t.type=="Expense"){ t.need=fNW.value; t.investment=fInv.value; }
  save();closeModal();render();
}

function openBill(idx=null){
  const d = idx!==null ? db.bills[idx] : null;
  const isEdit = idx!==null;
  modal(`<h3>${isEdit?'Edit':'Add'} Bill</h3><div class="form">
    <label>Bill name<input id="bName" value="${d?d.name:''}"></label>
    <label>Due date<input id="bDue" type="date" value="${d?d.due:''}"></label>
    <label>Amount<input id="bAmt" type="number" inputmode="decimal" value="${d?d.amount:''}"></label>
    <button class="primary" onclick="${isEdit?`saveBill(${idx})`:`addBill()`}">${isEdit?'Update':'Save'}</button></div>`);
}
function addBill(){db.bills.push({name:bName.value,due:bDue.value,amount:+bAmt.value||0,paid:'No'});save();closeModal();render()}
function saveBill(idx){db.bills[idx]={name:bName.value,due:bDue.value,amount:+bAmt.value||0,paid:db.bills[idx].paid};save();closeModal();render()}
function toggleBill(i){db.bills[i].paid=db.bills[i].paid=="Yes"?"No":"Yes";save();render()}

function openDebt(idx=null){
  const d = idx!==null ? db.debts[idx] : null;
  const isEdit = idx!==null;
  modal(`<h3>${isEdit?'Edit':'Add'} Debt</h3><div class="form">
    <label>Name<input id="dName" value="${d?d.name:''}"></label>
    <label>Starting balance<input id="dStart" type="number" value="${d?d.start:''}"></label>
    <label>Current balance<input id="dCurrent" type="number" value="${d?d.current:''}"></label>
    <label>Minimum payment<input id="dMin" type="number" value="${d?d.min:''}"></label>
    <label>Extra payment<input id="dExtra" type="number" value="${d?d.extra:''}"></label>
    <label>Monthly due day (1-28, optional)<input id="dDue" type="number" min="1" max="28" value="${d?d.dueDay||'':''}"></label>
    <button class="primary" onclick="${isEdit?`saveDebt(${idx})`:`addDebt()`}">${isEdit?'Update':'Save'}</button></div>`);
}
function addDebt(){db.debts.push({name:dName.value,start:+dStart.value||0,current:+dCurrent.value||0,min:+dMin.value||0,extra:+dExtra.value||0,dueDay:+dDue.value||null});save();closeModal();render()}
function saveDebt(idx){db.debts[idx]={name:dName.value,start:+dStart.value||0,current:+dCurrent.value||0,min:+dMin.value||0,extra:+dExtra.value||0,dueDay:+dDue.value||null};save();closeModal();render()}

function openFuture(idx=null){
  const d = idx!==null ? db.future[idx] : null;
  const isEdit = idx!==null;
  modal(`<h3>${isEdit?'Edit':'Add'} Future Expense</h3><div class="form">
    <label>Expense<input id="fuName" value="${d?d.name:''}"></label>
    <label>Target date<input id="fuDate" type="date" value="${d?d.date:''}"></label>
    <label>Target amount<input id="fuTarget" type="number" value="${d?d.target:''}"></label>
    <label>Saved so far<input id="fuSaved" type="number" value="${d?d.saved:''}"></label>
    <button class="primary" onclick="${isEdit?`saveFuture(${idx})`:`addFuture()`}">${isEdit?'Update':'Save'}</button></div>`);
}
function addFuture(){db.future.push({name:fuName.value,date:fuDate.value,target:+fuTarget.value||0,saved:+fuSaved.value||0});save();closeModal();render()}
function saveFuture(idx){db.future[idx]={name:fuName.value,date:fuDate.value,target:+fuTarget.value||0,saved:+fuSaved.value||0};save();closeModal();render()}

function openAsset(idx=null){
  const d = idx!==null ? db.assets[idx] : null;
  const isEdit = idx!==null;
  modal(`<h3>${isEdit?'Edit':'Add'} Asset / Debt</h3><div class="form">
    <label>Name<input id="aName" value="${d?d.name:''}"></label>
    <label>Type<select id="aType"><option ${d&&d.type=="Asset"?'selected':''}>Asset</option><option ${d&&d.type=="Debt"?'selected':''}>Debt</option></select></label>
    <label>Amount<input id="aAmt" type="number" value="${d?d.amount:''}"></label>
    <button class="primary" onclick="${isEdit?`saveAsset(${idx})`:`addAsset()`}">${isEdit?'Update':'Save'}</button></div>`);
}
function addAsset(){db.assets.push({name:aName.value,type:aType.value,amount:+aAmt.value||0});save();closeModal();render()}
function saveAsset(idx){db.assets[idx]={name:aName.value,type:aType.value,amount:+aAmt.value||0};save();closeModal();render()}

function saveSetup(){
  db.setup.income=+monthlyIncome.value||0;
  db.setup.invest=+investmentBudget.value||0;
  db.setup.savings=+savingsGoal.value||0;
  db.setup.emergency=+emergencyTarget.value||0;
  db.setup.emergencyMonthly=+emergencyMonthlyTarget.value||0;
  db.setup.futureMonthly=+futureMonthlyTarget.value||0;
  db.goals.investment=+investOpening.value||0;
  save();render();
  showToast("Budget settings saved.");
}
function saveGoals(){
  db.goals.savings=+savingsOpening.value||0;
  db.goals.emergency=+emergencyOpening.value||0;
  save();render();
  showToast("Savings & emergency settings saved.");
}
function delTx(i){db.tx.splice(i,1);save();render()}

function modal(html){document.getElementById("modalBody").innerHTML=html;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}

function showToast(msg){
  let t=document.createElement("div");
  t.className="toast";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add("show"),10);
  setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),300)},2000);
}

document.querySelectorAll(".nav button[data-screen], .botnav button[data-screen]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(b.dataset.screen).classList.add("active");
  document.querySelectorAll(".nav button[data-screen], .botnav button[data-screen]").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(`[data-screen="${b.dataset.screen}"]`).forEach(x=>x.classList.add("active"));
  window.scrollTo(0,0);
});

document.getElementById("resetBtn").onclick=()=>{if(confirm("Delete all saved data?")){localStorage.removeItem(KEY);location.reload()}};
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
render();
