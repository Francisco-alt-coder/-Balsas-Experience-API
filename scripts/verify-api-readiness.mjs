/** Executa suítes existentes apenas no banco local isolado e preserva evidências anteriores. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {spawnSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {connectReadOnly,loadReadOnlyConnection} from './lib/readonly-credentials.mjs';
import {loadTestConfig} from './test-config.mjs';
import {runtimeEnv} from './lib/runtime-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const directory = path.join(root, 'backups/neon/readiness-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
await mkdir(directory, {recursive:true});
const report = {startedUTC:new Date().toISOString(), platform:process.platform, node:process.version, checks:[], suites:[], reportDirectory:path.relative(root,directory)};
const hash = value => createHash('sha256').update(value).digest('hex');
const tables = ['_prisma_migrations','atracao_tags','atracoes','avaliacoes','categorias','tags'];
const safeCode = error => /^[A-Z0-9_]{1,60}$/.test(error?.code || '') ? error.code : 'CHECK_FAILED';
let beforeMain, beforeTest, originalEnvHash;
let config;
let preservationFailed=false;
let smokeAttempt=0;
async function snapshot(scope) {
  const client = await connectReadOnly({scope});
  try {
    const result = {};
    for (const table of tables) {
      const rows = (await client.query(`SELECT * FROM public."${table}" ORDER BY 1,2`)).rows;
      result[table] = {count:rows.length, sha256:hash(JSON.stringify(rows))};
    }
    return result;
  } finally {await client.end();}
}
async function check(name, fn) {
  try {await fn(); report.checks.push({name, status:'APROVADO'}); console.log(name + ': APROVADO'); return true;}
  catch(error) {report.checks.push({name, status:'REPROVADO', code:safeCode(error)}); process.exitCode=1; console.log(name + ': REPROVADO (' + safeCode(error) + ')'); return false;}
}
function sanitize(value) {
  let result = value;
  for (const key of ['DATABASE_URL','TEST_FIXTURE_DATABASE_URL','DIRECT_URL','API_WRITE_TOKEN']) {
    const secret = config?.[key];
    if (!secret) continue;
    result = result.replaceAll(secret, '[SEGREDO]');
    if (key.endsWith('URL')) {const password = decodeURIComponent(new URL(secret).password); if(password) result=result.replaceAll(password,'[SEGREDO]');}
  }
  return result.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, '[URL PRIVADA]');
}
async function run(name,args,env) {
  const result = spawnSync(process.execPath,args,{cwd:root, env,windowsHide:true,encoding:'utf8',timeout:120000});
  const output = sanitize((result.stdout||'')+(result.stderr||''));
  await writeFile(path.join(directory,name+'.txt'),output);
  if (result.error || result.signal || result.status !== 0) throw Object.assign(new Error(),{code:'SUITE_FAILED'});
  return output;
}
async function sourceFiles(directoryName) {
  const result = [];
  for (const entry of await readdir(path.join(root,directoryName),{withFileTypes:true})) {
    const relative = path.join(directoryName,entry.name);
    if(entry.isDirectory()) result.push(...await sourceFiles(relative));
    else if(/\.(js|mjs)$/.test(entry.name)) result.push(relative);
  }
  return result;
}
async function smoke(env,forceFailure=false,corsPolicy='https://readiness.invalid') {
  const reservation=net.createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const attempt=++smokeAttempt;
  const stopFile=path.join(directory,'stop-smoke-'+attempt+'-'+port);
  const pidFile=path.join(directory,'smoke-api-'+attempt+'-'+port+'.pid');
  const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const child=spawn(process.execPath,[npmCli,'start'],{cwd:root,env:{...env,NODE_ENV:'production',PORT:String(port),HOST:'0.0.0.0',CORS_ORIGINS:corsPolicy,NODE_OPTIONS:'--import='+new URL('./test-start-lifecycle.mjs',import.meta.url).href,BALSAS_TEST_STOP_FILE:stopFile,BALSAS_TEST_PID_FILE:pidFile},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let spawnError;child.on('error',error=>{spawnError=error;});
  let output=''; child.stdout.on('data',chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{output+=chunk;});
  const base='http://127.0.0.1:'+port;
  try {
    let ready=false;
    for(let i=0;i<100;i++) {
      assert.equal(child.exitCode,null);
      if(spawnError)throw spawnError;
      try {ready=(await fetch(base+'/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{}
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready);
    if(forceFailure)throw Object.assign(new Error(),{code:'EXPECTED_SMOKE_FAILURE'});
    for(const endpoint of ['/','/health','/live','/atracoes','/categorias']) assert.equal((await fetch(base+endpoint,{signal:AbortSignal.timeout(5000)})).status,200);
    const allowed=await fetch(base+'/atracoes',{method:'OPTIONS',headers:{Origin:'https://readiness.invalid','Access-Control-Request-Method':'POST'}});
    assert.equal(allowed.status,corsPolicy==='none'?403:204); assert.equal(allowed.headers.get('access-control-allow-origin'),corsPolicy==='none'?null:'https://readiness.invalid');
    assert.equal((await fetch(base+'/',{headers:{Origin:'https://denied.invalid'}})).status,403);
    assert.equal((await fetch(base+'/atracoes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    assert.ok(output.includes('node src/app.js'));
    await writeFile(stopFile,'stop');
    for(let i=0;i<150&&child.exitCode===null;i++)await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(child.exitCode,0);
  } finally {
    // Também solicite parada se alguma asserção falhar antes do caminho normal.
    await writeFile(stopFile,'stop');
    for(let i=0;i<150&&child.exitCode===null&&!spawnError;i++)await new Promise(resolve=>setTimeout(resolve,100));
    let apiPid;
    try {const value=(await readFile(pidFile,'utf8')).trim();if(/^\d+$/.test(value))apiPid=Number(value);}catch{}
    if(apiPid&&apiPid>0&&apiPid!==process.pid) {
      try {process.kill(apiPid,0);process.kill(apiPid);report.smokeForcedCleanup=true;}catch{}
    }
    if(child.exitCode===null&&child.pid) {
      if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      else child.kill();
      report.smokeForcedCleanup=true;
    }
    let stopped=false;
    for(let i=0;i<20;i++) {
      try {await fetch(base+'/live',{signal:AbortSignal.timeout(500)});}catch {stopped=true;break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    report.smokeCleanupConfirmed=stopped;
    await writeFile(path.join(directory,'production-isolated-smoke.txt'),sanitize(output));
    if(!stopped)throw Object.assign(new Error(),{code:'SMOKE_CLEANUP_FAILED'});
  }
}

try {
  process.env.TEST_ENV_PATH ||= 'backups/isolamento-testes/fixture-env.json';
  config=await loadTestConfig();
  const url=new URL(config.DATABASE_URL), fixture=new URL(config.TEST_FIXTURE_DATABASE_URL||config.DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  assert.match(url.pathname,/^\/balsas_lab08_test_\d+$/);
  assert.equal(fixture.host,url.host);assert.equal(fixture.pathname,url.pathname);
  assert.ok(config.API_WRITE_TOKEN);
  const auditUrl=await loadReadOnlyConnection({scope:'test'});
  if(auditUrl.host!==url.host||auditUrl.pathname!==url.pathname)throw Object.assign(new Error(),{code:'READINESS_SNAPSHOT_TARGET_MISMATCH'});
  originalEnvHash=hash(await readFile('.env'));
  beforeMain=await snapshot('production');beforeTest=await snapshot('test');
  report.beforeCounts={main:Object.fromEntries(tables.map(t=>[t,beforeMain[t].count])),test:Object.fromEntries(tables.map(t=>[t,beforeTest[t].count]))};
  console.log('Preflight: loopback, banco isolado e snapshots somente leitura confirmados.');
  const env=runtimeEnv({...process.env,DATABASE_URL:config.DATABASE_URL,API_WRITE_TOKEN:config.API_WRITE_TOKEN,TEST_ENV_PATH:process.env.TEST_ENV_PATH,TEST_REPORT_PATH:path.join(directory,'integration.json'),LAB08_REPORT_PATH:path.join(directory,'lab08.json'),POWERSHELL_REPORT_PATH:path.join(directory,'powershell.txt')});
  delete env.DIRECT_URL;delete env.TEST_FIXTURE_DATABASE_URL;delete env.NODE_OPTIONS;
  if(process.argv.includes('--smoke-cleanup-regression')) {
    await check('Limpeza após falha forçada do servidor temporário',async()=>{
      await assert.rejects(smoke(env,true),error=>error.code==='EXPECTED_SMOKE_FAILURE');
      assert.equal(report.smokeCleanupConfirmed,true);
    });
  } else {
  if(!process.argv.includes('--smoke-only')) {
  await check('Sintaxe JavaScript',async()=>{const files=[...await sourceFiles('src'),...await sourceFiles('scripts'),...await sourceFiles('tests'),'prisma/seed.js'];for(const file of files)await run('syntax-'+file.replace(/[^a-z0-9]/gi,'-'),['--check',file],env);report.syntaxFiles=files.length;});
  await check('Prisma validate',()=>run('prisma-validate',['node_modules/prisma/build/index.js','validate','--config','prisma7.config.ts'],env));
  await check('Build Prisma Client',()=>run('build',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'run','build'],env));
  await check('npm run check',()=>run('check',[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'run','check'],env));
  for(const [name,args,file] of [
    ['unitarios',['--test',... (await readdir('tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f)],null],
    ['integracao',['scripts/test-integration.mjs'],'integration.json'],
    ['lab08',['scripts/test-lab08.mjs'],'lab08.json'],
    ['powershell',['scripts/test-powershell-isolated.mjs'],null],
  ]) {
    const passed=await check('Suíte '+name,async()=>{
      const output=await run(name,args,env);
      let total,approved;
      if(file) {const data=JSON.parse(await readFile(path.join(directory,file),'utf8'));total=data.total;approved=data.aprovados??data.contagens?.APROVADO;assert.equal(approved,total);}
      else if(name==='unitarios') {total=Number(output.match(/(?:ℹ|#) tests (\d+)/)?.[1]);approved=Number(output.match(/(?:ℹ|#) pass (\d+)/)?.[1]);assert.ok(total);assert.equal(approved,total);}
      else {assert.match(output,/30 aprovados, zero falhas/);total=approved=30;}
      report.suites.push({name,total,approved,failed:0});
    });
    if(!passed)report.suites.push({name,status:'REPROVADO'});
    const intact=await check('Preservação após '+name,async()=>{assert.deepEqual(await snapshot('production'),beforeMain);assert.deepEqual(await snapshot('test'),beforeTest);assert.equal(hash(await readFile('.env')),originalEnvHash);});
    if(!intact){preservationFailed=true;break;}
  }
  }
  if(!preservationFailed){
    await check('npm start em produção no banco isolado, PORT, health, CORS, Bearer e encerramento',()=>smoke(env));
    await check('npm start em produção com CORS none e banco isolado',()=>smoke(env,false,'none'));
  }
  }
} catch(error) {report.preflightFailure=safeCode(error);process.exitCode=1;console.log('Preparação: '+safeCode(error));}
finally {
  if(beforeMain)await check('Banco principal preservado',async()=>assert.deepEqual(await snapshot('production'),beforeMain));
  if(beforeTest)await check('Dados do banco isolado preservados',async()=>assert.deepEqual(await snapshot('test'),beforeTest));
  if(originalEnvHash)await check('.env preservado',async()=>assert.equal(hash(await readFile('.env')),originalEnvHash));
  report.totalTests=report.suites.reduce((total,suite)=>total+(suite.total||0),0);
  report.finishedUTC=new Date().toISOString();
  await writeFile(path.join(directory,'summary.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
