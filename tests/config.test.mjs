/** Testes automatizados de CORS e recusa de porta inválida. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { configurarCors } from '../src/middlewares/cors.js';
import http from 'node:http';

test('política CORS none permite cliente sem Origin e nega origem de navegador', async () => {
  const middleware=configurarCors({NODE_ENV:'production',CORS_ORIGINS:'none'});
  const server=http.createServer((req,res)=>middleware(req,res,error=>{
    res.statusCode=error?403:200;res.end(error?.code||'ok');
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const direct=await fetch(base);assert.equal(direct.status,200);assert.equal(direct.headers.get('access-control-allow-origin'),null);
    const browser=await fetch(base,{headers:{Origin:'https://browser-test.invalid'}});assert.equal(browser.status,403);assert.equal(await browser.text(),'CORS_ORIGIN_DENIED');
    const preflight=await fetch(base,{method:'OPTIONS',headers:{Origin:'https://browser-test.invalid','Access-Control-Request-Method':'POST'}});assert.equal(preflight.status,403);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('política CORS none não aceita mistura com origens nem torna configuração vazia válida', () => {
  for(const CORS_ORIGINS of ['', 'none,https://browser-test.invalid', 'NONE'])assert.throws(()=>configurarCors({NODE_ENV:'production',CORS_ORIGINS}));
});

test('produção exige origens e rejeita curingas, caminhos e credenciais', () => {
  for (const CORS_ORIGINS of ['', '*', 'https://site.test/path', 'https://user:pass@site.test']) {
    assert.throws(() => configurarCors({ NODE_ENV: 'production', CORS_ORIGINS }));
  }
  assert.equal(typeof configurarCors({ NODE_ENV: 'production', CORS_ORIGINS: 'https://site.test' }), 'function');
});

test('inicialização rejeita porta inválida antes de escutar', () => {
  const resultado = spawnSync(process.execPath, ['src/app.js'], {
    env: { ...process.env, PORT: '65536' }, encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.equal(resultado.status, 1);
  assert.match(resultado.stderr, /PORT deve ser um inteiro/);
  assert.doesNotMatch(resultado.stdout, /Servidor executando/);
});
