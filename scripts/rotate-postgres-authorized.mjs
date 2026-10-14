// Operação local explicitamente autorizada; nenhuma senha/URL/verificador é impresso.
import {readFile,writeFile,open,rename,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import pg from 'pg';
import dotenv from 'dotenv';
import {loadAdminConnection,assertPrivateFile,assertPrivateDirectory,AdminCredentialError} from './lib/admin-credentials.mjs';
import {newStrongPassword,scramVerifier,rotationStatement} from './lib/rotation-password.mjs';
if(process.argv[2]!=='--execute-authorized-rotation')throw new AdminCredentialError('ROTATION_AUTHORIZATION_REQUIRED');
const source=path.resolve('backups/admin/credentials.json');
const report={startedUTC:new Date().toISOString(),authorization:'Expressa do usuário em 12/10/2026; risco de consumidores desconhecidos aceito',rotationPerformed:false,sourceUpdated:false,sessionTerminationPerformed:false,serviceRestartPerformed:false,checks:[],stages:[]};
const clients=[];let stage='preflight',candidate,attempted=false,completed=false,heartbeat;
function makeClient(url,label){const c=new pg.Client({connectionString:url.href,connectionTimeoutMillis:5000,query_timeout:10000});c.on('error',e=>{report.connectionErrors??=[];report.connectionErrors.push({source:label,code:/^[A-Z0-9_]+$/.test(e?.code||'')?e.code:'CONNECTION_LOST'});});return c;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bool=(value,code)=>{if(!value)throw new AdminCredentialError(code);};
const note=(name,data={})=>{report.checks.push({name,result:'APROVADO',...data});};
async function persistReport(){await writeFile('backups/rotation-executed-current.json',JSON.stringify(report,null,2));}
async function newConnection(url,expectedRole){
 const c=makeClient(url,'independent-validation');
 try{await c.connect();await c.query('BEGIN READ ONLY');const identity=(await c.query('SELECT current_user,current_database(),inet_server_port() port')).rows[0];bool(identity.current_user===expectedRole&&identity.current_database==='balsas_experience'&&identity.port===5432,'ROTATION_CONNECTION_IDENTITY');if(expectedRole==='postgres'){const cluster=(await c.query('SELECT system_identifier::text cluster FROM pg_control_system()')).rows[0].cluster;bool(cluster===report.checks[0].cluster,'ROTATION_CLUSTER_MISMATCH');}return identity;}finally{await c.end().catch(()=>{});}
}
async function snapshot(c){const out={};for(const table of ['_prisma_migrations','atracao_tags','atracoes','avaliacoes','categorias','tags']){const rows=(await c.query(`SELECT * FROM public."${table}" ORDER BY 1,2`)).rows;out[table]={count:rows.length,sha256:hash(JSON.stringify(rows))};}return out;}
async function roleState(c){return {roles:(await c.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,rolvaliduntil FROM pg_roles WHERE rolname IN ('postgres','balsas_api_prod','balsas_migrate_prod','balsas_api','balsas_migrate') ORDER BY rolname")).rows,memberships:(await c.query('SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY roleid,member,grantor')).rows,objects:(await c.query("SELECT relname,relowner,relacl FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows};}
try{
 for(const key of Object.keys(process.env))if(/^BALSAS_ADMIN_/i.test(key)&&process.env[key])throw new AdminCredentialError('ROTATION_ENV_OVERRIDE_REJECTED');
 await assertPrivateFile(source);await assertPrivateDirectory(path.dirname(source));bool(!(await lstat(source)).isSymbolicLink(),'ROTATION_SOURCE_TYPE');
 const oldUrl=await loadAdminConnection({env:{BALSAS_ADMIN_CREDENTIAL_FILE:source}});
 bool(decodeURIComponent(oldUrl.username)==='postgres'&&oldUrl.pathname==='/balsas_experience','ROTATION_ADMIN_IDENTITY');
 const evidence=dotenv.parse(await readFile('backups/isolamento-principal/env-original.private'));
 const compromised=await loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:evidence.DATABASE_URL}});
 bool(decodeURIComponent(compromised.username)==='postgres'&&compromised.pathname===oldUrl.pathname&&(compromised.port||'5432')==='5432','ROTATION_OLD_IDENTITY');
 bool(decodeURIComponent(oldUrl.password)===decodeURIComponent(compromised.password),'ROTATION_CURRENT_SOURCE_DIFFERS_FROM_OLD');
 for(let i=0;i<2;i++){
  const c=makeClient(oldUrl,'recovery-'+i);clients.push(c);await c.connect();
  const identity=(await c.query("SELECT pg_backend_pid() pid,current_user,current_database(),(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser,(SELECT system_identifier::text FROM pg_control_system()) cluster")).rows[0];
  bool(identity.current_user==='postgres'&&identity.current_database==='balsas_experience'&&identity.superuser,'ROTATION_RECOVERY_IDENTITY');note('Sessão administrativa de recuperação '+i,identity);
 }
 bool(report.checks[0].pid!==report.checks[1].pid&&report.checks[0].cluster===report.checks[1].cluster,'ROTATION_RECOVERY_SESSIONS');
 const settings=(await clients[0].query("SELECT name,setting FROM pg_settings WHERE name IN ('log_statement','log_duration','log_min_duration_statement','log_min_duration_sample','log_transaction_sample_rate','shared_preload_libraries','session_preload_libraries','local_preload_libraries','hba_file','log_directory','data_directory')")).rows;
 const values=Object.fromEntries(settings.map(r=>[r.name,r.setting]));
 bool(values.log_statement==='none'&&values.log_duration==='off'&&values.log_min_duration_statement==='-1'&&values.log_min_duration_sample==='-1'&&values.log_transaction_sample_rate==='0','ROTATION_LOGGING_NOT_SAFE');
 bool(['shared_preload_libraries','session_preload_libraries','local_preload_libraries'].every(k=>values[k]===''),'ROTATION_UNREVIEWED_AUDIT');
 const hba=(await clients[0].query('SELECT rule_number,auth_method,error FROM pg_hba_file_rules ORDER BY rule_number')).rows;bool(hba.every(r=>r.error===null),'ROTATION_HBA_ERRORS');
 report.hbaBeforeHash=hash(await readFile(values.hba_file));
 const baseline=JSON.parse(await readFile('backups/isolamento-principal/baseline.json','utf8'));
 await clients[0].query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 report.mainBefore=await snapshot(clients[0]);assert.deepEqual(report.mainBefore,baseline.mainTables);
 report.rolesBefore=await roleState(clients[0]);
 const orphans=(await clients[0].query(`SELECT (SELECT count(*)::int FROM atracoes a LEFT JOIN categorias c ON c.id=a."categoriaId" WHERE c.id IS NULL) categories,(SELECT count(*)::int FROM atracao_tags a LEFT JOIN atracoes x ON x.id=a."atracaoId" LEFT JOIN tags t ON t.id=a."tagId" WHERE x.id IS NULL OR t.id IS NULL) links,(SELECT count(*)::int FROM avaliacoes a LEFT JOIN atracoes x ON x.id=a."atracaoId" WHERE x.id IS NULL) reviews`)).rows[0];bool(Object.values(orphans).every(v=>v===0),'ROTATION_ORPHANS');report.integrityBefore=orphans;
 await clients[0].query('COMMIT');note('Dados protegidos e privilégios registrados');
 const backups=JSON.parse(await readFile('docs/backup-rotacao-verificado.json','utf8'));report.backups=[];
 for(const backup of backups.databases){const digest=hash(await readFile(backup.file));const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',backup.file],{windowsHide:true,timeout:10000});bool(digest===backup.sha256&&r.status===0&&r.stdout?.includes(Buffer.from('TABLE DATA')),'ROTATION_BACKUP_INVALID');report.backups.push({file:backup.file,sha256:digest,catalogReadable:true});}
 const restoredUrl=new URL(oldUrl);restoredUrl.pathname='/'+backups.restore.database;
 const restored=makeClient(restoredUrl,'restored-backup-validation');try{await restored.connect();await restored.query('BEGIN READ ONLY');assert.deepEqual(await snapshot(restored),report.mainBefore);note('Base anteriormente restaurada confere com a principal');}finally{await restored.end().catch(()=>{});}
 const runtime=dotenv.parse(await readFile('.env'));const apiUrl=new URL(runtime.DATABASE_URL);bool(apiUrl.username==='balsas_api_prod'&&apiUrl.pathname==='/balsas_experience','ROTATION_RUNTIME_IDENTITY');
 for(const host of ['127.0.0.1','[::1]']){const u=new URL(apiUrl);u.hostname=host;await newConnection(u,'balsas_api_prod');note('Runtime antes da rotação '+host);}
 const preHealth=await fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(10000)});bool(preHealth.status===200&&(await preHealth.json()).banco==='conectado','ROTATION_PRE_HEALTH');
 const newPassword=newStrongPassword();bool(newPassword!==decodeURIComponent(oldUrl.password),'ROTATION_NEW_PASSWORD');
 const nextUrl=new URL(oldUrl);nextUrl.password=newPassword;
 candidate=path.join(path.dirname(source),'credentials.rotation-staged-'+Date.now()+'.json');
 const handle=await open(candidate,'wx',0o600);try{await handle.writeFile(JSON.stringify({DATABASE_URL:nextUrl.href}));await handle.sync();}finally{await handle.close();}
 await assertPrivateFile(candidate);
 const persisted=await loadAdminConnection({env:{BALSAS_ADMIN_CREDENTIAL_FILE:candidate}});bool(decodeURIComponent(persisted.password)===newPassword,'ROTATION_CANDIDATE_PERSISTENCE');note('Nova credencial persistida em fonte privada protegida antes da alteração');
 const verifier=scramVerifier(newPassword);
 // Apenas a sessão dedicada à senha omite instrução em caso de erro.
 // Configuração global e demais sessões permanecem inalteradas.
 await clients[0].query("SET log_min_error_statement='panic'");
 bool((await clients[0].query('SHOW log_min_error_statement')).rows[0].log_min_error_statement==='panic','ROTATION_ERROR_LOGGING');
 await clients[1].query('SELECT 1');note('Sessão de recuperação viva imediatamente antes da mudança');
 stage='alter-role';report.stages.push({stage,atUTC:new Date().toISOString()});await persistReport();
 attempted=true;report.rotationAttempted=true;await clients[0].query(rotationStatement(verifier));report.rotationPerformed=true;
 stage='new-password-validation';
 for(const host of ['127.0.0.1','[::1]']){const u=new URL(persisted);u.hostname=host;await newConnection(u,'postgres');note('Nova senha em conexão independente '+host);}
 stage='publish-private-source';await rename(candidate,source);candidate=null;await assertPrivateFile(source);
 const fresh=await loadAdminConnection({env:{BALSAS_ADMIN_CREDENTIAL_FILE:source}});bool(decodeURIComponent(fresh.password)===newPassword,'ROTATION_SOURCE_RELOAD');await newConnection(fresh,'postgres');report.sourceUpdated=true;note('Fonte administrativa corrente substituída e relida');
 stage='old-password-rejection';
 for(const host of ['127.0.0.1','[::1]']){
  const u=new URL(compromised);u.hostname=host;const c=makeClient(u,'old-password-rejection');let code;
  try{await c.connect();}catch(e){code=e.code;}finally{await c.end().catch(()=>{});}
  bool(code==='28P01','ROTATION_OLD_PASSWORD_NOT_REJECTED');note('Senha comprometida rejeitada em conexão independente '+host,{sqlstate:code});
  const api=new URL(apiUrl);api.hostname=host;await newConnection(api,'balsas_api_prod');note('Runtime depois da rotação '+host);
 }
 stage='post-integrity';await clients[0].query('BEGIN READ ONLY');report.mainAfter=await snapshot(clients[0]);assert.deepEqual(report.mainAfter,report.mainBefore);assert.deepEqual(await roleState(clients[0]),report.rolesBefore);await clients[0].query('COMMIT');bool(hash(await readFile(values.hba_file))===report.hbaBeforeHash,'ROTATION_HBA_CHANGED');note('Dados, atributos/grants/memberships e HBA preservados');
 report.http=[];for(const endpoint of ['/','/health','/atracoes','/categorias','/atracoes?q=rio','/atracoes?categoria=Lazer','/atracoes?tag=cachoeira','/atracoes/1']){const r=await fetch('http://127.0.0.1:3000'+endpoint,{signal:AbortSignal.timeout(15000)});bool(r.status===200,'ROTATION_HTTP_FAILED');await r.json();report.http.push({endpoint,status:r.status});}
 const logDir=path.isAbsolute(values.log_directory)?values.log_directory:path.join(values.data_directory,values.log_directory);
 const {readdir}=await import('node:fs/promises');report.logSecretHits=[];
 for(const name of await readdir(logDir)){if(!/\.(?:log|csv|json)$/.test(name))continue;const body=await readFile(path.join(logDir,name),'utf8');if([newPassword,nextUrl.href,verifier].some(s=>body.includes(s)))report.logSecretHits.push({file:name});}
 bool(report.logSecretHits.length===0,'ROTATION_SECRET_IN_SERVER_LOG');note('Nova senha/URL/verificador ausentes dos arquivos de log PostgreSQL consultados');
 completed=true;report.completed=true;report.compromisedPasswordRejected=true;stage='complete';
}catch(e){report.failure={stage,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'ROTATION_PRECONDITION_OR_ASSERTION'};process.exitCode=1;}
finally{
 report.finishedUTC=new Date().toISOString();report.recoverySource=candidate?path.relative(process.cwd(),candidate):'backups/admin/credentials.json';report.recoveryHeld=attempted&&!completed;
 try{await persistReport();}catch{console.error('Não foi possível persistir relatório sanitizado da operação.');}
 console.log(JSON.stringify({completed,rotationPerformed:report.rotationPerformed,sourceUpdated:report.sourceUpdated,recoveryHeld:report.recoveryHeld,recoverySource:report.recoverySource,failure:report.failure||null,checks:report.checks,http:report.http}));
 if(report.recoveryHeld){
  console.error('Validação crítica pendente; sessões próprias de recuperação mantidas abertas. Não repetir rotação cegamente.');
  heartbeat=setInterval(()=>{for(const c of clients){try{c.query('SELECT 1').catch(()=>{});}catch{}}},15000);
  process.stdin.resume();await new Promise(resolve=>process.stdin.on('data',data=>{if(data.toString().trim()==='release-after-independent-verification')resolve();}));clearInterval(heartbeat);
 }
 for(const c of clients)await c.end().catch(()=>{});
}
