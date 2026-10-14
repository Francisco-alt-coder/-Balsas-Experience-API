import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {runtimeEnv} from './lib/runtime-env.mjs';
import {loadTestConfig} from './test-config.mjs';
const config = await loadTestConfig();
const url = new URL(config.DATABASE_URL);
const fixtureUrl = new URL(config.TEST_FIXTURE_DATABASE_URL || config.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Banco de testes deve usar loopback');
assert.match(url.pathname, /^\/balsas_lab08_test_\d+$/, 'Banco isolado obrigatório');
assert.equal(fixtureUrl.host, url.host, 'Fixture de outro host');
assert.equal(fixtureUrl.pathname, url.pathname, 'Fixture de outro banco');
const env = runtimeEnv({ ...process.env, ...config, PORT: '3197', HOST: '127.0.0.1', TEST_API_URL: 'http://127.0.0.1:3197' });
const server = spawn(process.execPath, ['src/app.js'], { env, windowsHide: true, stdio: 'ignore' });
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    assert.equal(server.exitCode, null, 'Servidor encerrou');
    try { ready = (await fetch(env.TEST_API_URL + '/health')).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, 'Servidor não ficou saudável');
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/test-api.ps1'], { env, windowsHide: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', () => {});
  const code = await new Promise(resolve => child.on('close', resolve));
  await writeFile(process.env.POWERSHELL_REPORT_PATH || 'docs/powershell-publicacao.txt', output);
  assert.equal(code, 0);
  assert.match(output, /APROVADO: 30/);
  assert.match(output, /REPROVADO: 0/);
  assert.match(output, /TOTAL: 30/);
  console.log('PowerShell isolado: 30 aprovados, zero falhas');
} finally { server.kill(); }
