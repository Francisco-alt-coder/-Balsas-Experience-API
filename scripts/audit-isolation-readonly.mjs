import { loadAdminConnection } from './lib/admin-credentials.mjs';
import {loadReadOnlyConnection,connectReadOnly} from './lib/readonly-credentials.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const config = dotenv.parse(await readFile('.env'));
const url = await loadReadOnlyConnection();
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/balsas_experience') throw new Error('Alvo fora do escopo');
const client = await connectReadOnly();
const report = { date:'2026-10-12', configuration:{host:url.hostname,port:url.port||'5432',database:url.pathname.slice(1),role:decodeURIComponent(url.username),directUrlDefined:!!config.DIRECT_URL}, queries:{}, backups:[] };
const queries = {
 server:`SELECT current_database() database,current_user role,version(),current_setting('transaction_read_only') readonly`,
 roles:`SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles ORDER BY rolname`,
 memberships:`SELECT r.rolname role,m.rolname member,a.admin_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member`,
 databases:`SELECT datname,pg_get_userbyid(datdba) owner,datacl FROM pg_database WHERE NOT datistemplate ORDER BY datname`,
 schemas:`SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'`,
 objects:`SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,c.relacl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relkind,c.relname`,
 extensions:`SELECT extname,extversion,pg_get_userbyid(extowner) owner FROM pg_extension`,
 defaults:`SELECT pg_get_userbyid(defaclrole) role,defaclnamespace::regnamespace::text schema,defaclobjtype,defaclacl FROM pg_default_acl`,
 functions:`SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
 dependencies:`SELECT d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid) object,pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) dependency FROM pg_depend d JOIN pg_class c ON d.objid=c.oid AND d.classid='pg_class'::regclass JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND d.deptype IN ('e','n','a') ORDER BY 2,3`,
 sessions:`SELECT datname,usename,application_name,client_addr::text,state,count(*)::int sessions FROM pg_stat_activity WHERE backend_type='client backend' GROUP BY 1,2,3,4,5 ORDER BY 1,2`,
 logging:`SELECT name,setting FROM pg_settings WHERE name IN ('log_statement','log_min_duration_statement','log_min_error_statement','password_encryption','listen_addresses','port')`,
 integrity:`SELECT (SELECT count(*) FROM atracoes a LEFT JOIN categorias c ON c.id=a."categoriaId" WHERE c.id IS NULL) orphan_categories,(SELECT count(*) FROM atracao_tags x LEFT JOIN atracoes a ON a.id=x."atracaoId" LEFT JOIN tags t ON t.id=x."tagId" WHERE a.id IS NULL OR t.id IS NULL) orphan_links,(SELECT count(*) FROM avaliacoes v LEFT JOIN atracoes a ON a.id=v."atracaoId" WHERE a.id IS NULL) orphan_reviews`
};
try {
 report.checkedUTC=new Date().toISOString();
 report.sessionVisibility='Não superusuário: campos de sessões de outros papéis podem ser ocultos; não é inventário completo de consumidores.';
 for (const [key,sql] of Object.entries(queries)) report.queries[key]=(await client.query(sql)).rows;
 const baseline=JSON.parse(await readFile('docs/backup-rotacao-verificado.json','utf8'));
 report.tables={};
 for(const [table,before] of Object.entries(baseline.databases[0].before)) {
  if(!/^[a-z_]+$/.test(table)) throw new Error('Tabela invalida');
  const rows=(await client.query(`SELECT * FROM "${table}" ORDER BY 1,2`)).rows;
  const hash=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  report.tables[table]={count:rows.length,sha256:hash,matchesBackup:hash===before.sha256&&rows.length===before.count};
  assert.ok(report.tables[table].matchesBackup,'Dados divergentes do baseline');
 }
 await client.query('ROLLBACK');
 report.hba={executed:false,reason:'Consulta administrativa separada; usar --with-admin-hba explicitamente.'};
 if(process.argv.includes('--with-admin-hba')){
  const admin=new pg.Client({connectionString:(await loadAdminConnection()).href,connectionTimeoutMillis:5000});
  try{await admin.connect();await admin.query('BEGIN READ ONLY');report.hba={executed:true,rules:(await admin.query('SELECT type,database,user_name,address,auth_method,error FROM pg_hba_file_rules ORDER BY rule_number')).rows};}finally{await admin.end().catch(()=>{});}
 }
 for(const item of baseline.databases) {
  const bytes=await readFile(item.file);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const catalog=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['--list',item.file],{windowsHide:true});
  report.backups.push({file:item.file,sha256:hash,matchesRecorded:hash===item.sha256,catalogReadable:catalog.status===0,hasTableData:catalog.stdout?.includes(Buffer.from('TABLE DATA'))===true});
  assert.ok(report.backups.at(-1).matchesRecorded&&report.backups.at(-1).catalogReadable&&report.backups.at(-1).hasTableData,'Backup não confere');
 }
 const originals=JSON.parse(await readFile('backups/originais.json','utf8'));
 report.originals={};
 for(const [table,snapshot] of Object.entries(originals)) report.originals[table]={count:snapshot.rows.length,selfHashMatches:createHash('sha256').update(JSON.stringify(snapshot.rows)).digest('hex')===snapshot.sha256};
 await writeFile('docs/isolamento-diagnostico.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} catch(error) { console.error('Diagnostico falhou; codigo:',error.code||'SEM_CODIGO');process.exitCode=1; }
finally { await client.end(); }
