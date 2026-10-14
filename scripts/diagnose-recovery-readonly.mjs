import {readFile,writeFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import {loadAdminConnection,nativeAdminEnv} from './lib/admin-credentials.mjs';
const admin=await loadAdminConnection(),runtime=dotenv.parse(await readFile('.env'));
const creds=JSON.parse(await readFile('backups/isolamento-principal/credentials.json','utf8'));
const secretValues=[admin.href,decodeURIComponent(admin.password),runtime.API_WRITE_TOKEN];
for(const uri of Object.values(creds)){secretValues.push(uri,decodeURIComponent(new URL(uri).password));}
const sanitize=s=>{for(const secret of secretValues.filter(Boolean))s=s.replaceAll(secret,'[SEGREDO]');return s.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');};
const report={date:'2026-10-12',readOnly:true,restartPerformed:false,connections:[],http:[],backups:[],logs:[]};
for(const [role,url]of [['admin',admin.href],['balsas_api_prod',creds.DATABASE_URL],['balsas_migrate_prod',creds.DIRECT_URL]])for(const host of ['127.0.0.1','[::1]']){
 const u=new URL(url);u.hostname=host;const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:3000});let result='SELECT_OK';try{await c.connect();await c.query('BEGIN READ ONLY');await c.query('SELECT current_user');}catch(e){result=e.code||'FAILED';}finally{await c.end().catch(()=>{});}report.connections.push({role,host,result});
}
for(const host of ['127.0.0.1','::1']){const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_isready.exe',['-h',host,'-p','5432','-t','3'],{windowsHide:true,encoding:'utf8',timeout:5000});report.connections.push({tool:'pg_isready',host,exit:r.status,message:sanitize((r.stdout||'')+(r.stderr||''))});}
const native=nativeAdminEnv(admin);native.PGSSLMODE='disable';const psql=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-tAc','SELECT 1'],{env:native,windowsHide:true,encoding:'utf8',timeout:5000});report.connections.push({tool:'psql SSL disabled',exit:psql.status,message:sanitize(psql.stderr||'')});
for(const endpoint of ['/','/health','/atracoes','/categorias']){try{const r=await fetch('http://127.0.0.1:3000'+endpoint,{signal:AbortSignal.timeout(3000)});report.http.push({endpoint,status:r.status,body:sanitize(await r.text())});}catch(e){report.http.push({endpoint,errorCode:e.code||'FETCH_FAILED'});}}
for(const file of ['C:/Program Files/PostgreSQL/18/data/log/postgresql-2026-10-11_155723.log','backups/isolamento-principal/api-runtime.log']){try{const meta=await stat(file);const text=await readFile(file,'utf8');report.logs.push({file,modifiedUTC:meta.mtime.toISOString(),tail:sanitize(text.split(/\r?\n/).filter(l=>!/^\s*(?:STATEMENT|DETAIL|CONTEXT):/.test(l)).slice(-30).join('\n'))});}catch(e){report.logs.push({file,code:e.code});}}
const baseline=JSON.parse(await readFile('backups/isolamento-principal/baseline.json','utf8'));
report.hbaMatchesLastAuthorizedConfiguration=createHash('sha256').update(await readFile(baseline.hbaPath)).digest('hex')===baseline.hbaProposedHash;
for(const backup of baseline.backupChecks){const bytes=await readFile(backup.file);const hash=createHash('sha256').update(bytes).digest('hex');const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',backup.file],{windowsHide:true});report.backups.push({file:backup.file,exists:true,hashMatches:hash===backup.sha256,catalogReadable:r.status===0});}
await writeFile('docs/recuperacao-diagnostico-leitura.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({connections:report.connections,http:report.http,backups:report.backups,hbaMatches:report.hbaMatchesLastAuthorizedConfiguration,logs:report.logs}));
