import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const dir='backups/isolamento-testes';
const privateConfig=JSON.parse(await readFile(dir+'/credentials.json','utf8'));
const baseline=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
const checks=[];
const report={checks};
async function check(name,fn){try{await fn();checks.push({name,result:'APROVADO'});}catch(e){checks.push({name,result:'REPROVADO',code:e.code||'ASSERCAO'});throw e;}}
async function deny(c,sql){await c.query('BEGIN');try{let code;try{await c.query(sql);}catch(e){code=e.code;}assert.equal(code,'42501');}finally{await c.query('ROLLBACK');}}
function safeOutput(value){let s=value;for(const u of [privateConfig.DATABASE_URL,privateConfig.DIRECT_URL]){s=s.replaceAll(u,'[URL PRIVADA]');s=s.replaceAll(decodeURIComponent(new URL(u).password),'[SEGREDO]');}return s.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');}
try{
 for(const [role,key] of [['balsas_api','DATABASE_URL'],['balsas_migrate','DIRECT_URL']]){
  const c=new pg.Client({connectionString:privateConfig[key]});await c.connect();
  try{
   await check(role+' autenticação e identidade',async()=>{const r=(await c.query('SELECT current_user,current_database()')).rows[0];assert.equal(r.current_user,role);assert.equal(r.current_database,'balsas_lab08_test_1791812594215');});
   await check(role+' sem atributos administrativos',async()=>{const r=(await c.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(r).every(v=>v===false));assert.equal((await c.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows[0].n,0);});
   await check(role+' nega SET ROLE postgres',()=>deny(c,'SET ROLE postgres'));
   await check(role+' nega CREATE ROLE',()=>deny(c,'CREATE ROLE balsas_denial_probe NOLOGIN'));
   await check(role+' leitura autorizada',async()=>assert.equal((await c.query('SELECT count(*)::int n FROM atracoes')).rows[0].n,8));
   for(const host of ['127.0.0.1','[::1]']) for(const database of ['balsas_experience','postgres','balsas_rotation_verify_1791815689706']){
    await check(role+' HBA nega '+database+' '+host,async()=>{const u=new URL(privateConfig[key]);u.hostname=host;u.pathname='/'+database;const x=new pg.Client({connectionString:u.href,connectionTimeoutMillis:3000});let code;try{await x.connect();}catch(e){code=e.code;}finally{await x.end();}assert.equal(code,'28000');});
   }
   if(role==='balsas_api'){
    for(const [label,sql] of [['DDL','CREATE TABLE public.balsas_ddl_probe(id int)'],['TRUNCATE','TRUNCATE public.atracao_tags'],['migrações','SELECT * FROM public._prisma_migrations'],['setval',"SELECT setval('public.tags_id_seq',1)"],['DELETE tags','DELETE FROM public.tags WHERE false'],['UPDATE categorias',"UPDATE public.categorias SET nome=nome WHERE false"]]) await check('API nega '+label,()=>deny(c,sql));
    report.effectivePrivileges=(await c.query("SELECT tablename,has_table_privilege(current_user,format('public.%I',tablename),'SELECT') read,has_table_privilege(current_user,format('public.%I',tablename),'INSERT') insert,has_table_privilege(current_user,format('public.%I',tablename),'UPDATE') update,has_table_privilege(current_user,format('public.%I',tablename),'DELETE') delete,has_table_privilege(current_user,format('public.%I',tablename),'TRUNCATE') truncate FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
   }else{
    await check('Migrador CREATE/ALTER/DML com rollback',async()=>{await c.query('BEGIN');try{await c.query('CREATE TABLE public.balsas_ddl_probe(id integer PRIMARY KEY)');await c.query('ALTER TABLE public.balsas_ddl_probe ADD COLUMN note text');await c.query("INSERT INTO public.balsas_ddl_probe VALUES (1,'teste')");assert.equal((await c.query('SELECT count(*)::int n FROM public.balsas_ddl_probe')).rows[0].n,1);}finally{await c.query('ROLLBACK');}});
    await check('Checksums das duas migrações aplicadas',async()=>{const rows=(await c.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(rows.length,2);for(const r of rows){assert.ok(r.finished_at);assert.equal(r.rolled_back_at,null);assert.equal(createHash('sha256').update(await readFile('prisma/migrations/'+r.migration_name+'/migration.sql')).digest('hex'),r.checksum);}});
   }
  }finally{await c.end();}
 }
 const env={...process.env,DATABASE_URL:privateConfig.DATABASE_URL,API_WRITE_TOKEN:privateConfig.API_WRITE_TOKEN,DIRECT_URL:privateConfig.DIRECT_URL};
 for(const args of [['validate','--config','prisma7.config.ts'],['migrate','status','--config','prisma7.config.ts']]) await check('Prisma '+args.slice(0,-2).join(' '),async()=>{const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{env,windowsHide:true,encoding:'utf8',timeout:30000});await writeFile('docs/isolamento-prisma-'+args[0]+'.txt',safeOutput((r.stdout||'')+(r.stderr||'')));assert.equal(r.status,0);});
 report.baseline=baseline.test.tables;
}catch(e){process.exitCode=1;report.interrupted=true;report.errorCode=e.code||'ASSERCAO';}
await writeFile('docs/isolamento-testes-validacao.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({checks,interrupted:report.interrupted||false}));
