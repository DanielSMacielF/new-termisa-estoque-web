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
   const part=(name,r)=>'<div style="background:#eef6f7;border-left:3px solid #1d9da4;padding:10px;margin:8px 0;border-radius:6px">'+
    '<strong>'+esc(name)+'</strong><div class="small">Inicial: '+brl(r.inicial)+' + Entradas: '+brl(r.entradas)+
    ' = Disponível: '+brl(r.disponivel)+'</div><div class="small">Disponível: '+brl(r.disponivel)+
    ' − Final: '+brl(r.final)+'</div><b>Consumo: '+brl(r.consumo)+'</b></div>';
   el.innerHTML='<h3>Prévia do fechamento diário</h3>'+
    part('Matéria-Prima (MP)',x.sections.MP)+part('Uso e Consumo (UC)',x.sections.UC)+
    '<div style="background:#e7f1f2;padding:12px;border-radius:6px"><b>CONSUMO TOTAL: '+
    brl(x.consumoTotal)+'</b><div class="small">Valor estimado das máquinas: '+brl(x.valorMaquinas)+
    '</div><div class="small">Diferença das máquinas em relação à MP: <b>'+
    brl(x.diferencaMP)+'</b></div><div class="small">Diferença em relação a MP + UC: <b>'+
    brl(x.diferencaTotal)+'</b></div></div>'+
    '<p class="small" style="margin-top:8px">Comparação gerencial: diferença não comprova lucro, prejuízo ou erro.</p>';
  }catch(e){el.innerHTML='<strong>Prévia do fechamento diário</strong><p class="small">Preencha os valores iniciais, entradas e finais de MP e UC para visualizar o cálculo.</p>';}
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
  '.nt-fin-report{--fin-ink:#194b5b;--fin-accent:#18a2aa;--fin-light:#eaf3f4}'+
  '.nt-fin-report .nt-fin-label{color:var(--fin-ink);font-size:10pt;font-weight:700;margin:4mm 0 1.7mm}'+
  '.nt-fin-report .nt-fin-table{table-layout:fixed;width:100%;border-collapse:collapse;font-size:9.7pt;line-height:1.32;margin:0 0 2.5mm}'+
  '.nt-fin-report .nt-fin-table th{background:#1a4b5a;color:#fff;font-size:8.2pt;font-weight:700;line-height:1.2;padding:3mm 1.2mm;text-align:center}'+
  '.nt-fin-report .nt-fin-table td{border-bottom:1px solid #d4e5e7;text-align:center;padding:3mm 1.2mm;overflow-wrap:anywhere}'+
  '.nt-fin-report .nt-fin-table td:first-child{font-weight:700;text-align:left}'+
  '.nt-fin-report .nt-fin-table tbody tr:nth-child(even){background:#f2f7f8}'+
  '.nt-fin-report .nt-fin-table .nt-fin-row-total{background:#e5f0f2!important;font-weight:800}'+
  '.nt-fin-report .nt-fin-table .nt-fin-row-total td:last-child{color:#087e89;font-size:11pt;font-weight:800}'+
  '.nt-fin-report .nt-fin-result{display:flex;align-items:center;justify-content:space-between;gap:5mm;border-left:3px solid var(--fin-accent);border-radius:5px;background:#e9f3f4;padding:3mm 4mm;margin:3mm 0 4mm}'+
  '.nt-fin-report .nt-fin-result span{display:block;font-size:8.5pt;line-height:1.45;color:#395d69}'+
  '.nt-fin-report .nt-fin-result strong{display:block;color:#087e89;font-size:17pt;font-weight:800;white-space:nowrap}'+
  '.nt-fin-report .nt-fin-smallnote{font-size:8.3pt;line-height:1.38;color:#4b6c78;margin:2mm 0}'+
  '.nt-fin-report .nt-fin-machines .nt-fin-table th{padding:2.3mm 1.2mm}'+
  '.nt-fin-report .nt-fin-machines .nt-fin-table td{padding:2.25mm 1.2mm}'+
  '.nt-fin-report .nt-fin-comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm;margin:2.8mm 0}'+
  '.nt-fin-report .nt-fin-comparison>div{border-left:2px solid var(--fin-accent);border-radius:5px;background:#eaf3f4;padding:3mm;min-height:17mm}'+
  '.nt-fin-report .nt-fin-comparison small{display:block;font-size:8pt;font-weight:700;color:#456775;line-height:1.25}'+
  '.nt-fin-report .nt-fin-comparison b{display:block;font-size:13pt;font-weight:800;margin-top:1.5mm;color:#165265}'+
  '.nt-fin-report .nt-fin-negative{color:#a55313!important;font-weight:800}'+
  '.nt-fin-report .nt-fin-reconcile{background:#f0f6f7;border-left:2px solid var(--fin-accent);border-radius:4px;padding:2.6mm 3mm;font-size:8.8pt;line-height:1.4;margin:3mm 0}'+
  '.nt-fin-report .nt-fin-reconcile strong{color:var(--fin-ink)}'+
  '.nt-fin-report .nt-fin-reconcile .nt-fin-formula{font-size:10.5pt;font-weight:700;color:#1b4b5b;margin-bottom:1mm}'+
  '.nt-fin-report .nt-fin-footer{font-size:7.7pt;line-height:1.32;color:#506f7c;margin:3mm 0}'+
  '.nt-fin-report .nt-fin-status{font-weight:700;color:#80591d}'+
  '@media print{.nt-fin-report .nt-fin-table tr{break-inside:avoid;page-break-inside:avoid}}'+
  '</style>';}
 function reportPages(record,date,marker){
  if(!record||record.dia!==date)return [];
  const x=calc(record),mp=x.sections.MP,uc=x.sections.UC;
  const total={inicial:x.estoqueInicialTotal,entradas:x.entradasTotal,
   disponivel:x.estoqueInicialTotal+x.entradasTotal,final:x.estoqueFinalTotal,
   consumo:x.consumoTotal};
  const money=v=>'<span'+(v<0?' class="nt-fin-negative"':'')+'>'+d.ntPlain(brl(v))+'</span>';
  const machineItems=x.maquinas;
  const rows=[['MATÉRIA-PRIMA (MP)',mp],['USO E CONSUMO (UC)',uc],['TOTAL',total]];
  const firstTable='<div class="nt-fin-label">1. VALORES DO ESTOQUE NO DIA</div>'+
   '<table class="nt-fin-table"><colgroup><col style="width:22%"><col style="width:15%">'+
   '<col style="width:15%"><col style="width:16%"><col style="width:15%"><col style="width:17%"></colgroup>'+
   '<thead><tr><th>TIPO</th><th>INICIAL</th><th>ENTRADAS (+)</th><th>DISPONÍVEL (=)</th>'+
   '<th>FINAL (−)</th><th>CONSUMO (=)</th></tr></thead><tbody>'+
   rows.map(([label,row],i)=>'<tr'+(i===2?' class="nt-fin-row-total"':'')+'><td>'+d.ntPlain(label)+'</td>'+
   [row.inicial,row.entradas,row.disponivel,row.final,row.consumo].map(v=>'<td>'+money(v)+'</td>').join('')+
   '</tr>').join('')+'</tbody></table>';
  const math='<div class="nt-fin-result">'+
   '<div><b>CONSUMO TOTAL APURADO</b><span>Estoque inicial + entradas − estoque final</span>'+
   '<span>'+d.ntPlain(brl(x.estoqueInicialTotal))+' + '+d.ntPlain(brl(x.entradasTotal))+
   ' − '+d.ntPlain(brl(x.estoqueFinalTotal))+'</span></div>'+
   '<strong>'+d.ntPlain(brl(x.consumoTotal))+'</strong></div>';
  const description='<p class="nt-fin-smallnote">'+
   'O consumo é o valor estimado dos materiais que saíram do estoque: nem toda saída precisa corresponder a uma entrada feita no mesmo dia.'+
   (x.consumoTotal<0?' <b>ATENÇÃO: consumo negativo. Confira as entradas e o estoque final digitados.</b>':'')+
   '</p>';
  const comparisonAmounts=[
   ['CONSUMO DE MP',mp.consumo],
   ['VALOR ESTIMADO DAS MÁQUINAS',x.valorMaquinas],
   ['DIFERENÇA (MÁQUINAS − MP)',x.diferencaMP]
  ];
  const comparison='<div class="nt-fin-label">3. CONFERÊNCIA COM A PRODUÇÃO</div>'+
   '<div class="nt-fin-comparison">'+comparisonAmounts.map(([label,val])=>
    '<div><small>'+d.ntPlain(label)+'</small><b'+(val<0?' class="nt-fin-negative"':'')+'>'+
    d.ntPlain(brl(val))+'</b></div>').join('')+'</div>'+
   '<div class="nt-fin-reconcile">'+
   '<div class="nt-fin-formula">'+d.ntPlain(brl(x.valorMaquinas))+' − '+d.ntPlain(brl(mp.consumo))+
   ' = '+money(x.diferencaMP)+'</div>'+
   '<div><strong>'+(!x.maquinas.length?'SEM MÁQUINAS INFORMADAS':
    x.diferencaMP===0?'VALORES IGUAIS':'DIFERENÇA A CONFERIR')+'</strong>'+
   (!x.maquinas.length?': registre as máquinas para comparar os valores.':
    x.diferencaMP===0?': valor estimado das máquinas igual ao consumo de MP.':
    ': confira a estimativa por máquina e o consumo de MP.')+'</div>'+
   '<div>O consumo adicional de Uso e Consumo (UC) é '+money(uc.consumo)+
   '. Considerando MP + UC, a diferença estimada fica em '+money(x.diferencaTotal)+'.</div>'+
   '<div class="nt-fin-smallnote">Essa diferença não comprova erro, lucro ou prejuízo: os valores das máquinas são estimados e podem incluir outros custos.</div>'+
   '</div>';
  // A primeira página contém o resumo completo: limitar linhas de máquinas
  // para proteger a observação e o rodapé. Modelos adicionais têm continuação.
  const groups=[machineItems.slice(0,2)];
  for(let i=2;i<machineItems.length;i+=8)groups.push(machineItems.slice(i,i+8));
  const machineTable=items=>'<div class="nt-fin-machines">'+
   '<div class="nt-fin-label">2. MÁQUINAS BAIXADAS NO DIA · VALORES MANUAIS</div>'+
   '<table class="nt-fin-table"><colgroup><col style="width:44%"><col style="width:15%">'+
   '<col style="width:20%"><col style="width:21%"></colgroup>'+
   '<thead><tr><th>MÁQUINA / MODELO</th><th>QUANTIDADE</th><th>VALOR ESTIMADO UNITÁRIO</th><th>TOTAL ESTIMADO</th></tr></thead><tbody>'+
   (items.length?items.map(r=>'<tr><td>'+d.ntPlain(r.modelo)+'</td><td>'+d.ntPlain(r.quantidade)+
    '</td><td>'+money(r.valorUnitarioCentavos)+'</td><td>'+money(r.totalCentavos)+'</td></tr>').join(''):
    '<tr><td colspan="4">Nenhuma máquina informada nesta data.</td></tr>')+
   '</tbody></table></div>';
  const pages=[];
  groups.forEach((items,i)=>{
   const first=i===0,last=i===groups.length-1;
   const intro=first?firstTable+math+description:
    '<p class="nt-fin-smallnote">Continuação dos modelos de máquinas informados manualmente no fechamento do dia.</p>';
   const foot=last?comparison+
    '<p class="nt-fin-footer"><b>Registro financeiro 100% manual.</b> Não foram usados preços ou custos do cadastro de materiais.'+
    ' A comparação é gerencial; deve ser interpretada com os custos efetivamente considerados.'+
    (record.observacao?'<br><b>OBSERVAÇÃO:</b> '+d.ntPlain(record.observacao):'')+'</p>':'';
   pages.push('<section class="page landscape nt-fin-report">'+
    d.ntTop('CONCILIAÇÃO FINANCEIRA DO ESTOQUE',
     'Fechamento manual · Matéria-Prima e Uso e Consumo · '+(first?'Visão do dia':'Continuação'),date)+
    intro+machineTable(items)+foot+marker+'</section>');
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
