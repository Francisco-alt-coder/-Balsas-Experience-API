import { loadAdminConnection } from './lib/admin-credentials.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomBytes,pbkdf2Sync,createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const mode=process.argv[2];
let stage='conexao';
const dir='backups/isolamento-testes';
const tables=['_prisma_migrations','atracao_tags','atracoes','avaliacoes','categorias','tags'];
const config=dotenv.parse(await readFile('.env'));
const original=JSON.parse(await readFile('backups/test-env.json','utf8'));
const main=await loadAdminConnection();
const test=new URL(original.DATABASE_URL);
assert.equal(main.pathname,'/balsas_experience');
assert.equal(test.pathname,'/balsas_lab08_test_1791812594215');
assert.equal(main.hostname,test.hostname);
assert.ok(['localhost','127.0.0.1','[::1]'].includes(main.hostname));
const adminUrl=new URL(main);adminUrl.pathname=test.pathname;
const db=new pg.Client({connectionString:adminUrl.href,connectionTimeoutMillis:5000});
const hash=b=>createHash('sha256').update(b).digest('hex');
async function snapshot(c) {
 const result={};
 for(const table of tables){const rows=(await c.query(`SELECT * FROM public."${table}" ORDER BY 1,2`)).rows;result[table]={count:rows.length,sha256:hash(JSON.stringify(rows))};}
 return result;
}
async function metadata(c){return {
 schemas:(await c.query("SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl FROM pg_namespace WHERE nspname='public'")).rows,
 objects:(await c.query("SELECT relname,relkind,pg_get_userbyid(relowner) owner,relacl FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows,
 database:(await c.query('SELECT datname,datdba,datacl FROM pg_database ORDER BY datname')).rows
};}
async function mainSnapshot(){const c=new pg.Client({connectionString:main.href});await c.connect();try{await c.query('BEGIN READ ONLY');const m=await metadata(c);m.database=m.database.filter(x=>x.datname!==test.pathname.slice(1));return {tables:await snapshot(c),metadata:m};}finally{await c.query('ROLLBACK');await c.end();}}
try{
 await db.connect();
 if(mode==='preflight'){
  await mkdir(dir,{recursive:true});
  stage='artefatos-e-backups';
  const artifacts={};
  for(const f of ['plano-isolamento-postgresql.md','isolamento-proposto.sql','isolamento-rollback-proposto.sql','isolamento-diagnostico.json']) artifacts[f]=hash(await readFile('docs/'+f));
  const backups=JSON.parse(await readFile('docs/backup-rotacao-verificado.json','utf8'));
  const verified=[];
  for(const b of backups.databases){assert.equal(hash(await readFile(b.file)),b.sha256);const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',b.file],{windowsHide:true});assert.equal(r.status,0);assert.ok(r.stdout.includes(Buffer.from('TABLE DATA')));verified.push({file:b.file,sha256:b.sha256,catalogReadable:true});}
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN ('balsas_api','balsas_migrate')")).rows[0].n,0);
  const settings=(await db.query("SELECT name,setting FROM pg_settings WHERE name IN ('hba_file','log_statement','log_min_duration_statement','log_duration','log_min_error_statement','shared_preload_libraries','session_preload_libraries','local_preload_libraries')")).rows;
  const hbaPath=settings.find(x=>x.name==='hba_file').setting;
  stage='leitura-hba';
  const hba=await readFile(hbaPath);
  const block=`# BEGIN BALSAS TEST ISOLATION\r\nhost ${test.pathname.slice(1)} balsas_api,balsas_migrate 127.0.0.1/32 scram-sha-256\r\nhost ${test.pathname.slice(1)} balsas_api,balsas_migrate ::1/128 scram-sha-256\r\nhost all balsas_api,balsas_migrate 0.0.0.0/0 reject\r\nhost all balsas_api,balsas_migrate ::0/0 reject\r\nlocal ${test.pathname.slice(1)} balsas_api,balsas_migrate scram-sha-256\r\nlocal all balsas_api,balsas_migrate reject\r\n# END BALSAS TEST ISOLATION\r\n`;
  assert.ok(!hba.toString().includes('BALSAS TEST ISOLATION'));
  await writeFile(dir+'/hba-original.conf',hba,{flag:'wx'});
  await writeFile(dir+'/hba-proposed.conf',Buffer.concat([Buffer.from(block),hba]),{flag:'wx'});
  const baseline={artifacts,backups:verified,settings,hbaPath,hbaHash:hash(hba),hbaProposedHash:hash(Buffer.concat([Buffer.from(block),hba])),main:await mainSnapshot(),test:{tables:await snapshot(db),metadata:await metadata(db)},postgres:(await db.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='postgres'")).rows};
  assert.deepEqual(baseline.test.tables,backups.databases[1].before);
  await writeFile(dir+'/test-env-original.json',await readFile('backups/test-env.json'),{flag:'wx'});
  await writeFile(dir+'/baseline.json',JSON.stringify(baseline,null,2));
  console.log(JSON.stringify({preflight:'APROVADO',hbaPath,backups:verified,testTables:baseline.test.tables}));
 }else if(mode==='apply'){
  const baseline=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
  baseline.main.metadata.database=baseline.main.metadata.database.filter(x=>x.datname!==test.pathname.slice(1));
  assert.equal(hash(await readFile(baseline.hbaPath)),baseline.hbaProposedHash,'HBA restritivo precisa estar instalado antes de LOGIN');
  assert.deepEqual(await snapshot(db),baseline.test.tables);
  assert.deepEqual(await mainSnapshot(),baseline.main);
  assert.equal((await db.query('SELECT count(*)::int n FROM pg_hba_file_rules WHERE error IS NOT NULL')).rows[0].n,0);
  const settings=Object.fromEntries((await db.query("SELECT name,setting FROM pg_settings WHERE name IN ('shared_preload_libraries','session_preload_libraries','local_preload_libraries')")).rows.map(x=>[x.name,x.setting]));
  assert.ok(Object.values(settings).every(x=>x===''),'Logging extensivel requer revisao');
  // Session-only logging suppression; verifier is generated in memory, never recorded.
  await db.query("SET log_statement='none'");await db.query("SET log_min_duration_statement=-1");await db.query("SET log_duration=off");await db.query("SET log_min_error_statement='panic'");
  function verifier(password){const salt=randomBytes(16);const salted=pbkdf2Sync(password,salt,4096,32,'sha256');const clientKey=createHmac('sha256',salted).update('Client Key').digest();const stored=createHash('sha256').update(clientKey).digest('base64');const server=createHmac('sha256',salted).update('Server Key').digest('base64');return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;}
  const privateConfig={API_WRITE_TOKEN:original.API_WRITE_TOKEN};
  for(const [role,key] of [['balsas_api','DATABASE_URL'],['balsas_migrate','DIRECT_URL']]){const u=new URL(adminUrl);u.username=role;u.password=randomBytes(48).toString('base64url');u.searchParams.set('application_name',role==='balsas_api'?'balsas-api-isolation-test':'balsas-migrate-isolation-test');privateConfig[key]=u.href;}
  await writeFile(dir+'/credentials.json',JSON.stringify(privateConfig),{flag:'wx',mode:0o600});
  await db.query('BEGIN');
  try{
   await db.query("SET LOCAL lock_timeout='3s'");
   for(const [role,key] of [['balsas_api','DATABASE_URL'],['balsas_migrate','DIRECT_URL']]) await db.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${verifier(decodeURIComponent(new URL(privateConfig[key]).password))}'`);
   let sql=await readFile('docs/isolamento-proposto.sql','utf8');
   sql=sql.slice(sql.indexOf('GRANT CONNECT'),sql.lastIndexOf('COMMIT;')).replaceAll('balsas_experience',test.pathname.slice(1));
   await db.query(sql);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
  await writeFile('backups/test-env.json',JSON.stringify({DATABASE_URL:privateConfig.DATABASE_URL,API_WRITE_TOKEN:original.API_WRITE_TOKEN}));
  await writeFile(dir+'/fixture-env.json',JSON.stringify({DATABASE_URL:privateConfig.DATABASE_URL,TEST_FIXTURE_DATABASE_URL:privateConfig.DIRECT_URL,API_WRITE_TOKEN:original.API_WRITE_TOKEN}));
  console.log('Papéis criados; grants e propriedade aplicados somente no banco de testes. Segredos privados, sem saída.');
 }else if(mode==='verify'){
  const baseline=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
  baseline.main.metadata.database=baseline.main.metadata.database.filter(x=>x.datname!==test.pathname.slice(1));
  const result={mainUnchanged:JSON.stringify(await mainSnapshot())===JSON.stringify(baseline.main),testTables:await snapshot(db),testMetadata:await metadata(db),roles:(await db.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('postgres','balsas_api','balsas_migrate') ORDER BY rolname")).rows};
  result.testDataUnchanged=JSON.stringify(result.testTables)===JSON.stringify(baseline.test.tables);
  result.postgresAttributesUnchanged=JSON.stringify(result.roles.filter(x=>x.rolname==='postgres'))===JSON.stringify(baseline.postgres);
  result.backupHashesUnchanged=true;
  for(const b of baseline.backups) assert.equal(hash(await readFile(b.file)),b.sha256);
  result.hbaBlockAndOriginalRulesUnchanged=hash(await readFile(baseline.hbaPath))===baseline.hbaProposedHash;
  await writeFile('docs/isolamento-testes-estado.json',JSON.stringify(result,null,2));
  assert.ok(result.mainUnchanged);assert.ok(result.testDataUnchanged);assert.ok(result.postgresAttributesUnchanged);assert.ok(result.hbaBlockAndOriginalRulesUnchanged);
  console.log(JSON.stringify({mainUnchanged:result.mainUnchanged,testDataUnchanged:result.testDataUnchanged,postgresAttributesUnchanged:result.postgresAttributesUnchanged,backupHashesUnchanged:result.backupHashesUnchanged,hbaBlockAndOriginalRulesUnchanged:result.hbaBlockAndOriginalRulesUnchanged,roles:result.roles}));
 }else throw new Error('Modo invalido');
}catch(e){console.error('Operação interrompida; etapa:',stage,'código:',e.code||'PRECONDICAO');process.exitCode=1;}finally{await db.end();}
