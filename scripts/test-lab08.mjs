/** Testa categorias, busca e avaliações com escrita e limpeza de fixtures no banco isolado. */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import {loadTestConfig} from './test-config.mjs';
import {runtimeEnv} from './lib/runtime-env.mjs';
const config=await loadTestConfig();
const runtimeUrl=new URL(config.DATABASE_URL);
const fixtureUrl=new URL(config.TEST_FIXTURE_DATABASE_URL || config.DATABASE_URL);
assert.ok(['localhost','127.0.0.1','[::1]'].includes(runtimeUrl.hostname),'Banco de testes deve usar loopback');
assert.match(runtimeUrl.pathname,/^\/balsas_lab08_test_\d+$/,'Banco isolado obrigatório');
assert.equal(fixtureUrl.host,runtimeUrl.host,'Fixture de outro host');
assert.equal(fixtureUrl.pathname,runtimeUrl.pathname,'Fixture de outro banco');
const db=new pg.Client({ connectionString:config.TEST_FIXTURE_DATABASE_URL || config.DATABASE_URL });
await db.connect();
const apiEnv=runtimeEnv({ ...process.env,DATABASE_URL:config.DATABASE_URL,API_WRITE_TOKEN:config.API_WRITE_TOKEN,PORT:'3196',HOST:'127.0.0.1',CORS_ORIGINS:'https://teste.invalid' });
delete apiEnv.DIRECT_URL;delete apiEnv.TEST_FIXTURE_DATABASE_URL;
const server=spawn(process.execPath,['src/app.js'],{ env:apiEnv,windowsHide:true,stdio:['ignore','pipe','pipe'] });
let iniciou=false; server.stdout.on('data',b=>{ if(b.toString().includes('Servidor executando')) iniciou=true; }); server.stderr.on('data',()=>{});
const resultados=[]; let id; const categoria='Teste '+randomUUID();
async function caso(nome,fn) { try { await fn(); resultados.push({nome,resultado:'APROVADO'}); } catch(e) { resultados.push({nome,resultado:'REPROVADO',erro:e.message}); process.exitCode=1; } }
async function req(method,path,body,token=config.API_WRITE_TOKEN) {
  const r=await fetch('http://127.0.0.1:3196'+path,{ method, headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000) });
  return { status:r.status,json:r.status===204?null:await r.json() };
}
try {
  for(let n=0;n<100&&!iniciou;n++) { if(server.exitCode!==null) throw new Error('Servidor não iniciou'); await new Promise(r=>setTimeout(r,50)); }
  assert.ok(iniciou);
  for(const method of ['POST','PUT','PATCH','DELETE']) for(const token of ['', 'invalido']) await caso(method+' autenticação '+(token?'inválida':'ausente'),async()=>assert.equal((await req(method,method==='POST'?'/atracoes':'/atracoes/1',{},token)).status,401));
  await caso('Categorias: formato acadêmico e contagens 4/1/3',async()=>{const r=await req('GET','/categorias');assert.equal(r.status,200); for(const [nome,n] of [['Histórico e Urbano',4],['Lazer',1],['Natureza e Aventura',3]]) assert.equal(r.json.find(c=>c.nome===nome).atracoes,n);});
  await caso('Categorias: compatibilidade nomes',async()=>assert.ok((await req('GET','/categorias?formato=nomes')).json.includes('Lazer')));
  await caso('Categorias: formato inválido',async()=>assert.equal((await req('GET','/categorias?formato=x')).status,400));
  const payload={nome:'Busca %_ '+randomUUID(),categoria,descricao:'Descrição exclusiva Jabuticaba',tags:[]};
  await caso('Criar atração temporária',async()=>{const r=await req('POST','/atracoes',payload);id=r.json.id;assert.equal(r.status,201);assert.ok(id);});
  await caso('Sem avaliações: null, zero e lista vazia',async()=>{const r=await req('GET',`/atracoes/${id}`);assert.equal(r.json.notaMedia,null);assert.equal(r.json.totalAvaliacoes,0);assert.deepEqual(r.json.avaliacoes,[]);});
  for(const [termo,esperado] of [[payload.nome,1],['JABUTICABA',1],['inexistente_'+randomUUID(),0],['%_',1],["' OR 1=1 --",0],['\\',0]]) await caso('Busca literal '+termo,async()=>{const r=await req('GET','/atracoes?q='+encodeURIComponent(' '+termo+' ')+'&categoria='+encodeURIComponent(categoria));assert.equal(r.status,200);assert.equal(r.json.length,esperado);});
  await caso('Busca vazia ignora filtro',async()=>assert.equal((await req('GET','/atracoes?q=%20&categoria='+encodeURIComponent(categoria))).json.length,1));
  await caso('Busca repetida devolve 400',async()=>assert.equal((await req('GET','/atracoes?q=a&q=b')).status,400));
  for(const body of [{visitante:'Ana',nota:0},{visitante:'Ana',nota:6},{visitante:'Ana',nota:2.5},{visitante:'Ana',nota:'5'},{visitante:4,nota:5},{visitante:' ',nota:5},{nota:5},{visitante:'Ana',nota:5,comentario:[]},{visitante:'Ana',nota:5,atracaoId:1}]) await caso('Avaliação inválida '+JSON.stringify(body),async()=>assert.equal((await req('POST',`/atracoes/${id}/avaliacoes`,body)).status,400));
  for(const token of ['', 'invalido']) await caso('Avaliação Bearer '+(token||'ausente'),async()=>assert.equal((await req('POST',`/atracoes/${id}/avaliacoes`,{visitante:'Ana',nota:5},token)).status,401));
  await caso('Avaliação atração inexistente',async()=>assert.equal((await req('POST','/atracoes/2147483647/avaliacoes',{visitante:'Ana',nota:5})).status,404));
  for(const nota of [5,4]) await caso('Persistir avaliação '+nota,async()=>{const r=await req('POST',`/atracoes/${id}/avaliacoes`,{visitante:'Visitante teste',nota,comentario:nota===5?'Teste':null});assert.equal(r.status,201);const dbrow=await db.query('SELECT nota FROM avaliacoes WHERE id=$1 AND "atracaoId"=$2',[r.json.id,id]);assert.equal(dbrow.rows[0].nota,nota);});
  await caso('Média 4.5 e total 2',async()=>{const r=await req('GET',`/atracoes/${id}`);assert.equal(r.json.notaMedia,4.5);assert.equal(r.json.totalAvaliacoes,2);assert.equal(r.json.avaliacoes.length,2);});
  await caso('Categoria normalizada reutilizada',async()=>{await req('PATCH',`/atracoes/${id}`,{categoria:' '+categoria.toUpperCase()+'  '});const r=await db.query('SELECT count(*)::int n FROM categorias WHERE chave=$1',[categoria.toLowerCase()]);assert.equal(r.rows[0].n,1);});
  await caso('Excluir atração e avaliações em cascata',async()=>{assert.equal((await req('DELETE',`/atracoes/${id}`)).status,204);assert.equal((await db.query('SELECT count(*)::int n FROM avaliacoes WHERE "atracaoId"=$1',[id])).rows[0].n,0);});
  await caso('Categoria sem atrações devolve zero',async()=>assert.equal((await req('GET','/categorias')).json.find(c=>c.chave===categoria.toLowerCase()||c.nome===categoria).atracoes,0));
} finally {
  if(id) await db.query('DELETE FROM atracoes WHERE id=$1',[id]);
  await db.query('DELETE FROM categorias WHERE chave=$1 AND NOT EXISTS (SELECT 1 FROM atracoes WHERE "categoriaId"=categorias.id)',[categoria.toLowerCase()]);
  await db.end(); server.kill();
  const relatorio={total:resultados.length,aprovados:resultados.filter(r=>r.resultado==='APROVADO').length,reprovados:resultados.filter(r=>r.resultado==='REPROVADO').length,resultados};
  await mkdir('tmp', { recursive: true });
  await writeFile(process.env.LAB08_REPORT_PATH || 'tmp/testes-lab08.json',JSON.stringify(relatorio,null,2)); console.log(JSON.stringify(relatorio));
}
