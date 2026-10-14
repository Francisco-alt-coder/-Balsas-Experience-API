import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile, unlink, rmdir} from 'node:fs/promises';
import path from 'node:path';
import {loadTestConfig} from '../scripts/test-config.mjs';

const tempRoot = path.resolve('tmp');

function mockUrl({hostname = '127.0.0.1', port = '5432', database = 'balsas_lab08_test_123', role = 'runtime_mock', protocol = 'postgresql:', parameters = []} = {}) {
 const url = new URL(protocol + '//' + hostname);
 url.port = port;
 url.pathname = '/' + database;
 url.username = role;
 url.password = 'fixture_mock_only';
 for (const [key, value] of parameters) url.searchParams.append(key, value);
 return url.href;
}

async function withConfig(config, run, fallback) {
 await mkdir(tempRoot, {recursive: true});
 const dir = await mkdtemp(path.join(tempRoot, 'test-config-'));
 const files = [];
 const directories = [];
 const configFile = path.join(dir, 'config.json');
 const previousCwd = process.cwd();
 try {
  files.push(configFile);
  await writeFile(configFile, typeof config === 'string' ? config : JSON.stringify(config));
  if (fallback) {
   const backupDir = path.join(dir, 'backups');
   const fixtureDir = path.join(backupDir, 'isolamento-testes');
   await mkdir(backupDir); directories.push(backupDir);
   await mkdir(fixtureDir); directories.push(fixtureDir);
   const fixtureFile = path.join(fixtureDir, 'fixture-env.json');
   files.push(fixtureFile);
   await writeFile(fixtureFile, JSON.stringify(fallback));
   process.chdir(dir);
  }
  return await run({env: {TEST_ENV_PATH: configFile}});
 } finally {
  process.chdir(previousCwd);
  for (const file of files.reverse()) await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  for (const directory of directories.reverse()) await rmdir(directory);
  await rmdir(dir);
 }
}

async function rejectConfig(config, code, fallback) {
 await withConfig(config, options => assert.rejects(loadTestConfig(options), error => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.ok(!error.message.includes('fixture_mock_only'));
  assert.ok(!Object.hasOwn(error, 'input'));
  return true;
 }), fallback);
}

test('configuração aceita banco local isolado e fixture correspondente', async () => {
 const config = {DATABASE_URL: mockUrl({parameters: [['schema', 'public'], ['application_name', 'mock_test']]}), TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'fixture_mock'}), API_WRITE_TOKEN: 'mock_only'};
 await withConfig(config, async options => {
  const loaded = await loadTestConfig(options);
  assert.ok(loaded.DATABASE_URL === config.DATABASE_URL);
  assert.ok(loaded.TEST_FIXTURE_DATABASE_URL === config.TEST_FIXTURE_DATABASE_URL);
  assert.equal(loaded.API_WRITE_TOKEN, 'mock_only');
 });
});

test('runtime recusa parâmetros capazes de sobrescrever conexão ou TLS', async () => {
 for (const key of ['host', 'port', 'user', 'password', 'database', 'options', 'ssl', 'sslrootcert', 'uselibpqcompat']) {
  await rejectConfig({DATABASE_URL: mockUrl({parameters: [[key, 'mock_only']]})}, 'TEST_CONFIG_PARAMETERS_REJECTED');
 }
});

test('runtime recusa parâmetros permitidos quando duplicados', async () => {
 for (const key of ['schema', 'sslmode', 'application_name', 'connect_timeout']) {
  await rejectConfig({DATABASE_URL: mockUrl({parameters: [[key, 'mock_only'], [key, 'mock_only']]})}, 'TEST_CONFIG_PARAMETERS_REJECTED');
 }
});

test('runtime recusa destino remoto, produção, nomes fora do padrão e protocolo inválido', async () => {
 await rejectConfig({DATABASE_URL: mockUrl({hostname: 'remote.invalid'})}, 'TEST_CONFIG_HOST_REJECTED');
 for (const database of ['balsas_experience', 'balsas_lab08_test_prod', 'balsas_lab08_test_123/other', 'balsas_lab08_test_123_extra']) {
  await rejectConfig({DATABASE_URL: mockUrl({database})}, 'TEST_CONFIG_DATABASE_REJECTED');
 }
 await rejectConfig({DATABASE_URL: mockUrl({protocol: 'https:'})}, 'TEST_CONFIG_PROTOCOL_REJECTED');
});

test('fixture explícita recusa host, porta ou banco divergentes', async () => {
 for (const changes of [{hostname: 'localhost'}, {port: '5433'}, {database: 'balsas_lab08_test_456'}]) {
  await rejectConfig({DATABASE_URL: mockUrl(), TEST_FIXTURE_DATABASE_URL: mockUrl(changes)}, 'TEST_CONFIG_FIXTURE_IDENTITY_MISMATCH');
 }
});

test('fixture explícita também recusa override de host e destino remoto', async () => {
 await rejectConfig({DATABASE_URL: mockUrl(), TEST_FIXTURE_DATABASE_URL: mockUrl({parameters: [['host', 'remote.invalid']]})}, 'TEST_CONFIG_PARAMETERS_REJECTED');
 await rejectConfig({DATABASE_URL: mockUrl(), TEST_FIXTURE_DATABASE_URL: mockUrl({hostname: 'remote.invalid'})}, 'TEST_CONFIG_HOST_REJECTED');
});

test('fixture explícita vazia não é substituída silenciosamente', async () => {
 await rejectConfig({DATABASE_URL: mockUrl(), TEST_FIXTURE_DATABASE_URL: ''}, 'TEST_CONFIG_URL_INVALID');
});

test('URL inválida produz somente código controlado', async () => {
 await rejectConfig({DATABASE_URL: 'fixture_mock_only'}, 'TEST_CONFIG_URL_INVALID');
});

test('JSON inválido produz somente código controlado', async () => {
 await rejectConfig('{"DATABASE_URL":"fixture_mock_only"', 'TEST_CONFIG_JSON_INVALID');
});

test('fixture fallback válida é carregada e validada', async () => {
 const config = {DATABASE_URL: mockUrl({role: 'balsas_api'})};
 const fallback = {...config, TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'balsas_migrate'})};
 await withConfig(config, async options => {
  const loaded = await loadTestConfig(options);
  assert.ok(loaded.TEST_FIXTURE_DATABASE_URL === fallback.TEST_FIXTURE_DATABASE_URL);
 }, fallback);
});

test('fixture fallback recusa override e identidade divergente', async () => {
 const config = {DATABASE_URL: mockUrl({role: 'balsas_api'})};
 await rejectConfig(config, 'TEST_CONFIG_PARAMETERS_REJECTED', {...config, TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'balsas_migrate', parameters: [['host', 'remote.invalid']]})});
 await rejectConfig(config, 'TEST_CONFIG_FIXTURE_IDENTITY_MISMATCH', {...config, TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'balsas_migrate', database: 'balsas_lab08_test_456'})});
});

test('fixture fallback recusa configuração runtime diferente e role inesperada', async () => {
 const config = {DATABASE_URL: mockUrl({role: 'balsas_api'})};
 await rejectConfig(config, 'TEST_CONFIG_FALLBACK_RUNTIME_MISMATCH', {DATABASE_URL: mockUrl(), TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'balsas_migrate'})});
 await rejectConfig(config, 'TEST_CONFIG_FIXTURE_ROLE_REJECTED', {...config, TEST_FIXTURE_DATABASE_URL: mockUrl({role: 'fixture_mock'})});
});
