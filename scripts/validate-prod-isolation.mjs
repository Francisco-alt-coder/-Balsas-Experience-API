import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const creds=JSON.parse(await readFile('backups/isolamento-principal/credentials.json','utf8'));
const baseline=JSON.parse(await readFile('backups/isolamento-principal/baseline.json','utf8'));
const checks=[],report={checks};
async function check(name,fn){try{await fn();checks.push({name,result:'APROVADO'});}catch(e){checks.push({name,result:'REPROVADO',code:e.code||'ASSERCAO'});throw e;}}
async function deny(c,sql){await c.query('BEGIN');try{let code;try{await c.query(sql);}catch(e){code=e.code;}assert.equal(code,'42501');}finally{await c.query('ROLLBACK');}}
function redact(s){for(const u of Object.values(creds)){s=s.replaceAll(u,'[URL PRIVADA]').replaceAll(decodeURIComponent(new URL(u).password),'[SEGREDO]');}return s.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');}
try{
 for(const [role,key]of [['balsas_api_prod','DATABASE_URL'],['balsas_migrate_prod','DIRECT_URL']]){
  const c=new pg.Client({connectionString:creds[key]});await c.connect();
  try{
   await check(role+' autenticação/identidade',async()=>{const r=(await c.query('SELECT current_user,current_database()')).rows[0];assert.equal(r.current_user,role);assert.equal(r.current_database,'balsas_experience');});
   await check(role+' sem atributos administrativos/membership',async()=>{const r=(await c.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(r).every(x=>x===false));assert.equal((await c.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows[0].n,0);});
   await check(role+' SET ROLE postgres negado',()=>deny(c,'SET ROLE postgres'));
   await check(role+' CREATE ROLE negado',()=>deny(c,'CREATE ROLE balsas_prod_denial_probe NOLOGIN'));
   await check(role+' SELECT autorizado',async()=>assert.equal((await c.query('SELECT count(*)::int n FROM atracoes')).rows[0].n,8));
   for(const host of ['127.0.0.1','[::1]'])for(const database of baseline.databases.map(x=>x.datname).filter(x=>x!=='balsas_experience'))await check(role+' HBA nega '+database+' '+host,async()=>{const u=new URL(creds[key]);u.hostname=host;u.pathname='/'+database;const x=new pg.Client({connectionString:u.href,connectionTimeoutMillis:3000});let code;try{await x.connect();}catch(e){code=e.code;}finally{await x.end();}assert.equal(code,'28000');});
   if(role==='balsas_api_prod'){
    const privileges=(await c.query("SELECT tablename,has_table_privilege(current_user,format('public.%I',tablename),'SELECT') read,has_table_privilege(current_user,format('public.%I',tablename),'INSERT') insert,has_table_privilege(current_user,format('public.%I',tablename),'UPDATE') update,has_table_privilege(current_user,format('public.%I',tablename),'DELETE') delete,has_table_privilege(current_user,format('public.%I',tablename),'TRUNCATE') truncate,has_table_privilege(current_user,format('public.%I',tablename),'REFERENCES') references,has_table_privilege(current_user,format('public.%I',tablename),'TRIGGER') trigger FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    report.apiPrivileges=privileges;
    await check('Grants API correspondem exatamente ao plano',async()=>{for(const p of privileges){assert.equal(p.truncate,false);assert.equal(p.references,false);assert.equal(p.trigger,false);assert.equal(p.read,p.tablename!=='_prisma_migrations');assert.equal(p.insert,p.tablename!=='_prisma_migrations');assert.equal(p.update,p.tablename==='atracoes');assert.equal(p.delete,['atracoes','atracao_tags'].includes(p.tablename));}assert.equal((await c.query("SELECT has_schema_privilege(current_user,'public','CREATE') allowed")).rows[0].allowed,false);});
    report.sequencePrivileges=(await c.query("SELECT sequencename,has_sequence_privilege(current_user,format('public.%I',sequencename),'USAGE') usage,has_sequence_privilege(current_user,format('public.%I',sequencename),'UPDATE') update FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows;
    await check('Sequências apenas USAGE',async()=>assert.ok(report.sequencePrivileges.every(x=>x.usage&&!x.update)));
    await check('Leitura de ledger de migrações negada',()=>deny(c,'SELECT * FROM public._prisma_migrations'));
    await check('CREATE no schema negado',()=>deny(c,'CREATE TABLE public.balsas_prod_denial_probe(id int)'));
    // No attempts to TRUNCATE/setval protected objects: catalog denial already proven.
   }else{
    report.migrationObjects=(await c.query("SELECT relname,relkind,pg_get_userbyid(relowner) owner FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows;
    await check('Propriedade/schema do migrador prevista, sem DDL de ensaio',async()=>{assert.ok(report.migrationObjects.every(x=>x.owner==='balsas_migrate_prod'));assert.equal((await c.query("SELECT has_schema_privilege(current_user,'public','CREATE') allowed")).rows[0].allowed,true);assert.equal((await c.query("SELECT pg_get_userbyid(datdba) owner FROM pg_database WHERE datname=current_database()")).rows[0].owner,'postgres');assert.equal((await c.query("SELECT pg_get_userbyid(nspowner) owner FROM pg_namespace WHERE nspname='public'")).rows[0].owner,'pg_database_owner');});
    await check('Checksums/estado das duas migrações',async()=>{const rows=(await c.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(rows.length,2);for(const r of rows){assert.ok(r.finished_at);assert.equal(r.rolled_back_at,null);assert.equal(createHash('sha256').update(await readFile('prisma/migrations/'+r.migration_name+'/migration.sql')).digest('hex'),r.checksum);}});
   }
  }finally{await c.end();}
 }
 const env={...process.env,DATABASE_URL:creds.DATABASE_URL,DIRECT_URL:creds.DIRECT_URL};
 for(const args of [['validate','--config','prisma7.config.ts'],['migrate','status','--config','prisma7.config.ts']])await check('Prisma '+args.slice(0,-2).join(' '),async()=>{const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{env,windowsHide:true,encoding:'utf8',timeout:30000});await writeFile('docs/isolamento-principal-prisma-'+args[0]+'.txt',redact((r.stdout||'')+(r.stderr||'')));assert.equal(r.status,0);});
}catch(e){process.exitCode=1;report.interrupted=true;report.errorCode=e.code||'ASSERCAO';}
await writeFile('docs/isolamento-principal-validacao.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:checks.filter(x=>x.result==='APROVADO').length,failed:checks.filter(x=>x.result==='REPROVADO'),interrupted:report.interrupted||false}));
