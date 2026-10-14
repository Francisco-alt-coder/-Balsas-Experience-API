import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import {loadAdminConnection,nativeAdminEnv} from './lib/admin-credentials.mjs';
const checks=[];async function check(name,fn){try{await fn();checks.push({name,result:'APROVADO'});}catch(e){checks.push({name,result:'REPROVADO',code:e.code||'ASSERCAO'});throw e;}}
const rejects=async(env,code)=>assert.rejects(loadAdminConnection({env}),e=>e.code===code);
try{
 const u=await loadAdminConnection();
 await check('Arquivo privado protegido e alvo local',async()=>{assert.equal(u.pathname,'/balsas_experience');assert.ok(u.password);});
 await check('Credencial ausente rejeitada',()=>rejects({BALSAS_ADMIN_CREDENTIAL_FILE:'backups/admin/missing.json'},'ADMIN_FILE_MISSING'));
 await check('URL invalida sem fallback',()=>rejects({BALSAS_ADMIN_DATABASE_URL:'invalid-secret-sentinel'},'ADMIN_URL_INVALID'));
 await check('Servidor remoto rejeitado',()=>rejects({BALSAS_ADMIN_DATABASE_URL:'postgresql://operator:dummy@remote.invalid:5432/balsas_experience'},'ADMIN_TARGET_REJECTED'));
 const noPassword=new URL(u);noPassword.password='';
 await check('Senha ausente sem pgpass rejeitada',()=>rejects({BALSAS_ADMIN_DATABASE_URL:noPassword.href},'ADMIN_PASSWORD_MISSING'));
 await writeFile('backups/admin/test-malformed.json','{ invalid');
 await check('JSON privado invalido rejeitado',()=>rejects({BALSAS_ADMIN_CREDENTIAL_FILE:'backups/admin/test-malformed.json'},'ADMIN_FILE_FORMAT'));
 await check('Variavel efemera prioritaria',async()=>assert.equal((await loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:u.href,BALSAS_ADMIN_CREDENTIAL_FILE:'missing'}})).password,u.password));
 await check('Conexao administrativa READ ONLY',async()=>{const c=new pg.Client({connectionString:u.href});await c.connect();try{await c.query('BEGIN READ ONLY');const r=(await c.query("SELECT current_user,current_database(),current_setting('transaction_read_only') readonly,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser")).rows[0];assert.equal(r.current_user,decodeURIComponent(u.username));assert.equal(r.readonly,'on');assert.equal(r.superuser,true);}finally{await c.end();}});
 await check('Senha invalida retorna 28P01 sem mensagem sensivel',async()=>{const bad=new URL(u);bad.password='invalid-'+Date.now();const c=new pg.Client({connectionString:bad.href,connectionTimeoutMillis:3000});let code;try{await c.connect();}catch(e){code=e.code;}finally{await c.end().catch(()=>{});}assert.equal(code,'28P01');});
 const escape=s=>s.replaceAll('\\','\\\\').replaceAll(':','\\:');
 const passfile=path.resolve('backups/admin/test-pgpass.conf');
 const fixturePassword='fictional-pgpass-fixture';
 await writeFile(passfile,[u.hostname,u.port||'5432',u.pathname.slice(1),decodeURIComponent(u.username),fixturePassword].map(escape).join(':')+'\n',{mode:0o600});
 await check('Pgpass privado Windows resolvido com fixture ficticia',async()=>assert.equal(decodeURIComponent((await loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:noPassword.href,BALSAS_ADMIN_PGPASSFILE:passfile}})).password),fixturePassword));
 const unmatched=new URL(noPassword);unmatched.pathname='/balsas_rotation_verify_1';
 await check('Pgpass sem entrada correspondente rejeitado',()=>rejects({BALSAS_ADMIN_DATABASE_URL:unmatched.href,BALSAS_ADMIN_PGPASSFILE:passfile},'ADMIN_PASSFILE_NO_MATCH'));
 await check('psql PostgreSQL18 com fonte vigente em memoria, sem senha em argv/arquivo novo',async()=>{const env=nativeAdminEnv(u);const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-tAc','SELECT current_user'],{env,windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(r.status,0);assert.equal(r.stdout.trim(),decodeURIComponent(u.username));});
 const badAcl=path.resolve('backups/admin/test-insecure.json');await writeFile(badAcl,'{}');
 if(process.platform==='win32')await check('ACL ampla recusada (fixture sem segredo)',async()=>{const r=spawnSync('icacls.exe',[badAcl,'/grant','*S-1-1-0:R'],{windowsHide:true,stdio:'ignore'});assert.equal(r.status,0);await rejects({BALSAS_ADMIN_CREDENTIAL_FILE:badAcl},'ADMIN_FILE_ACL');});
 await check('Falha CLI nao divulga valor da variavel',async()=>{const sentinel='ADMIN_SENTINEL_DO_NOT_PRINT';const r=spawnSync(process.execPath,['scripts/isolation-prod-control.mjs','rollback-check'],{env:{...process.env,BALSAS_ADMIN_DATABASE_URL:sentinel},windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(r.status,1);assert.ok(!((r.stdout||'')+(r.stderr||'')).includes(sentinel));assert.match(r.stderr,/ADMIN_URL_INVALID/);});
 const secrets=[decodeURIComponent(u.password)];for(const file of ['.env','backups/isolamento-principal/env-original.private','backups/isolamento-principal/credentials.json','backups/isolamento-testes/credentials.json']){const body=await readFile(file,'utf8');const cfg=file.endsWith('.json')?JSON.parse(body):dotenv.parse(body);for(const [k,v]of Object.entries(cfg)){if(k==='API_WRITE_TOKEN')secrets.push(v);if(/URL$/.test(k)){try{secrets.push(decodeURIComponent(new URL(v).password));}catch{}}}}
 let tracked=[];const git=spawnSync('git',['-c','safe.directory='+process.cwd(),'ls-files','-z'],{encoding:'utf8',windowsHide:true});assert.equal(git.status,0);tracked=git.stdout.split('\0').filter(Boolean);
 const hits=[];for(const file of tracked){const body=await readFile(file,'utf8');if(secrets.some(s=>s&&s.length>=8&&body.includes(s)))hits.push(file);}
 await check('Arquivos rastreados sem segredos reais conhecidos',async()=>assert.equal(hits.length,0));
 const candidateHits=[];for(const dir of ['src','scripts','prisma','tests','docs']){async function walk(base){for(const e of await readdir(base,{withFileTypes:true})){const file=path.join(base,e.name);if(e.isDirectory())await walk(file);else if(/\.(?:mjs|js|ts|py|ps1|json|md|txt|prisma|sql)$/.test(e.name)){const body=await readFile(file,'utf8');if(secrets.some(s=>s&&s.length>=8&&(body.includes(s)||body.includes(encodeURIComponent(s)))))candidateHits.push(file);}}}await walk(dir);}
 await check('Codigo e testes sem segredos reais conhecidos',async()=>assert.equal(candidateHits.length,0));
 await writeFile('docs/admin-segredos-verificados.json',JSON.stringify({trackedFiles:tracked.length,trackedHits:hits,sourceHits:candidateHits,limitation:'Busca por segredos conhecidos; nao cobre credenciais desconhecidas/historico remoto.'},null,2));
}catch(e){process.exitCode=1;checks.push({interrupted:true,code:e.code||'ASSERCAO'});}
finally{for(const file of ['backups/admin/test-malformed.json','backups/admin/test-pgpass.conf','backups/admin/test-insecure.json'])try{await unlink(file);}catch(e){if(e.code!=='ENOENT')process.exitCode=1;}}
await writeFile('docs/admin-autenticacao-testes.json',JSON.stringify({readOnlyDatabase:true,checks},null,2));console.log(JSON.stringify(checks));
