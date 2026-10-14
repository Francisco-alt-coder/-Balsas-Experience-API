import { loadAdminConnection } from './lib/admin-credentials.mjs';
import pg from 'pg';
import dotenv from 'dotenv';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const u=await loadAdminConnection({database:'balsas_lab08_test_1791812594215'});
const c=new pg.Client({connectionString:u.href});await c.connect();
const meta=async()=>(await c.query("SELECT relname,pg_get_userbyid(relowner) owner,relacl FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname")).rows;
try{
 const before=await meta();
 let sql=await readFile('docs/isolamento-rollback-proposto.sql','utf8');
 sql=sql.replaceAll('balsas_experience','balsas_lab08_test_1791812594215').replace('COMMIT;','ROLLBACK;');
 if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES'){
  await c.query('BEGIN READ ONLY');await c.query('SELECT current_user');await c.query('ROLLBACK');
  assert.deepEqual(await meta(),before);console.log('Ensaio de recuperacao por leitura aprovado; rollback SQL nao executado.');
 }else{
 await c.query(sql);
 assert.deepEqual(await meta(),before);
 assert.equal((await c.query('SELECT current_user')).rows[0].current_user,decodeURIComponent(u.username));
 await writeFile('docs/isolamento-rollback-ensaio.json',JSON.stringify({result:'APROVADO',scope:'balsas_lab08_test_1791812594215',ownershipStatementsAccepted:true,transactionRolledBack:true,metadataUnchanged:true,adminConnectionAvailable:true},null,2));
 console.log('Rollback de propriedade ensaiado em transacao revertida; metadados preservados.');
 }
}catch(e){await c.query('ROLLBACK');console.error('Ensaio interrompido; codigo:',e.code||'ASSERCAO');process.exitCode=1;}finally{await c.end();}
