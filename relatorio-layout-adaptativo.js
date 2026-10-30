/* New Termisa | Paginação adaptativa de relatórios A4.
 * Sem acesso a dados do estoque: reorganiza apenas o HTML já gerado.
 * Mantém fonte, unidades, notas fiscais, saldos e a ordem dos itens.
 */
(function(){
'use strict';
const SAFE_PX=16;
const CLASSES=['nt-general-requests','nt-general-stock','nt-general-production','nt-general-receipt'];
const q=(node,selector)=>node.querySelector(selector);
const qa=(node,selector)=>Array.from(node.querySelectorAll(selector));
let done=false,running=false,problem='';

function groupType(page){return CLASSES.find(c=>page.classList.contains(c))||null;}
function lastContentBottom(page){
 const footer=q(page,'.footer');
 if(!footer)return Infinity;
 const nodes=Array.from(page.children).filter(e=>!e.classList.contains('footer'));
 return nodes.length?Math.max(...nodes.map(n=>n.getBoundingClientRect().bottom)):-Infinity;
}
function gap(page){
 const footer=q(page,'.footer');
 return footer?footer.getBoundingClientRect().top-lastContentBottom(page):-Infinity;
}
function fits(page){return gap(page)>=SAFE_PX;}
function makeBlank(original,anchor,first){
 const page=original.cloneNode(true);
 if(page.classList.contains('nt-general-receipt')){
  if(!first){page.classList.remove('nt-rx-first');qa(page,'.nt-rx-metrics').forEach(x=>x.remove());}
  const stack=q(page,'.nt-rx-stack');
  if(!stack)throw Error('Conteúdo de recebimentos não identificado');
  qa(stack,'.nt-rx-entry').forEach(x=>x.remove());
 }else{
  const body=q(page,'table tbody');
  if(!body)throw Error('Tabela de materiais ausente');
  body.replaceChildren();
 }
 anchor.parentNode.insertBefore(page,anchor);
 return page;
}
function paginateTable(group){
 const rows=group.flatMap(p=>qa(p,'table tbody > tr')).map(r=>r.cloneNode(true));
 // Em relatórios volumosos, reduz no máximo 2px do espaço vertical de
 // cada célula, sem diminuir letras nem alterar nenhum valor ou descrição.
 if(rows.length>=24){
  for(const row of rows)for(const td of qa(row,'td')){
   const cs=getComputedStyle(group[0].querySelector('td')||td);
   const top=Math.max(2,parseFloat(cs.paddingTop)-2),bottom=Math.max(2,parseFloat(cs.paddingBottom)-2);
   td.style.setProperty('padding-top',top+'px','important');
   td.style.setProperty('padding-bottom',bottom+'px','important');
  }
 }
 if(!rows.length)return [];
 // Observações especiais de auditoria nunca são descartadas ou fundidas.
 const notes=p=>qa(p,'.note').map(n=>n.innerHTML).join('||');
 if(group.some(p=>notes(p)!==notes(group[0])))return group;
 const created=[],anchor=group[0];
 const begin=()=>{const p=makeBlank(group[0],anchor,false);created.push(p);return p;};
 try{
  let page=begin(),tbody=q(page,'table tbody');
  for(const row of rows){
   tbody.appendChild(row);
   if(fits(page))continue;
   tbody.removeChild(row);
   if(!tbody.children.length)throw Error('Uma linha é alta demais para o A4');
   page=begin();tbody=q(page,'table tbody');tbody.appendChild(row);
   if(!fits(page))throw Error('Uma linha não cabe com a margem de segurança');
  }
  // Equilibra as folhas para que a última não fique quase vazia.
  for(let i=created.length-1;i>0;i--){
   const prev=q(created[i-1],'table tbody'),cur=q(created[i],'table tbody');
   while(prev.children.length>cur.children.length+1&&prev.children.length>1){
    const row=prev.lastElementChild;cur.insertBefore(row,cur.firstChild);
    if(!fits(created[i])){prev.appendChild(row);break;}
   }
  }
  if(!created.every(fits))throw Error('O conteúdo da tabela ultrapassou o rodapé');
  group.forEach(p=>p.remove());
  return created;
 }catch(e){created.forEach(p=>p.remove());throw e;}
}
function deliveryId(entry){
 const badge=q(entry,'.nt-rx-badge');
 return badge?badge.textContent.replace(/CONTINUAÇÃO/g,'').trim():'';
}
function continuation(entry){
 const badge=q(entry,'.nt-rx-badge');
 if(badge&&!q(badge,'small')){
  const small=document.createElement('small');small.textContent='CONTINUAÇÃO';badge.appendChild(small);
 }
}
function paginateReceipts(group){
 const originals=group.flatMap(p=>qa(p,'.nt-rx-entry')).map(e=>e.cloneNode(true));
 if(!originals.length)return [];
 const anchor=group[0],created=[];
 const begin=(first)=>{
  const page=makeBlank(first?group[0]:(group[1]||group[0]),anchor,first);
  created.push(page);return page;
 };
 try{
  let page=begin(true),stack=q(page,'.nt-rx-stack'),note=q(stack,'.nt-rx-note');
  let nDistinct=0,lastId=null;
  for(const src of originals){
   const id=deliveryId(src),rows=qa(src,'table tbody > tr');
   let remaining=rows.length?rows.map(x=>x.cloneNode(true)):[];
   let continued=false;
   // Entregas extensas podem continuar em outra folha sem omitir linhas.
   do{
    if(nDistinct>=3){
     page=begin(false);stack=q(page,'.nt-rx-stack');note=q(stack,'.nt-rx-note');
     nDistinct=0;lastId=null;
    }
    const copy=src.cloneNode(true),tbody=q(copy,'table tbody');
    if(!tbody)throw Error('Tabela do fornecedor não identificada');
    tbody.replaceChildren();
    if(continued)continuation(copy);
    stack.insertBefore(copy,note);
    if(!fits(page)){
     copy.remove();
     if(nDistinct===0&&created.length>1)throw Error('Cabeçalho do fornecedor excede a página');
     page=begin(false);stack=q(page,'.nt-rx-stack');note=q(stack,'.nt-rx-note');
     nDistinct=0;lastId=null;
     stack.insertBefore(copy,note);
     if(!fits(page))throw Error('Bloco do fornecedor excede a página');
    }
    let count=0;
    while(remaining.length){
     const row=remaining[0];tbody.appendChild(row);
     if(!fits(page)){tbody.removeChild(row);break;}
     remaining.shift();count++;
    }
    if(count===0&&remaining.length){
     copy.remove();
     if(nDistinct===0&&created.length>1)throw Error('Uma linha da entrega não cabe no A4');
     page=begin(false);stack=q(page,'.nt-rx-stack');note=q(stack,'.nt-rx-note');
     nDistinct=0;lastId=null;
     continue;
    }
    if(id!==lastId){nDistinct++;lastId=id;}
    continued=true;
    if(remaining.length){
     page=begin(false);stack=q(page,'.nt-rx-stack');note=q(stack,'.nt-rx-note');
     nDistinct=0;lastId=null;
    }
   }while(remaining.length);
  }
  if(!created.every(fits))throw Error('Observação do recebimento invadiu o rodapé');
  group.forEach(p=>p.remove());
  return created;
 }catch(e){created.forEach(p=>p.remove());throw e;}
}
function spreadTableRows(page){
 const rows=qa(page,'table tbody > tr');
 if(rows.length<2)return;
 const room=gap(page)-SAFE_PX-7;
 if(room<16)return;
 const extra=Math.min(9,room/(rows.length*2));
 const cells=rows.flatMap(row=>qa(row,'td')),changed=[];
 for(const td of cells){
  const style=getComputedStyle(td),top=parseFloat(style.paddingTop),bottom=parseFloat(style.paddingBottom);
  td.style.setProperty('padding-top',(top+extra)+'px','important');
  td.style.setProperty('padding-bottom',(bottom+extra)+'px','important');
  changed.push([td,top,bottom]);
 }
 if(!fits(page)){
  for(const [td,top,bottom] of changed){
   td.style.setProperty('padding-top',top+'px','important');
   td.style.setProperty('padding-bottom',bottom+'px','important');
  }
 }
}
function spreadReceipts(page){
 const entries=qa(page,'.nt-rx-stack > .nt-rx-entry');
 if(entries.length<2)return;
 const space=gap(page)-SAFE_PX-7;
 if(space<12)return;
 const extra=Math.min(38,space/entries.length);
 const changed=[];
 for(let i=1;i<entries.length;i++){
  const el=entries[i],prev=el.style.marginTop;
  el.style.setProperty('margin-top',extra+'px','important');changed.push([el,prev]);
 }
 if(!fits(page))for(const [el,old] of changed)el.style.marginTop=old;
}
function rewritePageNumbers(){
 const pages=qa(document,'.page'),total=pages.length;
 for(let i=0;i<pages.length;i++){
  const footer=q(pages[i],'.footer'),spans=footer?footer.querySelectorAll('span'):[];
  if(spans.length)spans[spans.length-1].textContent='PÁGINA '+(i+1)+' DE '+total;
 }
}
function verifyDocument(){
 const pages=qa(document,'.page');
 for(let i=0;i<pages.length;i++)if(!fits(pages[i])){
  throw Error('Página '+(i+1)+' ultrapassou a área segura de impressão');
 }
}
function run(){
 if(running||done)return done;
 running=true;
 const backup=qa(document,'.page').map(p=>p.cloneNode(true));
 try{
  const originalPages=qa(document,'.page');
  let i=0;
  while(i<originalPages.length){
   const t=groupType(originalPages[i]);
   if(!t){i++;continue;}
   let j=i+1;
   while(j<originalPages.length&&groupType(originalPages[j])===t)j++;
   const group=originalPages.slice(i,j);
   const made=t==='nt-general-receipt'?paginateReceipts(group):paginateTable(group);
   if(t==='nt-general-receipt')made.forEach(spreadReceipts);
   else made.forEach(spreadTableRows);
   i=j;
  }
  rewritePageNumbers();verifyDocument();done=true;
  document.documentElement.dataset.ntLayout='ready';
  const bar=q(document,'.toolbar'),status=bar?q(bar,'.nt-layout-status'):null;
  if(status)status.textContent=' · Paginação conferida';
  return true;
 }catch(error){
  qa(document,'.page').forEach(p=>p.remove());
  backup.forEach(p=>document.body.appendChild(p));
  problem=String(error?.message||error);
  document.documentElement.dataset.ntLayout='warning';
  const bar=q(document,'.toolbar');
  if(bar){const p=document.createElement('strong');p.textContent=' Confira a impressão: '+problem;bar.appendChild(p);}
  return false;
 }finally{running=false;}
}
window.ntSafePrint=function(){
 if(!done&&!run()){alert('O relatório ainda não está seguro para imprimir. '+problem);return;}
 window.print();
};
window.ntAdaptiveReportStatus=function(){return {ready:done,problem,pages:qa(document,'.page').length};};
if(document.readyState==='complete')run();
else window.addEventListener('load',run,{once:true});
})();