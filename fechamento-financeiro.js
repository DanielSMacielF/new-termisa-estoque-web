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
    '<b>Consumo calculado: '+brl(r.consumo)+'</b></div>';
   el.innerHTML='<h3>Prévia do fechamento diário</h3>'+
    part('Matéria-Prima (MP)',x.sections.MP)+part('Uso e Consumo (UC)',x.sections.UC)+
    '<div style="background:#dcebef;border-left:3px solid #168f99;padding:12px;border-radius:6px;margin:8px 0">'+
    '<strong>TOTAL GERAL · MP + UC</strong><div class="small">Inicial: '+brl(x.totals.inicial)+
    ' · Entradas: '+brl(x.totals.entradas)+' · Final: '+brl(x.totals.final)+'</div>'+
    '<b>Consumo total: '+brl(x.totals.consumo)+'</b></div>'+
    '<div style="background:#e7f1f2;padding:12px;border-radius:6px"><b>Valor estimado das máquinas: '+
    brl(x.valorMaquinas)+'</b><div class="small">Diferença das máquinas em relação ao consumo total de MP + UC: <b>'+
    (x.maquinas.length?brl(x.diferencaGeral):'não aplicável')+'</b></div></div>'+
    '<p class="small" style="margin-top:8px">Os consumos de MP e UC são calculados separadamente e somados apenas no total geral. A diferença é um comparativo gerencial, não lucro ou prejuízo contábil.</p>';
  }catch(e){el.innerHTML='<strong>Prévia do fechamento diário</strong><p class="small">Preencha os valores iniciais, entradas e finais de MP e UC para visualizar os resultados separados e o total geral.</p>';}
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
  '.nt-fin-report .nt-fin-section{font-size:10pt;color:#153f4d;font-weight:700;margin:4mm 0 2mm;line-height:1.3}'+
  '.nt-fin-report .nt-fin-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9.5pt;line-height:1.3;margin:0 0 3mm;font-variant-numeric:tabular-nums}'+
  '.nt-fin-report .nt-fin-table thead th{background:#194b59;color:#fff;font-size:8.5pt;font-weight:700;padding:2.6mm 1.5mm;text-align:center;white-space:normal}'+
  '.nt-fin-report .nt-fin-table tbody td{padding:2.6mm 1.5mm;border-bottom:1px solid #d3e2e6;text-align:center;vertical-align:middle;overflow-wrap:anywhere}'+
  '.nt-fin-report .nt-fin-table tbody tr:nth-child(even){background:#eff5f6}'+
  '.nt-fin-report .nt-fin-table tbody tr.nt-fin-total{background:#dcebef;font-weight:800}'+
  '.nt-fin-report .nt-fin-stock-table tbody td:first-child{text-align:center;font-weight:400}'+
  '.nt-fin-report .nt-fin-machine-table tbody td:first-child{text-align:left;font-weight:700}'+
  '.nt-fin-report .nt-fin-table tbody tr.nt-fin-total td:last-child{font-size:11pt;color:#127e88;font-weight:800}'+
  '.nt-fin-report .nt-fin-grand-total{display:flex;align-items:center;justify-content:space-between;gap:5mm;background:#dcebef;border-left:2px solid #159ca4;border-radius:4px;padding:2.5mm 3mm;margin:2mm 0 3mm;color:#194b59;font-size:9pt;font-weight:800}'+
  '.nt-fin-report .nt-fin-grand-total b{font-size:12pt;color:#087e89;white-space:nowrap}'+
  '.nt-fin-report .nt-fin-machine-table tbody td{padding:2mm 1.5mm}'+
  '.nt-fin-report .nt-fin-machine-table td:nth-child(2){text-align:center}'+
  '.nt-fin-report .nt-fin-machine-table td:nth-child(n+3){text-align:right}'+
  '.nt-fin-report .nt-fin-machine-table td:last-child{font-weight:700}'+
  '.nt-fin-report .nt-fin-figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm;margin:3mm 0}'+
  '.nt-fin-report .nt-fin-figure{background:#e5f1f3;border-left:2px solid #16a3a9;border-radius:5px;padding:2.7mm 3mm;min-height:18mm}'+
  '.nt-fin-report .nt-fin-figure small{display:block;font-size:8pt;font-weight:700;line-height:1.3;color:#436573}'+
  '.nt-fin-report .nt-fin-figure b{display:block;font-size:13pt;line-height:1.3;color:#156475;margin-top:1.3mm;font-weight:800}'+
  '.nt-fin-report .nt-fin-figure.nt-fin-difference{background:#fff5e6;border-left-color:#ca873d}'+
  '.nt-fin-report .nt-fin-figure.nt-fin-difference b{color:#87531f}'+
  '.nt-fin-report .nt-fin-machine-total{display:flex;justify-content:space-between;align-items:center;gap:3mm;background:#e5f1f3;border-left:2px solid #16a3a9;border-radius:4px;padding:2.8mm 3.5mm;margin:2mm 0;font-size:9pt;color:#194b59;font-weight:700}'+
  '.nt-fin-report .nt-fin-machine-total b{font-size:12pt;font-weight:800;color:#087e89}'+
  '.nt-fin-report .nt-fin-status{font-size:9pt;font-weight:700;color:#244c59;margin:2mm 0 0}'+
  '.nt-fin-report .nt-fin-remark{font-size:8pt;color:#526d79;line-height:1.34;margin:3mm 0}'+
  /* Ajustes validados no Chrome A4: compactação moderada sem reduzir as colunas ou ocultar linhas. */
  '.nt-fin-report .desc{margin-bottom:2mm}'+
  '.nt-fin-report .nt-fin-section{margin:2mm 0 1mm;font-size:9pt}'+
  '.nt-fin-report .nt-fin-table{margin-bottom:1.5mm;line-height:1.2}'+
  '.nt-fin-report .nt-fin-table thead th{padding:1.7mm 1.3mm;font-size:8.2pt}'+
  '.nt-fin-report .nt-fin-table tbody td{padding:1.7mm 1.2mm;line-height:1.2}'+
  '.nt-fin-report .nt-fin-machine-table tbody td{padding:1.4mm 1mm;line-height:1.2}'+
  '.nt-fin-report .nt-fin-grand-total{padding:1.5mm 2.5mm;margin:1.1mm 0 1.5mm}'+
  '.nt-fin-report .nt-fin-machine-total{padding:1.5mm 2.5mm;margin:1mm 0;min-height:0}'+
  '.nt-fin-report .nt-fin-figures{margin:1.5mm 0}'+
  '.nt-fin-report .nt-fin-figure{min-height:15mm;padding:1.5mm 2.5mm}'+
  '.nt-fin-report .nt-fin-figure small{font-size:7.5pt}'+
  '.nt-fin-report .nt-fin-figure b{font-size:12pt;margin-top:1mm}'+
  '.nt-fin-report .nt-fin-status{margin:1mm 0 0;font-size:8pt}'+
  '.nt-fin-report .nt-fin-remark{margin:1mm 0;font-size:7.5pt;line-height:1.2}'+
  '.nt-fin-report .nt-fin-muted{color:#536e79;font-size:8.5pt;line-height:1.35;margin:2mm 0}'+
  '@media print{.nt-fin-report table tr{break-inside:avoid;page-break-inside:avoid}}'+
  '</style>';}
 function reportPages(record,date,marker){
  if(!record||record.dia!==date)return [];
  const x=calc(record),mp=x.sections.MP,uc=x.sections.UC;
  const currency=value=>d.ntPlain(brl(value));
  // MP e UC em quadros individuais; o quadro TOTAL GERAL aparece somente abaixo dos dois.
  const stockSection=(name,r)=>'<div class="nt-fin-section">'+d.ntPlain(name)+' · MOVIMENTAÇÕES E SALDOS</div>'+
   '<table class="nt-fin-table nt-fin-stock-table"><colgroup>'+
   '<col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>'+
   '<thead><tr><th>INICIAL</th><th>ENTRADAS</th><th>FINAL</th><th>CONSUMO</th></tr></thead>'+
   '<tbody><tr>'+[r.inicial,r.entradas,r.final,r.consumo].map(v=>'<td>'+currency(v)+'</td>').join('')+
   '</tr></tbody></table>';
  const stock=stockSection('MATÉRIA-PRIMA (MP)',mp)+
   stockSection('USO E CONSUMO (UC)',uc)+
   '<div class="nt-fin-grand-total"><span>CONSUMO TOTAL · MATÉRIA-PRIMA + USO E CONSUMO</span><b>'+
    currency(x.totals.consumo)+'</b></div>';
  const machineItems=x.maquinas;
  // Folha 1 contém MP, UC e resumo. Limitar máquinas para preservar o rodapé.
  // Nas continuações reservar espaço ao último quadro de conferência.
  const firstCap=machineItems.length>2?3:machineItems.length;
  const otherCap=7;
  const groups=[machineItems.slice(0,firstCap)];
  for(let i=firstCap;i<machineItems.length;i+=otherCap)groups.push(machineItems.slice(i,i+otherCap));
  const machineTable=items=>'<div class="nt-fin-section">MÁQUINAS PRODUZIDAS · VALORES ESTIMADOS</div>'+
   '<table class="nt-fin-table nt-fin-machine-table">'+
   '<colgroup><col style="width:43%"><col style="width:13%"><col style="width:22%"><col style="width:22%"></colgroup>'+
   '<thead><tr><th>MÁQUINA / MODELO</th><th>QUANTIDADE</th><th>VALOR POR MÁQUINA</th><th>VALOR TOTAL</th></tr></thead>'+
   '<tbody>'+(items.length?items.map(m=>'<tr><td>'+d.ntPlain(m.modelo)+'</td>'+
    '<td>'+d.ntPlain(m.quantidade)+'</td><td>'+currency(m.valorUnitarioCentavos)+'</td>'+
    '<td>'+currency(m.totalCentavos)+'</td></tr>').join(''):
    '<tr><td colspan="4" class="nt-fin-muted">Nenhuma máquina informada nesta data.</td></tr>')+
   '</tbody></table>';
  const overview='<div class="nt-fin-machine-total"><span>QUANTIDADE TOTAL: <b>'+
   d.ntPlain(x.qtdMaquinas)+'</b></span><span>VALOR ESTIMADO DAS MÁQUINAS: <b>'+
   currency(x.valorMaquinas)+'</b></span></div>';
  const hasMachines=machineItems.length>0;
  const difference=hasMachines?x.diferencaGeral:null;
  const status=!hasMachines?'Sem máquinas informadas para comparação':
   x.diferencaGeral>0?'Valor das máquinas maior que o consumo total de MP e UC':
   x.diferencaGeral<0?'Consumo total de MP e UC maior que o valor das máquinas':
   'Valores conferem';
  const cards='<div class="nt-fin-section">CONFERÊNCIA FINANCEIRA DO DIA</div>'+
   '<div class="nt-fin-figures">'+
   [['CONSUMO TOTAL · MP + UC',x.totals.consumo],['VALOR TOTAL DAS MÁQUINAS',x.valorMaquinas],
    ['DIFERENÇA PARA CONFERÊNCIA',difference]].map(([title,value],i)=>
     '<div class="nt-fin-figure'+(i===2&&difference!==0&&difference!==null?' nt-fin-difference':'')+'">'+
     '<small>'+d.ntPlain(title)+'</small><b>'+(value===null?'NÃO APLICÁVEL':currency(value))+
     '</b></div>').join('')+'</div>'+
   '<p class="nt-fin-status">'+d.ntPlain(status)+'</p>';
  const note='<p class="nt-fin-remark">Valores informados manualmente. A diferença apresentada compara o valor estimado das máquinas com o consumo conjunto de Matéria-Prima e Uso e Consumo; não comprova lucro ou prejuízo.'+
   (record.observacao?' <b>OBSERVAÇÃO:</b> '+d.ntPlain(record.observacao):'')+'</p>';
  const pages=[];
  groups.forEach((items,i)=>{
   const first=i===0,last=i===groups.length-1;
   pages.push('<section class="page landscape nt-fin-report">'+
    d.ntTop('CONCILIAÇÃO FINANCEIRA DO ESTOQUE',
      first?'Fechamento diário · Matéria-Prima e Uso e Consumo':'Fechamento diário · Continuação das máquinas',date)+
    (first?stock:'')+machineTable(items)+(last?overview+cards+note:'')+marker+'</section>');
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
  return 'Fechamento manual — MP: consumo '+brl(x.sections.MP.consumo)+
   ', variação '+brl(x.sections.MP.variacao)+
   '; UC: consumo '+brl(x.sections.UC.consumo)+
   ', variação '+brl(x.sections.UC.variacao)+
   '; TOTAL MP + UC: consumo '+brl(x.totals.consumo)+
   '; máquinas estimadas: '+brl(x.valorMaquinas)+
   '; diferença máquinas − consumo MP + UC: '+brl(x.diferencaGeral)+
   '. Valores informados manualmente; estoques preservados.';
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
