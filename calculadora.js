/* Calculadora flutuante New Termisa · sem operações no Firebase.
   Histórico de contas local (não sincronizado entre dispositivos). */
(function(){
 'use strict';
 if(document.getElementById('ntc-root'))return;
 const isMain=!!document.getElementById('navigation'),KEY='nt_almox_calculadora_history_v1',MAX=100;
 const style=document.createElement('style');style.id='ntc-css';style.textContent="\n#ntc-root,#ntc-root *{box-sizing:border-box}\n#ntc-root{position:fixed;right:12px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:11;font:14px/1.35 system-ui,-apple-system,\"Segoe UI\",sans-serif;color:#eff8ff;pointer-events:none}\n#ntc-root.ntc-standalone{bottom:calc(15px + env(safe-area-inset-bottom,0px))}\n#ntc-root[hidden]{display:none!important}\n#ntc-root button{font:inherit;color:inherit;background:#1c4263;border:1px solid #456c8e;cursor:pointer;border-radius:11px;min-height:43px;touch-action:manipulation;user-select:none;-webkit-user-select:none}\n#ntc-root button:focus-visible{outline:2px solid #8dd7f9;outline-offset:2px}\n#ntc-root button:active{filter:brightness(1.15)}\n#ntc-root .ntc-fab{pointer-events:auto;display:flex;justify-content:center;align-items:center;margin-left:auto;width:54px;height:54px;border-radius:17px;background:linear-gradient(140deg,#329dea,#216fb9);border-color:#7bbaf0;box-shadow:0 5px 22px #000b;font-size:29px;font-weight:600}\n#ntc-root.ntc-open .ntc-fab{display:none}\n#ntc-root .ntc-panel{pointer-events:auto;display:none;flex-direction:column;width:min(344px,calc(100vw - 24px));max-height:calc(100dvh - 132px);border:1px solid #527c9f;border-radius:20px;background:linear-gradient(150deg,#173c5d,#0e2946);box-shadow:0 14px 45px #001322bb;overflow:hidden}\n#ntc-root.ntc-standalone .ntc-panel{max-height:calc(100dvh - 35px)}\n#ntc-root.ntc-open .ntc-panel{display:flex}\n#ntc-root .ntc-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:12px 13px;border-bottom:1px solid #3c6484}\n#ntc-root .ntc-head strong{font-size:14px}\n#ntc-root .ntc-head small{display:block;color:#83d1c6;font-size:10px;font-weight:650;letter-spacing:.3px}\n#ntc-root .ntc-actions{display:flex;gap:6px}\n#ntc-root .ntc-actions button{min-height:35px;width:36px;height:35px;background:#265171;font-size:18px}\n#ntc-root .ntc-actions [aria-pressed=true]{background:#3389cc}\n#ntc-root .ntc-calc,#ntc-root .ntc-history{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px}\n#ntc-root .ntc-displaywrap{background:#081f35;border:1px solid #355d7d;border-radius:14px;padding:10px 13px;text-align:right;min-height:88px;margin-bottom:11px}\n#ntc-root .ntc-expr{font-size:12px;color:#accbe0;min-height:17px;overflow-wrap:anywhere}\n#ntc-root .ntc-display{font-size:clamp(26px,6vw,34px);font-weight:750;min-height:40px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}\n#ntc-root .ntc-error{font-size:19px;color:#ffc3b8}\n#ntc-root .ntc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}\n#ntc-root .ntc-grid button{height:48px;font-weight:700;font-size:19px}\n#ntc-root .ntc-grid .ntc-func{background:#275170;color:#bfe3fc}\n#ntc-root .ntc-grid .ntc-op{background:#275a84;color:#bbe9ff}\n#ntc-root .ntc-grid .ntc-equals{background:#308edb;border-color:#6cb6fa}\n#ntc-root .ntc-grid .ntc-delete{background:#385977}\n#ntc-root .ntc-tip{font-size:11px;text-align:center;color:#b6ccdd;margin-top:10px}\n#ntc-root .ntc-historyhead{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:12px}\n#ntc-root .ntc-historyhead strong{font-size:13px}\n#ntc-root .ntc-historyhead button{font-size:11px;min-height:35px;padding:7px 10px}\n#ntc-root .ntc-entry{display:block;width:100%;text-align:left;background:#0d2e49;border:1px solid #3d6784;padding:10px;border-radius:11px;margin:7px 0}\n#ntc-root .ntc-entry span{display:block;color:#b2cde2;font-size:12px;overflow-wrap:anywhere}\n#ntc-root .ntc-entry strong{display:block;font-size:20px;overflow-wrap:anywhere}\n#ntc-root .ntc-entry small{font-size:10px;color:#99b5cb}\n#ntc-root .ntc-empty{color:#acccdf;font-size:12px;padding:12px 0}\n#ntc-root .ntc-historynote{font-size:10px;color:#9fbbcf;margin-top:10px}\n@media(max-width:420px){#ntc-root{right:10px}#ntc-root .ntc-panel{width:min(330px,calc(100vw - 20px))}#ntc-root .ntc-grid button{height:46px}}\n@media(max-height:640px){#ntc-root .ntc-grid button{height:39px}#ntc-root .ntc-displaywrap{min-height:70px}}\n@media print{#ntc-root{display:none!important}}\n";document.head.appendChild(style);
 const root=document.createElement('div');root.id='ntc-root';root.className=isMain?'':'ntc-standalone';root.hidden=isMain;root.innerHTML="\n<button type=\"button\" class=\"ntc-fab\" data-ntc=\"open\" aria-label=\"Abrir calculadora\" title=\"Calculadora\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2.5\"/><rect x=\"8\" y=\"6\" width=\"8\" height=\"3\" rx=\".4\"/><path d=\"M8 13h1m4 0h1m-5 4h1m4 0h1m3-4h.01m0 4h.01\"/></svg></button>\n<section class=\"ntc-panel\" aria-label=\"Calculadora do Almoxarifado\" role=\"region\" tabindex=\"-1\">\n  <div class=\"ntc-head\"><div><strong>Calculadora</strong><small>NEW TERMISA · ALMOXARIFADO</small></div><div class=\"ntc-actions\">\n    <button type=\"button\" data-ntc=\"history\" aria-label=\"Abrir histórico\" aria-pressed=\"false\" title=\"Histórico\">◷</button>\n    <button type=\"button\" data-ntc=\"close\" aria-label=\"Fechar calculadora\" title=\"Fechar\">×</button>\n  </div></div>\n  <div class=\"ntc-calc\">\n    <div class=\"ntc-displaywrap\"><div class=\"ntc-expr\"></div><div class=\"ntc-display\" aria-live=\"polite\">0</div></div>\n    <div class=\"ntc-grid\">\n      <button type=\"button\" data-ntc=\"clear\" class=\"ntc-func\">AC</button><button type=\"button\" data-ntc=\"sign\" class=\"ntc-func\">±</button><button type=\"button\" data-ntc=\"percent\" class=\"ntc-func\">%</button><button type=\"button\" data-ntc=\"delete\" class=\"ntc-delete\" aria-label=\"Apagar número: segure para apagar continuamente\" title=\"Segure para apagar continuamente\">⌫</button>\n      <button type=\"button\" data-ntc=\"digit\" data-value=\"7\">7</button><button type=\"button\" data-ntc=\"digit\" data-value=\"8\">8</button><button type=\"button\" data-ntc=\"digit\" data-value=\"9\">9</button><button type=\"button\" data-ntc=\"operation\" data-value=\"/\" class=\"ntc-op\">÷</button>\n      <button type=\"button\" data-ntc=\"digit\" data-value=\"4\">4</button><button type=\"button\" data-ntc=\"digit\" data-value=\"5\">5</button><button type=\"button\" data-ntc=\"digit\" data-value=\"6\">6</button><button type=\"button\" data-ntc=\"operation\" data-value=\"*\" class=\"ntc-op\">×</button>\n      <button type=\"button\" data-ntc=\"digit\" data-value=\"1\">1</button><button type=\"button\" data-ntc=\"digit\" data-value=\"2\">2</button><button type=\"button\" data-ntc=\"digit\" data-value=\"3\">3</button><button type=\"button\" data-ntc=\"operation\" data-value=\"-\" class=\"ntc-op\">−</button>\n      <button type=\"button\" data-ntc=\"digit\" data-value=\"0\">0</button><button type=\"button\" data-ntc=\"decimal\">,</button><button type=\"button\" data-ntc=\"equals\" class=\"ntc-equals\">=</button><button type=\"button\" data-ntc=\"operation\" data-value=\"+\" class=\"ntc-op\">+</button>\n    </div><div class=\"ntc-tip\">Toque em ⌫ para apagar um dígito; segure para apagar continuamente.</div>\n  </div>\n  <div class=\"ntc-history\" hidden><div class=\"ntc-historyhead\"><strong>Últimos cálculos</strong><button type=\"button\" data-ntc=\"clear-history\">Limpar histórico</button></div><div class=\"ntc-entries\"></div><div class=\"ntc-historynote\">Histórico guardado somente neste navegador. Toque em um resultado para reutilizar.</div></div>\n</section>";document.body.appendChild(root);
 const $=q=>root.querySelector(q),panel=$('.ntc-panel'),launcher=$('.ntc-fab'),disp=$('.ntc-display'),expr=$('.ntc-expr'),calcPage=$('.ntc-calc'),histPage=$('.ntc-history');
 const signs={'+':'+','-':'−','*':'×','/':'÷'},fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:9}),round=n=>Number(n.toPrecision(12)).toString();
 const initial=()=>({raw:'0',first:null,op:null,next:false,finished:false,error:false,note:''});
 let state=initial(),items=[];
 try{let parsed=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(parsed))items=parsed.filter(x=>x&&typeof x.expr==='string'&&typeof x.result==='string').slice(0,MAX)}catch(_){}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(items))}catch(_){}};
 function show(){
  let n=Number(state.raw);
  let r=state.error?state.raw:(state.raw.includes('.')?Number(state.raw.split('.')[0]).toLocaleString('pt-BR')+','+state.raw.split('.')[1]:fmt(n));
  disp.textContent=r;disp.classList.toggle('ntc-error',state.error);
  expr.textContent=state.note||(state.first!==null&&state.op?fmt(state.first)+' '+signs[state.op]:'');
 }
 function reset(){state=initial();show()}
 function digit(d){
  if(state.error)state=initial();
  if(state.next||state.finished){state.raw=d;state.next=false;state.finished=false;state.note=''}
  else if(state.raw.replace(/[-.]/g,'').length<13)state.raw=state.raw==='0'?d:state.raw==='-0'?'-'+d:state.raw+d;
  show();
 }
 function decimal(){
  if(state.error)state=initial();
  if(state.next||state.finished){state.raw='0.';state.next=false;state.finished=false;state.note=''}
  else if(!state.raw.includes('.'))state.raw+='.';
  show();
 }
 function del(){
  if(state.error){reset();return}
  if(state.next){state.next=false;state.raw='0';state.note='';show();return}
  if(state.finished){state.finished=false;state.note=''}
  let s=state.raw.slice(0,-1);state.raw=s===''||s==='-'?'0':s;show();
 }
 function sign(){if(state.error||state.raw==='0')return;state.raw=state.raw[0]==='-'?state.raw.slice(1):'-'+state.raw;state.finished=false;show()}
 function percent(){if(state.error)return;state.raw=round(Number(state.raw)/100);state.finished=false;show()}
 function evaluate(a,b,op){let v=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:NaN;return Number.isFinite(v)?round(v):null}
 function bad(){state=initial();state.raw='Divisão por zero';state.error=true;show()}
 function operation(op){
  if(state.error)return;
  let current=Number(state.raw);
  if(state.first!==null&&state.op&&!state.next){let v=evaluate(state.first,current,state.op);if(v===null){bad();return}state.raw=v;state.first=Number(v)}
  else if(state.first===null||state.finished)state.first=current;
  state.op=op;state.next=true;state.finished=false;state.note='';show();
 }
 function equals(){
  if(state.error||!state.op||state.first===null||state.next)return;
  let a=state.first,b=Number(state.raw),op=state.op,v=evaluate(a,b,op);
  if(v===null){bad();return}
  let expression=fmt(a)+' '+signs[op]+' '+fmt(b)+' =';
  items.unshift({expr:expression,result:v,when:new Date().toISOString()});items=items.slice(0,MAX);save();
  state.raw=v;state.first=null;state.op=null;state.next=false;state.finished=true;state.note=expression;show();
 }
 function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function renderHistory(){
  const box=$('.ntc-entries');
  if(!items.length){box.innerHTML='<div class="ntc-empty">Nenhuma conta no histórico. Faça um cálculo e pressione =.</div>';return}
  box.innerHTML=items.map((r,i)=>{
   const d=new Date(r.when),when=Number.isFinite(d.getTime())?d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'';
   return '<button type="button" class="ntc-entry" data-ntc="use" data-index="'+i+'"><span>'+escapeHtml(r.expr)+'</span><strong>'+escapeHtml(fmt(r.result))+'</strong><small>'+escapeHtml(when)+'</small></button>'
  }).join('');
 }
 function history(on){calcPage.hidden=on;histPage.hidden=!on;calcPage.style.display=on?'none':'';histPage.style.display=on?'':'none';$('[data-ntc="history"]').setAttribute('aria-pressed',on?'true':'false');if(on)renderHistory()}
 function open(){reset();history(false);root.classList.add('ntc-open');launcher.setAttribute('aria-expanded','true');panel.focus({preventScroll:true})}
 function close(){root.classList.remove('ntc-open');launcher.setAttribute('aria-expanded','false');history(false);reset();stopHold();launcher.focus({preventScroll:true})}
 let pressTimer=null,repeatTimer=null,wasHeld=false;
 function stopHold(){clearTimeout(pressTimer);clearInterval(repeatTimer);pressTimer=repeatTimer=null}
 const deleteButton=$('[data-ntc="delete"]');
 deleteButton.addEventListener('pointerdown',e=>{if(e.button!==0)return;stopHold();wasHeld=false;pressTimer=setTimeout(()=>{wasHeld=true;del();repeatTimer=setInterval(()=>{del();if(state.raw==='0')stopHold()},85)},400)});
 ['pointerup','pointercancel','pointerleave'].forEach(e=>deleteButton.addEventListener(e,stopHold));
 window.addEventListener('blur',stopHold);
 root.addEventListener('click',e=>{
  const b=e.target.closest('button[data-ntc]');if(!b)return;e.stopPropagation();
  let action=b.dataset.ntc;
  if(action==='open')return open();
  if(action==='close')return close();
  if(action==='history')return history(histPage.hidden);
  if(action==='clear-history'){if(items.length&&window.confirm('Apagar o histórico de contas neste navegador?')){items=[];save();renderHistory()}return}
  if(action==='use'){let r=items[Number(b.dataset.index)];if(r&&Number.isFinite(Number(r.result))){state=initial();state.raw=r.result;state.finished=true;state.note='Resultado recuperado do histórico';show();history(false)}return}
  if(action==='digit')return digit(b.dataset.value);
  if(action==='decimal')return decimal();
  if(action==='operation')return operation(b.dataset.value);
  if(action==='equals')return equals();
  if(action==='clear')return reset();
  if(action==='sign')return sign();
  if(action==='percent')return percent();
  if(action==='delete'){if(wasHeld){wasHeld=false;return}return del()}
 });
 root.addEventListener('keydown',e=>{
  if(!root.classList.contains('ntc-open')||!histPage.hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  let k=e.key;
  if(/^[0-9]$/.test(k))digit(k);
  else if(k==='.'||k===',')decimal();
  else if('+-*/'.includes(k)&&k.length===1)operation(k);
  else if(k==='='||k==='Enter')equals();
  else if(k==='Backspace')del();
  else if(k==='Delete')reset();
  else if(k==='Escape')close();
  else return;
  e.preventDefault();
 });
 show();
 if(isMain){
  const nav=document.getElementById('navigation');
  const sync=()=>{let visible=!nav.classList.contains('hide');root.hidden=!visible;if(!visible&&root.classList.contains('ntc-open'))close()};
  new MutationObserver(sync).observe(nav,{attributes:true,attributeFilter:['class']});sync();
 }
})();