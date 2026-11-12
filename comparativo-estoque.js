/* New Termisa | Comparativo de Estoque
 * Leitura local: nenhum acesso ao Firebase, nenhuma gravacao, importacao ou alteracao de saldo.
 * Arquivos de referencia e destino podem ser PDF com texto, Excel ou CSV.
 */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var current=[], meta=null, busy=false;
var MAX_BYTES=25*1024*1024;
var Q=10000;
function norm(v){return String(v==null?"":v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function escapeHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function codeOf(v){
 if(v==null)return null;
 var s=String(v).trim().replace(/^[='"]+|['"]+$/g,"");
 if(/^\d+\.0+$/.test(s))s=s.split(".")[0];
 s=s.replace(/\s/g,"");
 if(/^\d{8}$/.test(s))return "0"+s; // Excel pode retirar zero a esquerda
 return /^\d{9}$/.test(s)?s:null;
}
function qtyOf(v){
 if(typeof v==="number")return Number.isFinite(v)?Math.round(v*Q)/Q:null;
 if(v==null||String(v).trim()==="")return null;
 var s=String(v).trim().replace(/\s|\u00a0/g,"").replace(/[−–]/g,"-");
 if(s.indexOf(",")>=0)s=s.replace(/\./g,"").replace(",",".");
 else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
 if(!/^-?\d+(\.\d+)?$/.test(s))return null;
 var n=Number(s);
 return Number.isFinite(n)&&Math.abs(n)<1e12?Math.round(n*Q)/Q:null;
}
function br(v){
 if(v==null||!Number.isFinite(v))return "—";
 return new Intl.NumberFormat("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:4}).format(v)
}
function signed(v){return v==null?"—":(v>0?"+":"")+br(v)}
function setStatus(v,isError){$("status").textContent=v;$("status").style.color=isError?"#ffb6a8":"#c9e2f8"}
function checkFile(f){
 if(!f)throw Error("Selecione os dois arquivos antes de comparar.");
 if(f.size>MAX_BYTES)throw Error("Arquivo acima de 25 MB: "+f.name);
 if(!/\.(pdf|xlsx|xls|csv)$/i.test(f.name))throw Error("Formato não suportado: "+f.name);
}
function row(code,name,qty,cat,unit,origin){
 return {code:code,name:String(name||"").trim(),qty:qty,cat:String(cat||"").trim().toUpperCase(),unit:String(unit||"").trim().toUpperCase(),origin:origin||""};
}
function headCol(v,kind){
 var n=norm(v).replace(/[^a-z0-9]+/g," ").trim();
 if(kind==="code")return /^(codigo|cod|cod item|codigo item|codigo do item|codigo do material|cod material|sku)$/.test(n);
 if(kind==="qty")return /^(quantidade|quant|qtde|qtd|qtd estoque|qtde estoque|saldo|saldo atual|estoque|estoque atual|quantidade atual|quantidade em estoque)$/.test(n);
 if(kind==="name")return /^(descricao|material|descricao material|nome material|nome do material|produto|nome produto|nome|item)$/.test(n);
 if(kind==="cat")return /^(cat|categoria|categoria do componente|classificacao|tipo de material)$/.test(n);
 if(kind==="unit")return /^(un|um|unidade|unidade de medida|medida)$/.test(n);
 return false;
}
async function parseExcel(file){
 if(!window.XLSX)throw Error("Leitor de Excel não carregou. Verifique a conexão e recarregue.");
 var wb;
 try{wb=window.XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false})}
 catch(e){throw Error("Não foi possível abrir a planilha "+file.name+": "+e.message)}
 var entries=[], issues=[], sheets=0;
 wb.SheetNames.forEach(function(sheetName){
  var sheet=wb.Sheets[sheetName], data=window.XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:true});
  var cols=null, parsed=0, codeHits=0;
  data.forEach(function(cells,ix){
   var c=Array.isArray(cells)?cells:[];
   var h={};["code","qty","name","cat","unit"].forEach(function(k){h[k]=c.findIndex(function(x){return headCol(x,k)})});
   if(h.code>=0&&h.qty>=0){cols=h;return}
   if(!cols)return;
   var code=codeOf(c[cols.code]);if(!code)return;
   codeHits++;
   var q=qtyOf(c[cols.qty]);
   var name=cols.name>=0?c[cols.name]:"";
   var cat=cols.cat>=0?c[cols.cat]:"";
   var un=cols.unit>=0?c[cols.unit]:"";
   entries.push(row(code,name,q,cat,un,sheetName+" · linha "+(ix+1)));
   parsed++;
   if(q===null)issues.push("Quantidade inválida: "+code+" ("+sheetName+", linha "+(ix+1)+")");
  });
  if(parsed)sheets++;
 });
 if(!entries.length)throw Error("Não localizei colunas 'Código' e 'Quantidade/Saldo' com materiais válidos no Excel. Confira os cabeçalhos.");
 return {rows:entries,issues:issues,source:file.name,recognized:entries.length,kind:"Excel/CSV",sheets:sheets};
}
function lineTokens(items, pageHeight){
 var arr=[];
 items.forEach(function(it){
  var s=String(it.str||"");if(!s.trim())return;
  var x=Number(it.transform&&it.transform[4])||0;
  var y=Number(it.transform&&it.transform[5])||0;
  var width=Number(it.width)||0, m, re=/\S+/g;
  while((m=re.exec(s))!==null){
   arr.push({txt:m[0],x:x+width*(m.index/Math.max(s.length,1)),y:pageHeight-y});
  }
 });
 arr.sort(function(a,b){return a.y-b.y||a.x-b.x});
 var lines=[];
 arr.forEach(function(t){
  var last=lines[lines.length-1];
  if(!last||Math.abs(last.y-t.y)>3.2){last={y:t.y,tokens:[]};lines.push(last)}
  last.tokens.push(t);
 });
 lines.forEach(function(l){l.tokens.sort(function(a,b){return a.x-b.x})});
 return lines;
}
function relevantNum(t){return /^-?[\d.,]+$/.test(t.txt)&&qtyOf(t.txt)!==null}
function pdfHeaderX(tokens){
 var code=tokens.find(function(t){return /^c[oó]digo:?$/i.test(t.txt)});
 var qty=tokens.find(function(t){return /^(saldo|qtde|qtd|quantidade)$/i.test(t.txt)});
 return code&&qty?{qty:qty.x,code:code.x}:null;
}
function pdfRowFromLine(tokens,width,header,source){
 var codeToken=tokens.find(function(t){return t.x<width*.20&&codeOf(t.txt)});
 if(!codeToken)return null;
 var code=codeOf(codeToken.txt);
 var qx=header?header.qty:(width>720?550:341);
 var near=tokens.filter(function(t){return t.x>=qx-47&&t.x<=qx+53&&relevantNum(t)});
 // Em arquivos conhecidos o saldo aparece ANTES do preco. Nunca usa campo preco como saldo.
 if(near.length>1)near.sort(function(a,b){return Math.abs(a.x-qx)-Math.abs(b.x-qx)});
 var q=near.length?qtyOf(near[0].txt):null;
 var catCandidates=tokens.filter(function(t){return /^(MP|UC|PA|MP\/UC)$/i.test(t.txt)&&t.x>codeToken.x+35&&t.x<qx-25});
 var catToken=catCandidates.length?catCandidates[0]:null;
 var nameStart=codeToken.x+45;
 var nameEnd=catToken?catToken.x-2:qx-55;
 var name=tokens.filter(function(t){return t.x>=nameStart&&t.x<nameEnd}).map(function(t){return t.txt}).join(" ");
 var un="";
 if(width>720){
  var ut=tokens.find(function(t){return /^(UN|KG|M|M2|M3|M²|M³|L|LT|PC|CX)$/i.test(t.txt)&&t.x>qx-105&&t.x<qx-35});
  if(ut)un=ut.txt;
 }
 return row(code,name,q,catToken?catToken.txt:"",un,source);
}
async function parsePdf(file){
 if(!window.pdfjsLib)throw Error("Leitor de PDF não carregou. Verifique a conexão e recarregue.");
 window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
 var pdf;
 try{pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise}
 catch(e){throw Error("Falha ao abrir PDF "+file.name+": "+e.message)}
 var entries=[],issues=[],codeHits=0,unreadable=0,headerSeen=false;
 try{
  for(var p=1;p<=pdf.numPages;p++){
   var page=await pdf.getPage(p),vp=page.getViewport({scale:1});
   var lines=lineTokens((await page.getTextContent()).items,vp.height);
   var header=null;
   lines.forEach(function(l){
    var h=pdfHeaderX(l.tokens);if(h){header=h;headerSeen=true;return}
    var hasCode=l.tokens.some(function(t){return t.x<vp.width*.20&&codeOf(t.txt)});
    if(!hasCode)return;
    codeHits++;
    var r=pdfRowFromLine(l.tokens,vp.width,header,"página "+p);
    if(!r){unreadable++;return}
    entries.push(r);
    if(r.qty===null)issues.push("Quantidade não identificada no PDF: "+r.code+" (página "+p+")");
   });
  }
 }finally{if(pdf.destroy)await pdf.destroy()}
 if(!entries.length)throw Error("Nenhum material foi reconhecido no PDF. O arquivo precisa conter texto selecionável e código de 9 dígitos.");
 if(!headerSeen)throw Error("Não encontrei cabeçalho de quantidade ('Saldo' ou 'Qtde') no PDF. Para evitar diferenças incorretas, converta esse relatório para Excel.");
 if(unreadable||entries.length<codeHits)issues.push("Algumas linhas com código não foram interpretadas.");
 return {rows:entries,issues:issues,source:file.name,recognized:entries.length,kind:"PDF",sheets:pdf.numPages};
}
async function loadFile(file){checkFile(file);return /\.pdf$/i.test(file.name)?parsePdf(file):parseExcel(file)}
function aggregate(list){
 var map=new Map();
 list.forEach(function(r){
  var obj=map.get(r.code);
  if(!obj){obj={code:r.code,items:[],name:r.name,unit:r.unit};map.set(r.code,obj)}
  obj.items.push(r);
  if(!obj.name&&r.name)obj.name=r.name;
  if(!obj.unit&&r.unit)obj.unit=r.unit;
 });
 map.forEach(function(a){
  var total=0,valid=true,catSet=new Set(),catRepeated=false;
  var units=new Set();
  a.items.forEach(function(it){
   if(it.qty===null)valid=false;else total+=Math.round(it.qty*Q);
   if(it.unit)units.add(norm(it.unit));
   if(it.cat&&catSet.has(norm(it.cat)))catRepeated=true;
   if(it.cat)catSet.add(norm(it.cat));
  });
  a.qty=valid?total/Q:null;
  a.categories=a.items.map(function(x){return x.cat||"sem categoria"}).join(" + ");
  a.note=a.items.length>1?"Soma de "+a.categories:"";
  a.suspect=a.items.length>1&&(catRepeated||catSet.size!==a.items.length)||units.size>1;
  if(a.suspect)a.note="Possível duplicidade: verificar "+a.categories;
 });
 return map;
}
function compare(ref,target){
 var a=aggregate(ref.rows),b=aggregate(target.rows),keys=new Set();
 a.forEach(function(v,k){keys.add(k)});b.forEach(function(v,k){keys.add(k)});
 var rows=[];
 Array.from(keys).sort().forEach(function(code){
  var ours=a.get(code),other=b.get(code),problem="";
  if(!ours)problem="Ausente no arquivo de referência";
  else if(!other)problem="Ausente no arquivo do outro sistema";
  else if(ours.qty===null||other.qty===null)problem="Quantidade ausente ou inválida";
  else if(ours.suspect||other.suspect)problem="Códigos duplicados: conferir categoria e lançamentos";
  else if(ours.unit&&other.unit&&norm(ours.unit)!==norm(other.unit))problem="Unidade diferente nos dois arquivos";
  var delta=(!problem)?(Math.round(ours.qty*Q)-Math.round(other.qty*Q))/Q:null;
  var status=problem?"REVISAR":delta>0?"A":delta<0?"D":"OK";
  var notes=[];
  if(ours&&ours.note)notes.push("Referência: "+ours.note);
  if(other&&other.note)notes.push("Outro: "+other.note);
  if(problem)notes.unshift(problem);
  rows.push({code:code,name:ours&&ours.name||other&&other.name||"",unit:ours&&ours.unit||other&&other.unit||"—",ours:ours?ours.qty:null,other:other?other.qty:null,diff:delta,status:status,obs:notes.join("; ")});
 });
 return rows;
}
function stats(rows){
 var s={ALL:rows.length,A:0,D:0,OK:0,REVISAR:0};
 rows.forEach(function(r){s[r.status]++});
 return s;
}
function draw(){
 var f=$("filter").value,search=norm($("search").value);
 var rows=current.filter(function(r){return(f==="ALL"||r.status===f)&&(!search||norm(r.code+" "+r.name).indexOf(search)>=0)});
 $("rows").innerHTML=rows.map(function(r){
  return "<tr><td class='code'>"+escapeHtml(r.code)+"</td><td class='name'>"+escapeHtml(r.name)+"</td><td>"+escapeHtml(r.unit)+"</td><td class='num'>"+br(r.ours)+"</td><td class='num'>"+br(r.other)+"</td><td class='num'>"+signed(r.diff)+"</td><td><span class='tag "+r.status+"'>"+r.status+"</span></td><td>"+escapeHtml(r.obs)+"</td></tr>"
 }).join("")||"<tr><td colspan='8'>Nenhum material para esse filtro.</td></tr>";
 $("shown").textContent="Exibindo "+rows.length+" de "+current.length+" códigos · ordenados por código";
}
function warningsText(ref,target,result){
 var parts=[];
 if(ref.issues.length)parts.push("Referência: "+ref.issues.length+" pendência(s) de leitura ("+ref.issues.slice(0,4).join("; ")+").");
 if(target.issues.length)parts.push("Outro sistema: "+target.issues.length+" pendência(s) de leitura ("+target.issues.slice(0,4).join("; ")+").");
 var n=stats(result).REVISAR;
 if(n)parts.push(n+" código(s) exigem conferência e NÃO devem ser ajustados automaticamente.");
 var lacksUnits=(ref.rows.some(function(r){return !r.unit})||target.rows.some(function(r){return !r.unit}));
 if(lacksUnits)parts.push("Há unidades de medida não informadas. Confira a unidade antes de aplicar qualquer quantidade, especialmente KG, M, M² e M³.");
 return parts;
}
async function run(){
 if(busy)return;
 var f1=$("fileRef").files[0],f2=$("fileTarget").files[0];
 try{
  checkFile(f1);checkFile(f2);
  busy=true;$("compare").disabled=true;$("results").classList.add("hidden");current=[];meta=null;
  setStatus("Lendo o primeiro relatório...");
  var ref=await loadFile(f1);
  setStatus("Lendo o segundo relatório...");
  var target=await loadFile(f2);
  setStatus("Conferindo códigos, saldos e duplicatas...");
  var result=compare(ref,target),s=stats(result);
  if(!result.length)throw Error("Nenhum código válido encontrado.");
  current=result;meta={ref:ref,target:target,at:new Date().toLocaleString("pt-BR")};
  $("total").textContent=s.ALL;$("add").textContent=s.A;$("minus").textContent=s.D;$("equal").textContent=s.OK;$("review").textContent=s.REVISAR;
  var warn=warningsText(ref,target,result),w=$("warnings");
  w.classList.toggle("hidden",!warn.length);
  w.innerHTML=warn.map(function(t){return "<p>"+escapeHtml(t)+"</p>"}).join("");
  $("filter").value="ALL";$("search").value="";draw();
  $("results").classList.remove("hidden");
  setStatus("Concluído: "+ref.rows.length+" linhas na referência; "+target.rows.length+" linhas no outro sistema. Nenhum saldo foi alterado.");
 }catch(e){setStatus(e&&e.message||"Erro ao comparar os arquivos.",true)}
 finally{busy=false;$("compare").disabled=false}
}
function exportXlsx(){
 if(!meta||!current.length)return;
 if(!window.XLSX){setStatus("Biblioteca Excel indisponível. Verifique a conexão.",true);return}
 var s=stats(current), wb=window.XLSX.utils.book_new();
 var summary=[["NEW TERMISA · COMPARATIVO DE ESTOQUE"],["Emitido",meta.at],["Saldo de referência",meta.ref.source],["Saldo do outro sistema",meta.target.source],["Total de códigos",s.ALL],["A · Aumentar",s.A],["D · Diminuir",s.D],["OK · Sem alteração",s.OK],["Conferir",s.REVISAR],["Regra","Diferença = referência - outro sistema"],["Segurança","Este documento não altera o estoque."]];
 window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(summary),"Resumo");
 var headings=["Código","Material","Unidade","Meu sistema","Outro sistema","Diferença (+ / -)","A / D","Observação"];
 var lines=current.map(function(r){return [r.code,r.name,r.unit,r.ours,r.other,r.diff,r.status,r.obs]});
 var ws=window.XLSX.utils.aoa_to_sheet([headings].concat(lines));ws["!cols"]=[{wch:14},{wch:43},{wch:10},{wch:17},{wch:18},{wch:20},{wch:13},{wch:66}];
 window.XLSX.utils.book_append_sheet(wb,ws,"Comparativo");
 var pending=current.filter(function(r){return r.status==="REVISAR"}).map(function(r){return [r.code,r.name,r.unit,r.ours,r.other,r.obs]});
 if(pending.length)window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet([["Código","Material","Unidade","Meu sistema","Outro sistema","Motivo"]].concat(pending)),"Pendencias");
 window.XLSX.writeFile(wb,"Comparativo_Estoque_New_Termisa_"+new Date().toISOString().slice(0,10)+".xlsx");
}

