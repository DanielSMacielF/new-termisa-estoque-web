// Publicação do site New Termisa no Firebase Hosting.
// Copia somente os arquivos atuais do sistema. Não exporta estoques nem configurações privadas.
// Uso: node preparar-hosting.js; firebase deploy --only hosting --project new-termisa-estoque
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=__dirname;
const target=path.join(source,'hosting-dist');
const allowlist=['index.html','inteligencia.html','calculadora.js'];
for(const name of allowlist){
 const full=path.join(source,name);
 if(!fs.existsSync(full) || !fs.statSync(full).isFile()){
   throw new Error('Arquivo obrigatório ausente: '+name);
 }
}
const index=fs.readFileSync(path.join(source,'index.html'),'utf8');
const intelligence=fs.readFileSync(path.join(source,'inteligencia.html'),'utf8');
if(!index.includes('./calculadora.js')||!index.includes('./inteligencia.html'))
 throw new Error('Referências do sistema principal não conferem. Nenhum arquivo foi preparado.');
if(!intelligence.includes('./calculadora.js'))
 throw new Error('Referência da calculadora não encontrada na Central de Inteligência.');
fs.rmSync(target,{recursive:true,force:true});
fs.mkdirSync(target,{recursive:true});
for(const name of allowlist)fs.copyFileSync(path.join(source,name),path.join(target,name));
console.log('Arquivos preparados com segurança para o Firebase Hosting:');
allowlist.forEach(name=>console.log(' - '+name));
console.log('Nenhum cadastro ou saldo foi alterado.');
console.log('Para publicar: firebase deploy --only hosting --project new-termisa-estoque');
