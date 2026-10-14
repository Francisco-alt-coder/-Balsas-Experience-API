// Matriz autorizada: escritas das suítes restritas à base de testes existente.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import dotenv from 'dotenv';
const secrets=[];
for(const file of ['.env','backups/admin/credentials.json','backups/isolamento-principal/credentials.json','backups/isolamento-principal/env-original.private','backups/isolamento-testes/credentials.json']){
 const body=await readFile(file,'utf8');const cfg=file.endsWith('.json')?JSON.parse(body):dotenv.parse(body);
 for(const [key,value]of Object.entries(cfg)){if(key==='API_WRITE_TOKEN')secrets.push(value);if(key.endsWith('URL')){try{const u=new URL(value);secrets.push(value,u.password,decodeURIComponent(u.password));}catch{}}}
}
const sanitize=body=>{for(const secret of secrets.filter(s=>s&&s.length>=6))body=body.replaceAll(secret,'[SEGREDO]');return body.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g,'[URL PRIVADA]');};
const report={startedUTC:new Date().toISOString(),checks:[]};
// Resolve o CLI da instalação Node sem concatenação shell.
const locate=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','(Get-Command npm.cmd).Source'],{encoding:'utf8',windowsHide:true});
const npmRoot=locate.stdout.trim().replace(/npm\.cmd$/i,'node_modules/npm/bin/npm-cli.js');
const commands=[
 ['unitarios',['--test','tests/auth.test.mjs','tests/config.test.mjs','tests/controllers.test.mjs','tests/health.test.mjs','tests/runtime-env.test.mjs','tests/readonly-credentials.test.mjs','tests/rotation-operation.test.mjs','tests/production-database.test.mjs']],
 ['sintaxe',[npmRoot,'run','check']],['build',[npmRoot,'run','build']],['npm-audit',[npmRoot,'audit','--include=dev','--json','--cache','.npm-cache']],
 ['integracao-lab08',['scripts/run-isolated-suites.mjs']],['powershell',['scripts/run-isolated-suites.mjs','powershell']],
 ['admin-online',['scripts/test-admin-auth-readonly.mjs']],['admin-offline',['scripts/test-admin-config-offline.mjs']],
 ['rollback-leitura',['scripts/review-prod-rollback.mjs']],['recuperacao-leitura',['scripts/isolation-prod-control.mjs','rollback-check']],
 ['prisma-status',['scripts/prisma-prod-readonly.mjs','status']],['prisma-validate',['scripts/prisma-prod-readonly.mjs','validate']],
 ['auditoria-minimo-privilegio',['scripts/audit-isolation-readonly.mjs']],['hba-administrativo',['scripts/audit-isolation-readonly.mjs','--with-admin-hba']],
 ['publicacao-arquivos',['scripts/check-publication-files.mjs']]
];
for(const [name,args]of commands){const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});await writeFile('backups/security-check-'+name+'.txt',sanitize((r.stdout||'')+(r.stderr||'')));report.checks.push({name,exitCode:r.status,result:r.status===0?'APROVADO':'REPROVADO',errorCode:r.error?.code||null});console.log(name+': '+report.checks.at(-1).result);if(r.status!==0)process.exitCode=1;}
report.finishedUTC=new Date().toISOString();await writeFile('backups/security-final-checks.json',JSON.stringify(report,null,2));
