/** Testa contratos HTTP e persistência em banco isolado, com registros temporários e limpeza ao final. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import pg from 'pg';
import {loadTestConfig} from './test-config.mjs';
import {runtimeEnv} from './lib/runtime-env.mjs';

const configTeste = await loadTestConfig();
const runtimeUrl = new URL(configTeste.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(runtimeUrl.hostname), 'Banco de testes deve usar loopback');
assert.match(runtimeUrl.pathname, /^\/balsas_lab08_test_\d+$/, 'Banco isolado obrigatório');
process.env.DATABASE_URL = configTeste.DATABASE_URL;
process.env.API_WRITE_TOKEN = configTeste.API_WRITE_TOKEN;

const resultados = [];
const fixtureUrl = new URL(configTeste.TEST_FIXTURE_DATABASE_URL || configTeste.DATABASE_URL);
assert.equal(fixtureUrl.pathname, runtimeUrl.pathname, 'Fixture de outro banco');
assert.equal(fixtureUrl.host, runtimeUrl.host, 'Fixture de outro host');
const client = new pg.Client({ connectionString: fixtureUrl.href, connectionTimeoutMillis: 5000 });
const porta = process.env.TEST_PORT || '3107';
const base = `http://127.0.0.1:${porta}`;
const marcador = `Auditoria ${randomUUID()}`;
const temporarios = new Set();
const tagsTemporarias = new Set();
const eventosServidor = [];
let server;
let antes;
let depois;
let conectado = false;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function snapshot() {
  const resultado = {};
  for (const tabela of ['atracoes', 'tags', 'atracao_tags']) {
    const { rows } = await client.query(`SELECT * FROM "${tabela}" ORDER BY 1, 2`);
    resultado[tabela] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  return resultado;
}
async function iniciar(port, extra = {}) {
  const apiEnv = runtimeEnv({ ...process.env, PORT: String(port), ...extra });
  delete apiEnv.DIRECT_URL; delete apiEnv.TEST_FIXTURE_DATABASE_URL;
  const child = spawn(process.execPath, ['src/app.js'], { env: apiEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let iniciou = false;
  child.stdout.on('data', (chunk) => { if (chunk.toString().includes('Servidor executando')) iniciou = true; });
  child.stderr.on('data', (chunk) => { eventosServidor.push(chunk.toString().trim()); });
  for (let i = 0; i < 100 && !iniciou; i++) {
    if (child.exitCode !== null) throw new Error('Servidor de teste encerrou antes de iniciar (porta ocupada ou configuração inválida)');
    await esperar(100);
  }
  if (!iniciou) { child.kill(); throw new Error('Timeout ao iniciar servidor de teste'); }
  return child;
}
async function request(method, path, body, url = base, raw = false) {
  const response = await fetch(`${url}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(['POST','PUT','PATCH','DELETE'].includes(method) ? { Authorization: `Bearer ${process.env.API_WRITE_TOKEN}` } : {}) }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  // Registre imediatamente qualquer criação, mesmo se uma asserção posterior falhar.
  if (method === 'POST' && response.status === 201 && Number.isInteger(json?.id) && json.nome === marcador) temporarios.add(json.id);
  return { status: response.status, json, text, location: response.headers.get('location') };
}
async function caso(method, endpoint, executar) {
  try {
    const http = await executar();
    resultados.push({ metodo: method, endpoint, http: http ?? null, resultado: 'APROVADO', detalhes: 'Asserções verificadas' });
  } catch (error) {
    resultados.push({ metodo: method, endpoint, http: error.http ?? null, resultado: 'REPROVADO', detalhes: error.message });
    process.exitCode = 1;
  }
}
async function status(method, path, expected, body, raw = false, url = base) {
  const r = await request(method, path, body, url, raw);
  if (r.status !== expected) {
    const erro = new Error(`${method} ${path}: esperado ${expected}, recebido ${r.status}; ${r.text.slice(0, 200)}`);
    erro.http = r.status;
    throw erro;
  }
  if (expected >= 400) assert.equal(typeof r.json?.erro, 'string');
  return r;
}
async function rejeitarSQL(sql, parametros, codigo) {
  await client.query('BEGIN');
  try {
    await assert.rejects(client.query(sql, parametros), (erro) => erro.code === codigo);
  } finally {
    await client.query('ROLLBACK');
  }
}
const payload = { nome: marcador, categoria: 'Turismo', descricao: 'Atracao cadastrada para validar a API REST', localizacao: { cidade: 'Balsas', estado: 'MA' }, distanciaCentroKm: 3, tags: [] };
try {
  await client.connect(); conectado = true; antes = await snapshot();
  server = await iniciar(porta, { CORS_ORIGINS: 'https://auditoria.invalid' });
  await caso('GET', '/', async () => { const r = await status('GET', '/', 200); assert.equal(r.json.nome, 'Balsas Experience API'); return r.status; });
  await caso('GET', '/health', async () => { const r = await status('GET', '/health', 200); assert.equal(r.json.banco, 'conectado'); return r.status; });
  await caso('GET', '/ (CORS e ausência de credenciais)', async () => {
    const r = await fetch(`${base}/`, { headers: { Origin: 'https://auditoria.invalid' }, signal: AbortSignal.timeout(10000) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://auditoria.invalid');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('access-control-allow-credentials'), null);
    const json = await r.json();
    assert.equal(json.nome, 'Balsas Experience API');
    return r.status;
  });
  await caso('OPTIONS', '/atracoes (preflight permitido)', async () => {
    const r = await fetch(`${base}/atracoes`, { method: 'OPTIONS', headers: {
      Origin: 'https://auditoria.invalid', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://auditoria.invalid');
    assert.match(r.headers.get('access-control-allow-headers'), /Authorization/);
    return r.status;
  });
  for (const method of ['GET', 'OPTIONS', 'POST']) {
    await caso(method, '/atracoes (origem bloqueada)', async () => {
      const r = await fetch(`${base}/atracoes`, { method, headers: { Origin: 'https://bloqueada.invalid' } });
      assert.equal(r.status, 403);
      assert.equal(r.headers.get('access-control-allow-origin'), null);
      assert.deepEqual(await r.json(), { erro: 'Origem não permitida' });
      return r.status;
    });
  }
  await caso('GET', '/atracoes', async () => { const r = await status('GET', '/atracoes', 200); assert.ok(Array.isArray(r.json)); assert.equal(r.json.length, antes.atracoes.count); return r.status; });
  for (const body of [{}, { nome: '', categoria: '', descricao: '' }, { nome: 'Teste', descricao: 'Sem categoria' }, { ...payload, nome: 12 }, { ...payload, nome: ' ' }, { ...payload, localizacao: 'Balsas - MA' }, { ...payload, tags: [1] }, { ...payload, distanciaCentroKm: -1 }, { ...payload, campoFicticio: true }, []]) {
    await caso('POST', '/atracoes (inválido)', async () => (await status('POST', '/atracoes', 400, body)).status);
  }
  await caso('POST', '/atracoes (JSON malformado)', async () => (await status('POST', '/atracoes', 400, '{', true)).status);
  await caso('POST', '/atracoes (corpo grande)', async () => (await status('POST', '/atracoes', 413, { ...payload, descricao: 'x'.repeat(110000) })).status);
  await caso('POST', '/atracoes', async () => {
    const r = await status('POST', '/atracoes', 201, payload);
    assert.ok(Number.isInteger(r.json.id)); assert.equal(r.location, `/atracoes/${r.json.id}`);
    const { rows } = await client.query('SELECT nome, categoria, cidade FROM atracoes WHERE id=$1', [r.json.id]);
    assert.deepEqual(rows[0], { nome: marcador, categoria: 'Turismo', cidade: 'Balsas' }); return r.status;
  });
  const id = [...temporarios][0];
  if (id) {
    await caso('GET', `/atracoes/${id}`, async () => { const r = await status('GET', `/atracoes/${id}`, 200); assert.equal(r.json.nome, marcador); return r.status; });
    await caso('GET', '/atracoes (registro persistido)', async () => { const r = await status('GET', '/atracoes', 200); assert.ok(r.json.some((item) => item.id === id && item.nome === marcador)); return r.status; });
    const tag = `${marcador} tag`;
    tagsTemporarias.add(tag);
    const put = { ...payload, descricao: 'Atualização PUT', localizacao: { cidade: 'Balsas', estado: 'MA' }, tags: [tag, tag] };
    await caso('PUT', `/atracoes/${id}`, async () => { const r = await status('PUT', `/atracoes/${id}`, 200, put); assert.equal(r.json.descricao, put.descricao); assert.deepEqual(r.json.tags, [tag]); const db = await client.query('SELECT descricao FROM atracoes WHERE id=$1', [id]); assert.equal(db.rows[0].descricao, put.descricao); return r.status; });
    await caso('PUT', `/atracoes/${id} (incompleto)`, async () => (await status('PUT', `/atracoes/${id}`, 400, { nome: marcador })).status);
    await caso('PATCH', `/atracoes/${id}`, async () => { const r = await status('PATCH', `/atracoes/${id}`, 200, { descricao: 'Atualização PATCH' }); const get = await status('GET', `/atracoes/${id}`, 200); assert.equal(get.json.descricao, 'Atualização PATCH'); assert.equal(get.json.nome, marcador); assert.equal(get.json.categoria, put.categoria); assert.deepEqual(get.json.localizacao, put.localizacao); assert.deepEqual(get.json.tags, [tag]); const db = await client.query('SELECT descricao FROM atracoes WHERE id=$1', [id]); assert.equal(db.rows[0].descricao, 'Atualização PATCH'); return r.status; });
    for (const body of [{}, { nome: null }, { nome: '' }, { tags: 'tag' }, { desconhecido: 1 }, { localizacao: { cidade: null } }]) await caso('PATCH', `/atracoes/${id} (inválido)`, async () => (await status('PATCH', `/atracoes/${id}`, 400, body)).status);
    await caso('PATCH', `/atracoes/${id} (localização parcial)`, async () => { await status('PATCH', `/atracoes/${id}`, 200, { localizacao: { cidade: 'Cidade Teste' } }); const r = await status('GET', `/atracoes/${id}`, 200); assert.equal(r.json.localizacao.cidade, 'Cidade Teste'); assert.equal(r.json.localizacao.estado, 'MA'); return 200; });
    await caso('GET', '/atracoes (filtros e paginação)', async () => { const r = await status('GET', `/atracoes?categoria=Turismo&cidade=Cidade%20Teste&tag=${encodeURIComponent(tag)}&ate=3&ordem=nome&pagina=1&tamanho=3`, 200); assert.equal(r.json.length, 1); assert.equal(r.json[0].id, id); return r.status; });
    await caso('PUT', `/atracoes/${id} (padrões e remoção de vínculos)`, async () => {
      const r = await status('PUT', `/atracoes/${id}`, 200, { nome: marcador, categoria: 'Turismo', descricao: 'PUT sem opcionais' });
      assert.deepEqual(r.json.localizacao, { cidade: 'Balsas', estado: 'MA' });
      assert.equal(r.json.distanciaCentroKm, null); assert.deepEqual(r.json.tags, []);
      const vinculos = await client.query('SELECT * FROM atracao_tags WHERE "atracaoId"=$1', [id]);
      assert.equal(vinculos.rows.length, 0);
      const tagExistente = await client.query('SELECT id FROM tags WHERE nome=$1', [tag]);
      assert.equal(tagExistente.rows.length, 1);
      const get = await status('GET', `/atracoes/${id}`, 200);
      assert.equal(get.json.descricao, 'PUT sem opcionais');
      return r.status;
    });
    await caso('SQL', 'Unicidade de tags', async () => {
      await rejeitarSQL('INSERT INTO tags (nome) VALUES ($1)', [tag], '23505');
    });
    for (const campo of ['id', 'criadoEm', 'atualizadoEm']) {
      await caso('PATCH', `/atracoes/${id} (campo protegido ${campo})`, async () =>
        (await status('PATCH', `/atracoes/${id}`, 400, { [campo]: 1 })).status);
    }
    await caso('GET', '/categorias?formato=nomes', async () => { const r = await status('GET', '/categorias?formato=nomes', 200); assert.ok(r.json.includes('Turismo')); assert.equal(new Set(r.json).size, r.json.length); return r.status; });
    await caso('DELETE', `/atracoes/${id}`, async () => { const r = await status('DELETE', `/atracoes/${id}`, 204); assert.equal(r.text, ''); const db = await client.query('SELECT id FROM atracoes WHERE id=$1', [id]); assert.equal(db.rows.length, 0); return r.status; });
    await caso('SQL', 'Chave estrangeira rejeita atração excluída', async () => {
      const { rows } = await client.query('SELECT id FROM tags WHERE nome=$1', [tag]);
      await rejeitarSQL('INSERT INTO atracao_tags ("atracaoId", "tagId") VALUES ($1, $2)', [id, rows[0].id], '23503');
    });
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) await caso(method, `/atracoes/${id} (inexistente)`, async () => (await status(method, `/atracoes/${id}`, 404, method === 'PUT' ? payload : method === 'PATCH' ? { descricao: 'Teste' } : undefined)).status);
  } else {
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) resultados.push({ metodo: method, endpoint: '/atracoes/:id', http: null, resultado: 'NÃO EXECUTADO', detalhes: 'POST não criou um registro temporário' });
  }
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) for (const value of ['abc', '-1', '0', '1.5', '2147483648']) await caso(method, `/atracoes/${value} (ID inválido)`, async () => (await status(method, `/atracoes/${value}`, 400, method === 'PUT' ? payload : method === 'PATCH' ? { descricao: 'Teste' } : undefined)).status);
  for (const query of ['ate=Infinity', 'ate=-1', 'ate=abc', 'pagina=0', 'tamanho=-1', 'pagina=999999999999999999', 'tamanho=2147483648', 'categoria=a&categoria=b', 'ordem=id']) await caso('GET', `/atracoes?${query}`, async () => (await status('GET', `/atracoes?${query}`, 400)).status);
  await caso('GET', '/atracoes (filtro sem registros)', async () => { const r = await status('GET', `/atracoes?cidade=${encodeURIComponent(marcador)}`, 200); assert.deepEqual(r.json, []); return r.status; });
  await caso('GET', '/abc', async () => (await status('GET', '/abc', 404)).status);
  let falha;
  try {
    falha = await iniciar(Number(porta) + 1, { DATABASE_URL: 'postgresql://teste:teste@127.0.0.1:1/teste?connect_timeout=1' });
    for (const path of ['/health', '/atracoes']) await caso('GET', `${path} (banco indisponível isolado)`, async () => { const r = await status('GET', path, 500, undefined, false, `http://127.0.0.1:${Number(porta) + 1}`); assert.deepEqual(r.json, { erro: 'Erro interno no servidor' }); return r.status; });
  } finally { falha?.kill(); }
} catch (error) {
  resultados.push({ metodo: '-', endpoint: 'Preparação', http: null, resultado: 'NÃO VERIFICADO', detalhes: error.code ?? 'Falha de preparação; verifique banco, porta e Prisma Client' });
  process.exitCode = 1;
} finally {
  if (conectado) {
    try {
      for (const id of temporarios) await client.query('DELETE FROM atracoes WHERE id=$1 AND nome=$2', [id, marcador]);
      for (const nome of tagsTemporarias) await client.query('DELETE FROM tags WHERE nome=$1 AND NOT EXISTS (SELECT 1 FROM atracao_tags WHERE "tagId"=tags.id)', [nome]);
      depois = await snapshot();
      assert.deepEqual(depois, antes, 'Dados preexistentes divergem do snapshot inicial');
      resultados.push({ metodo: 'SQL', endpoint: 'Preservação das 3 tabelas', http: null, resultado: 'APROVADO', detalhes: 'Contagens e hashes SHA-256 idênticos antes/depois' });
    } catch (error) { resultados.push({ metodo: 'SQL', endpoint: 'Limpeza/preservação', http: null, resultado: 'REPROVADO', detalhes: error.code ?? error.message }); process.exitCode = 1; }
    await client.end();
  }
  server?.kill();
  const contagens = Object.fromEntries(['APROVADO', 'REPROVADO', 'NÃO EXECUTADO', 'NÃO VERIFICADO'].map((nome) => [nome, resultados.filter((r) => r.resultado === nome).length]));
  const relatorio = { dataUTC: new Date().toISOString(), ambiente: process.version, antes, depois, eventosServidor, resultados, contagens, total: resultados.length };
  await mkdir('tmp', { recursive: true });
  await writeFile(process.env.TEST_REPORT_PATH || 'tmp/resultado-integracao.json', `${JSON.stringify(relatorio, null, 2)}\n`);
  console.table(resultados);
  console.log(JSON.stringify({ contagens, total: resultados.length }));
}
