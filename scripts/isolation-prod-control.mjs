import { loadAdminConnection } from './lib/admin-credentials.mjs';
import {runtimeEnv} from './lib/runtime-env.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,writeFile,open} from 'node:fs/promises';
import {createHash,randomBytes,pbkdf2Sync,createHmac} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
const mode=process.argv[2],dir='backups/isolamento-principal';
const tables=['_prisma_migrations','atracao_tags','atracoes','avaliacoes','categorias','tags'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const envBytes=await readFile('.env');
const oldConfig=dotenv.parse(envBytes);
const adminUrl=await loadAdminConnection();
assert.ok(['localhost','127.0.0.1','[::1]'].includes(adminUrl.hostname));
assert.equal(adminUrl.pathname,'/balsas_experience');
const db=new pg.Client({connectionString:adminUrl.href,connectionTimeoutMillis:5000});
let stage='conexao';
async function snapshot(c){const r={};for(const t of tables){const rows=(await c.query(`SELECT * FROM public."${t}" ORDER BY 1,2`)).rows;r[t]={count:rows.length,sha256:hash(JSON.stringify(rows))};}return r;}
async function metadata(c){return {
 schema:(await c.query("SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl FROM pg_namespace WHERE nspname='public'")).rows,
 objects:(await c.query("SELECT relname,relkind,pg_get_userbyid(relowner) owner,relacl,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows,
 extensions:(await c.query('SELECT extname,extversion,pg_get_userbyid(extowner) owner FROM pg_extension ORDER BY extname')).rows,
 defaults:(await c.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows,
 functions:(await c.query("SELECT proname,proowner,prosecdef,proacl FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid")).rows
};}
async function otherDatabases(){const result={};for(const row of (await db.query("SELECT datname FROM pg_database WHERE NOT datistemplate AND datname<>'balsas_experience' ORDER BY datname")).rows){const u=new URL(adminUrl);u.pathname='/'+row.datname;const c=new pg.Client({connectionString:u.href});await c.connect();try{await c.query('BEGIN READ ONLY');result[row.datname]={metadata:await metadata(c)};if(row.datname.startsWith('balsas_'))result[row.datname].tables=await snapshot(c);}finally{await c.query('ROLLBACK');await c.end();}}return result;}
const rolesSql="SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('postgres','balsas_api','balsas_migrate','balsas_api_prod','balsas_migrate_prod') ORDER BY rolname";
async function integrity(){return (await db.query(`SELECT
 (SELECT count(*)::int FROM atracoes a LEFT JOIN categorias c ON c.id=a."categoriaId" WHERE c.id IS NULL) categories,
 (SELECT count(*)::int FROM atracao_tags x LEFT JOIN atracoes a ON a.id=x."atracaoId" LEFT JOIN tags t ON t.id=x."tagId" WHERE a.id IS NULL OR t.id IS NULL) links,
 (SELECT count(*)::int FROM avaliacoes v LEFT JOIN atracoes a ON a.id=v."atracaoId" WHERE a.id IS NULL) reviews`)).rows[0];}
async function sequences(){return (await db.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows;}
try{
 await db.connect();
 if(mode==='preflight'){
  stage='revisao';const artifacts={};for(const f of ['isolamento-principal-proposta-v2.sql','relatorio-isolamento-testes.md','isolamento-principal-rollback-v2.sql'])artifacts[f]=hash(await readFile('docs/'+f));
  const historical=JSON.parse(await readFile('docs/backup-rotacao-verificado.json','utf8'));
  const backupChecks=[];
  for(const b of historical.databases){assert.equal(hash(await readFile(b.file)),b.sha256);const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',b.file],{windowsHide:true});assert.equal(r.status,0);assert.ok(r.stdout.includes(Buffer.from('TABLE DATA')));backupChecks.push({file:b.file,sha256:b.sha256,catalogReadable:true});}
  const mainTables=await snapshot(db);assert.deepEqual(mainTables,historical.databases[0].before);
  const others=await otherDatabases();assert.deepEqual(others[historical.restore.database].tables,mainTables,'Restauracao historica diverge');
  const roles=(await db.query(rolesSql)).rows;assert.ok(!roles.some(x=>x.rolname.endsWith('_prod')));
  const meta=await metadata(db);assert.ok(meta.objects.every(x=>x.owner==='postgres'&&!x.relrowsecurity));assert.equal(meta.functions.length,0);assert.equal(meta.defaults.length,0);
  assert.deepEqual(meta.objects.filter(x=>x.relkind==='r').map(x=>x.relname).sort(),tables.slice().sort());
  assert.deepEqual(meta.objects.filter(x=>x.relkind==='S').map(x=>x.relname).sort(),['atracoes_id_seq','avaliacoes_id_seq','categorias_id_seq','tags_id_seq']);
  const settings=(await db.query("SELECT name,setting FROM pg_settings WHERE name IN ('hba_file','log_statement','log_duration','log_min_duration_statement','log_min_duration_sample','log_statement_sample_rate','log_transaction_sample_rate','log_min_error_statement','shared_preload_libraries','session_preload_libraries','local_preload_libraries')")).rows;
  assert.ok(settings.filter(x=>x.name.endsWith('preload_libraries')).every(x=>x.setting===''));
  const hbaPath=settings.find(x=>x.name==='hba_file').setting;const hba=await readFile(hbaPath);assert.ok(!hba.toString().includes('BALSAS PROD ISOLATION'));
  assert.equal((await db.query('SELECT count(*)::int n FROM pg_hba_file_rules WHERE error IS NOT NULL')).rows[0].n,0);
  const block='# BEGIN BALSAS PROD ISOLATION\r\nhost balsas_experience balsas_api_prod,balsas_migrate_prod 127.0.0.1/32 scram-sha-256\r\nhost balsas_experience balsas_api_prod,balsas_migrate_prod ::1/128 scram-sha-256\r\nhost all balsas_api_prod,balsas_migrate_prod 0.0.0.0/0 reject\r\nhost all balsas_api_prod,balsas_migrate_prod ::0/0 reject\r\nlocal balsas_experience balsas_api_prod,balsas_migrate_prod scram-sha-256\r\nlocal all balsas_api_prod,balsas_migrate_prod reject\r\n# END BALSAS PROD ISOLATION\r\n';
  const proposed=Buffer.concat([Buffer.from(block),hba]);
  const sessions=(await db.query("SELECT pid,datname,usename,application_name,state,client_addr::text,xact_start IS NOT NULL open_transaction,pg_blocking_pids(pid) blockers FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid() ORDER BY pid")).rows;
  const locks=(await db.query("SELECT l.pid,l.mode,l.granted,c.relname FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE c.relnamespace='public'::regnamespace AND l.pid<>pg_backend_pid() AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY l.pid,c.relname")).rows;
  assert.ok(!sessions.some(x=>x.datname==='balsas_experience'&&x.open_transaction));assert.equal(locks.length,0);
  const deps=(await db.query("SELECT c.relname,d.deptype,pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) dependency FROM pg_depend d JOIN pg_class c ON d.objid=c.oid AND d.classid='pg_class'::regclass WHERE c.relnamespace='public'::regnamespace AND d.deptype IN ('e','a','n') ORDER BY c.relname,d.deptype")).rows;assert.ok(!deps.some(x=>x.deptype==='e'));
  const baseline={artifacts,backupChecks,hbaPath,hbaHash:hash(hba),hbaProposedHash:hash(proposed),envHash:hash(envBytes),mainTables,mainMetadata:meta,otherDatabases:others,databases:(await db.query('SELECT datname,datdba,datacl FROM pg_database ORDER BY datname')).rows,roles,settings,sessions,locks,dependencies:deps,sequences:await sequences(),integrity:await integrity(),restoredBackupMatches:true};
  assert.ok(Object.values(baseline.integrity).every(x=>x===0));
  await writeFile(dir+'/env-original.private',envBytes,{flag:'wx'});await writeFile(dir+'/hba-original.conf',hba,{flag:'wx'});await writeFile(dir+'/hba-proposed.conf',proposed,{flag:'wx'});await writeFile(dir+'/baseline.json',JSON.stringify(baseline,null,2));
  await writeFile('docs/isolamento-principal-preflight.json',JSON.stringify({...baseline,envHash:undefined},null,2));
  console.log(JSON.stringify({preflight:'APROVADO',sessions,locks,backupRestoreMatches:true,mainTables}));
 }else if(mode==='apply'){
  stage='precondicoes';const b=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
  assert.equal(b.rollbackRehearsed,true);
  assert.equal(hash(await readFile('.env')),b.envHash);assert.equal(hash(await readFile(b.hbaPath)),b.hbaProposedHash);
  assert.deepEqual(await snapshot(db),b.mainTables);assert.deepEqual(await metadata(db),b.mainMetadata);assert.deepEqual(await otherDatabases(),b.otherDatabases);
  assert.equal((await db.query('SELECT count(*)::int n FROM pg_hba_file_rules WHERE error IS NOT NULL')).rows[0].n,0);
  for(const [f,h]of Object.entries(b.artifacts))assert.equal(hash(await readFile('docs/'+f)),h);
  // Suppression restricted to this provisioning session; no secret in tool output.
  for(const sql of ["SET log_statement='none'","SET log_duration=off","SET log_min_duration_statement=-1","SET log_min_duration_sample=-1","SET log_transaction_sample_rate=0","SET log_min_error_statement='panic'"])await db.query(sql);
  function verifier(pass){const salt=randomBytes(16),salted=pbkdf2Sync(pass,salt,4096,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest(),stored=hash(client),server=createHmac('sha256',salted).update('Server Key').digest('base64');return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${Buffer.from(stored,'hex').toString('base64')}:${server}`;}
  const privateConfig={};for(const[role,key]of [['balsas_api_prod','DATABASE_URL'],['balsas_migrate_prod','DIRECT_URL']]){const u=new URL(adminUrl);u.username=role;u.password=randomBytes(48).toString('base64url');u.searchParams.set('application_name',role);privateConfig[key]=u.href;}
  await writeFile(dir+'/credentials.json',JSON.stringify(privateConfig),{flag:'wx',mode:0o600});
  stage='papéis-e-propriedade';const proposal=await readFile('docs/isolamento-principal-proposta-v2.sql','utf8');
  const body=proposal.slice(0,proposal.lastIndexOf('COMMIT;'));await db.query(body);
  try{for(const[role,key]of [['balsas_api_prod','DATABASE_URL'],['balsas_migrate_prod','DIRECT_URL']])await db.query(`ALTER ROLE ${role} LOGIN PASSWORD '${verifier(decodeURIComponent(new URL(privateConfig[key]).password))}'`);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
  await writeFile(dir+'/applied.json',JSON.stringify({database:'balsas_experience',roles:['balsas_api_prod','balsas_migrate_prod'],committed:true}));
  console.log('Papéis, propriedade e grants da proposta aplicados somente à principal; segredos privados.');
 }else if(mode==='switch'){
  stage='configuracao';const b=JSON.parse(await readFile(dir+'/baseline.json','utf8')),creds=JSON.parse(await readFile(dir+'/credentials.json','utf8'));
  assert.equal(hash(await readFile('.env')),b.envHash);
  // Preserve token/other config verbatim; migration secret only in private CLI environment.
  const lines=envBytes.toString('utf8').split(/\r?\n/);let replaced=false;
  const next=lines.filter(l=>!/^\s*(?:export\s+)?DIRECT_URL\s*=/.test(l)).map(l=>{if(/^\s*(?:export\s+)?DATABASE_URL\s*=/.test(l)){assert.ok(!replaced);replaced=true;return 'DATABASE_URL='+creds.DATABASE_URL;}return l;});assert.ok(replaced);
  const nextBytes=Buffer.from(next.join('\r\n'));const nextConfig=dotenv.parse(nextBytes);assert.equal(nextConfig.API_WRITE_TOKEN,oldConfig.API_WRITE_TOKEN);assert.equal(nextConfig.DATABASE_URL,creds.DATABASE_URL);assert.ok(!nextConfig.DIRECT_URL);
  await writeFile('.env',nextBytes);await writeFile(dir+'/env-updated-hash.json',JSON.stringify({sha256:hash(nextBytes)}));
  console.log('DATABASE_URL privada atualizada. DIRECT_URL fornecida somente ao processo CLI autorizado.');
 }else if(mode==='start'||mode==='start-rollback'){
  stage='inicializacao';const creds=JSON.parse(await readFile(dir+'/credentials.json','utf8'));const config=dotenv.parse(await readFile('.env'));const connection=creds.DATABASE_URL;assert.equal(config.DATABASE_URL,connection);
  let reachable=false;try{reachable=(await fetch('http://127.0.0.1:'+ (config.PORT||3000)+'/',{signal:AbortSignal.timeout(1000)})).ok;}catch{}assert.equal(reachable,false,'Porta em uso: identificar processo antes de parar');
  const env=runtimeEnv({...process.env,...config,DATABASE_URL:connection});
  const log=await open(dir+'/api-runtime.log','a');const child=spawn(process.execPath,['src/app.js'],{cwd:process.cwd(),env,detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});child.unref();await log.close();
  await writeFile(dir+'/api-pid.json',JSON.stringify({pid:child.pid,port:Number(config.PORT||3000),executable:process.execPath,scope:'Balsas Experience API'}));await writeFile('backups/servidor-local.pid',String(child.pid));
  let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:'+(config.PORT||3000)+'/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  console.log(JSON.stringify({apiStarted:true,pid:child.pid,port:Number(config.PORT||3000)}));
 }else if(mode==='verify'){
  stage='verificacao';const b=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
  const refresh=spawnSync('powershell.exe',['-NoProfile','-File','scripts/verify-prod-api-process.ps1'],{windowsHide:true,stdio:'ignore',timeout:15000});assert.equal(refresh.status,0);
  const roles=(await db.query(rolesSql)).rows,mainTables=await snapshot(db),meta=await metadata(db);
  const databaseAclOutsideMainUnchanged=JSON.stringify((await db.query("SELECT datname,datdba,datacl FROM pg_database WHERE datname<>'balsas_experience' ORDER BY datname")).rows)===JSON.stringify(b.databases.filter(x=>x.datname!=='balsas_experience'));
  const result={mainTables,mainDataUnchanged:JSON.stringify(mainTables)===JSON.stringify(b.mainTables),integrity:await integrity(),otherDatabasesUnchanged:JSON.stringify(await otherDatabases())===JSON.stringify(b.otherDatabases),existingRolesUnchanged:JSON.stringify(roles.filter(x=>!x.rolname.endsWith('_prod')))===JSON.stringify(b.roles),roles,mainMetadata:meta,sequences:await sequences(),hbaUnchangedSinceInstall:hash(await readFile(b.hbaPath))===b.hbaProposedHash,backupsUnchanged:true};
  for(const x of b.backupChecks)assert.equal(hash(await readFile(x.file)),x.sha256);
  result.databaseAclOutsideMainUnchanged=databaseAclOutsideMainUnchanged;assert.ok(databaseAclOutsideMainUnchanged);
  try{
   const processEvidence=JSON.parse((await readFile('docs/isolamento-principal-processo.json','utf8')).replace(/^\uFEFF/,''));
   const apiSessions=(await db.query('SELECT usename,datname,application_name,client_port FROM pg_stat_activity WHERE client_port=ANY($1::int[])',[processEvidence.databaseClientPorts])).rows;
   assert.equal(apiSessions.length,processEvidence.databaseClientPorts.length);
   assert.ok(apiSessions.every(x=>x.usename==='balsas_api_prod'&&x.datname==='balsas_experience'));
   result.apiProcessIdentity={pid:processEvidence.pid,sessions:apiSessions,exclusiveRoleConfirmed:true};
  }catch(e){if(e.code!=='ENOENT')throw e;}
  assert.ok(result.mainDataUnchanged&&result.otherDatabasesUnchanged&&result.existingRolesUnchanged&&result.hbaUnchangedSinceInstall);assert.ok(Object.values(result.integrity).every(x=>x===0));assert.ok(meta.objects.every(x=>x.owner==='balsas_migrate_prod'));
  await writeFile('docs/isolamento-principal-estado.json',JSON.stringify(result,null,2));console.log(JSON.stringify({mainDataUnchanged:result.mainDataUnchanged,otherDatabasesUnchanged:result.otherDatabasesUnchanged,existingRolesUnchanged:result.existingRolesUnchanged,integrity:result.integrity,backupsUnchanged:true}));
 }else if(mode==='rollback-check'){
  stage='ensaio-somente-leitura';await db.query('BEGIN READ ONLY');
  const b=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
  assert.deepEqual(await snapshot(db),b.mainTables);
  const admin=(await db.query('SELECT current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser')).rows[0];assert.equal(admin.superuser,true);
  const runtime=dotenv.parse(await readFile('.env'));assert.equal(new URL(runtime.DATABASE_URL).username,'balsas_api_prod');
  const sql=await readFile('docs/isolamento-principal-rollback-v2.sql','utf8');assert.ok(!/NOLOGIN|REVOKE|DROP\s|DELETE\s|UPDATE\s|INSERT\s/i.test(sql));
  await db.query('ROLLBACK');await writeFile('docs/admin-recuperacao-leitura.json',JSON.stringify({result:'APROVADO',readOnly:true,operatorRole:admin.current_user,protectedDataMatches:true,runtimeRetained:true,rollbackSqlNotExecuted:true},null,2));console.log('Recuperacao validada por leitura; nenhum SQL de rollback executado.');
 }else if(mode==='rollback'){
  stage='rollback';const b=JSON.parse(await readFile(dir+'/baseline.json','utf8'));assert.deepEqual(await snapshot(db),b.mainTables,'Nao restaurar sobre dados alterados');
  await db.query(await readFile('docs/isolamento-principal-rollback-v2.sql','utf8'));
  console.log('Rollback de propriedade aplicado com credencial vigente; runtime exclusivo e .env preservados. HBA mantido.');
 }else throw new Error('Modo invalido');
}catch(e){try{await db.query('ROLLBACK');}catch{}console.error('Interrompido; etapa:',stage,'codigo:',e.code||'PRECONDICAO');process.exitCode=1;}finally{await db.end();}
