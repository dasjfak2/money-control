// v130: More -> Settings / Data & reports / Suggestions & reports (the old Account & Backup screen split)
import { chromium, devices } from 'playwright'; import path from 'path'; import fs from 'fs';
const b=await chromium.launch({args:['--no-sandbox']});
let f=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)f++;};
const file='file://'+path.resolve(process.argv[2]);
const shotDir=process.argv[3]||'';
async function open(dev, seen=true){ const ctx=await b.newContext({...dev, permissions:['clipboard-read','clipboard-write']}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.goto(file); await p.waitForTimeout(500);
  await p.evaluate((seen)=>{ db=defaultDb(); db.profile={name:"T",countryCode:"+880",phone:"1",email:"t@x.com"}; document.getElementById('langGate').classList.add('hidden'); db.accounts=[{id:'a1',name:'SECRETNAME',type:'cash',opening:1000}]; db.meta=db.meta||{}; db.meta.onboardingSeen=true; db.meta.pageGuidesSeen={}; if(seen) Object.keys(PAGE_GUIDES).forEach(k=>db.meta.pageGuidesSeen[k]=true); render(); },seen);
  return p; }
const vis=(p,id)=>p.evaluate(i=>{const e=document.getElementById(i); return !!e&&e.offsetParent!==null;},id);
const title=p=>p.evaluate(()=>document.getElementById('syncTitle').textContent.trim());
const active=p=>p.evaluate(()=>document.querySelector('.screen.active').id);

for(const [name,dev] of [['mobile',devices['Pixel 7']],['desktop',{viewport:{width:1280,height:800}}]]){
  console.log('== '+name);
  const p=await open(dev);
  ok(await p.evaluate(()=>APP_VERSION)==='v130','version v130');
  await p.evaluate(()=>goToScreen('more'));
  ok(await p.evaluate(()=>['moreSetBtn','moreDataBtn','moreFbBtn'].every(i=>document.getElementById(i)&&document.getElementById(i).offsetParent!==null)&&!document.getElementById('moreAcctBtn')),'More shows 3 rows, old single row gone');
  ok(await p.evaluate(()=>!document.getElementById('fxSyncTabs')&&!document.getElementById('fxTabSet')&&!document.getElementById('fxTabData')),'in-page tab bar removed');
  if(shotDir) await p.screenshot({path:`${shotDir}/${name}_more.png`});

  // Settings
  await p.click('#moreSetBtn');
  ok(await active(p)==='sync','Settings opens the sync screen');
  ok(await title(p)==='Settings','title = Settings');
  for(const id of ['acctCard','cardProfile','cardLanguage','cardPrivacy','cardNotif','cardAppLock','cardUpdate']) ok(await vis(p,id),'Settings shows '+id);
  for(const id of ['cardStorage','cardBackupRestore','cardLegal','cardDangerZone']) ok(!(await vis(p,id)),'Settings hides '+id);
  ok(await p.evaluate(()=>document.querySelector('[data-group="more"].active')!==null),'More stays highlighted');
  if(shotDir) await p.screenshot({path:`${shotDir}/${name}_settings.png`,fullPage:false});

  // Data & reports
  await p.evaluate(()=>goToScreen('more')); await p.click('#moreDataBtn');
  ok(await active(p)==='sync'&&await title(p)==='Data & reports','Data & reports opens, title ok');
  for(const id of ['cardStorage','cardBackupRestore','cardLegal','cardDangerZone']) ok(await vis(p,id),'Data shows '+id);
  for(const id of ['acctCard','cardProfile','cardLanguage','cardNotif','cardAppLock','cardUpdate']) ok(!(await vis(p,id)),'Data hides '+id);
  ok(await p.evaluate(()=>/MB|used/i.test(document.getElementById('storageMeterText').textContent)),'storage meter rendered when Data opened');
  ok(await p.evaluate(()=>document.querySelectorAll('#fxSyncData .card').length>=8),'all Data cards still there ('+await p.evaluate(()=>document.querySelectorAll('#fxSyncData .card').length)+')');
  if(shotDir) await p.screenshot({path:`${shotDir}/${name}_data.png`});
  // repeatable: back to Settings again
  await p.evaluate(()=>goToScreen('more')); await p.click('#moreSetBtn');
  ok(await title(p)==='Settings'&&await vis(p,'cardProfile')&&!(await vis(p,'cardBackupRestore')),'Settings again after Data');
  // version label + owner area still at bottom of the screen in both views
  ok(await p.evaluate(()=>!!document.getElementById('fxVerLbl')&&document.getElementById('fxVerLbl').offsetParent!==null),'version label visible');

  // old-style callers
  await p.evaluate(()=>goToScreen('sync')); ok(await active(p)==='sync','goToScreen("sync") still works');
  await p.evaluate(()=>fxSyncShowFor('cardNotif')); ok(await title(p)==='Settings','fxSyncShowFor(cardNotif) -> Settings');
  await p.evaluate(()=>fxSyncShowFor('cardBackupRestore')); ok(await title(p)==='Data & reports'&&await vis(p,'cardBackupRestore'),'fxSyncShowFor(cardBackupRestore) -> Data');

  // Feedback screen
  await p.evaluate(()=>goToScreen('more')); await p.click('#moreFbBtn');
  ok(await active(p)==='feedback','Suggestions & reports opens');
  ok(await p.evaluate(()=>document.querySelector('[data-group="more"].active')!==null),'More highlighted on feedback');
  ok(await p.evaluate(()=>['fbType','fbMsg','fbInfo'].every(i=>document.getElementById(i).offsetParent!==null)),'form fields visible');
  ok(await p.evaluate(()=>{const e=document.getElementById('fbMsg'); const r=e.getBoundingClientRect(); return r.width>150&&r.height>80&&getComputedStyle(e).fontSize==='16.5px';}),'textarea styled like the other inputs');
  if(shotDir) await p.screenshot({path:`${shotDir}/${name}_feedback.png`});
  await p.evaluate(()=>{ window.__mail=[]; document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a[href^="mailto:"]'); if(a){ e.preventDefault(); window.__mail.push(a.getAttribute('href')); } },true); });
  // empty message -> toast, nothing opened
  await p.evaluate(()=>fxFbSend());
  ok(await p.evaluate(()=>window.__mail.length===0&&/write a message/i.test(document.body.innerText)),'empty message: nothing opened, toast shown');
  // bug + info
  await p.selectOption('#fbType','bug'); await p.fill('#fbMsg','Crash when I add a bill & "quote" ünïcode ১২৩');
  await p.evaluate(()=>fxFbSend());
  const href=await p.evaluate(()=>window.__mail[0]||''); const u=new URL(href); const body=decodeURIComponent(u.search.match(/body=([^&]*)/)[1]); const subj=decodeURIComponent(u.search.match(/subject=([^&]*)/)[1]);
  ok(href.startsWith('mailto:dasjfak2@gmail.com?'),'mailto goes to the public contact address');
  ok(subj==='[FexaFY v130] Bug report','subject has version + type: '+subj);
  ok(body.startsWith('Crash when I add a bill & "quote" ünïcode ১২৩'),'message intact incl. & " unicode');
  ok(/App: FexaFY v130/.test(body)&&/Language: en/.test(body)&&/Device: /.test(body)&&/Screen: \d+x\d+/.test(body),'app info appended');
  ok(!/SECRETNAME|1234|opening|balance/i.test(href+body),'no money data / account names in the email');
  // info off
  await p.evaluate(()=>{ document.getElementById('fbInfo').checked=false; window.__mail=[]; fxFbSend(); });
  const body2=decodeURIComponent((await p.evaluate(()=>window.__mail[0])).match(/body=([^&]*)/)[1]);
  ok(body2==='Crash when I add a bill & "quote" ünïcode ১২৩','info unticked -> message only');
  await p.selectOption('#fbType','suggestion'); await p.evaluate(()=>{ window.__mail=[]; fxFbSend(); });
  ok(/subject=%5BFexaFY%20v130%5D%20Suggestion/.test(await p.evaluate(()=>window.__mail[0])),'suggestion subject');
  // whitespace-only is empty
  await p.fill('#fbMsg','   \n  '); await p.evaluate(()=>{ window.__mail=[]; fxFbSend(); }); ok(await p.evaluate(()=>window.__mail.length===0),'whitespace-only counts as empty');
  // length cap
  await p.evaluate(()=>{ const e=document.getElementById('fbMsg'); e.value='x'.repeat(1000); }); ok(await p.evaluate(()=>document.getElementById('fbMsg').maxLength===1000),'maxlength 1000');
  // copy (real clipboard)
  await p.fill('#fbMsg','copy me'); await p.evaluate(()=>{ document.getElementById('fbInfo').checked=true; });
  await p.evaluate(()=>fxFbCopy()); await p.waitForTimeout(300);
  const clip=await p.evaluate(()=>navigator.clipboard.readText());
  ok(/^\[FexaFY v130\] Suggestion\n\ncopy me\n\n--\nApp: FexaFY v130/.test(clip),'Copy puts subject + message + info on the clipboard');
  ok(await p.evaluate(()=>/copied/i.test(document.body.innerText)),'copied toast');
  // copy fallback when the clipboard API is unavailable
  await p.evaluate(()=>{ Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}); window.__ec=0; const o=document.execCommand.bind(document); document.execCommand=function(c){ if(c==='copy'){ window.__ec++; return true;} return o.apply(document,arguments); }; fxFbCopy(); });
  ok(await p.evaluate(()=>window.__ec===1&&!document.querySelector('textarea[style*="fixed"]')),'fallback copy used execCommand and cleaned up');

  // global search
  await p.evaluate(()=>goToScreen('dashboard'));
  const rows=await p.evaluate(()=>{ renderGlobalSearchResults('suggest'); return [...document.querySelectorAll('#gsearchResults .gsearch-row')].map(r=>r.dataset.screen); });
  ok(rows.includes('feedback'),'global search finds Suggestions & reports: '+rows);
  await p.evaluate(()=>gsearchGoScreen('sync','cardBackupRestore')); await p.waitForTimeout(200); ok(await title(p)==='Data & reports','search "Backup & Restore" -> Data view');
  await p.evaluate(()=>gsearchGoScreen('sync','cardProfile')); await p.waitForTimeout(200); ok(await title(p)==='Settings'&&await vis(p,'cardProfile'),'search "My Profile" -> Settings view (profile now in Settings)');
  await p.evaluate(()=>gsearchGoScreen('sync','acctCard')); await p.waitForTimeout(200); ok(await title(p)==='Settings','search row "Settings" -> Settings');
  await p.evaluate(()=>gsearchGoScreen('sync','cardStorage')); await p.waitForTimeout(200); ok(await title(p)==='Data & reports','search row "Data & reports" -> Data');
  await p.evaluate(()=>gsearchGoScreen('feedback')); ok(await active(p)==='feedback','search row feedback -> feedback screen');
  ok(p.errs.length===0,'no page errors '+p.errs);
  await p.context().close();
}

// languages: all keys, title follows language switch in both views, RTL
{
  const p=await open(devices['Pixel 7']);
  const keys=['fb_title','fb_sub','fb_type','fb_t_sug','fb_t_bug','fb_t_other','fb_msg','fb_info','fb_send','fb_copy','fb_note','fb_empty','fb_copied'];
  const bad=await p.evaluate((keys)=>{ const o=[]; for(const l of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ for(const k of keys){ const v=I18N[l][k]; if(!v||!String(v).trim()) o.push(l+':'+k+' missing'); else if(l!=='en'&&v===I18N.en[k]&&!['fb_t_other','fb_type','fb_t_sug'].includes(k)) o.push(l+':'+k+' same as en'); } } return o; },keys);
  ok(bad.length===0,'13 feedback keys in 10 languages '+bad);
  const r=await p.evaluate(()=>{ const o=[]; for(const l of ['en','bn','hi','ur','ar','es','fr','pt','ru','zh']){ setLanguage(l);
      fxOpenSync('data'); if(document.getElementById('syncTitle').textContent.trim()!==I18N[l].sync_tab_data) o.push(l+' data title');
      fxOpenSync('set'); if(document.getElementById('syncTitle').textContent.trim()!==I18N[l].sync_tab_settings) o.push(l+' settings title');
      goToScreen('more'); const rows=['moreSetBtn','moreDataBtn','moreFbBtn'].map(i=>document.getElementById(i).textContent.trim());
      if(rows[0]!==I18N[l].sync_tab_settings||rows[1]!==I18N[l].sync_tab_data||rows[2]!==I18N[l].fb_title) o.push(l+' more rows '+rows);
      goToScreen('feedback'); if(document.querySelector('#feedback h2').textContent.trim()!==I18N[l].fb_title) o.push(l+' fb title');
      if(document.querySelector('#fbType option[value="bug"]').textContent.trim()!==I18N[l].fb_t_bug) o.push(l+' bug option');
    } setLanguage('en'); return o; });
  ok(r.length===0,'titles, More rows and feedback screen follow all 10 languages '+r);
  await p.evaluate(()=>{ setLanguage('ar'); goToScreen('feedback'); });
  ok(await p.evaluate(()=>document.documentElement.dir==='rtl'),'Arabic -> RTL feedback screen');
  if(shotDir) await p.screenshot({path:`${shotDir}/mobile_feedback_ar.png`});
  ok(p.errs.length===0,'no page errors '+p.errs);
  await p.context().close();
}
// page guide: opening Data first must not show a guide pointing at hidden Settings cards; Settings then shows it
{
  const p=await open(devices['Pixel 7'],false);
  await p.evaluate(()=>fxOpenSync('data')); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!(pgSteps&&pgSteps.length)||pgScreen!=='sync'),'no Settings guide while Data is showing');
  ok(await p.evaluate(()=>!document.querySelector('.pg-pop,.pgpop,#pgPop,.pageguide')||document.querySelector('.pg-pop,.pgpop,#pgPop,.pageguide').offsetParent===null),'no guide bubble visible on Data');
  await p.evaluate(()=>fxOpenSync('set')); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>pgScreen==='sync'&&pgSteps.length>=1),'guide appears when Settings opens ('+await p.evaluate(()=>pgSteps.map(s=>s.target))+')');
  await p.context().close();
}
// legal text + stale labels
{
  const s=fs.readFileSync(process.argv[2],'utf8');
  const stale=[...s.matchAll(/Account (?:&amp;|&) Backup/g)].map(m=>{ const a=s.lastIndexOf('\n',m.index)+1; return s.slice(a,s.indexOf('\n',m.index)).trim().slice(0,90); }).filter(l=>!/^(\/\/|\/\*|\*|debugging via|Full JSON|be changed|in Account|"Change PIN"|Net Worth, Analytics|window\.__APP_ICONS|\/\/ v119)/.test(l)&&!/^\s*(<!--)/.test(l));
  console.log(' remaining Account & Backup mentions that are not comments:',stale.length); stale.forEach(l=>console.log('   ',l));
  ok(stale.every(l=>/sync_title|onb_sync_title/.test(l)),'only the now-unused i18n labels remain (no user-facing text points at Account & Backup)');
  ok(/Suggestions and bug reports/.test(s),'privacy policy mentions the email-based suggestions');
}
console.log('FAILS '+f);
await b.close(); process.exit(f?1:0);
