// Somente leitura: conexões novas, pool e GETs; não reinicia o servidor.
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';
import {runtimeEnv} from './lib/runtime-env.mjs';
import {loadAdminConnection} from './lib/admin-credentials.mjs';
const config=dotenv.parse(await readFile('.env'));
const report={startedUTC:new Date().toISOString(),readOnly:true,restartPerformed:false,rounds:[],http:[],errors:[]};
assert.equal(new URL(config.DATABASE_URL).username,'balsas_api_prod');
assert.equal(new URL(config.DATABASE_URL).pathname,'/balsas_experience');
const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:3,connectionTimeoutMillis:5000,query_timeout:10000});
pool.on('error',e=>report.errors.push({source:'pool',code:e.code||'FAILED'}));
let failedServer;
try{
 const admin=new pg.Client({connectionString:(await loadAdminConnection()).href,connectionTimeoutMillis:5000});
 await admin.connect();
 try{
  await admin.query('BEGIN READ ONLY');
  report.server=(await admin.query("SELECT version(),pg_postmaster_start_time() started,current_setting('max_connections') max_connections,current_setting('data_directory') data_directory")).rows[0];
  report.hba=(await admin.query('SELECT rule_number,type,database,user_name,address,auth_method,error FROM pg_hba_file_rules ORDER BY rule_number')).rows;
  assert.ok(report.hba.every(r=>r.error===null));
  report.sessions=(await admin.query("SELECT pid,usename,datname,application_name,state,backend_type,client_addr::text,client_port FROM pg_stat_activity ORDER BY pid")).rows;
  report.preparedTransactions=(await admin.query('SELECT owner,database FROM pg_prepared_xacts')).rows;
  report.locks=(await admin.query('SELECT count(*)::int waiting FROM pg_locks WHERE NOT granted')).rows[0];
 }finally{await admin.end();}
 const paths=['/','/live','/health','/atracoes','/categorias','/categorias?formato=nomes','/atracoes?q=rio','/atracoes?categoria=Lazer','/atracoes?tag=cachoeira','/atracoes?ate=60','/atracoes/1'];
 for(const path of paths){const r=await fetch('http://127.0.0.1:3000'+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,path);const body=await r.json();if(path==='/health')assert.equal(body.banco,'conectado');report.http.push({path,status:r.status});}
 // Janela mínima de dois minutos; intercala IPv4/IPv6 e conexão persistente.
 for(let i=0;i<25;i++){
  const u=new URL(config.DATABASE_URL);u.hostname=i%2?'[::1]':'127.0.0.1';
  const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:5000,query_timeout:10000});
  try{await c.connect();const r=(await c.query('SELECT current_user,current_database(),1 value')).rows[0];assert.equal(r.current_user,'balsas_api_prod');assert.equal(r.current_database,'balsas_experience');await pool.query('SELECT 1');const h=await fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(15000)});assert.equal(h.status,200);report.rounds.push({atUTC:new Date().toISOString(),host:u.hostname,result:'APROVADO'});}finally{await c.end().catch(()=>{});}
  if(i<24)await new Promise(r=>setTimeout(r,5000));
 }
 // Falha real em instância temporária com destino deliberadamente indisponível.
 const bad=new URL(config.DATABASE_URL);bad.port='1';
 failedServer=spawn(process.execPath,['src/app.js'],{env:runtimeEnv({...process.env,...config,DATABASE_URL:bad.href,HOST:'127.0.0.1',PORT:'3211'}),windowsHide:true,stdio:'ignore'});
 let ready=false;for(let i=0;i<50;i++){assert.equal(failedServer.exitCode,null);try{ready=(await fetch('http://127.0.0.1:3211/live')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const unhealthy=await fetch('http://127.0.0.1:3211/health',{signal:AbortSignal.timeout(15000)});assert.equal(unhealthy.status,500);assert.deepEqual(await unhealthy.json(),{erro:'Erro interno no servidor'});
 report.failureHealth={status:500,sanitized:true,scope:'instância temporária; principal não interrompida'};
}catch(e){report.errors.push({code:e.code||'ASSERTION'});process.exitCode=1;}
finally{failedServer?.kill();await pool.end();report.finishedUTC=new Date().toISOString();report.durationSeconds=(Date.parse(report.finishedUTC)-Date.parse(report.startedUTC))/1000;await writeFile('docs/recuperacao-estabilidade-atual.json',JSON.stringify(report,null,2));console.log(JSON.stringify({rounds:report.rounds.length,durationSeconds:report.durationSeconds,http:report.http,failureHealth:report.failureHealth,errors:report.errors}));}
