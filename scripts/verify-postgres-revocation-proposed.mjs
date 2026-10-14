import { loadAdminConnection } from './lib/admin-credentials.mjs';
// PREPARED ONLY. Run after separately authorized password rotation, never as mutation.
import {readFile,writeFile} from 'node:fs/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
assert.equal(process.argv[2],'--after-authorized-rotation','Teste reservado a etapa posterior autorizada');
const old=dotenv.parse(await readFile('backups/isolamento-principal/env-original.private'));
const runtime=dotenv.parse(await readFile('.env'));
// Provision this private file only during the separately authorized rotation.
const fresh={DATABASE_URL:(await loadAdminConnection()).href};
const oldUrl=new URL(old.DATABASE_URL),newUrl=new URL(fresh.DATABASE_URL),apiUrl=new URL(runtime.DATABASE_URL);
assert.equal(decodeURIComponent(oldUrl.username),'postgres');assert.equal(decodeURIComponent(newUrl.username),'postgres');assert.equal(decodeURIComponent(apiUrl.username),'balsas_api_prod');
for(const u of [oldUrl,newUrl,apiUrl]){assert.ok(['localhost','127.0.0.1','[::1]'].includes(u.hostname));assert.equal(u.port||'5432','5432');assert.equal(u.pathname,'/balsas_experience');}
assert.ok(decodeURIComponent(oldUrl.password)!==decodeURIComponent(newUrl.password),'A fonte corrente deve conter uma credencial diferente da antiga');
const results=[];
async function freshConnection(u,role){const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:5000,application_name:'balsas-post-rotation-verification'});try{await c.connect();await c.query('BEGIN READ ONLY');const r=(await c.query('SELECT current_user,current_database(),inet_server_addr()::text server_addr,inet_server_port() server_port,version()')).rows[0];assert.equal(r.current_user,role);assert.equal(r.current_database,'balsas_experience');assert.equal(r.server_port,5432);return r;}finally{await c.end().catch(()=>{});}}
try{
 for(const host of ['127.0.0.1','[::1]']){
  const freshUrl=new URL(newUrl);freshUrl.hostname=host;await freshConnection(freshUrl,'postgres');results.push({test:'nova senha '+host,result:'APROVADO'});
  const revokedUrl=new URL(oldUrl);revokedUrl.hostname=host;const c=new pg.Client({connectionString:revokedUrl.href,connectionTimeoutMillis:5000});let code;try{await c.connect();}catch(e){code=e.code;}finally{await c.end().catch(()=>{});}results.push({test:'senha antiga '+host,result:code==='28P01'?'APROVADO':'REPROVADO_OU_INCONCLUSIVO',sqlstate:code||'AUTHENTICATED'});assert.equal(code,'28P01');
  const runtimeUrl=new URL(apiUrl);runtimeUrl.hostname=host;await freshConnection(runtimeUrl,'balsas_api_prod');results.push({test:'runtime em conexao nova '+host,result:'APROVADO'});
 }
 const health=await fetch('http://127.0.0.1:'+(runtime.PORT||3000)+'/health',{signal:AbortSignal.timeout(5000)});assert.equal(health.status,200);assert.equal((await health.json()).banco,'conectado');results.push({test:'API existente saudável',result:'APROVADO'});
}catch(e){process.exitCode=1;results.push({interrupted:true,code:e.code||'ASSERCAO'});}
await writeFile('docs/rotacao-verificacao-posterior.json',JSON.stringify({results,mutations:false},null,2));console.log(JSON.stringify(results));
