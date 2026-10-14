/** Testes automatizados de remoção de variáveis administrativas e carregamento de dotenv. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeEnv} from '../scripts/lib/runtime-env.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('processo API recebe somente identidade runtime, sem segredos administrativos',()=>{const source={DATABASE_URL:'runtime',API_WRITE_TOKEN:'bearer',DIRECT_URL:'migration',BALSAS_ADMIN_DATABASE_URL:'admin',BALSAS_ADMIN_CREDENTIAL_FILE:'adminfile',BALSAS_ADMIN_PGPASSFILE:'adminpass',BALSAS_READONLY_DATABASE_URL:'audit',BALSAS_MIGRATION_DATABASE_URL:'migration2',OLD_DATABASE_URL:'exposed-sentinel',NEW_DATABASE_URL:'fresh-sentinel',PGPASSWORD:'password',PGPASSFILE:'passfile',TEST_FIXTURE_DATABASE_URL:'fixture',PORT:'3000'};const sanitized=runtimeEnv(source);assert.deepEqual(sanitized,{DATABASE_URL:'runtime',API_WRITE_TOKEN:'bearer',PORT:'3000'});assert.equal(source.DIRECT_URL,'migration');});
test('variantes de capitalização são removidas',()=>{assert.deepEqual(runtimeEnv({old_database_url:'old',New_Database_Url:'new',balsas_admin_database_url:'admin',pGpaSsWoRd:'pass',DATABASE_URL:'runtime'}),{DATABASE_URL:'runtime'});});
test('bootstrap da API sanitiza aliases após dotenv carregar o arquivo',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'balsas-runtime-env-'));
 try{
  await writeFile(path.join(dir,'.env'),'OLD_DATABASE_URL=old-fixture\nnew_database_url=new-fixture\nDIRECT_URL=migrate-fixture\nbalsas_admin_database_url=admin-fixture\nAPI_WRITE_TOKEN=runtime-fixture\n');
  const moduleURL=new URL('../src/lib/load-runtime-env.js',import.meta.url).href;
  const code=`await import(${JSON.stringify(moduleURL)}); const forbidden=Object.keys(process.env).filter(k=>/^(?:OLD_DATABASE_URL|NEW_DATABASE_URL|DIRECT_URL|BALSAS_ADMIN_)/i.test(k)); if(forbidden.length||process.env.API_WRITE_TOKEN!=='runtime-fixture')process.exit(1);`;
  const env=runtimeEnv(process.env);delete env.API_WRITE_TOKEN;
  const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,env,encoding:'utf8',windowsHide:true});assert.equal(r.status,0);
 }finally{const resolved=path.resolve(dir);if(path.dirname(resolved)!==path.resolve(tmpdir())||!path.basename(resolved).startsWith('balsas-runtime-env-'))throw new Error('Limpeza fora do diretório temporário autorizado');await rm(resolved,{recursive:true,force:true});}
});
