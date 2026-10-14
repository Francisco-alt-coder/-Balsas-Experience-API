/** Testes automatizados de configuração do segredo e autenticação Bearer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validarTokenConfigurado, autenticarEscrita } from '../src/middlewares/autenticacao.js';
test('configuração recusa segredo ausente ou trivial', () => {
  for (const token of [undefined, '', 'token', 'a'.repeat(64), 'changeme'.repeat(8)]) assert.throws(() => validarTokenConfigurado({ API_WRITE_TOKEN: token }));
  assert.ok(validarTokenConfigurado({ API_WRITE_TOKEN: randomBytes(32).toString('hex') }));
});
test('Bearer compara credenciais de diferentes tamanhos sem falhar', () => {
  const anterior = process.env.API_WRITE_TOKEN;
  process.env.API_WRITE_TOKEN = randomBytes(32).toString('hex');
  try {
    for (const authorization of [undefined, 'Basic abc', 'Bearer x', 'Bearer ' + 'z'.repeat(200), 'Bearer ' + process.env.API_WRITE_TOKEN]) {
      let status, passou = false;
      const res = { status(n) { status=n; return this; }, set() { return this; }, json() {} };
      autenticarEscrita({ headers: { authorization } }, res, () => { passou=true; });
      assert.equal(passou, authorization === 'Bearer ' + process.env.API_WRITE_TOKEN);
      if (!passou) assert.equal(status,401);
    }
  } finally { if (anterior === undefined) delete process.env.API_WRITE_TOKEN; else process.env.API_WRITE_TOKEN=anterior; }
});
test('servidor não inicia sem API_WRITE_TOKEN', () => {
  const r=spawnSync(process.execPath,['src/app.js'],{ env: { ...process.env, PORT:'3198', API_WRITE_TOKEN:'' }, windowsHide:true, encoding:'utf8',timeout:10000 });
  assert.equal(r.status,1); assert.match(r.stderr,/API_WRITE_TOKEN/); assert.doesNotMatch(r.stdout,/Servidor executando/);
});
