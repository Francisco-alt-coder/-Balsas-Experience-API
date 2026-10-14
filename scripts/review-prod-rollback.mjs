import { loadAdminConnection } from './lib/admin-credentials.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
const dir='backups/isolamento-principal';
const u=await loadAdminConnection({database:'balsas_lab08_test_1791812594215'});
const c=new pg.Client({connectionString:u.href});await c.connect();
const meta=async()=>({objects:(await c.query("SELECT relname,relowner,relacl FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows,roles:(await c.query("SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname IN ('balsas_api','balsas_migrate') ORDER BY rolname")).rows,schema:(await c.query("SELECT nspacl FROM pg_namespace WHERE nspname='public'")).rows,database:(await c.query("SELECT datacl FROM pg_database WHERE datname=current_database()")).rows});
try{
 const before=await meta();
 const rollback=await readFile('docs/isolamento-principal-rollback-v2.sql','utf8');
 const sql=rollback.replaceAll('balsas_experience','balsas_lab08_test_1791812594215').replaceAll('balsas_api_prod','balsas_api').replaceAll('balsas_migrate_prod','balsas_migrate').replace('COMMIT;','ROLLBACK;');
 if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES'){
  await c.query('BEGIN READ ONLY');assert.deepEqual(await meta(),before);await c.query('ROLLBACK');
  await writeFile('docs/admin-rollback-testes-leitura.json',JSON.stringify({readOnly:true,metadataUnchanged:true,rollbackSqlNotExecuted:true},null,2));
  console.log('Ensaio por leitura concluido; SQL de propriedade/grants nao executado.');
 }else{
 await c.query(sql);assert.deepEqual(await meta(),before);
 const b=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
 b.artifacts['isolamento-principal-rollback-v2.sql']=createHash('sha256').update(rollback).digest('hex');b.rollbackRehearsed=true;
 await writeFile(dir+'/baseline.json',JSON.stringify(b,null,2));
 await writeFile('docs/isolamento-principal-rollback-ensaio.json',JSON.stringify({result:'APROVADO',scope:'balsas_lab08_test_1791812594215',ownershipAndGrantsAndLoginStatementsAccepted:true,rolledBack:true,metadataAndRolesUnchanged:true},null,2));
 console.log('Rollback completo validado no teste em transacao revertida; objetos, grants e logins preservados.');
 }
}catch(e){await c.query('ROLLBACK');console.error('Revisao interrompida; codigo:',e.code||'ASSERCAO');process.exitCode=1;}finally{await c.end();}