/* Identidade de PDF alinhada à Comunicação Interna.
 * O logotipo já existe na página principal; seu carregamento é local à origem.
 * Nenhuma consulta ou alteração de estoque é realizada aqui.
 */
var ntComparativoLogoPromise=null;
function ntComparativoLogo(){
 if(!ntComparativoLogoPromise){
  ntComparativoLogoPromise=fetch("./index.html",{cache:"force-cache"})
   .then(function(r){if(!r.ok)throw Error("Logotipo indisponível");return r.text()})
   .then(function(html){
    var m=/const NT_LOGO="(data:image\/png;base64,[^"]+)"/.exec(html);
    return m?m[1]:null;
   }).catch(function(){return null});
 }
 return ntComparativoLogoPromise;
}
function ntPdfShortText(doc,value,maxWidth){
 var valueText=String(value||"—");
 if(doc.getTextWidth(valueText)<=maxWidth)return valueText;
 while(valueText.length>2 && doc.getTextWidth(valueText+"…")>maxWidth)valueText=valueText.slice(0,-1);
 return valueText+"…";
}
function ntDrawComparativoHeader(doc,pn,stat,logo){
 var dark=[21,59,74],ink=[21,62,76],teal=[32,159,163],soft=[231,241,242],sub=[64,91,102];
 if(logo){
  try{doc.addImage(logo,"PNG",15,7.3,59,10)}catch(e){logo=null}
 }
 if(!logo){
  doc.setFont("helvetica","bold");doc.setFontSize(15);doc.setTextColor.apply(doc,ink);
  doc.text("NEW TERMISA",15,16);
 }
 doc.setTextColor.apply(doc,sub);doc.setFont("helvetica","normal");doc.setFontSize(8.2);
 doc.text("ALMOXARIFADO / NEW TERMISA",282,12.6,{align:"right"});
 doc.setFontSize(8.2);doc.text(String(meta.at||"").split(",")[0],282,18,{align:"right"});
 doc.setDrawColor.apply(doc,teal);doc.setLineWidth(.65);doc.line(15,24,282,24);
 doc.setFont("helvetica","bold");doc.setTextColor.apply(doc,ink);doc.setFontSize(17);
 doc.text("COMPARATIVO DE ESTOQUE",15,33.5);
 doc.setFont("helvetica","normal");doc.setTextColor.apply(doc,sub);doc.setFontSize(8.9);
 doc.text("Conferência de saldos entre os sistemas, sem movimentação de estoque.",15,39.2);
 if(pn!==1){
  doc.setFont("helvetica","bold");doc.setFontSize(8.6);doc.setTextColor.apply(doc,dark);
  doc.text("RESULTADO POR MATERIAL · CONTINUAÇÃO",15,46.8);
  return;
 }
 var labels=[
  ["CÓDIGOS",stat.ALL],
  ["A · AUMENTAR",stat.A],
  ["D · DIMINUIR",stat.D],
  ["OK · IGUAIS",stat.OK],
  ["CONFERIR",stat.REVISAR]
 ];
 var gap=2.7,w=(267-gap*4)/5,yy=44.1,hh=15.5;
 for(var z=0;z<labels.length;z++){
  var x=15+z*(w+gap);
  doc.setFillColor.apply(doc,soft);doc.roundedRect(x,yy,w,hh,1.8,1.8,"F");
  doc.setFillColor.apply(doc,teal);doc.rect(x,yy,.9,hh,"F");
  doc.setTextColor.apply(doc,sub);doc.setFont("helvetica","bold");doc.setFontSize(7.2);
  doc.text(labels[z][0],x+3.2,yy+5.4);
  doc.setTextColor.apply(doc,ink);doc.setFontSize(14.4);
  doc.text(String(labels[z][1]),x+3.2,yy+12.6);
 }
 doc.setFont("helvetica","bold");doc.setFontSize(8.3);doc.setTextColor.apply(doc,dark);
 doc.text("ARQUIVOS COMPARADOS",15,65.1);
 doc.setDrawColor(216,231,234);doc.setLineWidth(.23);doc.line(15,67.2,282,67.2);
 doc.setFont("helvetica","bold");doc.setFontSize(7.2);doc.setTextColor.apply(doc,sub);
 doc.text("REFERÊNCIA · MEU SISTEMA",15,71.3);
 doc.text("SALDO ATUAL · OUTRO SISTEMA",152,71.3);
 doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor.apply(doc,ink);
 doc.text(ntPdfShortText(doc,meta.ref.source,128),15,76.1);
 doc.text(ntPdfShortText(doc,meta.target.source,128),152,76.1);
 doc.setFont("helvetica","bold");doc.setFontSize(8.6);doc.text("RESULTADO POR MATERIAL",15,83.3);
 doc.setFont("helvetica","normal");doc.setTextColor.apply(doc,sub);doc.setFontSize(7.7);
 doc.text("A = aumentar  |  D = diminuir  |  OK = sem ajuste  |  CONFERIR = verificar",282,83.3,{align:"right"});
}
async function exportPdf(){
 if(!meta||!current.length)return;
 if(!window.jspdf||!window.jspdf.jsPDF){setStatus("Biblioteca de PDF não carregou. Verifique a conexão.",true);return}
 var logo=await ntComparativoLogo();
 var doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"}),s=stats(current);
 if(typeof doc.autoTable!=="function"){setStatus("Gerador de tabela PDF não carregou. Recarregue a página.",true);return}
 var body=current.map(function(r){return [r.code,r.name,r.unit,br(r.ours),br(r.other),signed(r.diff),r.status,r.obs]});
 doc.autoTable({
  startY:87, margin:{left:15,right:15,top:51,bottom:20},
  head:[["CÓDIGO","MATERIAL / DESCRIÇÃO","UN.","MEU SISTEMA","OUTRO SISTEMA","DIFERENÇA","A / D","OBSERVAÇÃO"]],
  body:body,theme:"striped",rowPageBreak:"avoid",
  tableWidth:267,
  styles:{
   font:"helvetica",fontSize:7.7,fontStyle:"normal",textColor:[21,62,76],
   cellPadding:{top:2.05,right:1.35,bottom:2.05,left:1.35},
   overflow:"linebreak",valign:"middle",minCellHeight:6,
   lineColor:[220,232,234],lineWidth:0
  },
  headStyles:{fillColor:[25,73,87],textColor:[255,255,255],fontStyle:"bold",fontSize:7.1,cellPadding:{top:2.8,right:1.2,bottom:2.8,left:1.2}},
  alternateRowStyles:{fillColor:[234,243,245]},
  columnStyles:{
   0:{cellWidth:24},
   1:{cellWidth:75},
   2:{cellWidth:12,halign:"center"},
   3:{cellWidth:23,halign:"right"},
   4:{cellWidth:23,halign:"right"},
   5:{cellWidth:22,halign:"right"},
   6:{cellWidth:18,halign:"center"},
   7:{cellWidth:70}
  },
  didParseCell:function(ctx){
   if(ctx.section!=="body")return;
   if(ctx.column.index===0)ctx.cell.styles.fontStyle="bold";
   if(ctx.column.index===6){
    var st=String(ctx.cell.raw);
    ctx.cell.styles.fontStyle="bold";ctx.cell.styles.halign="center";
    if(st==="A")ctx.cell.styles.textColor=[7,123,136];
    else if(st==="D")ctx.cell.styles.textColor=[176,64,57];
    else if(st==="OK")ctx.cell.styles.textColor=[31,119,84];
    else ctx.cell.styles.textColor=[155,102,24];
   }
  },
  didDrawPage:function(){
   ntDrawComparativoHeader(doc,doc.internal.getCurrentPageInfo().pageNumber,s,logo);
  }
 });
 var total=doc.internal.getNumberOfPages();
 for(var n=1;n<=total;n++){
  doc.setPage(n);doc.setDrawColor(220,232,234);doc.setLineWidth(.25);doc.line(15,197.4,282,197.4);
  doc.setTextColor(64,91,102);doc.setFont("helvetica","normal");doc.setFontSize(7.8);
  doc.text("NEW TERMISA  |  ALMOXARIFADO",15,202);
  doc.text("PÁGINA "+n+" DE "+total,282,202,{align:"right"});
 }
 doc.save("Comparativo_Estoque_New_Termisa_"+new Date().toISOString().slice(0,10)+".pdf");
}
$("compare").addEventListener("click",run);
$("pdf").addEventListener("click",exportPdf);
$("xlsx").addEventListener("click",exportXlsx);
$("filter").addEventListener("change",draw);
$("search").addEventListener("input",draw);
$("clear").addEventListener("click",function(){
 $("fileRef").value="";$("fileTarget").value="";
 $("nameRef").textContent="Nenhum arquivo escolhido";$("nameTarget").textContent="Nenhum arquivo escolhido";
 current=[];meta=null;$("results").classList.add("hidden");setStatus("");
});
[["fileRef","nameRef"],["fileTarget","nameTarget"]].forEach(function(pair){
 $(pair[0]).addEventListener("change",function(){
  $(pair[1]).textContent=this.files&&this.files[0]?this.files[0].name:"Nenhum arquivo escolhido";
  $("results").classList.add("hidden");current=[];meta=null;
 });
});
})();
