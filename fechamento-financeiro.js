/* New Termisa | Conciliação financeira manual v1.
 * Exclusivamente dados digitados: NUNCA lê preços/custos de materiais,
 * nem grava em nt_web_materiais ou nt_web_movimentos.
 */
export function createFinancialClosing(d){
 'use strict';
 const ACTION='RELATORIO_CONCILIACAO_FINANCEIRA_MANUAL_V1';
 const HIDE_ACTION='RELATORIO_CONCILIACAO_FINANCEIRA_OCULTAR_V1';
 const RESTORE_ACTION='RELATORIO_CONCILIACAO_FINANCEIRA_RESTAURAR_V1';
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
  const qtdMaquinas=maquinas.reduce((a,x)=>a+x.quantidade,0);
  const totals={
   inicial:section.MP.inicial+section.UC.inicial,
   entradas:section.MP.entradas+section.UC.entradas,
   final:section.MP.final+section.UC.final,
   consumo:section.MP.consumo+section.UC.consumo
  };
  const diferencaGeral=valorMaquinas-totals.consumo;
  if(![valorMaquinas,qtdMaquinas,...Object.values(totals),diferencaGeral].every(Number.isSafeInteger))
   throw Error('Valores do fechamento excederam o limite seguro.');
  // Mantém MP e UC independentes e só apresenta a soma no total geral.
  return {sections:section,totals,maquinas,valorMaquinas,
   diferencaGeral,qtdMaquinas};
 }
 async function readAll(includeHidden=false){
  checkReady();
  // Exclusões/restaurações são eventos de auditoria: o lançamento original
  // permanece intacto, mas deixa de aparecer nos PDFs e no histórico comum.
  const snap=await d.getDocsFromServer(d.query(d.collection(d.getDb(),'nt_web_auditoria'),
   d.where('acao','in',[ACTION,HIDE_ACTION,RESTORE_ACTION])));
  if(snap.metadata?.fromCache)throw Error('Não foi possível confirmar o histórico no servidor.');
  const docs=snap.docs.map(x=>({...x.data(),numero:x.id}));
  const excluded=new Set();
  docs.filter(x=>x.acao===HIDE_ACTION||x.acao===RESTORE_ACTION)
   .sort((a,b)=>String(a.criadoEmLocal||'').localeCompare(String(b.criadoEmLocal||''))||
    String(a.numero).localeCompare(String(b.numero)))
   .forEach(ev=>(Array.isArray(ev.registros)?ev.registros:[]).forEach(id=>{
    if(ev.acao===HIDE_ACTION)excluded.add(String(id));
    else excluded.delete(String(id));
   }));
  return docs.filter(x=>x.acao===ACTION)
   .filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.dia||''))&&x.categorias?.MP&&x.categorias?.UC)
   .map(x=>({...x,oculto:excluded.has(String(x.numero))}))
   .filter(x=>includeHidden||!x.oculto)
   .sort((a,b)=>String(b.criadoEmLocal||'').localeCompare(String(a.criadoEmLocal||''))||
    String(b.numero).localeCompare(String(a.numero)));
 }
 async function setDayVisibility(date,hide){
  checkReady();
  const all=await readAll(true);
  const entries=all.filter(x=>x.dia===date&&Boolean(x.oculto)!==hide);
  if(!entries.length){d.notice('Não há lançamentos a '+(hide?'excluir':'restaurar')+' nessa data.',true);return;}
  const verb=hide?'EXCLUIR DO HISTÓRICO E DOS RELATÓRIOS':'RESTAURAR NO HISTÓRICO E NOS RELATÓRIOS';
  if(!confirm(verb+' os '+entries.length+' lançamento(s) da data '+dateLabel(date)+'?\n\n'+
   (hide?'Os registros serão ocultados dos PDFs e do histórico comum, inclusive do Relatório Geral. '+
    'Os originais permanecem guardados para auditoria. ':
    'Os registros voltarão a aparecer nos relatórios. ')+
   'Nenhum saldo, material ou movimentação de estoque será alterado.'))return;
  const ref=d.doc(d.collection(d.getDb(),'nt_web_auditoria'));
  const event={
   acao:hide?HIDE_ACTION:RESTORE_ACTION,dia:date,
   registros:entries.map(x=>String(x.numero)),
   origem:'CONCILIACAO_FINANCEIRA',semImpactoNoEstoque:true,
   criadoEmLocal:new Date().toISOString(),criadoEm:d.serverTimestamp(),
   operador:String(d.getUser()?.email||''),uid:String(d.getUser()?.uid||'')
  };
  d.loader(true);
  try{
   await d.setDoc(ref,event);
   const check=await d.getDocFromServer(ref);
   if(!check.exists())throw Error('A exclusão/restauração pode ter sido registrada; consulte o histórico antes de repetir.');
   history=[];
   d.notice(hide?'Lançamentos da data ocultados com auditoria preservada.':'Lançamentos restaurados no histórico e nos relatórios.');
  }finally{d.loader(false);}
  await showHistory();
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
   const part=(name,r)=>'<div style="background:#eef6f7;border-left:3px solid #1d9da4;padding:10px;margin:8px 0;border-radius:6px">'+
    '<strong>'+esc(name)+'</strong><div class="small">Inicial: '+brl(r.inicial)+
    ' · Entradas: '+brl(r.entradas)+' · Final: '+brl(r.final)+'</div>'+
    '<b>Consumo: '+brl(r.consumo)+'</b></div>';
   el.innerHTML='<h3>Prévia do fechamento diário</h3>'+
    part('Matéria-Prima (MP)',x.sections.MP)+part('Uso e Consumo (UC)',x.sections.UC)+
    '<div style="background:#e7f1f2;padding:12px;border-radius:6px"><b>Consumo combinado: '+brl(x.totals.consumo)+
    '</b><div class="small">Valor estimado das máquinas: '+brl(x.valorMaquinas)+
    ' · Diferença para conferência: <b>'+(x.maquinas.length?brl(x.diferencaGeral):'não aplicável')+'</b></div></div>'+
    '<p class="small">O consumo conjunto de MP e UC é comparado ao valor estimado das máquinas. A diferença não comprova lucro ou prejuízo.</p>';
  }catch(e){el.innerHTML='<strong>Prévia do fechamento diário</strong><p class="small">Preencha os valores iniciais, entradas e finais de MP e UC para visualizar os resultados separados e o comparativo.</p>';}
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
   '<p class="small"><b>Consumo = Inicial + Entradas − Final.</b> Consumo positivo significa material utilizado. <b>Variação = Entradas − Consumo = Final − Inicial</b>; se for negativa, o estoque diminuiu. A comparação com as máquinas não representa lucro ou prejuízo contábil.</p>'+
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
   '\nTotal de consumo MP + UC: '+brl(result.totals.consumo)+
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
   const all=await readAll(true);
   history=all.filter(x=>!x.oculto);
   const hidden=all.filter(x=>x.oculto);
   const fmtRow=(r,hiddenRow)=>'<div class="nt-repos-history"><div><b>'+esc(dateLabel(r.dia))+
    (hiddenRow?' · OCULTO':'')+'</b><div class="small">'+
    esc(new Date(r.criadoEmLocal||Date.now()).toLocaleString('pt-BR'))+
    ' · '+esc(r.operador||'')+' · '+esc(r.numero)+'</div></div><div class="buttons">'+
    (hiddenRow?'<button class="btn alt" data-action="nt-fin-restore-day" data-day="'+esc(r.dia)+
      '">Restaurar dia</button>':
      '<button class="btn alt" data-action="nt-fin-edit" data-code="'+esc(r.numero)+'">Editar valores</button>'+
      '<button class="btn ghost" data-action="nt-fin-history-pdf" data-code="'+esc(r.numero)+'">PDF desta versão</button>'+
      '<button class="btn danger" data-action="nt-fin-hide-day" data-day="'+esc(r.dia)+'">Excluir histórico do dia</button>')+
    '</div></div>';
   const activeList=history.map(r=>fmtRow(r,false)).join('');
   const hiddenList=hidden.map(r=>fmtRow(r,true)).join('');
   d.panel('<h2>Histórico · Conciliação Financeira</h2>'+
    '<p class="small">A versão mais recente de cada data é usada nos relatórios. Excluir o histórico de um dia oculta TODAS as versões dessa data dos PDFs individual e geral. O registro de auditoria é preservado e pode ser restaurado.</p>'+
    '<div class="card" style="max-height:48vh;overflow-y:auto">'+
    (activeList||'<p>Nenhum fechamento financeiro ativo.</p>')+'</div>'+
    (hidden.length?'<details class="card" style="margin:9px 0"><summary>Excluídos · auditoria ('+hidden.length+')</summary>'+
     '<div style="max-height:22vh;overflow-y:auto">'+hiddenList+'</div></details>':'')+
    '<div class="buttons"><button class="btn" data-action="nt-fin-open">Novo / editar data selecionada</button>'+
    '<button class="btn ghost" data-action="close">Fechar</button></div>');
  }finally{d.loader(false);}
 }
 function css(){return '<style>'+
  '.nt-fin-report .desc{margin-bottom:3mm}'+
  '.nt-fin-report .nt-fin-section{font-size:10.6pt;color:#153f4d;font-weight:700;margin:3mm 0 2mm;line-height:1.25}'+
  '.nt-fin-report .nt-fin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3mm;margin:2mm 0 4mm}'+
  '.nt-fin-report .nt-fin-stat{background:#eff6f7;border:1px solid #cfdee1;border-radius:2.3mm;padding:3mm 3.2mm;min-height:21mm}'+
  '.nt-fin-report .nt-fin-stat:last-child{background:#e6f1f2;border-color:#9dced0}'+
  '.nt-fin-report .nt-fin-stat small{display:block;font-size:8.2pt;font-weight:700;color:#4c6771;line-height:1.25}'+
  '.nt-fin-report .nt-fin-stat b{display:block;font-size:13.5pt;font-weight:800;color:#153f4d;margin-top:2mm;white-space:nowrap;font-variant-numeric:tabular-nums}'+
  '.nt-fin-report .nt-fin-stat:last-child b{color:#0f8388}'+
  '.nt-fin-report .nt-fin-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10.2pt;line-height:1.22;font-variant-numeric:tabular-nums;margin:0 0 1.5mm}'+
  '.nt-fin-report .nt-fin-table thead th{background:#194b59;color:#fff;font-size:9pt;font-weight:700;padding:2.1mm 1.6mm;text-align:center}'+
  '.nt-fin-report .nt-fin-table tbody td{padding:2.2mm 1.6mm;border-bottom:1px solid #d3e2e6;text-align:center;vertical-align:middle;overflow-wrap:anywhere}'+
  '.nt-fin-report .nt-fin-table tbody tr:nth-child(even){background:#eff5f6}'+
  '.nt-fin-report .nt-fin-machine-table tbody td:first-child{text-align:left;font-weight:700}'+
  '.nt-fin-report .nt-fin-machine-table tbody td:last-child{text-align:right;font-weight:700}'+
  '.nt-fin-report .nt-fin-machine-total{display:flex;justify-content:space-between;align-items:center;gap:3mm;background:#e5f1f3;border-radius:2mm;padding:2.5mm 3.4mm;margin:1.7mm 0 3mm;color:#153f4d;font-size:9.5pt;font-weight:700}'+
  '.nt-fin-report .nt-fin-machine-total b{font-size:12pt;color:#087e89}'+
  '.nt-fin-report .nt-fin-figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm;margin:2mm 0}'+
  '.nt-fin-report .nt-fin-figure{background:#eff6f7;border:1px solid #cfdee1;border-radius:2.3mm;padding:3mm 3.4mm;min-height:20mm}'+
  '.nt-fin-report .nt-fin-figure small{display:block;font-size:8.1pt;font-weight:700;color:#4c6771;line-height:1.25}'+
  '.nt-fin-report .nt-fin-figure b{display:block;font-size:15pt;color:#153f4d;margin-top:2mm;font-weight:800;white-space:nowrap}'+
  '.nt-fin-report .nt-fin-figure.nt-fin-difference{background:#fff3f0;border-color:#e5b8ac}'+
  '.nt-fin-report .nt-fin-figure.nt-fin-difference small,.nt-fin-report .nt-fin-figure.nt-fin-difference b{color:#a14a3e}'+
  '.nt-fin-report .nt-fin-status{font-size:8.9pt;font-weight:700;color:#a14a3e;margin:2mm 0 1mm}'+
  '.nt-fin-report .nt-fin-remark{font-size:8.2pt;color:#526d79;line-height:1.32;margin:1mm 0 2mm}'+
  /* A4 paisagem: ajustar apenas a Conciliação (PDF individual e Relatório Geral). */
  '.nt-fin-report .desc{margin-bottom:2mm}'+
  '.nt-fin-report .nt-fin-section{margin:1.25mm 0 .85mm;font-size:10pt}'+
  '.nt-fin-report .nt-fin-stats{gap:2mm;margin:.7mm 0 1.6mm}'+
  '.nt-fin-report .nt-fin-stat{padding:1.5mm 2.5mm;min-height:15mm}'+
  '.nt-fin-report .nt-fin-stat small{font-size:7.6pt;line-height:1.2}'+
  '.nt-fin-report .nt-fin-stat b{font-size:12.3pt;margin-top:.8mm}'+
  '.nt-fin-report .nt-fin-table thead th{padding:1.5mm 1.3mm}'+
  '.nt-fin-report .nt-fin-machine-table tbody td{padding:1.5mm 1.3mm}'+
  '.nt-fin-report .nt-fin-machine-total{padding:1.7mm 2.8mm;margin:1mm 0 1.4mm}'+
  '.nt-fin-report .nt-fin-figures{margin:.8mm 0;gap:2.2mm}'+
  '.nt-fin-report .nt-fin-figure{min-height:16mm;padding:1.7mm 2.6mm}'+
  '.nt-fin-report .nt-fin-figure b{font-size:13.5pt;margin-top:.7mm}'+
  '.nt-fin-report .nt-fin-status{margin:.8mm 0 .5mm}'+
  '.nt-fin-report .nt-fin-remark{margin:.5mm 0 .8mm;line-height:1.23;font-size:8.1pt}'+
  '@media print{.nt-fin-report table tr{break-inside:avoid;page-break-inside:avoid}}'+
  '</style>';}
 function reportPages(record,date,marker){
  if(!record||record.dia!==date)return [];
  const x=calc(record),money=v=>d.ntPlain(brl(v));
  const stockSection=(name,r,tag)=>'<div class="nt-fin-section">'+name+' · MOVIMENTAÇÕES E SALDOS</div>'+
   '<div class="nt-fin-stats">'+
   [['SALDO INICIAL',r.inicial],['ENTRADAS',r.entradas],['SALDO FINAL',r.final],['CONSUMO DE '+tag,r.consumo]]
    .map(([label,value])=>'<div class="nt-fin-stat"><small>'+d.ntPlain(label)+'</small><b>'+money(value)+'</b></div>').join('')+
   '</div>';
  const stock=stockSection('MATÉRIA-PRIMA (MP)',x.sections.MP,'MP')+
   stockSection('USO E CONSUMO (UC)',x.sections.UC,'UC');
  // O consumo combinado aparece uma vez, na conferência financeira, abaixo das máquinas.
  // Paginação fixa por grupos equilibrados para evitar a última página quase vazia.
  const machines=x.maquinas,groups=[];
  // Usar a altura provável de cada linha: descrições longas podem ocupar 2-3 linhas.
  const units=m=>Math.max(1,Math.ceil(String(m.modelo||'').length/50));
  const totalUnits=machines.reduce((sum,m)=>sum+units(m),0);
  if(totalUnits<=6)groups.push(machines);
  else{
   const groupCount=Math.max(2,1+Math.ceil(Math.max(0,totalUnits-6)/8));
   let remainingUnits=totalUnits,pos=0;
   for(let k=0;k<groupCount&&pos<machines.length;k++){
    const left=groupCount-k;
    const budget=k===0?6:8;
    const target=Math.min(budget,Math.ceil(remainingUnits/left));
    const chunk=[];
    let used=0;
    while(pos<machines.length){
     const cost=units(machines[pos]);
     if(chunk.length&&used+cost>target)break;
     chunk.push(machines[pos++]);used+=cost;
     if(used>=target)break;
    }
    groups.push(chunk);remainingUnits-=used;
   }
   // Fallback para nomes extremamente longos ou aritmética de páginas conservadora.
   while(pos<machines.length){
    const chunk=[],budget=8;
    let used=0;
    do{const m=machines[pos++];chunk.push(m);used+=units(m);}while(pos<machines.length&&used+units(machines[pos])<=budget);
    groups.push(chunk);
   }
  }
  const table=items=>'<div class="nt-fin-section">MÁQUINAS PRODUZIDAS · VALORES ESTIMADOS</div>'+
   '<table class="nt-fin-table nt-fin-machine-table">'+
   '<colgroup><col style="width:42%"><col style="width:13%"><col style="width:23%"><col style="width:22%"></colgroup>'+
   '<thead><tr><th>MÁQUINA / MODELO</th><th>QUANTIDADE</th><th>VALOR POR MÁQUINA</th><th>VALOR TOTAL</th></tr></thead>'+
   '<tbody>'+(items.length?items.map(m=>'<tr><td>'+d.ntPlain(m.modelo)+'</td>'+
    '<td>'+d.ntPlain(m.quantidade)+'</td><td>'+money(m.valorUnitarioCentavos)+'</td>'+
    '<td>'+money(m.totalCentavos)+'</td></tr>').join(''):
    '<tr><td colspan="4">Nenhuma máquina informada nesta data.</td></tr>')+
   '</tbody></table>';
  const total='<div class="nt-fin-machine-total"><span>TOTAL PRODUZIDO: <b>'+
   d.ntPlain(x.qtdMaquinas)+' MÁQUINAS</b></span><span>VALOR ESTIMADO TOTAL: <b>'+
   money(x.valorMaquinas)+'</b></span></div>';
  const diff=machines.length?x.diferencaGeral:null;
  const status=diff===null?'Sem máquinas informadas para comparação':
   diff>0?'Valor das máquinas maior que o consumo conjunto de MP e UC':
   diff<0?'Consumo conjunto de MP e UC maior que o valor das máquinas':'Valores conferem';
  const finish='<div class="nt-fin-section">CONFERÊNCIA FINANCEIRA DO DIA</div>'+
   '<div class="nt-fin-figures">'+
   [['CONSUMO TOTAL · MP + UC',x.totals.consumo],['VALOR TOTAL DAS MÁQUINAS',x.valorMaquinas],
    ['DIFERENÇA PARA CONFERÊNCIA',diff]].map(([name,value],i)=>
    '<div class="nt-fin-figure'+(i===2&&value!==null&&value<0?' nt-fin-difference':'')+'">'+
    '<small>'+d.ntPlain(name)+'</small><b>'+(value===null?'NÃO APLICÁVEL':money(value))+
    '</b></div>').join('')+'</div>'+
   '<p class="nt-fin-status">'+d.ntPlain(status)+'</p>'+
   '<p class="nt-fin-remark">Valores informados manualmente. A diferença compara o consumo conjunto de MP e UC com o valor estimado das máquinas; não comprova lucro ou prejuízo.'+
   (record.observacao?' <b>OBSERVAÇÃO:</b> '+d.ntPlain(record.observacao):'')+'</p>';
  return groups.map((items,i)=>{
   const first=i===0,last=i===groups.length-1;
   return '<section class="page landscape nt-fin-report">'+
    d.ntTop('CONCILIAÇÃO FINANCEIRA DO ESTOQUE',
     first?'Fechamento diário · Matéria-Prima e Uso e Consumo':'Fechamento diário · Continuação das máquinas',date)+
    (first?stock:'')+table(items)+(last?total+finish:'')+marker+'</section>';
  });
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
  return 'Fechamento manual — MP: consumo '+brl(x.sections.MP.consumo)+
   '; UC: consumo '+brl(x.sections.UC.consumo)+
   '; consumo conjunto '+brl(x.totals.consumo)+
   '; máquinas estimadas '+brl(x.valorMaquinas)+
   '; diferença para conferência '+(x.maquinas.length?brl(x.diferencaGeral):'não aplicável')+
   '. Sem alteração do estoque.';
 }
 async function action(a,button){
  if(a==='nt-fin-open')return open();
  if(a==='nt-fin-pdf')return openPDF();
  if(a==='nt-fin-history')return showHistory();
  if(a==='nt-fin-add'){snapshotForm();draft.maquinas.push({modelo:'',quantidade:'',valorUnitario:''});return modal();}
  if(a==='nt-fin-remove'){snapshotForm();draft.maquinas.splice(Number(button.dataset.index),1);if(!draft.maquinas.length)draft.maquinas.push({modelo:'',quantidade:'',valorUnitario:''});return modal();}
  if(a==='nt-fin-save')return save();
  if(a==='nt-fin-hide-day')return setDayVisibility(String(button.dataset.day||''),true);
  if(a==='nt-fin-restore-day')return setDayVisibility(String(button.dataset.day||''),false);
  if(a==='nt-fin-edit'){const found=history.find(x=>x.numero===button.dataset.code);return open(found?.dia||today(),button.dataset.code);}
  if(a==='nt-fin-history-pdf')return openPDF(history.find(x=>x.numero===button.dataset.code)?.dia||today(),button.dataset.code);
 }
 document.addEventListener('input',e=>{if(e.target.closest('#ntFin_form'))preview()});
 return {action,latestForDate,reportPages,css,summary,calc,parseCents,openPDF};
}
