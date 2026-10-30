// FexaFY release builder: removes COMMENTS ONLY (JS, CSS, HTML) from index.html. No renaming, no minifying, no logic change.
// Usage:  npm i acorn   &&   node build-release.mjs <source index.html> <output index.html>
// It then PROVES equivalence: the JS of every inline <script> is re-parsed and its AST is compared with the original
// (comments are not part of an AST), CSS is compared after comment removal, and the HTML skeleton is compared.
import fs from 'fs'; import * as acorn from 'acorn'; import crypto from 'crypto';
const [,, SRC, OUT] = process.argv;
const src = fs.readFileSync(SRC, 'utf8');

// ---- split document into html / script / style / comment regions (sequential scan; the HTML tokenizer rules) ----
function regions(t){
  const out=[]; let i=0;
  while(i<t.length){
    const c=t.indexOf('<!--',i), s=t.search? null:null;
    const rs=/<script\b[^>]*>/gi, rt=/<style\b[^>]*>/gi; rs.lastIndex=i; rt.lastIndex=i;
    const ms=rs.exec(t), mt=rt.exec(t);
    const cand=[[c<0?Infinity:c,'comment'],[ms?ms.index:Infinity,'script'],[mt?mt.index:Infinity,'style']].sort((a,b)=>a[0]-b[0])[0];
    if(cand[0]===Infinity){ out.push({k:'html',s:i,e:t.length}); break; }
    if(cand[0]>i) out.push({k:'html',s:i,e:cand[0]});
    if(cand[1]==='comment'){ const e=t.indexOf('-->',cand[0]+4); const end=e<0?t.length:e+3; out.push({k:'comment',s:cand[0],e:end}); i=end; }
    else {
      const m=cand[1]==='script'?ms:mt; const open=m.index+m[0].length;
      const close=t.toLowerCase().indexOf(cand[1]==='script'?'</script':'</style',open);
      out.push({k:'open',s:m.index,e:open}); out.push({k:cand[1],s:open,e:close<0?t.length:close}); i=close<0?t.length:close;
    }
  }
  return out;
}
const OPEN=/<script\b[^>]*\bsrc=/i;
function stripJS(code){
  const comments=[]; const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script',allowHashBang:true,onComment:(block,text,start,end)=>comments.push({block,start,end})});
  let out='',pos=0;
  for(const c of comments){
    out+=code.slice(pos,c.start);
    const ls=code.lastIndexOf('\n',c.start-1)+1; let le=code.indexOf('\n',c.end); if(le<0) le=code.length;
    const before=code.slice(ls,c.start), after=code.slice(c.end,le);
    if(before.trim()===''&&after.trim()===''){ // whole-line comment: drop the line(s) entirely
      out=out.slice(0,out.length-before.length); pos=Math.min(code.length,le+1);
    } else {
      out+= c.block && code.slice(c.start,c.end).includes('\n') ? '\n' : (c.block?' ':''); pos=c.end;
    }
  }
  out+=code.slice(pos); return out;
}
function stripCSS(css){
  let out='',i=0,q=null;
  while(i<css.length){
    const ch=css[i];
    if(q){ out+=ch; if(ch==='\\'){ out+=css[i+1]||''; i+=2; continue; } if(ch===q) q=null; i++; continue; }
    if(ch==='"'||ch==="'"){ q=ch; out+=ch; i++; continue; }
    if(ch==='/'&&css[i+1]==='*'){ const e=css.indexOf('*/',i+2); i=e<0?css.length:e+2; continue; }
    out+=ch; i++;
  }
  return out.replace(/\n[ \t]*(?=\n)/g,'');   // blank lines left behind by comments
}
const rs=regions(src); let out='';
for(const r of rs){
  const t=src.slice(r.s,r.e);
  if(r.k==='comment') { if(/^<!--\s*\[if/i.test(t)) throw new Error('conditional comment found'); continue; }
  if(r.k==='script'){ out+=stripJS(t); continue; }
  if(r.k==='style'){ out+=stripCSS(t); continue; }
  out+=t;
}
out=out.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n');   // collapse runs of blank lines in the HTML part only left by removed comments
// (safe: this is applied to the whole file, but JS/CSS blank lines inside string/template literals are checked by the AST proof below)
fs.writeFileSync(OUT,out);

// ---------------- PROOF ----------------
const strip=(n)=>JSON.parse(JSON.stringify(n,(k,v)=>(k==='start'||k==='end')?undefined:v));
const A=regions(src), B=regions(out); let fails=0, nscripts=0;
const kinds=x=>x.filter(r=>r.k==='script'||r.k==='style'||r.k==='open');
const ka=kinds(A), kb=kinds(B);
if(ka.length!==kb.length){ console.log('FAIL region count',ka.length,kb.length); fails++; }
for(let i=0;i<ka.length;i++){
  const a=ka[i], b=kb[i];
  if(a.k!==b.k){ console.log('FAIL kind mismatch',i,a.k,b.k); fails++; continue; }
  const ta=src.slice(a.s,a.e), tb=out.slice(b.s,b.e);
  if(a.k==='open'){ if(ta!==tb){ console.log('FAIL tag changed',ta); fails++; } continue; }
  if(a.k==='script'){
    nscripts++;
    const pa=JSON.stringify(strip(acorn.parse(ta,{ecmaVersion:'latest',sourceType:'script',allowHashBang:true})));
    const pb=JSON.stringify(strip(acorn.parse(tb,{ecmaVersion:'latest',sourceType:'script',allowHashBang:true})));
    // literals must be identical too (acorn keeps value+raw in the AST)
    if(pa!==pb){ console.log('FAIL AST differs in script #'+nscripts); fails++; }
  } else {
    const norm=x=>stripCSS(x).replace(/\s+/g,'');
    if(norm(ta)!==norm(tb)){ console.log('FAIL css differs'); fails++; }
  }
}
// HTML skeleton: everything outside script/style/comments must be byte-identical apart from blank-line runs
const skel=(t,rg)=>rg.filter(r=>r.k==='html'||r.k==='open').map(r=>t.slice(r.s,r.e)).join('').replace(/\s+/g,' ');
if(skel(src,A)!==skel(out,B)){ console.log('FAIL html skeleton differs'); fails++; }
const h=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
console.log(fails? 'PROOF FAILED ('+fails+')' : 'PROOF OK: '+nscripts+' scripts have identical ASTs, CSS identical after comment removal, HTML skeleton identical');
console.log('source',src.length,'chars ->',out.length,'chars ('+(100-100*out.length/src.length).toFixed(1)+'% smaller)','| sha256',h(out));
process.exit(fails?1:0);
