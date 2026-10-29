/* New Termisa - Excel editavel, formulas, filtros e graficos Office nativos.
   Nenhuma imagem de pagina PDF, nenhuma escrita no Firebase. */
const PAL={navy:'164352',deep:'103043',teal:'15989F',light:'EDF5F6',
 white:'FFFFFF',ink:'1F4553',muted:'5E7A86',line:'DCE8EA'};
let pendingExcel=null;
function loadLibs(){
 if(window.ExcelJS?.Workbook&&window.JSZip?.loadAsync)return Promise.resolve([window.ExcelJS,window.JSZip]);
 if(pendingExcel)return pendingExcel;
 const script=(url,test)=>new Promise((resolve,reject)=>{
  if(test()){resolve();return;}
  const el=document.createElement('script');el.src=url;el.async=true;
  el.onload=()=>test()?resolve():reject(Error('Biblioteca Excel incompatível.'));
  el.onerror=()=>reject(Error('Não foi possível carregar a biblioteca Excel pela internet.'));
  document.head.appendChild(el);
 });
 pendingExcel=Promise.all([
  script('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',()=>!!window.ExcelJS?.Workbook),
  script('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>!!window.JSZip?.loadAsync)
 ]).then(()=>[window.ExcelJS,window.JSZip]).catch(e=>{pendingExcel=null;throw e;});
 return pendingExcel;
}
const txt=x=>String(x??''),num=x=>Number.isFinite(Number(x))?Number(x):0;
const shortGraphName=x=>{const name=txt(x).replace(/\s+/g,' ').trim();return name.length>18?name.slice(0,17)+'…':name;};
const round=x=>Math.round((num(x)+Number.EPSILON)*10000)/10000;
const prettyDate=x=>/^\d{4}-\d\d-\d\d$/.test(txt(x))?txt(x).slice(8,10)+'/'+txt(x).slice(5,7)+'/'+txt(x).slice(0,4):txt(x);
const timeOf=x=>{const m=txt(x?.timeClient||x?.hora).match(/(?:T)?(\d\d:\d\d)/);return m?m[1]:''};
const alpha=n=>{let x='';for(;n;n=Math.floor((n-1)/26))x=String.fromCharCode(65+(n-1)%26)+x;return x};
const f=(formula,result)=>({formula:formula,result:num(result)});
function style(c,opt={}){
 c.font={name:'Aptos',size:opt.size||10,bold:!!opt.bold,color:{argb:'FF'+(opt.color||PAL.ink)}};
 c.alignment={vertical:'middle',horizontal:opt.align||'left',wrapText:!!opt.wrap};
 if(opt.fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+opt.fill}};
 if(opt.border)c.border={bottom:{style:'hair',color:{argb:'FF'+PAL.line}}};
 if(opt.numeric)c.numFmt='#,##0.####;[Red](#,##0.####);0';
}
function merged(ws,range,value,opt){
 ws.mergeCells(range);const c=ws.getCell(range.split(':')[0]);c.value=value;style(c,opt);return c;
}
function createSheet(book,name,title,subtitle,widths,logo){
 const ws=book.addWorksheet(name,{views:[{state:'frozen',ySplit:8,showGridLines:false}],
  pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
   margins:{left:.25,right:.25,top:.35,bottom:.3,header:.1,footer:.15}}});
 ws.properties.defaultRowHeight=19;
 widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
 const last=alpha(Math.max(8,widths.length));
 ws.getRow(1).height=9;ws.getRow(2).height=33;ws.getRow(3).height=21;
 ws.getRow(4).height=5;ws.getRow(5).height=29;
 ws.getRow(6).height=21;ws.getRow(7).height=11;
 if(logo?.startsWith('data:image/')){
  const id=book.addImage({base64:logo,extension:logo.includes('jpeg')?'jpeg':'png'});
  ws.addImage(id,{tl:{col:.05,row:1.08},ext:{width:155,height:36}});
 }
 merged(ws,'D2:'+last+'2','ALMOXARIFADO / NEW TERMISA',
  {color:PAL.navy,bold:true,size:10,align:'right'});
 const date=(txt(subtitle).match(/\d\d\/\d\d\/\d{4}/)||[])[0]||'';
 merged(ws,'D3:'+last+'3',date,{size:9,color:PAL.muted,align:'right'});
 for(let i=1;i<=Math.max(8,widths.length);i++){
  ws.getCell(4,i).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+PAL.teal}};
 }
 merged(ws,'A5:'+last+'5',title.toUpperCase(),{size:16,bold:true,color:PAL.navy});
 merged(ws,'A6:'+last+'6',subtitle,{size:9,color:PAL.muted});
 ws.headerFooter.oddFooter='NEW TERMISA  |  ALMOXARIFADO  |  &P / &N';
 ws.pageSetup.printTitlesRow='1:8';
 return ws;
}
function table(ws,headers,rows,options={}){
 const start=9,last=alpha(headers.length);
 headers.forEach((h,j)=>{
  const c=ws.getCell(8,j+1);c.value=h;style(c,{fill:PAL.navy,color:PAL.white,
   bold:true,size:9,align:'center',wrap:true});
 });ws.getRow(8).height=30;
 rows.forEach((entry,i)=>{
  const row=ws.getRow(i+start);row.height=24;
  entry.forEach((v,j)=>{
   const c=row.getCell(j+1);c.value=v&&typeof v==='object'&&v.formula?
    {formula:v.formula,result:v.result}:v??'';
   const numeric=typeof v==='number'||v&&typeof v==='object'&&v.formula;
   style(c,{fill:i%2?PAL.light:PAL.white,size:9,
    align:numeric?'right':'left',numeric,border:true,wrap:j===options.wrap});
   if(options.codes?.includes(j))c.numFmt='@';
  });
 });
 if(rows.length)ws.autoFilter={from:{row:8,column:1},to:{row:rows.length+8,column:headers.length}};
 ws.pageSetup.printArea='A1:'+last+Math.max(18,rows.length+10);
}
function section(ws,range,title){
 merged(ws,range,title,{fill:PAL.navy,color:PAL.white,bold:true,size:11});
}
function card(ws,a,b,label,value,formula){
 merged(ws,a+'8:'+b+'8',label.toUpperCase(),{fill:PAL.light,color:PAL.navy,bold:true,size:9});
 const c=merged(ws,a+'9:'+b+'10',formula?f(formula,value):num(value),
  {fill:PAL.light,color:PAL.teal,bold:true,size:21});c.numFmt='#,##0';
 ws.getRow(8).height=23;ws.getRow(9).height=25;ws.getRow(10).height=23;
}

