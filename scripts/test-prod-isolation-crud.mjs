import { loadAdminConnection } from './lib/admin-credentials.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import pg from 'pg';
const dir='backups/isolamento-principal';
const adminUrl=await loadAdminConnection();
if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES')throw new Error('CRUD de escrita requer autorizacao e opt-in explicito; use rollback-check para verificacao por leitura');
const config=dotenv.parse(await readFile('.env'));
assert.equal(decodeURIComponent(new URL(config.DATABASE_URL).username),'balsas_api_prod');assert.ok(!config.DIRECT_URL);
const baseline=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
const db=new pg.Client({connectionString:adminUrl.href});await db.connect();
const base='http://127.0.0.1:'+(config.PORT||3000),marker='Isolamento principal '+randomUUID();
const checks=[],report={checks,temporaryMarker:marker};let tempId;
const originalIds=new Set((await db.query('SELECT id FROM atracoes')).rows.map(x=>x.id));
async function check(name,fn){try{await fn();checks.push({name,result:'APROVADO'});}catch(e){checks.push({name,result:'REPROVADO',code:e.code||'ASSERCAO'});throw e;}}
async function req(method,path,body,auth=config.API_WRITE_TOKEN){const r=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(['POST','PUT','PATCH','DELETE'].includes(method)&&auth?{Authorization:'Bearer '+auth}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const json=r.status===204?null:await r.json();if(method==='POST'&&path==='/atracoes'&&r.status===201&&json.nome===marker){tempId=json.id;await writeFile(dir+'/crud-ledger.json',JSON.stringify({marker,tempId,scope:'balsas_experience'}));}return {status:r.status,json,location:r.headers.get('location')};}
async function snapshot(){const result={};for(const t of Object.keys(baseline.mainTables)){const rows=(await db.query(`SELECT * FROM public."${t}" ORDER BY 1,2`)).rows;result[t]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}return result;}
try{
 assert.deepEqual(await snapshot(),baseline.mainTables);
 await writeFile(dir+'/crud-ledger.json',JSON.stringify({marker,scope:'balsas_experience'}));
 const category=(await db.query('SELECT nome FROM categorias ORDER BY id LIMIT 1')).rows[0].nome;
 const tags=(await db.query('SELECT nome FROM tags ORDER BY id LIMIT 2')).rows.map(x=>x.nome);
 const payload={nome:marker,categoria:category,descricao:'Registro temporario autorizado para isolamento',localizacao:{cidade:'Balsas',estado:'MA'},tags,distanciaCentroKm:1};
 await check('GET raiz/health',async()=>{assert.equal((await req('GET','/')).json.nome,'Balsas Experience API');const r=await req('GET','/health');assert.equal(r.status,200);assert.equal(r.json.banco,'conectado');});
 await check('GET atrações/categorias protegidas',async()=>{const r=await req('GET','/atracoes');assert.equal(r.status,200);assert.equal(r.json.length,8);assert.equal((await req('GET','/categorias')).json.length,3);});
 await check('Identidade exclusiva da API real',async()=>{const sessions=(await db.query("SELECT usename,datname,application_name,client_addr::text FROM pg_stat_activity WHERE application_name='balsas_api_prod' AND backend_type='client backend'")).rows;assert.ok(sessions.length>0);assert.ok(sessions.every(x=>x.usename==='balsas_api_prod'&&x.datname==='balsas_experience'));report.apiSessions=sessions;const pid=JSON.parse(await readFile(dir+'/api-pid.json','utf8'));report.apiProcess=pid;});
 await check('POST sem token/token inválido negado',async()=>{for(const auth of ['', 'invalid-isolation-token'])assert.equal((await req('POST','/atracoes',payload,auth)).status,401);});
 await check('POST cria somente atração temporária',async()=>{const r=await req('POST','/atracoes',payload);assert.equal(r.status,201);assert.ok(Number.isInteger(tempId)&&!originalIds.has(tempId));assert.equal(r.location,'/atracoes/'+tempId);assert.deepEqual(new Set(r.json.tags),new Set(tags));});
 await check('GET temporária persistida',async()=>{const r=await req('GET','/atracoes/'+tempId);assert.equal(r.status,200);assert.equal(r.json.nome,marker);});
 await check('PUT temporária e troca de vínculos temporários',async()=>{const r=await req('PUT','/atracoes/'+tempId,{...payload,descricao:'PUT temporario',tags:[tags[0]]});assert.equal(r.status,200);assert.equal(r.json.descricao,'PUT temporario');assert.deepEqual(r.json.tags,[tags[0]]);});
 await check('PATCH temporária e remoção de vínculos temporários',async()=>{const r=await req('PATCH','/atracoes/'+tempId,{descricao:'PATCH temporario',tags:[]});assert.equal(r.status,200);assert.equal(r.json.descricao,'PATCH temporario');assert.deepEqual(r.json.tags,[]);});
 await check('Avaliação temporária e agregação',async()=>{const r=await req('POST','/atracoes/'+tempId+'/avaliacoes',{visitante:'Ensaio isolamento',nota:5,comentario:'Temporario'});assert.equal(r.status,201);const detail=(await req('GET','/atracoes/'+tempId)).json;assert.equal(detail.totalAvaliacoes,1);assert.equal(detail.notaMedia,5);});
 await check('DELETE somente temporária e cascata',async()=>{assert.ok(!originalIds.has(tempId));assert.equal((await db.query('SELECT nome FROM atracoes WHERE id=$1',[tempId])).rows[0].nome,marker);assert.equal((await req('DELETE','/atracoes/'+tempId)).status,204);assert.equal((await req('GET','/atracoes/'+tempId)).status,404);assert.equal((await db.query('SELECT count(*)::int n FROM avaliacoes WHERE "atracaoId"=$1',[tempId])).rows[0].n,0);});
 await check('Dados protegidos: seis contagens/hashes idênticos',async()=>{report.after=await snapshot();assert.deepEqual(report.after,baseline.mainTables);});
}catch(e){process.exitCode=1;report.interrupted=true;report.errorCode=e.code||'ASSERCAO';}
finally{
 // Recovery targets only the unique marker created here, never protected IDs.
 const remaining=(await db.query('SELECT id FROM atracoes WHERE nome=$1',[marker])).rows;
 for(const row of remaining){assert.ok(!originalIds.has(row.id));await db.query('DELETE FROM atracoes WHERE id=$1 AND nome=$2',[row.id,marker]);}
 report.recoveryDeletedTemporaryRows=remaining.length;
 try{report.final=await snapshot();assert.deepEqual(report.final,baseline.mainTables);report.protectedDataPreserved=true;}catch(e){process.exitCode=1;report.protectedDataPreserved=false;}
 await db.end();await writeFile('docs/isolamento-principal-crud.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks,protectedDataPreserved:report.protectedDataPreserved,recoveryDeletedTemporaryRows:remaining.length}));
}
