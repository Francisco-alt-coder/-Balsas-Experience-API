/** Testes automatizados de health, liveness e erros com banco simulado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {criarHealthCheck,liveness} from '../src/controllers/health.controller.js';
import {erroSanitizado} from '../src/lib/safe-error.js';
import {configurarBanco} from '../src/lib/database-config.js';
async function serve(prisma,fn){const app=express();app.get('/health',criarHealthCheck(prisma));app.get('/live',liveness);app.use((e,req,res,next)=>res.status(500).json({erro:'Erro interno no servidor'}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('health HTTP saudável consulta cliente simulado e mantém contrato',async()=>{let count=0;await serve({$queryRaw:async(strings)=>{assert.equal(strings[0],'SELECT 1');count++;return [{value:1}];}},async base=>{const r=await fetch(base+'/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok',banco:'conectado'});});assert.equal(count,1);});
test('falha de conexão retorna 500 sanitizado e live permanece 200',async()=>{const secret='private-sentinel-secret';await serve({$queryRaw:async()=>{throw Object.assign(new Error(secret),{code:'ECONNRESET'});}},async base=>{const r=await fetch(base+'/health');assert.equal(r.status,500);const body=await r.text();assert.ok(!body.includes(secret));assert.deepEqual(JSON.parse(body),{erro:'Erro interno no servidor'});assert.equal((await fetch(base+'/live')).status,200);});});
test('logs rejeitam nomes e códigos contendo payload/segredo',()=>{assert.deepEqual(erroSanitizado({name:'Error secret://value',code:'secret-value'}),{tipo:'Error',codigo:undefined});assert.deepEqual(erroSanitizado({name:'Error',code:'ECONNRESET'}),{tipo:'Error',codigo:'ECONNRESET'});});
test('configuração PG limita pool/timeouts e recusa URL sem exibir entrada',()=>{const env={DATABASE_URL:'postgresql://dummy:dummy@127.0.0.1/test'};assert.equal(configurarBanco(env).max,10);for(const field of ['DB_POOL_MAX','DB_QUERY_TIMEOUT_MS','DB_CONNECTION_TIMEOUT_MS'])assert.throws(()=>configurarBanco({...env,[field]:'-1'}));try{configurarBanco({DATABASE_URL:'private-secret-invalid'});assert.fail();}catch(e){assert.ok(!e.message.includes('private-secret-invalid'));}});