function dashboard(book,model,logo){
 const t=model.totals||{},date=prettyDate(model.date);
 const ws=createSheet(book,'Dashboard','Relatório Geral do Dia · '+date,
   'Referente ao dia '+date+' · Produção, saídas, recebimentos e reposições.',Array(20).fill(10),logo);
 ws.views=[{showGridLines:false,zoomScale:85}];
 const cards=[
  ['MÁQUINAS CONCLUÍDAS',num(t.machines)],
  ['RETIRADAS',num(t.requestsLines)],
  ['RECEBIMENTOS',num(t.receipts)],
  ['REPOSIÇÕES SOLICITADAS',num(t.reposReports)],
  ['MATERIAIS DISTINTOS',num(t.stockItems)]
 ];
 cards.forEach(([label,value],i)=>{
  const a=alpha(i*4+1),b=alpha(i*4+4);
  merged(ws,a+'8:'+b+'8',label,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  const c=merged(ws,a+'9:'+b+'11',value,{fill:PAL.light,color:PAL.teal,bold:true,size:22});
  c.numFmt='#,##0';
 });
 [8,9,10,11].forEach(n=>ws.getRow(n).height=n===8?24:19);
 section(ws,'A14:T14','PANORAMA DO DIA');
 const summaries=[
  ['PRODUÇÃO',num(t.machines)+' máquina(s) concluída(s).'],
  ['MATERIAIS ENTREGUES',num(t.requestsLines)+' retirada(s) realizadas de '+num(t.requestsMaterials)+' material(is) diferente(s).'],
  ['RECEBIMENTOS',num(t.receipts)+' entrega(s) documentada(s), envolvendo '+num(t.receiptLines)+' linha(s) de material.'],
  ['REPOSIÇÕES',num(t.reposReports)?num(t.reposReports)+' solicitação(ões) de reposição emitida(s), com '+num(t.reposLines)+' linha(s) de material. Confira os documentos após o recebimento.':'Nenhuma solicitação de reposição emitida nesta data.'],
  ['MOVIMENTAÇÕES DO ESTOQUE',num(t.requestsLines+t.stockEntries+t.returnLines)+' operações confirmadas: '+num(t.requestsLines)+' retirada(s), '+num(t.stockEntries)+' entrada(s) e '+num(t.returnLines)+' devolução(ões), envolvendo '+num(t.stockItems)+' material(is) distinto(s).']
 ];
 summaries.forEach(([name,value],i)=>{
  const start=17+i*5,end=start+3;
  merged(ws,'A'+start+':E'+end,name,{fill:PAL.light,color:PAL.navy,bold:true,size:10});
  merged(ws,'F'+start+':T'+end,value,{fill:PAL.light,size:10,color:PAL.ink,wrap:true});
  for(let k=start;k<=end;k++)ws.getRow(k).height=15;
 });
 const warnings=[];
 if(num(t.receiptDifferences)>0)warnings.push(num(t.receiptDifferences)+' diferença(s) entre nota fiscal e recebimento.');
 if(num(t.pendingCodes)>0)warnings.push(num(t.pendingCodes)+' item(ns) recebido(s) sem cadastro.');
 if(num(t.stockNotReconciled)>0)warnings.push(num(t.stockNotReconciled)+' saldo(s) com divergência histórica a conferir.');
 if(warnings.length){
  section(ws,'A43:T43','PONTOS DE ATENÇÃO');
  merged(ws,'A44:T46',warnings.join('  '),{fill:'FFF3DE',color:PAL.ink,size:10,wrap:true});
 }
 merged(ws,'A49:T51','Este relatório reúne os registros do dia selecionado. Solicitação de reposição não significa compra ou recebimento; o saldo depende das movimentações oficiais.',
  {color:PAL.muted,size:9,wrap:true});
 ws.pageSetup.printArea='A1:T53';ws.pageSetup.fitToHeight=1;
 return ws;
}


function receiptPDFStyle(book,model,logo){
 const date=prettyDate(model.date),rows=model.receiptRows||[],tot=model.totals||{};
 const ws=createSheet(book,'Recebimentos','Recebimento de Materiais',
  'Consolidado diário · entregas identificadas por fornecedor, nota e pedido.',[15,11,24,19,12,11,15,15,13],logo);
 const cards=[['DATA DE REFERÊNCIA',date],['ENTREGAS',num(tot.receipts)],
  ['LINHAS DE MATERIAL',rows.length],['DIVERGÊNCIAS',num(tot.receiptDifferences)]];
 const blocks=[['A','B'],['C','D'],['E','F'],['G','I']];
 cards.forEach(([name,value],i)=>{
  const [a,b]=blocks[i];
  merged(ws,a+'8:'+b+'8',name,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  merged(ws,a+'9:'+b+'11',value,{fill:PAL.light,color:PAL.teal,bold:true,size:15});
 });
 const groups=new Map();
 rows.forEach(row=>{
  const key=[row.fornecedor||'',row.pedidoCompra||'',row.notaFiscal||''].join('|');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 });
 let at=14,ix=0;
 for(const list of groups.values()){
  ix++;
  const one=list[0]||{},label='ENTREGA '+String(ix).padStart(2,'0');
  merged(ws,'A'+at+':B'+(at+2),label,{fill:PAL.navy,color:PAL.white,bold:true,size:11,align:'center'});
  merged(ws,'C'+at+':F'+at,'FORNECEDOR',{fill:PAL.light,color:PAL.muted,bold:true,size:8});
  merged(ws,'C'+(at+1)+':F'+(at+2),one.fornecedor||'Fornecedor não informado',
    {fill:PAL.light,color:PAL.navy,bold:true,size:10,wrap:true});
  merged(ws,'G'+at+':I'+at,'PC: '+txt(one.pedidoCompra||'—')+'    NF: '+txt(one.notaFiscal||'—'),
    {fill:PAL.light,color:PAL.navy,bold:true,size:10,align:'right'});
  merged(ws,'G'+(at+1)+':I'+(at+2),date,{fill:PAL.light,color:PAL.muted,size:9,align:'right'});
  at+=3;
  const header=[['A','B','CÓDIGO'],['C','E','MATERIAL'],['F','F','UN.'],['G','G','QTD. NF'],['H','H','RECEBIDO'],['I','I','DIF.']];
  header.forEach(([a,b,t])=>merged(ws,a+at+':'+b+at,t,{fill:PAL.navy,color:PAL.white,bold:true,size:9,align:'center'}));
  ws.getRow(at).height=25;at++;
  list.forEach((x,i)=>{
   const fill=i%2?PAL.light:PAL.white,row=at;
   merged(ws,'A'+row+':B'+row,txt(x.codigo||''),{fill,size:9,align:'center'});
   ws.getCell('A'+row).numFmt='@';
   merged(ws,'C'+row+':E'+row,x.nome||'',{fill,size:9,wrap:true});
   [['F',x.unidade||''],['G',num(x.prevista)],['H',num(x.recebida)]].forEach(([col,v])=>{
    const cell=ws.getCell(col+row);cell.value=v;style(cell,{fill,size:9,align:'center',numeric:typeof v==='number'});
   });
   const c=ws.getCell('I'+row);c.value=f('H'+row+'-G'+row,num(x.recebida)-num(x.prevista));
   style(c,{fill,size:9,align:'center',numeric:true});
   ws.getRow(row).height=26;at++;
  });
  at+=2;
 }
 if(!rows.length)merged(ws,'A15:I17','Nenhum recebimento documentado na data.',{fill:PAL.light,size:10});
 merged(ws,'A'+(at+1)+':I'+(at+3),
  'A diferença corresponde à quantidade recebida menos a quantidade da NF. Entradas integradas de materiais cadastrados atualizam o estoque; itens sem cadastro ficam pendentes.',
  {fill:PAL.light,color:PAL.muted,size:9,wrap:true});
 ws.pageSetup.printArea='A1:I'+(at+5);
 ws.pageSetup.fitToHeight=at<57?1:0;
 return ws;
}



function reposPDFStyle(book,model,logo,catalog,stock){
 const date=prettyDate(model.date);
 const ws=createSheet(book,'Reposição','Relatório de Reposição de Materiais',
  'Relação de materiais solicitados para análise e aquisição.',[17,11,30,20,13,14,18,18],logo);
 const documents=(model.repos||[]).filter(x=>(x.itens||[]).length>0);
 let pos=9;
 if(!documents.length){
  merged(ws,'A10:H12','Nenhuma solicitação de reposição emitida na data.',{fill:PAL.light,size:10});
 }
 for(let docIndex=0;docIndex<documents.length;docIndex++){
  const doc=documents[docIndex],items=doc.itens||[];
  section(ws,'A'+pos+':H'+pos,'MATERIAIS PARA AQUISIÇÃO  ·  '+items.length+' ITEM(NS)');
  pos+=2;
  const d=new Date(doc.criadoEmLocal||'');
  const hour=Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',
   {timeZone:'America/Fortaleza',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'—';
  merged(ws,'A'+pos+':D'+pos,'DATA E HORA · '+date+' · '+hour,
   {fill:PAL.light,color:PAL.navy,bold:true,size:9});
  merged(ws,'E'+pos+':H'+pos,'SOLICITADO POR · Almoxarifado',
   {fill:PAL.light,color:PAL.navy,bold:true,size:9,align:'right'});
  pos+=2;
  [['A','B','CÓDIGO'],['C','E','MATERIAL'],['F','F','UN.'],['G','H','SALDO ATUAL']].forEach(([a,b,name])=>
   merged(ws,a+pos+':'+b+pos,name,{fill:PAL.navy,color:PAL.white,bold:true,align:'center',size:9}));
  ws.getRow(pos).height=25;pos++;
  for(let i=0;i<items.length;i++){
   const x=items[i],m=catalog.get(txt(x.codigo))||stock.get(txt(x.codigo))||{},fill=i%2?PAL.light:PAL.white;
   merged(ws,'A'+pos+':B'+pos,txt(x.codigo||''),{fill,size:9,align:'center'});
   ws.getCell('A'+pos).numFmt='@';
   merged(ws,'C'+pos+':E'+pos,x.nome||m.nome||'',{fill,size:9,wrap:true});
   ws.getCell('F'+pos).value=m.unidadeMedida||m.unidade||'';
   style(ws.getCell('F'+pos),{fill,size:9,align:'center'});
   const amt=Number.isFinite(Number(m.quantidade))?Number(m.quantidade):'';
   const cell=merged(ws,'G'+pos+':H'+pos,amt,{fill,size:9,align:'center',numeric:typeof amt==='number'});
   if(typeof amt==='number')cell.numFmt='#,##0.####';
   ws.getRow(pos).height=25;pos++;
  }
  pos+=2;
 }
 merged(ws,'A'+(pos+1)+':H'+(pos+3),'Saldo atual e unidade consultados no Firebase ao gerar o relatório. O saldo não representa necessariamente a posição na data original da solicitação.',
  {fill:PAL.light,color:PAL.muted,wrap:true,size:9});
 section(ws,'A'+(pos+5)+':H'+(pos+5),'ENCAMINHAMENTO');
 merged(ws,'A'+(pos+6)+':H'+(pos+9),
  'Solicita-se análise para aquisição dos materiais relacionados. A definição das quantidades e a autorização cabem à chefia e ao setor de Compras. Este registro não comprova compra ou recebimento.',
  {color:PAL.ink,size:9,wrap:true});
 ws.pageSetup.printArea='A1:H'+(pos+11);
 ws.pageSetup.fitToHeight=pos<50?1:0;
 return ws;
}

function intelligenceExecutive(book,model,logo,mainUnit,ranked){
 const t=model.totals||{},date=prettyDate(model.date);
 const ws=createSheet(book,'Inteligência Executiva','Inteligência do Estoque',
   'Visão executiva diária · volumes, operações e sinais de atenção.',Array(18).fill(11),logo);
 ws.properties.defaultRowHeight=14;ws.views=[{showGridLines:false,zoomScale:90}];
 const kpis=[['RETIRADAS (OPERAÇÕES)',num(t.requestsLines)],['MATERIAIS DISTINTOS',num(t.requestsMaterials)],
  ['ENTRADAS (OPERAÇÕES)',num(t.stockEntries)],['DEVOLUÇÕES (OPERAÇÕES)',num(t.returnLines)]];
 const blocks=[['A','D'],['E','H'],['I','M'],['N','R']];
 kpis.forEach(([name,value],i)=>{
  const [a,b]=blocks[i];
  merged(ws,a+'8:'+b+'8',name,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  const c=merged(ws,a+'9:'+b+'11',value,{fill:PAL.light,color:PAL.teal,bold:true,size:20});c.numFmt='#,##0';
 });
 section(ws,'A13:R13','VISÃO EXECUTIVA · '+date);
 section(ws,'A15:I15','MAIORES RETIRADAS EM '+mainUnit);
 section(ws,'J15:R15','MOVIMENTAÇÕES OPERACIONAIS');
 merged(ws,'A16:I16','Top 6 por quantidade. Não somar unidades de medida diferentes.',
  {size:9,color:PAL.muted});
 merged(ws,'J16:R16','Entradas, retiradas e devoluções registradas no período.',
  {size:9,color:PAL.muted});
 const operations=num(t.requestsLines+t.stockEntries+t.returnLines);
 const operationLabels=[
  ['RETIRADAS',num(t.requestsLines)],['ENTRADAS',num(t.stockEntries)],
  ['DEVOLUÇÕES',num(t.returnLines)]
 ];
 [['J','L'],['M','O'],['P','R']].forEach(([a,b],i)=>{
  const [label,value]=operationLabels[i];
  const percent=operations?Math.round(100*value/operations):0;
  const valueRef="'Dados Gráficos'!B"+(9+i);
  const totalRef="SUM('Dados Gráficos'!B9:B11)";
  const result=label+'  '+value+' ('+percent+'%)';
  const formula='"'+label+'  "&'+valueRef+'&" ("&IFERROR(TEXT('+valueRef+'/'+totalRef+',"0%"),"0%")&")"';
  merged(ws,a+'34:'+b+'35',{formula,result},
   {fill:PAL.light,color:PAL.navy,bold:true,size:9,align:'center'});
 });
 merged(ws,'J37:R38',{
   formula:'SUM(\'Dados Gráficos\'!B9:B11)&" OPERAÇÕES CONFIRMADAS"',
   result:operations+' OPERAÇÕES CONFIRMADAS'
 },
  {fill:PAL.light,color:PAL.teal,bold:true,size:16,align:'center'});
 // A legenda fica em CÉLULAS ao lado das barras. Os eixos nativos do Excel
 // escondiam os nomes conforme a versão do aplicativo.
 ranked.slice(0,6).forEach((x,i)=>{
  const first=19+i*3,last=first+2,code=txt(x.code),name=txt(x.name);
  merged(ws,'A'+first+':C'+last,
   (i+1)+'. '+name+'\n'+num(x.qty).toLocaleString('pt-BR')+' '+mainUnit,
   {fill:i%2?PAL.white:PAL.light,color:PAL.navy,bold:true,size:9,wrap:true});
 });
 section(ws,'A40:R40','RANKING DE CONSUMO DO DIA');
 ranked.slice(0,6).forEach((v,i)=>{
  const row=42+i*2;
  merged(ws,'A'+row+':K'+row,(i+1)+'. '+txt(v.name)+'  ·  '+txt(v.code),{fill:i%2?PAL.white:PAL.light,size:9,color:PAL.ink});
  merged(ws,'L'+row+':R'+row,num(v.qty).toLocaleString('pt-BR')+' '+mainUnit+' · '+v.ops+' retirada(s)',
    {fill:i%2?PAL.white:PAL.light,color:PAL.teal,bold:true,size:10,align:'right'});
  ws.getRow(row).height=21;
 });
 section(ws,'A56:R56','DIAGNÓSTICOS DO DIA');
 const top=ranked[0],total=ranked.reduce((a,x)=>a+num(x.qty),0);
 const cards=[
  ['MAIOR CONSUMO EM '+mainUnit,top?txt(top.name)+' · '+num(top.qty).toLocaleString('pt-BR')+' '+mainUnit:'Sem retiradas na unidade.'],
  ['FREQUÊNCIA DE RETIRADAS',num(t.requestsMaterials)+' material(is) diferentes; '+num(t.requestsLines)+' operações.'],
  ['ATENÇÃO AO SALDO',num(t.stockNotReconciled)?num(t.stockNotReconciled)+' saldo(s) exigem conferência.':'Nenhum saldo com divergência indicada.']
 ];
 [['A','F'],['G','L'],['M','R']].forEach(([a,b],i)=>{
  merged(ws,a+'58:'+b+'58',cards[i][0],{fill:PAL.light,bold:true,color:PAL.navy,size:9});
  merged(ws,a+'59:'+b+'62',cards[i][1],{fill:PAL.light,color:PAL.ink,size:9,wrap:true});
 });
 merged(ws,'A64:R66','Fonte: movimentações confirmadas no Firebase. Ranking separado por unidade de medida; valores da planilha não são enviados automaticamente de volta ao estoque.',
  {color:PAL.muted,size:9,wrap:true});
 ws.pageSetup.printArea='A1:R67';ws.pageSetup.fitToHeight=1;
 return ws;
}
function intelligenceDetailed(book,model,logo,mainUnit,ranked,others){
 const t=model.totals||{},date=prettyDate(model.date),stock=model.stockRows||[];
 const ws=createSheet(book,'Inteligência Detalhada','Inteligência do Estoque',
   'Consumo, saldos históricos e controle de recebimentos do dia.',Array(18).fill(11),logo);
 ws.properties.defaultRowHeight=14;ws.views=[{showGridLines:false,zoomScale:90}];
 const zero=stock.filter(x=>num(x.saida)>0&&x.fim!=null&&num(x.fim)===0);
 const pressure=stock.filter(x=>num(x.saida)>0&&num(x.inicialCalculado)>0&&num(x.saida)/num(x.inicialCalculado)>=.5);
 const divergent=stock.filter(x=>x.validar||Math.abs(num(x.residual))>.0001);
 const kpis=[['SALDOS ZERADOS APÓS SAÍDA',zero.length],
  ['CONSUMO ≥ 50% DO INICIAL',pressure.length],
  ['DIVERGÊNCIAS DE SALDO',divergent.length],
  ['LINHAS RECEBIDAS',num(t.receiptLines)]];
 const spans=[['A','D'],['E','H'],['I','M'],['N','R']];
 kpis.forEach(([label,value],i)=>{
  const [a,b]=spans[i];merged(ws,a+'8:'+b+'8',label,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  merged(ws,a+'9:'+b+'11',value,{fill:PAL.light,color:PAL.teal,bold:true,size:19});
 });
 section(ws,'A13:R13','ANÁLISE DETALHADA · '+date);
 section(ws,'A15:I15','CONSUMO POR UNIDADE DE MEDIDA');
 section(ws,'J15:R15','ALERTAS DE SALDO AO FINAL DO DIA');
 merged(ws,'A16:I16','Totais separados: não somar unidades incompatíveis.',{color:PAL.muted,size:9});
 merged(ws,'J16:R16','Somente materiais com retirada registrada.',{color:PAL.muted,size:9});
 const stockMap=new Map(stock.map(x=>[txt(x.codigo),x]));
 const unitMap=new Map();
 for(const m of model.requests||[]){
  const code=txt(m.codigo),unit=stockMap.get(code)?.unidade||'—';
  let item=unitMap.get(unit);
  if(!item){item={unit,codes:new Set(),ops:0,qty:0};unitMap.set(unit,item)}
  item.codes.add(code);item.ops++;item.qty=round(item.qty+num(m.quantidade));
 }
 let at=18;
 [...unitMap.values()].sort((a,b)=>b.qty-a.qty).slice(0,5).forEach((u,i)=>{
  const color=i%2?PAL.white:PAL.light;
  merged(ws,'A'+at+':B'+(at+1),u.unit,{fill:color,color:PAL.teal,bold:true,size:12});
  merged(ws,'C'+at+':I'+(at+1),
   u.codes.size+' material(is)  ·  '+u.ops+' retiradas  ·  '+num(u.qty).toLocaleString('pt-BR')+' '+u.unit,
   {fill:color,color:PAL.ink,size:10});
  at+=3;
 });
 section(ws,'A35:I35','OUTRAS FAIXAS DE CONSUMO');
 const otherSorted=[...others].sort((a,b)=>b.qty-a.qty).slice(0,5);
 if(otherSorted.length){
  otherSorted.forEach((x,i)=>{
   const row=37+i*2;
   merged(ws,'A'+row+':F'+row,x.name,{fill:i%2?PAL.white:PAL.light,size:9,wrap:true});
   merged(ws,'G'+row+':I'+row,num(x.qty).toLocaleString('pt-BR')+' '+x.unit,
    {fill:i%2?PAL.white:PAL.light,bold:true,color:PAL.teal,align:'right',size:9});
  });
 }else merged(ws,'A37:I39','Sem movimentações em outras unidades.',{color:PAL.muted,size:9});
 section(ws,'A49:I49','OUTRAS RETIRADAS EM '+mainUnit);
 const extra=ranked.slice(6,10);
 if(extra.length)extra.forEach((x,i)=>{
  const row=51+i*2;
  merged(ws,'A'+row+':F'+row,x.name,{fill:i%2?PAL.white:PAL.light,size:9,wrap:true});
  merged(ws,'G'+row+':I'+row,num(x.qty).toLocaleString('pt-BR')+' '+mainUnit,
   {fill:i%2?PAL.white:PAL.light,color:PAL.teal,bold:true,size:9,align:'right'});
 });
 else merged(ws,'A51:I53','Nenhuma outra retirada nessa unidade.',{color:PAL.muted,size:9});
 let alertRow=18;
 for(const [label,entries,render] of [
  ['ZERADOS ('+zero.length+')',zero,x=>txt(x.nome)+' · '+txt(x.codigo)],
  ['RETIRADA ELEVADA ('+pressure.length+')',pressure,x=>txt(x.nome)+' · '+Math.round(num(x.saida)/num(x.inicialCalculado)*100)+'% do saldo inicial'],
  ['DIVERGÊNCIAS ('+divergent.length+')',divergent,x=>txt(x.nome)+' · código '+txt(x.codigo)]
 ]){
  merged(ws,'J'+alertRow+':R'+alertRow,label,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  alertRow++;
  if(!entries.length){
   merged(ws,'J'+alertRow+':R'+alertRow,'Nenhum registro nesta condição.',{color:PAL.muted,size:9});
   alertRow+=2;
  }else{
   entries.slice(0,4).forEach((x,j)=>{
    merged(ws,'J'+alertRow+':R'+(alertRow+1),render(x),
      {fill:label.startsWith('RETIRADA ELEVADA')?'FFF0CD':j%2?PAL.white:'FFF3DE',size:9,color:PAL.ink,wrap:true});
    alertRow+=2;
   });alertRow++;
  }
 }
 section(ws,'J49:R49','CONTROLE DE RECEBIMENTOS');
 const receipt=model.receiptRows||[],groups=new Map();
 receipt.forEach(x=>{
  const key=[x.fornecedor||'',x.pedidoCompra||'',x.notaFiscal||''].join('|');
  const item=groups.get(key)||{supplier:x.fornecedor||'Fornecedor',received:0,linked:0};
  item.received++;
  if(x.entradaConfirmada)item.linked++;
  groups.set(key,item);
 });
 const summary=['Recebimentos documentados: '+num(t.receipts),
  'Entradas efetivas: '+num(t.stockEntries),
  'Linhas de material: '+receipt.length,
  'Aguardando cadastro: '+num(t.pendingCodes)];
 summary.forEach((x,i)=>merged(ws,'J'+(51+i)+':R'+(51+i),x,{fill:i%2?PAL.white:PAL.light,size:9}));
 let gr=56;
 for(const x of [...groups.values()].slice(0,4)){
  merged(ws,'J'+gr+':R'+gr,txt(x.supplier)+' · '+x.received+' linha(s) · '+x.linked+' vinculada(s)',
   {fill:gr%2?PAL.white:PAL.light,size:9,wrap:true});
  gr+=2;
 }
 ws.pageSetup.printArea='A1:R'+Math.max(65,gr+3);ws.pageSetup.fitToHeight=1;
 return ws;
}

function makeData(book,model,logo){
 const t=model.totals||{},date=prettyDate(model.date),cat=new Map((model.materialCatalog||[]).map(x=>[txt(x.codigo),x]));
 const stockMap=new Map((model.stockRows||[]).map(x=>[txt(x.codigo),x]));
 const tab=(name,title,description,widths,headers,rows,options)=>{
  const ws=createSheet(book,name,title,date+' · '+description,widths,logo);
  table(ws,headers,rows,options);return ws;
 };
 const sourceMoves=tab('Dados - Movimentos','Movimentações do Estoque','Saídas, entradas e devoluções reais, sem conferência física',
  [12,17,17,43,16,27,20,26],
  ['HORA','CÓDIGO','TIPO','MATERIAL','QUANTIDADE','SOLICITANTE','PEDIDO','ID'],
  (model.operationalRows||[]).map(x=>[timeOf(x),txt(x.codigo),x.tipo,x.nome||'',num(x.quantidade),
   x.solicitante||'',x.pedido||'',x.id||'']),{codes:[1],wrap:3});
 sourceMoves.state='hidden';
 if((model.machineRows||[]).length)tab('Produção','Produção de Máquinas','Máquinas concluídas e lotes',
  [16,18,44,12,17,25],
  ['DATA','CÓDIGO','PRODUTO','UN.','QTDE.','LOTE / OPÇÃO'],
  (model.machineRows||[]).map(x=>[date,txt(x.codigoMaquina),x.produto||'',x.unidade||'',
   num(x.concluida),x.lote||'']),{codes:[1],wrap:2});
 tab('Materiais Entregues','Materiais Entregues','Comunicação interna · materiais retirados do almoxarifado',
  [14,17,43,12,15,31,23],
  ['HORA','CÓDIGO','MATERIAL / DESCRIÇÃO','UN.','QTDE.','SOLICITANTE','PEDIDO'],
  (model.requests||[]).map(x=>[timeOf(x),txt(x.codigo),x.nome||'',stockMap.get(txt(x.codigo))?.unidade||'—',
   num(x.quantidade),x.solicitante||'',x.pedido||'']),{codes:[1],wrap:2});
 receiptPDFStyle(book,model,logo);

 reposPDFStyle(book,model,logo,cat,stockMap);
 tab('Saldos','Saldos do Almoxarifado','Saldos finais registrados e iniciais calculados com as movimentações do dia.',
  [18,46,12,17,16,16,17,18],
  ['CÓDIGO','MATERIAL / DESCRIÇÃO','UN.','INICIAL','SAÍDAS','DEVOL.','ENTRADAS','FINAL'],
  (model.stockRows||[]).map((x,i)=>{
   const n=i+9,open=x.inicialCalculado==null?'':num(x.inicialCalculado);
   return [txt(x.codigo),x.nome||'',x.unidade||'',
    open===''?'':f('H'+n+'+E'+n+'-F'+n+'-G'+n,open),
    num(x.saida),num(x.devolucao),num(x.entrada),x.fim==null?'':num(x.fim)];
  }),{codes:[0],wrap:1});
 const audit=tab('Dados - Conciliação','Conciliação de Saldos','Verificações auxiliares para auditoria',
  [17,46,12,17,16,15,16,18,19,17],
  ['CÓDIGO','MATERIAL','UN.','INICIAL','SAÍDAS','DEVOL.','ENTRADAS','FINAL REGISTRADO','FINAL CALCULADO','DIFERENÇA'],
  (model.stockRows||[]).map((x,i)=>{
   const n=i+9,open=x.inicialCalculado==null?'':num(x.inicialCalculado),end=x.fim==null?'':num(x.fim);
   return [txt(x.codigo),x.nome||'',x.unidade||'',open,num(x.saida),num(x.devolucao),num(x.entrada),end,
    open===''?'':f('D'+n+'-E'+n+'+F'+n+'+G'+n,end),
    open===''?'':f('H'+n+'-I'+n,0)];
  }),{codes:[0],wrap:1});
 audit.state='hidden';
 const used=new Map();
 (model.requests||[]).forEach(x=>{
  const code=txt(x.codigo),old=used.get(code)||{code,name:x.nome||'',
   unit:stockMap.get(code)?.unidade||'—',qty:0,ops:0};
  old.qty=round(old.qty+num(x.quantidade));old.ops++;used.set(code,old);
 });
 const all=[...used.values()],mainUnit=all.some(x=>x.unit==='UN')?'UN':all.find(x=>x.unit!=='—')?.unit||'UN';
 const main=all.filter(x=>x.unit===mainUnit).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name,'pt-BR'));
 const other=all.filter(x=>x.unit!==mainUnit).sort((a,b)=>String(a.unit).localeCompare(String(b.unit))||b.qty-a.qty);
 const rows=[...main,...other];
 const sourceConsumption=tab('Dados - Consumo','Consumo detalhado','Consumo separado por unidade de medida',
  [18,46,14,19,20,25],
  ['CÓDIGO','MATERIAL','UN.','CONSUMO','RETIRADAS','CATEGORIA'],
  rows.map((x,i)=>[x.code,x.name,x.unit,f('SUMIF(\'Materiais Entregues\'!B9:B2000,A'+(i+9)+',\'Materiais Entregues\'!E9:E2000)',x.qty),x.ops,x.unit===mainUnit?'GRÁFICO PRINCIPAL':'OUTRA UNIDADE']),
  {codes:[0],wrap:1});
 sourceConsumption.state='hidden';
 tab('Conferência Entradas','Conferência de Entradas','Entradas documentadas e efetivas',
  [18,46,13,20,21,19,39],
  ['CÓDIGO','MATERIAL','UN.','RECEBIDO NF','ENTRADAS ESTOQUE','DIFERENÇA','SITUAÇÃO'],
  (model.comparisons||[]).map((x,i)=>[txt(x.codigo),x.nome||'',x.unidade||'',num(x.recebido),
   num(x.entradas),f('D'+(i+9)+'-E'+(i+9),round(num(x.recebido)-num(x.entradas))),x.situacao||'']),
  {codes:[0],wrap:1});
 intelligenceExecutive(book,model,logo,mainUnit,main);
 intelligenceDetailed(book,model,logo,mainUnit,main,other);
 const g=createSheet(book,'Dados Gráficos','Dados dos Gráficos',
  'Fontes auxiliares dos gráficos de inteligência',[23,20,5,46,22,18],logo);
 ['A8','B8','D8','E8'].forEach((a,i)=>{g.getCell(a).value=['OPERAÇÃO','QUANTIDADE','MATERIAL ('+mainUnit+')','CONSUMO'][i];style(g.getCell(a),
   {fill:PAL.navy,color:PAL.white,bold:true});});
 const counts=[['Retiradas','SAIDA',num(t.requestsLines)],['Entradas','ENTRADA',num(t.stockEntries)],
  ['Devoluções','DEVOLUCAO',num(t.returnLines)]];
 counts.forEach((x,i)=>{
  const n=9+i;g.getCell('A'+n).value=x[0];
  g.getCell('B'+n).value=f('COUNTIF(\'Dados - Movimentos\'!C9:C1000,"'+x[1]+'")',x[2]);
  style(g.getCell('B'+n),{numeric:true,fill:PAL.light});
 });
 for(let i=0;i<6;i++){
  const n=9+i,row=main[i];
  g.getCell('D'+n).value=row?shortGraphName(row.name):'';
  g.getCell('E'+n).value=row?f("'Dados - Consumo'!D"+n,row.qty):0;
 }
 g.mergeCells('A18:F20');g.getCell('A18').value='Edite os registros da planilha. Ao recalcular, os gráficos e indicadores vinculados podem ser atualizados.';
 style(g.getCell('A18'),{wrap:true,color:PAL.muted});
 g.state='hidden';
 return {counts:counts.map(x=>({name:x[0],value:x[2]})),top:main.slice(0,6).map(x=>({name:shortGraphName(x.name),value:x.qty})),
  unit:mainUnit,intelligenceSheetIndex:book.worksheets.findIndex(ws=>ws.name==='Inteligência Executiva')+1};
}
const escapeXml=s=>txt(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function cache(values,isText){
 return '<c:'+(isText?'strCache':'numCache')+'>'+(isText?'':'<c:formatCode>General</c:formatCode>')+
  '<c:ptCount val="'+values.length+'"/>'+values.map((x,i)=>'<c:pt idx="'+i+'"><c:v>'+escapeXml(x)+'</c:v></c:pt>').join('')+
  '</c:'+(isText?'strCache':'numCache')+'>';
}
function chartRef(rows,cols){
 const first=9,last=8+rows.length,pre="'Dados Gráficos'!";
 const names=rows.map(x=>x.name),values=rows.map(x=>x.value);
 return '<c:cat><c:strRef><c:f>'+pre+'$'+cols[0]+'$'+first+':$'+cols[0]+'$'+last+'</c:f>'+
  cache(names,true)+'</c:strRef></c:cat><c:val><c:numRef><c:f>'+
  pre+'$'+cols[1]+'$'+first+':$'+cols[1]+'$'+last+'</c:f>'+cache(values,false)+'</c:numRef></c:val>';
}
/* Legendas e valores detalhados ficam nas células editáveis.
   Evita os rótulos automáticos que o Excel sobrepõe às barras e à rosca. */
function chartXml(type,rows){
 const pre='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+
 '<c:lang val="pt-BR"/><c:chart><c:plotArea><c:layout/>';
 let body='';
 const noLabels=''; // Nenhum rótulo automático: os valores completos estão em células editáveis.
 if(type==='donut'){
  const colors=['12888F','3C86C4','E1A457'];
  const dots=rows.map((x,i)=>'<c:dPt><c:idx val="'+i+'"/><c:spPr>'+
   '<a:solidFill><a:srgbClr val="'+colors[i%colors.length]+'"/></a:solidFill>'+
   '</c:spPr></c:dPt>').join('');
  body='<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/>'+
   '<c:order val="0"/><c:tx><c:v>Movimentações</c:v></c:tx>'+dots+
   chartRef(rows,['A','B'])+'</c:ser>'+noLabels+
   '<c:holeSize val="67"/></c:doughnutChart>';
 }else{
  body='<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/>'+
   '<c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>'+
   '<c:tx><c:v>Consumo</c:v></c:tx>'+
   '<c:spPr><a:solidFill><a:srgbClr val="15989F"/></a:solidFill>'+
   '</c:spPr>'+chartRef(rows,['D','E'])+'</c:ser>'+noLabels+
   '<c:gapWidth val="75"/><c:axId val="924451"/><c:axId val="924452"/>'+
   '</c:barChart>'+
   '<c:catAx><c:axId val="924451"/>'+
   '<c:scaling><c:orientation val="maxMin"/></c:scaling>'+
   '<c:axPos val="l"/><c:tickLblPos val="none"/>'+
   '<c:crossAx val="924452"/><c:crosses val="autoZero"/>'+
   '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>'+
   '</c:catAx>'+
   '<c:valAx><c:axId val="924452"/>'+
   '<c:scaling><c:orientation val="minMax"/></c:scaling>'+
   '<c:axPos val="b"/><c:majorGridlines/>'+
   '<c:numFmt formatCode="#,##0.##" sourceLinked="0"/>'+
   '<c:tickLblPos val="nextTo"/><c:crossAx val="924451"/>'+
   '<c:crosses val="autoZero"/><c:crossBetween val="between"/>'+
   '</c:valAx>';
 }
 return pre+body+'</c:plotArea><c:plotVisOnly val="0"/>'+
  '</c:chart></c:chartSpace>';
}
function anchor(id,rid,bounds){
 const loc=(name,col,row)=>'<xdr:'+name+'><xdr:col>'+col+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
  '<xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:'+name+'>';
 return '<xdr:twoCellAnchor editAs="oneCell">'+loc('from',bounds[0],bounds[1])+loc('to',bounds[2],bounds[3])+
  '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+(200+id)+
  '" name="Gráfico New Termisa '+id+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'+
  '<xdr:xfrm><a:off xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" x="0" y="0"/>'+
  '<a:ext xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" cx="0" cy="0"/></xdr:xfrm>'+
  '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+
  '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'+
  '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '+
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="'+rid+'"/>'+
  '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
}

async function nativeCharts(buffer,graphs,JSZip){
 const zip=await JSZip.loadAsync(buffer);
 const sheetIndex=graphs[0]?.sheetIndex;
 if(!Number.isInteger(sheetIndex)||sheetIndex<1)throw Error('Aba de inteligência não identificada.');
 const wsRel='xl/worksheets/_rels/sheet'+sheetIndex+'.xml.rels';
 if(!zip.file(wsRel))throw Error('Relacionamento da folha de inteligência não localizado.');
 const wsXml=await zip.file(wsRel).async('string');
 const match=wsXml.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/);
 if(!match)throw Error('Gráficos não puderam ser vinculados à inteligência.');
 const filename=match[1],dpath='xl/drawings/'+filename,rpath='xl/drawings/_rels/'+filename+'.rels';
 if(!zip.file(dpath)||!zip.file(rpath)||!zip.file('[Content_Types].xml'))
  throw Error('Estrutura de desenho do Excel indisponível.');
 let d=await zip.file(dpath).async('string'),r=await zip.file(rpath).async('string'),
  types=await zip.file('[Content_Types].xml').async('string');
 if(!d.includes('</xdr:wsDr>')||!r.includes('</Relationships>')||!types.includes('</Types>'))
  throw Error('Estrutura gráfica do Excel não reconhecida.');
 let count=Math.max(0,...[...r.matchAll(/Id="rId(\d+)"/g)].map(x=>Number(x[1])));
 graphs.forEach((x,i)=>{
  const id=i+1,rel='rId'+(++count),path='xl/charts/chart'+id+'.xml';
  zip.file(path,chartXml(x.type,x.rows));
  r=r.replace('</Relationships>',
    '<Relationship Id="'+rel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart'+id+'.xml"/></Relationships>');
  d=d.replace('</xdr:wsDr>',anchor(id,rel,x.box)+'</xdr:wsDr>');
  types=types.replace('</Types>',
    '<Override PartName="/'+path+'" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');
 });
 zip.file(dpath,d);zip.file(rpath,r);zip.file('[Content_Types].xml',types);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

export async function exportarExcelFuncional(model,options={}){
 const [ExcelJS,JSZip]=await loadLibs(),book=new ExcelJS.Workbook();
 book.creator='New Termisa Almoxarifado';book.title='Relatório Geral · '+prettyDate(model.date);
 book.subject='Excel editável REV5; gráficos sem rótulos sobrepostos; fontes nativas';
 book.created=new Date();book.calcProperties.fullCalcOnLoad=true;
 dashboard(book,model,options.logo);
 const graphs=makeData(book,model,options.logo);
 const original=await book.xlsx.writeBuffer();
 const enhanced=await nativeCharts(original,[
  {type:graphs.unit,rows:graphs.top.length?graphs.top:[{name:'Sem dados',value:0}],box:[3,17,9,37],sheetIndex:graphs.intelligenceSheetIndex},
  {type:'donut',rows:graphs.counts,box:[9,17,18,32],sheetIndex:graphs.intelligenceSheetIndex}
 ],JSZip);
 const blob=new Blob([enhanced],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
  url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='NewTermisa_Relatorio_Geral_EDITAVEL_REV5_'+model.date+'.xlsx';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 return {sheets:book.worksheets.length,charts:2,editable:true};
}
