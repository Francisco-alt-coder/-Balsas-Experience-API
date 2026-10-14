/** Testes automatizados de identidades de auditoria e isolamento de credenciais. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadReadOnlyConnection} from '../scripts/lib/readonly-credentials.mjs';
import {nativeAdminEnv,loadAdminConnection} from '../scripts/lib/admin-credentials.mjs';
import {spawnSync} from 'node:child_process';
const supplied=(role='balsas_migrate_prod',database='balsas_experience')=>{const u=new URL('postgresql://127.0.0.1:5432');u.username=role;u.password='fixture-sentinel';u.pathname='/'+database;return {BALSAS_READONLY_DATABASE_URL:u.href};};
test('auditoria aceita migrador existente e rejeita admin/runtime/base incorreta',async()=>{
 const u=await loadReadOnlyConnection({env:supplied()});assert.equal(u.username,'balsas_migrate_prod');
 for(const role of ['postgres','balsas_api_prod','balsas_migrate'])await assert.rejects(loadReadOnlyConnection({env:supplied(role)}),e=>e.code==='READONLY_IDENTITY_REJECTED');
 await assert.rejects(loadReadOnlyConnection({env:supplied('balsas_migrate_prod','balsas_lab08_test_123')}),e=>e.code==='READONLY_IDENTITY_REJECTED');
 assert.equal((await loadReadOnlyConnection({scope:'test',env:supplied('balsas_migrate','balsas_lab08_test_123')})).username,'balsas_migrate');
});
test('auditoria recusa fonte ausente/inválida sem fallback administrativo',async()=>{
 await assert.rejects(loadReadOnlyConnection({env:{BALSAS_READONLY_CREDENTIAL_FILE:'backups/no-audit-source.json',BALSAS_ADMIN_DATABASE_URL:supplied().BALSAS_READONLY_DATABASE_URL}}),e=>e.code==='ADMIN_FILE_MISSING');
 await assert.rejects(loadReadOnlyConnection({env:{BALSAS_READONLY_DATABASE_URL:'secret-sentinel'}}),e=>e.code==='ADMIN_URL_INVALID'&&!e.message.includes('secret-sentinel'));
 await assert.rejects(loadReadOnlyConnection({env:{BALSAS_READONLY_DATABASE_URL:''}}),e=>e.code==='READONLY_SOURCE_MISSING');
});
test('bootstrap recusa origem histórica e não imprime entrada inválida',()=>{
 const a=spawnSync(process.execPath,['scripts/bootstrap-admin-private.mjs','--from-existing-authorized'],{encoding:'utf8',windowsHide:true});assert.equal(a.status,1);assert.match(a.stderr,/ADMIN_PROVISION_EXPLICIT_SOURCE_REQUIRED/);
 const sentinel='credential-sentinel-not-for-output';const b=spawnSync(process.execPath,['scripts/bootstrap-admin-private.mjs','--from-runtime-authorized'],{encoding:'utf8',windowsHide:true,env:{...process.env,BALSAS_ADMIN_DATABASE_URL:sentinel}});assert.equal(b.status,1);assert.ok(!((b.stdout||'')+(b.stderr||'')).includes(sentinel));
});
test('ambiente libpq não propaga credenciais antigas/novas ou aliases',()=>{
 const u=new URL(supplied().BALSAS_READONLY_DATABASE_URL);
 const env=nativeAdminEnv(u,{PATH:'retained',DATABASE_URL:'runtime',DIRECT_URL:'migrate',OLD_DATABASE_URL:'old',NEW_DATABASE_URL:'new',BALSAS_ADMIN_PGPASSFILE:'file',BALSAS_READONLY_DATABASE_URL:'audit',PGPASSFILE:'other',PGSERVICE:'service',TEST_FIXTURE_DATABASE_URL:'fixture'});
 assert.deepEqual(env,{PATH:'retained',PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'balsas_migrate_prod',PGPASSWORD:'fixture-sentinel',PGDATABASE:'balsas_experience'});
});
test('parâmetros URI não podem substituir destino, identidade ou arquivos SSL',async()=>{
 for(const query of ['host=remote.invalid','%68ost=remote.invalid','user=postgres','password=fixture','port=6543','database=postgres','sslcert=other-file','options=unsafe','application_name=a&application_name=b']){
  const cfg=supplied();cfg.BALSAS_READONLY_DATABASE_URL+='?'+query;
  await assert.rejects(loadReadOnlyConnection({env:cfg}),e=>e.code==='ADMIN_PARAMETER_REJECTED');
  await assert.rejects(loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:cfg.BALSAS_READONLY_DATABASE_URL}}),e=>e.code==='ADMIN_PARAMETER_REJECTED');
 }
 const cfg=supplied();cfg.BALSAS_READONLY_DATABASE_URL+='?schema=public&sslmode=disable&connect_timeout=3';assert.equal((await loadReadOnlyConnection({env:cfg})).username,'balsas_migrate_prod');
 const env=nativeAdminEnv(new URL(supplied().BALSAS_READONLY_DATABASE_URL),{old_database_url:'old',balsas_admin_database_url:'admin',pghostaddr:'remote',pgoptions:'unsafe',PATH:'retained'});assert.equal(env.old_database_url,undefined);assert.equal(env.balsas_admin_database_url,undefined);assert.equal(env.pghostaddr,undefined);assert.equal(env.pgoptions,undefined);assert.equal(env.PATH,'retained');
});
