import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import pg from 'pg';
import {loadAdminConnection} from './lib/admin-credentials.mjs';
import {connectReadOnly} from './lib/readonly-credentials.mjs';
const runtime=dotenv.parse(await readFile('.env'));
assert.equal(new URL(runtime.DATABASE_URL).username,'balsas_api_prod');
const pid=JSON.parse((await readFile('docs/recuperacao-pid-atual.json','utf8')).replace(/^\uFEFF/,''));
assert.ok(pid.launcherMatches&&pid.listenerConfirmed);
const c=await connectReadOnly();
const report={checkedUTC:new Date().toISOString(),readOnly:true,apiPID:pid.pid};
try{
 report.auditIdentity=(await c.query("SELECT current_user,current_setting('transaction_read_only') readonly")).rows[0];
 const api=new pg.Client({connectionString:runtime.DATABASE_URL,connectionTimeoutMillis:5000});
 try{await api.connect();await api.query('BEGIN READ ONLY');report.apiSessions=(await api.query("SELECT usename,datname,client_port,application_name FROM pg_stat_activity WHERE backend_type='client backend' AND client_port=ANY($1::int[])",[pid.databaseClientPorts])).rows;}finally{await api.end().catch(()=>{});}
 assert.ok(report.apiSessions.length>0);assert.ok(report.apiSessions.every(s=>s.usename==='balsas_api_prod'&&s.datname==='balsas_experience'));
 report.mainTables={};const baseline=JSON.parse(await readFile('backups/isolamento-principal/baseline.json','utf8'));
 for(const table of Object.keys(baseline.mainTables)){assert.ok(/^[a-z_]+$/.test(table));const rows=(await c.query(`SELECT * FROM public."${table}" ORDER BY 1,2`)).rows;report.mainTables[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
 assert.deepEqual(report.mainTables,baseline.mainTables);report.mainHashesUnchanged=true;
 report.credentialCheck={executed:false,reason:'Separado da verificação operacional; usar --with-credential-check.'};
 if(process.argv.includes('--with-credential-check')){
  const adminUrl=await loadAdminConnection();
  const admin=new pg.Client({connectionString:adminUrl.href,connectionTimeoutMillis:5000});
  try{await admin.connect();await admin.query('BEGIN READ ONLY');await admin.query('SELECT 1');const old=new URL(dotenv.parse(await readFile('backups/isolamento-principal/env-original.private')).DATABASE_URL);report.credentialCheck={executed:true,compromisedPasswordStillValid:decodeURIComponent(old.password)===decodeURIComponent(adminUrl.password)};}finally{await admin.end().catch(()=>{});}
 }
 const h=await fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(10000)});assert.equal(h.status,200);report.health={status:h.status,body:await h.json()};
}catch(e){report.errorCode=e.code||'ASSERTION';process.exitCode=1;}finally{await c.end().catch(()=>{});await writeFile('docs/recuperacao-final-leitura.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
