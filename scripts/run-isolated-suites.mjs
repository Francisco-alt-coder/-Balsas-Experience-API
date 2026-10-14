/** Orquestra suítes isoladas e compara contagens, hashes e integridade dos vínculos após cada execução. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {runtimeEnv} from './lib/runtime-env.mjs';
const creds=JSON.parse(await readFile('backups/isolamento-testes/credentials.json','utf8'));
const baseline=JSON.parse(await readFile('backups/isolamento-testes/baseline.json','utf8'));
const env=runtimeEnv({...process.env,DATABASE_URL:creds.DATABASE_URL,API_WRITE_TOKEN:creds.API_WRITE_TOKEN,TEST_ENV_PATH:'backups/isolamento-testes/fixture-env.json'});
delete env.DIRECT_URL;delete env.TEST_FIXTURE_DATABASE_URL;
const c=new pg.Client({connectionString:creds.DIRECT_URL});await c.connect();
const results=process.argv[2]==='powershell'?JSON.parse(await readFile('docs/isolamento-suites.json','utf8')):[];
const hash=s=>createHash('sha256').update(s).digest('hex');
async function verify(){for(const [t,s] of Object.entries(baseline.test.tables)){const rows=(await c.query(`SELECT * FROM public."${t}" ORDER BY 1,2`)).rows;assert.equal(rows.length,s.count,t);assert.equal(hash(JSON.stringify(rows)),s.sha256,t);}const r=(await c.query(`SELECT
 (SELECT count(*)::int FROM atracoes a LEFT JOIN categorias c ON c.id=a."categoriaId" WHERE c.id IS NULL) categories,
 (SELECT count(*)::int FROM atracao_tags x LEFT JOIN atracoes a ON a.id=x."atracaoId" LEFT JOIN tags t ON t.id=x."tagId" WHERE a.id IS NULL OR t.id IS NULL) links,
 (SELECT count(*)::int FROM avaliacoes v LEFT JOIN atracoes a ON a.id=v."atracaoId" WHERE a.id IS NULL) reviews`)).rows[0];assert.ok(Object.values(r).every(x=>x===0));}
function sanitize(s){for(const u of [creds.DATABASE_URL,creds.DIRECT_URL]){s=s.replaceAll(u,'[URL PRIVADA]').replaceAll(decodeURIComponent(new URL(u).password),'[SEGREDO]');}return s.replaceAll(creds.API_WRITE_TOKEN,'[TOKEN]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');}
try{
 await verify();
 const suites=process.argv[2]==='powershell'?[['powershell',['scripts/test-powershell-isolated.mjs']]]:[['unitarios',['--test','tests/auth.test.mjs','tests/config.test.mjs','tests/controllers.test.mjs']],['sintaxe',['--check','src/app.js']],['integracao',['scripts/test-integration.mjs']],['lab08',['scripts/test-lab08.mjs']]];
 for(const [name,args] of suites){
  const r=spawnSync(process.execPath,args,{env,windowsHide:true,encoding:'utf8',timeout:90000});
  await writeFile('docs/isolamento-suite-'+name+'.txt',sanitize((r.stdout||'')+(r.stderr||'')));
  results.push({suite:name,exitCode:r.status});assert.equal(r.status,0,name);
  await verify();results.at(-1).sixTableHashesUnchanged=true;
  console.log(name+': aprovado; hashes das seis tabelas preservados.');
 }
 // Confirmar identidade de uma instancia real da API, sem DIRECT_URL ou segredo de fixtures.
 const server=spawn(process.execPath,['src/app.js'],{env:{...env,PORT:'3199',HOST:'127.0.0.1'},windowsHide:true,stdio:'ignore'});
 try{
  let ready=false;
  for(let i=0;i<80;i++){assert.equal(server.exitCode,null);try{ready=(await fetch('http://127.0.0.1:3199/health',{signal:AbortSignal.timeout(2000)})).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  const sessions=(await c.query("SELECT usename,datname,application_name FROM pg_stat_activity WHERE application_name='balsas-api-isolation-test' AND pid<>pg_backend_pid()")).rows;
  assert.ok(sessions.length>0);assert.ok(sessions.every(s=>s.usename==='balsas_api'&&s.datname==='balsas_lab08_test_1791812594215'));
  results.push({suite:'identidade-api-real',exitCode:0,sessions});
 }finally{server.kill();}
 await verify();
}catch(e){process.exitCode=1;results.push({interrupted:true,code:e.code||'ASSERCAO'});}
finally{await c.end();await writeFile('docs/isolamento-suites.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
