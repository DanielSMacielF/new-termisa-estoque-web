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
 merged(ws,'A1:'+last+'1','NEW TERMISA   /   ALMOXARIFADO',
  {fill:PAL.deep,color:PAL.white,bold:true,size:11});ws.getRow(1).height=27;
 ws.getRow(2).height=22;ws.getRow(3).height=22;
 if(logo?.startsWith('data:image/')){
  const id=book.addImage({base64:logo,extension:logo.includes('jpeg')?'jpeg':'png'});
  ws.addImage(id,{tl:{col:.1,row:1.16},ext:{width:155,height:38}});
 }
 merged(ws,'C2:'+last+'3',title.toUpperCase(),{size:16,bold:true,align:'right',color:PAL.navy});
 merged(ws,'A4:'+last+'4',subtitle,{size:9,color:PAL.muted});
 for(let i=1;i<=widths.length;i++)ws.getCell(5,i).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+PAL.teal}};
 ws.getRow(5).height=4;
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
 const t=model.totals||{};
 const ws=createSheet(book,'Dashboard','Relatório Geral do Dia · '+prettyDate(model.date),
  'Visão executiva • dados do Firebase na data '+prettyDate(model.date),Array(16).fill(12),logo);
 ws.views=[{showGridLines:false,zoomScale:80}];
 card(ws,'A','C','Máquinas concluídas',t.machines,"SUM('Produção'!E9:E1000)");
 card(ws,'D','F','Retiradas',t.requestsLines,"'Dados Gráficos'!B9");
 card(ws,'G','I','Recebimentos',t.receipts,null);
 card(ws,'J','L','Reposições',t.reposReports,null);
 card(ws,'M','P','Materiais distintos',t.stockItems,null);
 section(ws,'A13:P13','PANORAMA DO DIA');
 const overview=[
  ['PRODUÇÃO',num(t.machines)+' máquina(s) concluída(s).'],
  ['MATERIAIS ENTREGUES',num(t.requestsLines)+' retiradas de '+num(t.requestsMaterials)+' materiais.'],
  ['RECEBIMENTOS',num(t.receipts)+' recebimentos com '+num(t.receiptLines)+' linhas.'],
  ['REPOSIÇÕES',num(t.reposReports)+' solicitação(ões), '+num(t.reposLines)+' item(ns).'],
  ['MOVIMENTAÇÕES',num(t.requestsLines+t.stockEntries+t.returnLines)+' operações; '+num(t.stockItems)+' códigos distintos.']
 ];
 overview.forEach(([title,value],i)=>{
  const n=15+i*3;
  merged(ws,'A'+n+':C'+(n+1),title,{fill:PAL.light,color:PAL.navy,bold:true,size:9});
  merged(ws,'D'+n+':G'+(n+1),value,{fill:PAL.light,size:10,wrap:true});
  ws.getRow(n).height=23;ws.getRow(n+1).height=22;
 });
 section(ws,'I14:P14','MOVIMENTAÇÕES OPERACIONAIS');
 section(ws,'A32:P32','INTELIGÊNCIA DE ESTOQUE');
 merged(ws,'A34:G34','DIAGNÓSTICOS DO DIA',{bold:true,color:PAL.teal,size:11});
 const lines=[
  'Retiradas: '+num(t.requestsLines),
  'Entradas reais: '+num(t.stockEntries),
  'Devoluções: '+num(t.returnLines),
  'Materiais distintos: '+num(t.stockItems),
  'Recebimentos documentados: '+num(t.receipts),
  'Diferenças de nota fiscal: '+num(t.receiptDifferences),
  'Saldos que exigem conferência: '+num(t.stockNotReconciled)
 ];
 lines.forEach((line,i)=>merged(ws,'A'+(36+i*2)+':G'+(37+i*2),line,
  {fill:i%2?PAL.white:PAL.light,size:10}));
 merged(ws,'A53:P55',
  'Os dados foram consultados no Firebase ao gerar o arquivo. Esta é uma cópia de análise: '+
  'alterações feitas no Excel não são enviadas ao estoque. Gráficos e fórmulas são editáveis.',
  {fill:PAL.light,color:PAL.muted,size:9,wrap:true});
 ws.pageSetup.printArea='A1:P55';ws.pageSetup.fitToHeight=1;
 return ws;
}
function makeData(book,model,logo){
 const t=model.totals||{},date=prettyDate(model.date),cat=new Map((model.materialCatalog||[]).map(x=>[txt(x.codigo),x]));
 const stockMap=new Map((model.stockRows||[]).map(x=>[txt(x.codigo),x]));
 const tab=(name,title,description,widths,headers,rows,options)=>{
  const ws=createSheet(book,name,title,date+' · '+description,widths,logo);
  table(ws,headers,rows,options);return ws;
 };
 tab('Movimentações','Movimentações do Estoque','Saídas, entradas e devoluções reais, sem conferência física',
  [12,17,17,43,16,27,20,26],
  ['HORA','CÓDIGO','TIPO','MATERIAL','QUANTIDADE','SOLICITANTE','PEDIDO','ID'],
  (model.operationalRows||[]).map(x=>[timeOf(x),txt(x.codigo),x.tipo,x.nome||'',num(x.quantidade),
   x.solicitante||'',x.pedido||'',x.id||'']),{codes:[1],wrap:3});
 tab('Produção','Produção de Máquinas','Máquinas concluídas e lotes',
  [16,18,44,12,17,25],
  ['DATA','CÓDIGO','PRODUTO','UN.','QTDE.','LOTE / OPÇÃO'],
  (model.machineRows||[]).map(x=>[date,txt(x.codigoMaquina),x.produto||'',x.unidade||'',
   num(x.concluida),x.lote||'']),{codes:[1],wrap:2});
 tab('Materiais Entregues','Comunicação Interna','Materiais retirados do almoxarifado',
  [14,17,43,12,15,31,23],
  ['HORA','CÓDIGO','MATERIAL / DESCRIÇÃO','UN.','QTDE.','SOLICITANTE','PEDIDO'],
  (model.requests||[]).map(x=>[timeOf(x),txt(x.codigo),x.nome||'',stockMap.get(txt(x.codigo))?.unidade||'—',
   num(x.quantidade),x.solicitante||'',x.pedido||'']),{codes:[1],wrap:2});
 tab('Recebimentos','Recebimento de Materiais','Fornecedores, pedidos, notas fiscais e itens',
  [15,42,18,16,17,43,12,15,15,12,27],
  ['DATA','FORNECEDOR','PEDIDO COMPRA','NOTA FISCAL','CÓDIGO','MATERIAL','UN.','QTDE. NF','RECEBIDO','DIF.','SITUAÇÃO'],
  (model.receiptRows||[]).map((x,i)=>[date,x.fornecedor||'',x.pedidoCompra||'',x.notaFiscal||'',
   txt(x.codigo),x.nome||'',x.unidade||'',num(x.prevista),num(x.recebida),
   f('I'+(i+9)+'-H'+(i+9),round(num(x.recebida)-num(x.prevista))),
   x.entradaConfirmada?'ENTRADA VINCULADA':x.semCadastro?'PENDENTE DE CADASTRO':'VERIFICAR VÍNCULO']),
  {codes:[4],wrap:5});
 const rest=(model.repos||[]).flatMap(r=>(r.itens||[]).map(x=>{
  const m=cat.get(txt(x.codigo))||{};
  return [date,txt(x.codigo),x.nome||m.nome||'',m.unidadeMedida||'',
   Number.isFinite(Number(m.quantidade))?Number(m.quantidade):'',
   'SOLICITADO PARA ANÁLISE'];
 }));
 tab('Reposição','Reposição de Materiais','Materiais solicitados para compras',
  [16,18,45,14,20,30],['DATA','CÓDIGO','MATERIAL','UN.','SALDO ATUAL','SITUAÇÃO'],
  rest,{codes:[1],wrap:2});
 tab('Saldos','Saldos do Almoxarifado','INICIAL reconstituído; FINAL registrado no Firebase',
  [17,46,12,17,16,15,16,18,19,17],
  ['CÓDIGO','MATERIAL','UN.','INICIAL','SAÍDAS','DEVOL.','ENTRADAS','FINAL REGISTRADO','FINAL CALCULADO','DIFERENÇA'],
  (model.stockRows||[]).map((x,i)=>{
   const n=i+9,open=x.inicialCalculado==null?'':num(x.inicialCalculado),end=x.fim==null?'':num(x.fim);
   return [txt(x.codigo),x.nome||'',x.unidade||'',open,num(x.saida),num(x.devolucao),num(x.entrada),end,
    open===''?'':f('D'+n+'-E'+n+'+F'+n+'+G'+n,end),
    open===''?'':f('H'+n+'-I'+n,0)];
  }),{codes:[0],wrap:1});
 const used=new Map();
 (model.requests||[]).forEach(x=>{
  const code=txt(x.codigo),old=used.get(code)||{code,name:x.nome||'',
   unit:stockMap.get(code)?.unidade||'—',qty:0,ops:0};
  old.qty=round(old.qty+num(x.quantidade));old.ops++;used.set(code,old);
 });
 const all=[...used.values()],mainUnit=all.some(x=>x.unit==='UN')?'UN':all.find(x=>x.unit!=='—')?.unit||'UN';
 const main=all.filter(x=>x.unit===mainUnit).sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name,'pt-BR'));
 const other=all.filter(x=>x.unit!==mainUnit).sort((a,b)=>x=>0||a.unit.localeCompare(b.unit)||b.qty-a.qty);
 const rows=[...main,...other];
 tab('Inteligência','Inteligência de Estoque','Consumo separado por unidade',
  [18,46,14,19,20,25],
  ['CÓDIGO','MATERIAL','UN.','CONSUMO','RETIRADAS','CATEGORIA'],
  rows.map(x=>[x.code,x.name,x.unit,x.qty,x.ops,x.unit===mainUnit?'GRÁFICO PRINCIPAL':'OUTRA UNIDADE']),
  {codes:[0],wrap:1});
 tab('Conferência Entradas','Conferência de Entradas','Entradas documentadas e efetivas',
  [18,46,13,20,21,19,39],
  ['CÓDIGO','MATERIAL','UN.','RECEBIDO NF','ENTRADAS ESTOQUE','DIFERENÇA','SITUAÇÃO'],
  (model.comparisons||[]).map((x,i)=>[txt(x.codigo),x.nome||'',x.unidade||'',num(x.recebido),
   num(x.entradas),f('D'+(i+9)+'-E'+(i+9),round(num(x.recebido)-num(x.entradas))),x.situacao||'']),
  {codes:[0],wrap:1});
 const g=createSheet(book,'Dados Gráficos','Dados dos Gráficos',
  'Fontes editáveis dos gráficos nativos do dashboard',[23,20,5,46,22,18],logo);
 ['A8','B8','D8','E8'].forEach((a,i)=>{g.getCell(a).value=['OPERAÇÃO','QUANTIDADE','MATERIAL ('+mainUnit+')','CONSUMO'][i];style(g.getCell(a),
   {fill:PAL.navy,color:PAL.white,bold:true});});
 const counts=[['Retiradas','SAIDA',num(t.requestsLines)],['Entradas','ENTRADA',num(t.stockEntries)],
  ['Devoluções','DEVOLUCAO',num(t.returnLines)]];
 counts.forEach((x,i)=>{
  const n=9+i;g.getCell('A'+n).value=x[0];
  g.getCell('B'+n).value=f('COUNTIF(\'Movimentações\'!C9:C1000,"'+x[1]+'")',x[2]);
  style(g.getCell('B'+n),{numeric:true,fill:PAL.light});
 });
 for(let i=0;i<6;i++){
  const n=9+i,row=main[i];
  g.getCell('D'+n).value=row?{formula:"'Inteligência'!B"+n,result:row.name}:'';
  g.getCell('E'+n).value=row?f("'Inteligência'!D"+n,row.qty):0;
 }
 g.mergeCells('A18:F20');g.getCell('A18').value='Edite os registros da planilha. Ao recalcular, os gráficos e indicadores vinculados podem ser atualizados.';
 style(g.getCell('A18'),{wrap:true,color:PAL.muted});
 return {counts:counts.map(x=>({name:x[0],value:x[2]})),top:main.slice(0,6).map(x=>({name:x.name,value:x.qty})),
  unit:mainUnit};
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
function chartXml(type,rows){
 const pre='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+
 '<c:lang val="pt-BR"/><c:chart><c:plotArea><c:layout/>';
 let body='';
 if(type==='donut'){
  const colors=['12888F','3C86C4','E1A457'];
  const dots=rows.map((x,i)=>'<c:dPt><c:idx val="'+i+'"/><c:spPr><a:solidFill><a:srgbClr val="'+colors[i%3]+'"/></a:solidFill></c:spPr></c:dPt>').join('');
  body='<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>'+
   '<c:tx><c:v>Operações</c:v></c:tx>'+dots+chartRef(rows,['A','B'])+'</c:ser>'+
   '<c:holeSize val="60"/></c:doughnutChart>';
 }else{
  body='<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/>'+
   '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Consumo em '+escapeXml(type)+'</c:v></c:tx>'+
   '<c:spPr><a:solidFill><a:srgbClr val="15989F"/></a:solidFill></c:spPr>'+
   chartRef(rows,['D','E'])+'</c:ser><c:gapWidth val="60"/><c:axId val="924451"/><c:axId val="924452"/></c:barChart>'+
   '<c:catAx><c:axId val="924451"/><c:scaling><c:orientation val="maxMin"/></c:scaling>'+
   '<c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="924452"/><c:crosses val="autoZero"/>'+
   '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>'+
   '<c:valAx><c:axId val="924452"/><c:scaling><c:orientation val="minMax"/></c:scaling>'+
   '<c:axPos val="b"/><c:majorGridlines/><c:numFmt formatCode="#,##0.##" sourceLinked="0"/>'+
   '<c:tickLblPos val="nextTo"/><c:crossAx val="924451"/><c:crosses val="autoZero"/>'+
   '<c:crossBetween val="between"/></c:valAx>';
 }
 return pre+body+'</c:plotArea>'+(type==='donut'?'<c:legend><c:legendPos val="r"/><c:layout/></c:legend>':'')+
  '<c:plotVisOnly val="1"/></c:chart></c:chartSpace>';
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
 const dpath='xl/drawings/drawing1.xml',rpath='xl/drawings/_rels/drawing1.xml.rels';
 if(!zip.file(dpath)||!zip.file(rpath)||!zip.file('[Content_Types].xml'))
  throw Error('Não foi possível inicializar os gráficos nativos do Excel.');
 let d=await zip.file(dpath).async('string'),r=await zip.file(rpath).async('string'),
  types=await zip.file('[Content_Types].xml').async('string');
 if(!d.includes('</xdr:wsDr>')||!r.includes('</Relationships>')||!types.includes('</Types>'))
  throw Error('Estrutura gráfica do arquivo Excel não reconhecida.');
 let count=Math.max(0,...[...r.matchAll(/Id="rId(\d+)"/g)].map(x=>Number(x[1])));
 graphs.forEach((x,i)=>{
  const id=i+1,rel='rId'+(++count),path='xl/charts/chart'+id+'.xml';
  zip.file(path,chartXml(x.type,x.rows));
  r=r.replace('</Relationships>','<Relationship Id="'+rel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart'+id+'.xml"/></Relationships>');
  d=d.replace('</xdr:wsDr>',anchor(id,rel,x.box)+'</xdr:wsDr>');
  types=types.replace('</Types>','<Override PartName="/'+path+'" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');
 });
 zip.file(dpath,d);zip.file(rpath,r);zip.file('[Content_Types].xml',types);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function exportarExcelFuncional(model,options={}){
 const [ExcelJS,JSZip]=await loadLibs(),book=new ExcelJS.Workbook();
 book.creator='New Termisa Almoxarifado';book.title='Relatório Geral · '+prettyDate(model.date);
 book.subject='Excel com fórmulas, filtros e gráficos nativos';
 book.created=new Date();book.calcProperties.fullCalcOnLoad=true;
 dashboard(book,model,options.logo);
 const graphs=makeData(book,model,options.logo);
 const original=await book.xlsx.writeBuffer();
 const enhanced=await nativeCharts(original,[
  {type:'donut',rows:graphs.counts,box:[8,15,16,30]},
  {type:graphs.unit,rows:graphs.top.length?graphs.top:[{name:'Sem dados',value:0}],box:[7,34,16,51]}
 ],JSZip);
 const blob=new Blob([enhanced],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
  url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='NewTermisa_Relatorio_Geral_Funcional_'+model.date+'.xlsx';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 return {sheets:book.worksheets.length,charts:2,editable:true};
}
