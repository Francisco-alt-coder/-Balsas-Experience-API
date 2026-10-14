import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import {createHash,randomUUID} from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {runtimeEnv} from './lib/runtime-env.mjs';
import {connectReadOnly} from './lib/readonly-credentials.mjs';
const config=dotenv.parse(await readFile('.env'));
const report={startedUTC:new Date().toISOString(),checks:[],startupCommand:'npm start',productionEnvironment:true,host:'0.0.0.0',platform:process.platform,shutdownValidation:'Evento SIGTERM local nas instâncias de teste; entrega de sinal Linux/Render ainda requer validação remota.'};
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
await mkdir('tmp',{recursive:true});const control=await mkdtemp(path.resolve('tmp/publicacao-lifecycle-'));
const children=[],sockets=new Set();let available=true;
const target=new URL(config.DATABASE_URL);
assert.equal(target.username,'balsas_api_prod');assert.equal(target.pathname,'/balsas_experience');assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname));
const proxy=net.createServer(socket=>{
 if(!available){socket.destroy();return;}
 const upstream=net.connect({host:target.hostname.replace(/^\[|\]$/g,''),port:Number(target.port||5432)});
 for(const s of [socket,upstream]){sockets.add(s);s.on('error',()=>{socket.destroy();upstream.destroy();});s.on('close',()=>{sockets.delete(s);if(s===socket)upstream.destroy();else socket.destroy();});}
 socket.pipe(upstream);upstream.pipe(socket);
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function check(name,fn){try{await fn();report.checks.push({name,result:'APROVADO'});}catch(e){process.exitCode=1;report.checks.push({name,result:'REPROVADO',code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'ASSERTION'});}}
async function start(port,url,extra={}){
 const stopFile=path.join(control,'stop-'+port);
 const env=runtimeEnv({...process.env,...config,NODE_ENV:'production',HOST:'0.0.0.0',PORT:String(port),DATABASE_URL:url,CORS_ORIGINS:'https://cliente.example.invalid',DB_CONNECTION_TIMEOUT_MS:'1000',DB_QUERY_TIMEOUT_MS:'2000',NODE_OPTIONS:'--import=./scripts/test-start-lifecycle.mjs',BALSAS_TEST_STOP_FILE:stopFile,...extra});
 const child=spawn(process.execPath,[npmCli,'start'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const record={child,port,stopFile,output:''};child.stdout.on('data',b=>{record.output+=b.toString();});child.stderr.on('data',()=>{});children.push(record);return record;
}
async function ready(record){for(let n=0;n<80;n++){assert.equal(record.child.exitCode,null);try{if((await fetch('http://127.0.0.1:'+record.port+'/live',{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await wait(100);}throw new Error('START_TIMEOUT');}
async function stop(record){if(record.child.exitCode===null){await writeFile(record.stopFile,'stop');for(let n=0;n<140&&record.child.exitCode===null;n++)await wait(100);assert.notEqual(record.child.exitCode,null,'Processo de teste não encerrou');}return record.child.exitCode;}
async function tables(c){const out={};for(const t of ['_prisma_migrations','atracao_tags','atracoes','avaliacoes','categorias','tags']){const rows=(await c.query(`SELECT * FROM "${t}" ORDER BY 1,2`)).rows;out[t]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}return out;}
let before;
try{
 const c=await connectReadOnly();try{before=await tables(c);}finally{await c.end();}
 const proxied=new URL(target);proxied.hostname='127.0.0.1';proxied.port=String(proxy.address().port);
 const healthy=await start(3210,proxied.href);await ready(healthy);
 const request=async(method,endpoint,body,headers={})=>fetch('http://127.0.0.1:3210'+endpoint,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 await check('npm start em produção com PORT fornecida e host 0.0.0.0',async()=>{assert.ok(healthy.output.includes('node src/app.js'));assert.ok(healthy.output.includes('Servidor executando na porta 3210'));assert.equal((await request('GET','/')).status,200);});
 await check('health disponível: SELECT 1 real e HTTP 200',async()=>{const r=await request('GET','/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok',banco:'conectado'});});
 await check('CORS origem exata permitida e preflight',async()=>{const r=await request('OPTIONS','/atracoes',undefined,{Origin:'https://cliente.example.invalid','Access-Control-Request-Method':'POST'});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://cliente.example.invalid');});
 await check('CORS proibida recebe 403',async()=>assert.equal((await request('GET','/atracoes',undefined,{Origin:'https://forbidden.invalid'})).status,403));
 await check('nosniff e ausência de x-powered-by',async()=>{const r=await request('GET','/');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-powered-by'),null);});
 await check('Bearer ausente/inválido e corpo inválido não escrevem',async()=>{assert.equal((await request('POST','/atracoes',{})).status,401);assert.equal((await request('POST','/atracoes',{}, {Authorization:'Bearer invalid'})).status,401);assert.equal((await request('POST','/atracoes',{}, {Authorization:'Bearer '+config.API_WRITE_TOKEN})).status,400);});
 await check('Limite JSON: 413, JSON inválido: 400',async()=>{const big=await request('POST','/atracoes',{descricao:'x'.repeat(110000)});assert.equal(big.status,413);const malformed=await fetch('http://127.0.0.1:3210/atracoes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'});assert.equal(malformed.status,400);});
 await check('Banco indisponível: health 500 sanitizado e live 200',async()=>{available=false;for(const s of sockets)s.destroy();const r=await request('GET','/health');assert.equal(r.status,500);assert.deepEqual(await r.json(),{erro:'Erro interno no servidor'});assert.equal((await request('GET','/live')).status,200);});
 await check('Mesmo processo recupera conexão e health volta a 200',async()=>{available=true;let status;for(let i=0;i<10;i++){status=(await request('GET','/health')).status;if(status===200)break;await wait(200);}assert.equal(status,200);assert.equal(healthy.child.exitCode,null);});
 await check('Endpoints de leitura principais retornam 200',async()=>{for(const endpoint of ['/atracoes','/categorias','/atracoes?q=rio','/atracoes?tag=cachoeira','/atracoes/1'])assert.equal((await request('GET',endpoint)).status,200);});
 const invalid=new URL(target);invalid.password='invalid-'+randomUUID();
 await check('Credencial inválida de teste produz 28P01',async()=>{const c=new pg.Client({connectionString:invalid.href,connectionTimeoutMillis:2000});let code;try{await c.connect();}catch(e){code=e.code;}finally{await c.end().catch(()=>{});}assert.equal(code,'28P01');});
 const bad=await start(3212,invalid.href);await ready(bad);
 await check('health com credencial inválida: 500 sanitizado, live 200',async()=>{const r=await fetch('http://127.0.0.1:3212/health',{signal:AbortSignal.timeout(10000)});assert.equal(r.status,500);assert.deepEqual(await r.json(),{erro:'Erro interno no servidor'});});
 const broken=await start(3213,target.href,{API_WRITE_TOKEN:'invalid'});
 await check('Falha de inicialização recusa serviço antes do listener',async()=>{for(let i=0;i<80&&broken.child.exitCode===null;i++)await wait(100);assert.ok(broken.child.exitCode!==null&&broken.child.exitCode!==0);await assert.rejects(fetch('http://127.0.0.1:3213/health',{signal:AbortSignal.timeout(1000)}));});
 await check('Handler de encerramento fecha instâncias temporárias com código 0',async()=>{assert.equal(await stop(healthy),0);assert.equal(await stop(bad),0);});
}catch(e){process.exitCode=1;report.checks.push({name:'Preparação da matriz',result:'REPROVADO',code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'ASSERTION'});}
finally{
 for(const child of children)try{await stop(child);}catch{process.exitCode=1;report.cleanupPending=true;}
 for(const s of sockets)s.destroy();await new Promise(resolve=>proxy.close(resolve));
 try{const c=await connectReadOnly();try{assert.deepEqual(await tables(c),before);report.mainTablesUnchanged=true;}finally{await c.end();}}catch(e){report.mainTablesUnchanged=false;process.exitCode=1;}
 report.finishedUTC=new Date().toISOString();await writeFile('backups/publicacao-production-matrix.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
