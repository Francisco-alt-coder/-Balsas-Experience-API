import {mkdir,mkdtemp,copyFile,cp,readFile,writeFile,realpath} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import path from 'node:path';
import {runtimeEnv} from './lib/runtime-env.mjs';
await mkdir('tmp',{recursive:true});const dir=await mkdtemp(path.resolve('tmp/publicacao-clean-'));
for(const f of ['package.json','package-lock.json','prisma7.config.ts'])await copyFile(f,path.join(dir,f));
for(const f of ['src','prisma','tests','scripts'])await cp(f,path.join(dir,f),{recursive:true});
const cfg=dotenv.parse(await readFile('.env'));const env=runtimeEnv({...process.env,...cfg,NODE_ENV:'production',CORS_ORIGINS:'https://cliente.example.invalid'});const results=[];
function redact(text){for(const value of [cfg.DATABASE_URL,cfg.API_WRITE_TOKEN,decodeURIComponent(new URL(cfg.DATABASE_URL).password)])if(value)text=text.replaceAll(value,'[SEGREDO]');return text.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');}
const npmCli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
for(const [name,args]of [['install',['ci','--include=dev','--cache',path.resolve('.npm-cache')]],['build',['run','build']],['schema',['exec','--','prisma','validate','--config','prisma7.config.ts']],['unitários',['test']],['prune-production',['prune','--omit=dev','--cache',path.resolve('.npm-cache')]],['production-dependencies',['ls','--omit=dev','--depth=0']]]){
 if(name==='prune-production'){const resolved=await realpath(dir);assert.equal(path.dirname(resolved),await realpath('tmp'));assert.ok(path.basename(resolved).startsWith('publicacao-clean-'));}
 const r=spawnSync(process.execPath,[npmCli,...args],{cwd:dir,env,windowsHide:true,encoding:'utf8',timeout:120000});results.push({name,exit:r.status,result:r.status===0?'APROVADO':'REPROVADO'});await writeFile('backups/publicacao-clean-'+name+'.txt',redact((r.stdout||'')+(r.stderr||'')));if(r.status!==0){process.exitCode=1;break;}
}
if(results.every(r=>r.exit===0)){
 const flag=path.join(dir,'stop-production');const child=spawn(process.execPath,[npmCli,'start'],{cwd:dir,env:{...env,PORT:'3240',HOST:'0.0.0.0',NODE_OPTIONS:'--import=./scripts/test-start-lifecycle.mjs',BALSAS_TEST_STOP_FILE:flag},windowsHide:true,stdio:'ignore'});
 let ok=false;try{for(let i=0;i<100;i++){assert.equal(child.exitCode,null);try{const r=await fetch('http://127.0.0.1:3240/health',{signal:AbortSignal.timeout(1000)});if(r.status===200&&(await r.json()).banco==='conectado'){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ok);}catch{process.exitCode=1;}finally{await writeFile(flag,'stop');for(let i=0;i<140&&child.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));if(child.exitCode!==0){ok=false;process.exitCode=1;}}
 results.push({name:'production-only-start-health-shutdown',exit:child.exitCode,result:ok?'APROVADO':'REPROVADO'});
}
await writeFile('backups/publicacao-clean-install.json',JSON.stringify({checkedUTC:new Date().toISOString(),isolatedDirectory:path.relative(process.cwd(),dir),results,noPrivateFilesCopied:true,productionEnvironment:true,platform:process.platform},null,2));console.log(JSON.stringify(results));
