/* New Termisa | Conciliação financeira manual v1.
 * Exclusivamente dados digitados: NUNCA lê preços/custos de materiais,
 * nem grava em nt_web_materiais ou nt_web_movimentos.
 */
export function createFinancialClosing(d){
 'use strict';
 const ACTION='RELATORIO_CONCILIACAO_FINANCEIRA_MANUAL_V1';
 const categories=[['MP','Matéria-Prima'],['UC','Uso e Consumo']];
 let draft=null,history=[];
 const esc=s=>d.esc(String(s??''));
 const dateLabel=s=>d.ntDate(s);
 const brl=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const key=(cat,part)=>'ntFin_'+cat+'_'+part;
 const today=()=>d.getDate();
 function checkReady(){
  if(!d.getUser()||!d.isReady()||!navigator.onLine)throw Error('Conecte-se ao Firebase para consultar o fechamento financeiro.');
 }
 function parseCents(value,label){
  let s=String(value??'').replace(/R\$/gi,'').replace(/\s/g,'').trim();
  if(!s)throw Error('Preencha o campo '+label+'.');
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d+(,\d{1,2})?$/.test(s))s=s.replace(',','.');
  else if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Valor inválido em '+label+'. Exemplo: 1.800,00.');
  const num=Number(s);
  const cents=Math.round(num*100);
  if(!Number.isSafeInteger(cents)||cents<0||cents>100000000000000)throw Error('Valor fora do limite em '+label+'.');
  return cents;
 }
 function displayInput(cents){return cents===undefined||cents===null?'':(Number(cents)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
 function blank(day){return {dia:day,categorias:Object.fromEntries(categories.map(([k])=>[k,{inicial:'',entradas:'',final:''}])),maquinas:[{modelo:'',quantidade:'',valorUnitario:''}],observacao:''};}
 function makeDraft(record,day){
  if(!record)return blank(day);
  return {dia:day,
   categorias:Object.fromEntries(categories.map(([k])=>[k,{
    inicial:displayInput(record.categorias?.[k]?.inicialCentavos),
    entradas:displayInput(record.categorias?.[k]?.entradasCentavos),
    final:displayInput(record.categorias?.[k]?.finalCentavos)
   }])),
   maquinas:(record.maquinas?.length?record.maquinas:[{modelo:'',quantidade:'',valorUnitarioCentavos:null}])
    .map(x=>({modelo:String(x.modelo||''),quantidade:x.quantidade==null?'':String(x.quantidade),
     valorUnitario:displayInput(x.valorUnitarioCentavos)})),
   observacao:String(record.observacao||'')};
 }
 function calc(record){
  if(!record?.categorias?.MP||!record?.categorias?.UC)throw Error('Fechamentos MP e UC incompletos.');
  const section={};
  for(const [k] of categories){
   const s=record.categorias[k];
   const initial=Number(s.inicialCentavos),input=Number(s.entradasCentavos),final=Number(s.finalCentavos);
   if(![initial,input,final].every(Number.isSafeInteger)||[initial,input,final].some(x=>x<0))throw Error('Confira o valor manual de '+k+'.');
   section[k]={inicial:initial,entradas:input,disponivel:initial+input,final,consumo:initial+input-final,variacao:final-initial};
  }
  const maquinas=(record.maquinas||[]).map(x=>{
   const quantity=Number(x.quantidade),unit=Number(x.valorUnitarioCentavos);
   if(!Number.isSafeInteger(quantity)||quantity<=0||quantity>1000000||!Number.isSafeInteger(unit)||unit<0)
    throw Error('Confira a quantidade e o valor unitário das máquinas.');
   const total=quantity*unit;
   if(!Number.isSafeInteger(total))throw Error('Valor total das máquinas excede o limite.');
   return {...x,quantidade:quantity,valorUnitarioCentavos:unit,totalCentavos:total};
  });
  const valorMaquinas=maquinas.reduce((a,x)=>a+x.totalCentavos,0);
  const consumoTotal=section.MP.consumo+section.UC.consumo;
  const variacaoTotal=section.MP.variacao+section.UC.variacao;
  const estoqueInicialTotal=section.MP.inicial+section.UC.inicial;
  const entradasTotal=section.MP.entradas+section.UC.entradas;
  const estoqueFinalTotal=section.MP.final+section.UC.final;
  if(![valorMaquinas,consumoTotal,variacaoTotal,estoqueInicialTotal,entradasTotal,estoqueFinalTotal].every(Number.isSafeInteger))
   throw Error('Total financeiro excedeu o limite seguro.');
  return {sections:section,maquinas,valorMaquinas,consumoTotal,variacaoTotal,estoqueInicialTotal,entradasTotal,estoqueFinalTotal,
   diferencaMP:valorMaquinas-section.MP.consumo,diferencaTotal:valorMaquinas-consumoTotal,
   qtdMaquinas:maquinas.reduce((a,x)=>a+x.quantidade,0)};
 }
 async function readAll(){
  checkReady();
  const snap=await d.getDocsFromServer(d.query(d.collection(d.getDb(),'nt_web_auditoria'),d.where('acao','==',ACTION)));
  if(snap.metadata?.fromCache)throw Error('Não foi possível confirmar o histórico no servidor.');
  return snap.docs.map(x=>({...x.data(),numero:x.id}))
   .filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.dia||''))&&x.categorias?.MP&&x.categorias?.UC)
   .sort((a,b)=>String(b.criadoEmLocal||'').localeCompare(String(a.criadoEmLocal||''))||String(b.numero).localeCompare(String(a.numero)));
 }
 function latest(items,date){return items.find(x=>x.dia===date)||null;}
 async function latestForDate(date){return latest(await readAll(),date);}
 function snapshotForm(){
  if(!draft)return;
  const inp=id=>document.getElementById(id)?.value??'';
  draft.dia=inp('ntFin_date');
  for(const [k] of categories)for(const f of ['inicial','entradas','final'])draft.categorias[k][f]=inp(key(k,f));
  draft.observacao=inp('ntFin_obs');
  draft.maquinas=Array.from(document.querySelectorAll('[data-nt-fin-machine]')).map(el=>({
   modelo:el.querySelector('[data-fin-model]')?.value||'',quantidade:el.querySelector('[data-fin-qty]')?.value||'',
   valorUnitario:el.querySelector('[data-fin-price]')?.value||''
  }));
 }
 function parseForm(strict=true){
  snapshotForm();
  if(!draft||!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.dia||'')))throw Error('Informe uma data válida.');
  const categorias={};
  for(const [k,label] of categories){
   const s=draft.categorias[k];
   categorias[k]={inicialCentavos:parseCents(s.inicial,label+' / Inicial'),
    entradasCentavos:parseCents(s.entradas,label+' / Entradas'),
    finalCentavos:parseCents(s.final,label+' / Final')};
  }
  const maquinas=draft.maquinas.filter(m=>m.modelo.trim()||String(m.quantidade).trim()||String(m.valorUnitario).trim()).map((m,i)=>{
   if(!String(m.modelo).trim())throw Error('Informe o modelo da máquina na linha '+(i+1)+'.');
   if(!/^[1-9]\d*$/.test(String(m.quantidade).trim()))throw Error('Quantidade inteira inválida na máquina '+(i+1)+'.');
   const quantidade=Number(m.quantidade);
   if(!Number.isSafeInteger(quantidade)||quantidade>1000000)throw Error('Quantidade inválida na máquina '+(i+1)+'.');
   return {modelo:String(m.modelo).trim().slice(0,110),quantidade,
    valorUnitarioCentavos:parseCents(m.valorUnitario,'valor da máquina '+(i+1))};
  });
  return {dia:draft.dia,categorias,maquinas,observacao:String(draft.observacao||'').trim().slice(0,800)};
 }
 function preview(){
  const el=document.getElementById('ntFin_preview');if(!el)return;
  try{
   const x=calc(parseForm(false));
   el.innerHTML='<strong>Resultado dos valores digitados manualmente</strong><div class="nt-fin-mini">'+
    [['Consumo MP (material utilizado)',x.sections.MP.consumo],
     ['Consumo UC (material utilizado)',x.sections.UC.consumo],
     ['Consumo total do dia',x.consumoTotal],
     ['Variação do estoque (final − inicial)',x.variacaoTotal],
     ['Máquinas (valor estimado)',x.valorMaquinas],
     ['Diferença máquinas − consumo total',x.diferencaTotal]]
     .map(([name,value])=>'<div><small>'+esc(name)+'</small><b style="'+(value<0?'color:#b45309':'')+'">'+brl(value)+'</b></div>').join('')+'</div>'+
     '<p class="small" style="margin-top:8px">Consumo = Inicial + Entradas − Final. Variação do estoque = Final − Inicial.'+
     (x.variacaoTotal<0?' O valor negativo indica redução do estoque.':'')+
     ' O comparativo com máquinas não representa lucro nem prejuízo contábil.</p>';
  }catch(e){el.innerHTML='<strong>Prévia dos cálculos</strong><p class="small">Preencha os seis valores de MP e UC para visualizar os resultados.</p>';}
 }
 function modal(){
  if(!draft)return;
  const catForm=([k,label])=>'<div class="card" style="margin:8px 0"><h3>'+esc(label)+' ('+k+')</h3>'+
   '<div class="grid">'+[['inicial','Estoque inicial (R$)'],['entradas','Entradas (R$)'],['final','Estoque final (R$)']]
    .map(([field,name])=>'<div class="field"><label for="'+key(k,field)+'">'+name+'</label>'+
     '<input type="text" inputmode="decimal" id="'+key(k,field)+'" value="'+esc(draft.categorias[k][field])+
     '" placeholder="0,00" autocomplete="off"></div>').join('')+'</div></div>';
  const machineRows=draft.maquinas.map((m,i)=>'<div data-nt-fin-machine style="border:1px solid #bdd8dd;border-radius:8px;padding:9px;margin:7px 0">'+
   '<div class="grid"><div class="field"><label>Modelo</label><input data-fin-model value="'+esc(m.modelo)+'" placeholder="Modelo da máquina"></div>'+
   '<div class="field"><label>Quantidade produzida</label><input data-fin-qty type="number" min="1" step="1" value="'+esc(m.quantidade)+'"></div>'+
   '<div class="field"><label>Valor estimado unitário (R$)</label><input data-fin-price inputmode="decimal" value="'+esc(m.valorUnitario)+'" placeholder="0,00"></div></div>'+
   '<button type="button" class="btn ghost" data-action="nt-fin-remove" data-index="'+i+'">Excluir modelo</button></div>').join('');
  d.panel('<div id="ntFin_form"><h2>Conciliação Financeira do Estoque</h2>'+
   '<p class="small">Preenchimento 100% manual. Os preços do cadastro de materiais não são consultados. Salvar não modifica saldos, preços nem movimentações.</p>'+
   '<div class="field"><label for="ntFin_date">Data de referência</label><input id="ntFin_date" type="date" value="'+esc(draft.dia)+'"></div>'+
   categories.map(catForm).join('')+
   '<div class="card"><h3>Comparativo estimado de máquinas produzidas</h3><p class="small">Informe cada modelo manualmente. Se não houve produção, deixe a linha vazia.</p>'+
   '<div id="ntFin_machineRows">'+machineRows+'</div><button type="button" class="btn alt" data-action="nt-fin-add">+ Acrescentar modelo</button></div>'+
   '<div class="field"><label for="ntFin_obs">Observações (opcional)</label><textarea id="ntFin_obs" rows="2">'+esc(draft.observacao)+'</textarea></div>'+
   '<div class="card" id="ntFin_preview" aria-live="polite"></div>'+
   '<p class="small"><b>Consumo = Inicial + Entradas − Final.</b> Consumo positivo significa material utilizado. <b>Variação = Final − Inicial</b>; se for negativa, o estoque diminuiu. A comparação com as máquinas não representa lucro ou prejuízo contábil.</p>'+
   '<div class="buttons"><button class="btn" data-action="nt-fin-save">Salvar MP e UC no Firebase</button><button class="btn ghost" data-action="close">Fechar</button></div></div>');
  preview();
 }
 async function open(date=today(),recordId=''){
  checkReady();d.loader(true);
  try{
   history=await readAll();
   const record=recordId?history.find(x=>String(x.numero)===String(recordId)):latest(history,date);
   draft=makeDraft(record,date);
   modal();
  }finally{d.loader(false);}
 }
 async function save(){
  checkReady();
  const record=parseForm();
  const result=calc(record);
  if(!confirm('Salvar os valores MANUAIS em '+dateLabel(record.dia)+'?\n\n'+
   'Consumo MP: '+brl(result.sections.MP.consumo)+'\nConsumo UC: '+brl(result.sections.UC.consumo)+
   '\nMáquinas estimadas: '+brl(result.valorMaquinas)+
   '\n\nUma nova versão substituirá a anterior nos próximos PDFs. O estoque NÃO será modificado.'))return;
  const ref=d.doc(d.collection(d.getDb(),'nt_web_auditoria'));
  const data={...record,acao:ACTION,origem:'MANUAL',semImpactoNoEstoque:true,
   criadoEmLocal:new Date().toISOString(),criadoEm:d.serverTimestamp(),
   operador:String(d.getUser()?.email||''),uid:String(d.getUser()?.uid||'')};
  d.loader(true);
  try{
   await d.setDoc(ref,data);
   // Uma gravação que já chegou ao servidor nunca deve ser repetida cegamente.
   const snap=await d.getDocFromServer(ref);
   if(!snap.exists())throw Error('A gravação pode ter ocorrido; consulte o histórico antes de tentar novamente.');
   d.close();draft=null;history=[];
   d.notice('Fechamento manual de MP e UC salvo e confirmado. Os PDFs usam a versão mais recente.');
  }finally{d.loader(false);}
 }
 async function showHistory(){
  d.loader(true);
  try{
   history=await readAll();
   const list=history.map(r=>'<div class="nt-repos-history"><div><b>'+esc(dateLabel(r.dia))+'</b>'+
    '<div class="small">'+esc(new Date(r.criadoEmLocal||Date.now()).toLocaleString('pt-BR'))+
    ' · '+esc(r.operador||'')+' · '+esc(r.numero)+'</div></div><div class="buttons">'+
    '<button class="btn alt" data-action="nt-fin-edit" data-code="'+esc(r.numero)+'">Editar valores</button>'+
    '<button class="btn ghost" data-action="nt-fin-history-pdf" data-code="'+esc(r.numero)+'">PDF desta versão</button></div></div>').join('');
   d.panel('<h2>Histórico · Conciliação Financeira</h2><p class="small">Cada salvamento preserva a versão anterior. O Relatório Geral utiliza apenas a versão mais recente de cada data.</p>'+
    '<div class="card" style="max-height:58vh;overflow-y:auto">'+(list||'<p>Nenhum fechamento financeiro cadastrado.</p>')+'</div>'+
    '<div class="buttons"><button class="btn" data-action="nt-fin-open">Novo / editar data selecionada</button><button class="btn ghost" data-action="close">Fechar</button></div>');
  }finally{d.loader(false);}
 }
 function css(){return '<style>'+
  '.nt-fin-report .nt-fin-section{margin:3mm 0 4mm}'+
  '.nt-fin-report .nt-fin-boxes{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0}'+
  '.nt-fin-report .nt-fin-boxes>div{background:#e9f3f4;border-left:2px solid #14a2aa;border-radius:5px;padding:2mm 3mm;min-height:14mm}'+
  '.nt-fin-report .nt-fin-boxes small{display:block;font-size:7pt;color:#587780;font-weight:700}'+
  '.nt-fin-report .nt-fin-boxes b{display:block;font-size:12pt;color:#087e89;margin-top:1mm}'+
  '.nt-fin-report .nt-fin-label{font-size:10pt;color:#1b4b59;font-weight:700;margin:3mm 0 1mm}'+
  '.nt-fin-report .nt-fin-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9pt;margin-bottom:2mm}'+
  '.nt-fin-report .nt-fin-table th{background:#194959;color:#fff;font-size:8pt;padding:2mm 1.2mm}'+
  '.nt-fin-report .nt-fin-table td{border-bottom:1px solid #d7e5e7;text-align:center;padding:2.3mm 1mm}'+
  '.nt-fin-report .nt-fin-table td:first-child{text-align:left}'+
  '.nt-fin-report .nt-fin-summary{background:#edf5f6;border-left:2px solid #16a4ac;padding:3mm 4mm;margin:3mm 0;font-size:9pt;line-height:1.5}'+
  '.nt-fin-report .nt-fin-note{font-size:8pt;line-height:1.35;color:#567483;margin-top:3mm}'+
  '.nt-fin-report .nt-fin-status{font-weight:bold;color:#a26317}'+
  '</style>';}
 function reportPages(record,date,marker){
  if(!record||record.dia!==date)return [];
  const x=calc(record),cat=x.sections;
  const mp=cat.MP,uc=cat.UC;
  const rows=[['Matéria-Prima (MP)',mp],['Uso e Consumo (UC)',uc],['TOTAL',{inicial:mp.inicial+uc.inicial,entradas:mp.entradas+uc.entradas,final:mp.final+uc.final,consumo:x.consumoTotal}]];
  const table='<div class="nt-fin-label">CONCILIAÇÃO DE VALORES DO ESTOQUE</div><table class="nt-fin-table">'+
   '<thead><tr><th>CLASSIFICAÇÃO</th><th>INICIAL</th><th>ENTRADAS</th><th>FINAL</th><th>CONSUMO CALCULADO</th></tr></thead>'+
   '<tbody>'+rows.map(([label,r])=>'<tr><td><b>'+d.ntPlain(label)+'</b></td>'+
    [r.inicial,r.entradas,r.final,r.consumo].map(z=>'<td>'+d.ntPlain(brl(z))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const boxes='<div class="nt-fin-boxes">'+
   [['Consumo MP',mp.consumo],['Consumo UC',uc.consumo],['Consumo total',x.consumoTotal],['Máquinas (estimado)',x.valorMaquinas]]
   .map(([k,v])=>'<div><small>'+d.ntPlain(k.toUpperCase())+'</small><b>'+d.ntPlain(brl(v))+'</b></div>').join('')+'</div>';
  const machines=x.maquinas;
  // Sem valores estimados ou com grandes quantidades, gera páginas de continuação.
  const groups=[];
  for(let i=0;i<machines.length;i+=8)groups.push(machines.slice(i,i+8));
  if(!groups.length)groups.push([]);
  const pages=[];
  groups.forEach((items,i)=>{
   const main=i===0;
   const intro=main?boxes+table:'<p class="nt-fin-note">Continuação dos modelos de máquinas informados manualmente.</p>';
   const machineTable='<div class="nt-fin-label">MÁQUINAS PRODUZIDAS · VALORES ESTIMADOS</div>'+
    '<table class="nt-fin-table"><thead><tr><th style="width:45%">MODELO</th><th>QUANTIDADE</th><th>VALOR UNITÁRIO</th><th>VALOR TOTAL</th></tr></thead><tbody>'+
    (items.length?items.map(r=>'<tr><td>'+d.ntPlain(r.modelo)+'</td><td>'+d.ntPlain(r.quantidade)+'</td>'+
      '<td>'+d.ntPlain(brl(r.valorUnitarioCentavos))+'</td><td>'+d.ntPlain(brl(r.totalCentavos))+'</td></tr>').join(''):
      '<tr><td colspan="4">Nenhuma máquina informada para esta data.</td></tr>')+'</tbody></table>';
   const final=i===groups.length-1?'<div class="nt-fin-summary"><b>VALOR ESTIMADO DAS MÁQUINAS: '+d.ntPlain(brl(x.valorMaquinas))+'</b>'+
    '<div>Comparação com consumo de MP: '+d.ntPlain(brl(x.diferencaMP))+'</div>'+
    '<div>Comparação com consumo de MP + UC: '+d.ntPlain(brl(x.diferencaTotal))+'</div>'+
    '<div class="nt-fin-status">'+(x.consumoTotal<0?'Atenção: consumo líquido negativo. Conferir os valores manuais.':'Conferência comparativa, não uma igualdade contábil obrigatória.')+'</div></div>'+
    '<p class="nt-fin-note">Todos os valores desta página foram lançados manualmente. A avaliação estimada das máquinas pode incluir mão de obra, custos indiretos e margem. Este documento não altera nem comprova os preços do estoque operacional.</p>'+
    (record.observacao?'<p class="nt-fin-note"><b>Observação:</b> '+d.ntPlain(record.observacao)+'</p>':''):'';
   pages.push('<section class="page landscape nt-fin-report">'+d.ntTop('CONCILIAÇÃO FINANCEIRA DO ESTOQUE','Fechamento manual · Matéria-Prima e Uso e Consumo · '+(main?'Visão diária':'Continuação'),date)+
    intro+machineTable+final+marker+'</section>');
  });
  return pages;
 }
 function individualHTML(record){
  const marker='__NT_FIN_FOOTER__';
  const pages=reportPages(record,record.dia,marker);
  const html=d.ntHtml('Conciliação Financeira do Estoque · '+dateLabel(record.dia),
   pages.map((p,i)=>p.replace(marker,d.ntFooter(i+1,pages.length))));
  return html.replace('</head>',css()+'</head>');
 }
 async function openPDF(date=today(),id=''){
  checkReady();
  // Abrir ANTES da primeira operação assíncrona (necessário no Chrome Android).
  const pop=window.open('','_blank');
  if(!pop)throw Error('Permita pop-ups do New Termisa para abrir o PDF.');
  pop.document.open();
  pop.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="font:16px Arial;padding:24px">Consultando o fechamento financeiro MANUAL no Firebase...</body></html>');
  pop.document.close();
  d.loader(true);
  try{
   const list=await readAll();
   const record=id?list.find(x=>x.numero===id):latest(list,date);
   if(!record)throw Error('Ainda não existe fechamento financeiro manual nesta data.');
   pop.document.open();pop.document.write(individualHTML(record));pop.document.close();
  }catch(e){
   pop.document.open();
   pop.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="font:16px Arial;padding:24px"><h2>Relatório financeiro não disponível</h2><p>Consulte o histórico no sistema e tente novamente. Nenhum dado foi modificado.</p></body></html>');
   pop.document.close();
   throw e;
  }finally{d.loader(false);}
 }
 function summary(record){
  if(!record)return '';
  const x=calc(record);
  return 'Fechamento manual — consumo MP: '+brl(x.sections.MP.consumo)+
   '; consumo UC: '+brl(x.sections.UC.consumo)+
   '; variação do estoque: '+brl(x.variacaoTotal)+
   '; máquinas estimadas: '+brl(x.valorMaquinas)+
   '; diferença máquinas − consumo total: '+brl(x.diferencaTotal)+
   '. Valores independentes do cadastro de materiais.';
 }
 async function action(a,button){
  if(a==='nt-fin-open')return open();
  if(a==='nt-fin-pdf')return openPDF();
  if(a==='nt-fin-history')return showHistory();
  if(a==='nt-fin-add'){snapshotForm();draft.maquinas.push({modelo:'',quantidade:'',valorUnitario:''});return modal();}
  if(a==='nt-fin-remove'){snapshotForm();draft.maquinas.splice(Number(button.dataset.index),1);if(!draft.maquinas.length)draft.maquinas.push({modelo:'',quantidade:'',valorUnitario:''});return modal();}
  if(a==='nt-fin-save')return save();
  if(a==='nt-fin-edit'){const found=history.find(x=>x.numero===button.dataset.code);return open(found?.dia||today(),button.dataset.code);}
  if(a==='nt-fin-history-pdf')return openPDF(history.find(x=>x.numero===button.dataset.code)?.dia||today(),button.dataset.code);
 }
 document.addEventListener('input',e=>{if(e.target.closest('#ntFin_form'))preview()});
 return {action,latestForDate,reportPages,css,summary,calc,parseCents,openPDF};
}
