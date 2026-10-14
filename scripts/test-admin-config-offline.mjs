/** Verifica configuração privada e exposição de segredos conhecidos sem conectar ao banco. */
import {loadAdminConnection} from './lib/admin-credentials.mjs';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import dotenv from 'dotenv';
import path from 'node:path';
import assert from 'node:assert/strict';
const checks=[];async function check(name,fn){await fn();checks.push({name,result:'APROVADO'});}
try{
 const current=await loadAdminConnection();await check('Fonte privada atual/ACL/Git',async()=>assert.equal(current.pathname,'/balsas_experience'));
 await check('Novo valor do operador prevalece sem copia historica',async()=>{const supplied=new URL(current);supplied.password='future-value-validation-only';const loaded=await loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:supplied.href}});assert.equal(decodeURIComponent(loaded.password),'future-value-validation-only');});
 await check('Falta de fonte administrativa nao usa .env runtime',async()=>assert.rejects(loadAdminConnection({env:{BALSAS_ADMIN_CREDENTIAL_FILE:'backups/admin/not-configured.json'}}),e=>e.code==='ADMIN_FILE_MISSING'));
 const secrets=[];for(const file of ['.env','backups/admin/credentials.json','backups/isolamento-principal/env-original.private','backups/isolamento-principal/credentials.json','backups/isolamento-testes/credentials.json']){const b=await readFile(file,'utf8');const cfg=file.endsWith('.json')?JSON.parse(b):dotenv.parse(b);for(const [k,v]of Object.entries(cfg)){if(k==='API_WRITE_TOKEN')secrets.push(v);if(k.endsWith('URL')){try{const u=new URL(v);secrets.push(v,u.password,decodeURIComponent(u.password));}catch{}}}}
 const hits=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())await walk(f);else if(/\.(?:js|mjs|ts|py|ps1|sql|md|txt|json|prisma)$/.test(f)){const body=await readFile(f,'utf8');if(secrets.some(s=>s&&s.length>=8&&body.includes(s)))hits.push(f);}}}
 for(const d of ['src','scripts','prisma','tests','docs'])await walk(d);
 await check('Fontes e evidencias sem credenciais reais conhecidas',async()=>assert.equal(hits.length,0));
 const r=spawnSync('git',['-c','safe.directory='+process.cwd(),'ls-files','-z'],{windowsHide:true,encoding:'utf8'});assert.equal(r.status,0);const tracked=r.stdout.split('\0').filter(Boolean);for(const f of tracked){const b=await readFile(f,'utf8');assert.ok(!secrets.some(s=>s&&s.length>=8&&b.includes(s)));}
 await check('Arquivos rastreados inspecionados',async()=>assert.equal(r.status,0));
 await writeFile('docs/admin-config-offline.json',JSON.stringify({checks,trackedFiles:tracked.length,hits,databaseConnections:0,limitations:'Busca por segredos conhecidos de pelo menos oito caracteres; nao e auditoria completa do historico.'},null,2));
}catch(e){process.exitCode=1;checks.push({result:'REPROVADO',code:e.code||'ASSERCAO'});}
console.log(JSON.stringify(checks));
