/* Relatório Geral v3: reconstrução de paginação por medição de conteúdo.
   Entrada: apenas páginas HTML do relatório já preparado com dados do Firebase.
   Saída: páginas A4 consistentes; nunca altera materiais, códigos ou quantidades. */
(function(){
'use strict';
const SAFE=14, maxReceiptEntries=4;
const q=(n,s)=>n.querySelector(s), qa=(n,s)=>Array.from(n.querySelectorAll(s));
const pageTypes=['nt-general-production','nt-general-requests','nt-general-receipt',
 'nt-general-repos','nt-general-stock'];
let ready=false, issue='', running=false;
const allPages=()=>qa(document,'.page');
function kind(p){return pageTypes.find(c=>p.classList.contains(c))||null;}
function footerTop(p){return q(p,'.footer')?.getBoundingClientRect().top??-1;}
function lastBottom(p){
 const footer=q(p,'.footer');
 const els=Array.from(p.children).filter(n=>n!==footer);
 if(!els.length)return p.getBoundingClientRect().top;
 return Math.max(...els.map(n=>n.getBoundingClientRect().bottom));
}
function free(p){return footerTop(p)-lastBottom(p);}
function ok(p){return free(p)>=SAFE;}
function blank(base,anchor,type,first){
 const p=base.cloneNode(true);
 p.classList.add('nt-v3-page');
 p.style.setProperty('height','204mm','important');
 p.style.setProperty('min-height','204mm','important');
 if(type==='nt-general-receipt'){
  qa(p,'.nt-rx-entry').forEach(n=>n.remove());
  // A observação de auditoria entra uma única vez, ao final da seção,
  // evitando duplicação quando uma entrega ocupa várias páginas.
  qa(p,'.nt-rx-footnote').forEach(n=>n.remove());
  if(!first)qa(p,'.nt-rx-metrics').forEach(n=>n.remove());
 }else {
  const body=q(p,'table tbody');
  if(!body)throw Error('Tabela ausente em '+type);
  body.replaceChildren();
  if(type==='nt-general-production'&&!first)qa(p,'.nt-gp-metrics').forEach(n=>n.remove());
  if(type==='nt-general-repos'&&!first)qa(p,'.nt-day-repos-meta').forEach(n=>n.remove());
 }
 anchor.parentNode.insertBefore(p,anchor);
 return p;
}
function htmlSig(p){return qa(p,'.note').map(x=>x.textContent.trim()).join(' / ');}
function paginateTable(group,type){
 const original=group.flatMap(p=>qa(p,'table tbody > tr')).map(n=>n.cloneNode(true));
 if(!original.length)return group;
 // Acima de 20 registros, recuperar até 2px de padding vertical por lado.
 // A fonte, as descrições e as medidas continuam exatamente iguais.
 // O espaço de cada linha continua sujeito à medição real da página.
 if(original.length>20&&(type==='nt-general-stock'||type==='nt-general-requests')){
  const sample=q(group[0],'table tbody td');
  const computed=sample?getComputedStyle(sample):null;
  if(computed){
   const top=Math.max(2,parseFloat(computed.paddingTop)-2);
   const bottom=Math.max(2,parseFloat(computed.paddingBottom)-2);
   for(const tr of original)for(const td of qa(tr,'td')){
    td.style.setProperty('padding-top',top+'px','important');
    td.style.setProperty('padding-bottom',bottom+'px','important');
   }
  }
 }
 // Páginas de produção/requisições/estoque têm sempre a mesma observação.
 // Em caso de textos diferentes, não é seguro fundi-las.
 if(group.some(p=>htmlSig(p)!==htmlSig(group[0])))return group;
 const anchor=group[0],made=[];
 const make=()=>{const p=blank(group[0],anchor,type,made.length===0);made.push(p);return p;};
 try{
  let page=make(),tbody=q(page,'table tbody');
  for(const row of original){
   tbody.appendChild(row);
   if(ok(page))continue;
   tbody.removeChild(row);
   if(!tbody.children.length)throw Error('Linha de material maior que a área da página');
   page=make();tbody=q(page,'table tbody');tbody.appendChild(row);
   if(!ok(page))throw Error('Linha longa demais para imprimir com segurança');
  }
  if(!made.every(ok))throw Error('Tabela ultrapassou o rodapé');
  group.forEach(p=>p.remove());
  return made;
 }catch(e){made.forEach(p=>p.remove());throw e;}
}
function receiptKey(entry){
 const b=q(entry,'.nt-rx-badge');
 return b?b.textContent.replace(/CONTINUAÇÃO/g,'').trim():'';
}
function appendContinue(entry){
 const b=q(entry,'.nt-rx-badge');
 if(b&&!q(b,'small')){const t=document.createElement('small');t.textContent='CONTINUAÇÃO';b.append(t);}
}
function receiptEntries(group){
 const all=group.flatMap(p=>qa(p,'.nt-rx-entry'));
 const result=[];
 for(const src of all){
  const key=receiptKey(src),previous=result[result.length-1];
  if(previous&&previous.key===key){
   const dest=q(previous.element,'tbody');
   qa(src,'tbody>tr').forEach(row=>dest.appendChild(row.cloneNode(true)));
  }else result.push({key,element:src.cloneNode(true)});
 }
 return result;
}
function paginateReceipts(group){
 const all=receiptEntries(group);
 if(!all.length)return group;
 const anchor=group[0],made=[];
 const make=()=>{const p=blank(group[made.length?Math.min(1,group.length-1):0],anchor,'nt-general-receipt',made.length===0);
  made.push(p);return p;};
 // Preservar observações de auditoria do documento original.
 const extra=group.flatMap(p=>qa(p,'.nt-rx-footnote')).map(n=>n.cloneNode(true));
 try{
  let page=make(),stack=q(page,'.nt-rx-stack'),note=q(stack,'.nt-rx-note');
  if(!stack||!note)throw Error('Bloco de recebimento incompleto');
  let distinct=0;
  const newPage=()=>{page=make();stack=q(page,'.nt-rx-stack');note=q(stack,'.nt-rx-note');distinct=0;};
  for(const entry of all){
   const src=entry.element,rows=qa(src,'tbody>tr').map(n=>n.cloneNode(true));
   let remaining=rows.length?rows:[null],isContinuation=false;
   while(remaining.length){
    if(distinct>=maxReceiptEntries)newPage();
    const copy=src.cloneNode(true),tbody=q(copy,'tbody');
    tbody.replaceChildren();
    if(isContinuation)appendContinue(copy);
    stack.insertBefore(copy,note);
    if(!ok(page)){
     copy.remove();
     if(distinct===0)throw Error('Cabeçalho do recebimento não cabe na página');
     newPage();continue;
    }
    let added=0;
    while(remaining.length){
     const item=remaining[0];
     if(item===null){remaining.shift();added++;break;}
     tbody.appendChild(item);
     if(!ok(page)){tbody.removeChild(item);break;}
     remaining.shift();added++;
    }
    if(!added){
     copy.remove();
     if(distinct===0)throw Error('Material do recebimento não cabe no A4');
     newPage();continue;
    }
    distinct++;isContinuation=true;
    if(remaining.length)newPage();
   }
  }
  for(const noteExtra of extra){
   let last=made[made.length-1];
   const s=q(last,'.nt-rx-stack');s.append(noteExtra);
   if(!ok(last)){
    noteExtra.remove();
    // Anotar na página seguinte, com identificação explícita do vínculo.
    newPage();q(page,'.nt-rx-stack').append(noteExtra);
    if(!ok(page))throw Error('Nota de auditoria excede a área segura');
   }
  }
  if(!made.every(ok))throw Error('Recebimento ultrapassou o rodapé');
  group.forEach(p=>p.remove());return made;
 }catch(e){made.forEach(p=>p.remove());throw e;}
}
function fillTable(p){
 const rows=qa(p,'table tbody>tr');if(rows.length<3)return;
 // Aumenta apenas a altura das células, nunca o tamanho das letras.
 const available=free(p)-SAFE-10;if(available<12)return;
 const perSide=Math.min(9,available/(rows.length*2));
 const changes=[];
 for(const row of rows)for(const td of qa(row,'td')){
  const css=getComputedStyle(td),top=parseFloat(css.paddingTop),bottom=parseFloat(css.paddingBottom);
  changes.push([td,top,bottom]);
  td.style.setProperty('padding-top',(top+perSide)+'px','important');
  td.style.setProperty('padding-bottom',(bottom+perSide)+'px','important');
 }
 if(!ok(p))for(const [td,top,bottom] of changes){
  td.style.setProperty('padding-top',top+'px','important');
  td.style.setProperty('padding-bottom',bottom+'px','important');
 }
}
function fillReceipts(p){
 const cards=qa(p,'.nt-rx-stack>.nt-rx-entry');
 if(cards.length<2)return;
 const available=free(p)-SAFE-12;
 if(available<18)return;
 const per=Math.min(32,available/(cards.length-1));
 const edits=[];
 for(let i=1;i<cards.length;i++){
  const c=cards[i],before=c.style.marginTop;
  edits.push([c,before]);
  c.style.setProperty('margin-top',per+'px','important');
 }
 if(!ok(p))for(const [c,before] of edits)c.style.marginTop=before;
}
function renumber(){
 const pp=allPages();
 for(let i=0;i<pp.length;i++){
  const footer=q(pp[i],'.footer');
  if(!footer)throw Error('Rodapé ausente na página '+(i+1));
  const spans=qa(footer,'span');
  if(spans.length<2)throw Error('Numeração do rodapé ausente');
  spans[spans.length-1].textContent='PÁGINA '+(i+1)+' DE '+pp.length;
 }
}
function audit(){
 const pp=allPages();
 for(let i=0;i<pp.length;i++)if(!ok(pp[i])){
  throw Error('Página '+(i+1)+' ficou fora da área imprimível: '+Math.round(free(pp[i]))+' px');
 }
}
function setToolbar(message,alertUser){
 const toolbar=q(document,'.toolbar');if(!toolbar)return;
 let label=q(toolbar,'.nt-v3-label');
 if(!label){label=document.createElement('span');label.className='nt-v3-label';toolbar.append(label);}
 label.textContent=' · '+message;
 label.style.color=alertUser?'#ffddc2':'#b0ebec';
}
function rebuild(){
 if(ready||running)return ready;
 running=true;
 const backups=allPages().map(n=>n.cloneNode(true));
 try{
  const old=allPages();
  let i=0;
  while(i<old.length){
   const type=kind(old[i]);
   if(!type){i++;continue;}
   let end=i+1;
   while(end<old.length&&kind(old[end])===type)end++;
   const group=old.slice(i,end);
   const fresh=type==='nt-general-receipt'?paginateReceipts(group):paginateTable(group,type);
   fresh.forEach(p=>type==='nt-general-receipt'?fillReceipts(p):fillTable(p));
   i=end;
  }
  renumber();audit();ready=true;issue='';
  document.documentElement.dataset.ntV3='ready';
  setToolbar('Diagramação conferida',false);return true;
 }catch(e){
  allPages().forEach(p=>p.remove());
  backups.forEach(p=>document.body.append(p));
  issue=String(e?.message||e);
  document.documentElement.dataset.ntV3='error';
  setToolbar('Impressão bloqueada: '+issue,true);return false;
 }finally{running=false;}
}
window.ntSafePrint=function(){
 if(!ready&&!rebuild()){alert('Não é seguro gerar o PDF. '+issue);return;}
 window.print();
};
window.ntV3Status=()=>({ready,issue,pages:allPages().length});
if(document.readyState==='complete')rebuild();
else window.addEventListener('load',rebuild,{once:true});
})();