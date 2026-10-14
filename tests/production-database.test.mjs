/** Testes automatizados de configuração PostgreSQL e exigência de TLS remoto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {configurarBanco} from '../src/lib/database-config.js';
test('produção remota exige verificação TLS e preserva URL pooled/direta',()=>{
 const u=new URL('postgresql://ep-demo-pooler.example.invalid/balsas');u.username='balsas_api_prod';u.password='fixture-only';
 for(const mode of ['', 'require','disable','no-verify']){u.search=mode?'sslmode='+mode:'';assert.throws(()=>configurarBanco({NODE_ENV:'production',DATABASE_URL:u.href}),/sslmode=verify-full/);}
 u.search='sslmode=verify-full';const config=configurarBanco({NODE_ENV:'production',DATABASE_URL:u.href});const c=new pg.Client(config);assert.equal(c.host,'ep-demo-pooler.example.invalid');assert.ok(c.ssl);assert.notEqual(c.ssl.rejectUnauthorized,false);
 u.hostname='ep-demo.example.invalid';assert.equal(new pg.Client(configurarBanco({NODE_ENV:'production',DATABASE_URL:u.href})).host,'ep-demo.example.invalid');
});
test('parâmetros não sobrescrevem identidade/TLS e erros não refletem segredo',()=>{
 const u=new URL('postgresql://127.0.0.1/balsas');u.username='runtime';u.password='sentinel-not-for-output';
 for(const query of ['host=remote.invalid','sslmode=verify-full&sslmode=disable','sslcert=C:/private','ssl=0','channel_binding=require']){u.search=query;try{configurarBanco({DATABASE_URL:u.href});assert.fail();}catch(e){assert.ok(!e.message.includes(u.password));assert.match(e.message,/parâmetro/);}}
});
