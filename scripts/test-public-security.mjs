/**
 * Smoke test HTTPS sem escrita. Não lê DATABASE_URL nem API_WRITE_TOKEN.
 * Uso: PUBLIC_API_URL=https://dominio-real node scripts/test-public-security.mjs
 */
import assert from 'node:assert/strict';

const raw = process.env.PUBLIC_API_URL;
assert.ok(raw, 'PUBLIC_API_URL deve estar definida com a URL publicada.');
const base = new URL(raw);
assert.equal(base.protocol, 'https:', 'Somente endpoints HTTPS são aceitos.');
assert.equal(base.username + base.password, '', 'A URL não pode conter credenciais.');
assert.equal(base.search + base.hash, '', 'Forneça a URL base, sem consulta ou fragmento.');
assert.equal(base.pathname, '/', 'Forneça a URL da raiz da API.');

async function verificar(path, esperado, options = {}) {
  const response = await fetch(new URL(path, base), {
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    ...options,
  });
  assert.equal(response.status, esperado, `${path} retornou HTTP ${response.status}, esperado ${esperado}`);
  console.log(`APROVADO ${options.method ?? 'GET'} ${path}: HTTP ${response.status}`);
  return response;
}

const root = await verificar('/', 200);
assert.equal((await root.json()).nome, 'Balsas Experience API');

const health = await verificar('/health', 200);
assert.equal((await health.json()).banco, 'conectado');

const list = await verificar('/atracoes', 200);
assert.ok(Array.isArray(await list.json()), 'A lista de atrações precisa ser um array.');

const categories = await verificar('/categorias', 200);
assert.ok(Array.isArray(await categories.json()), 'A lista de categorias precisa ser um array.');

await verificar('/atracoes/id-invalido', 400);

for (const authorization of [undefined, 'Bearer token-invalido-para-teste']) {
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) headers.Authorization = authorization;
  const response = await verificar('/atracoes', 401, {
    method: 'POST',
    headers,
    body: '{}',
  });
  assert.match(response.headers.get('www-authenticate') ?? '', /Bearer/i);
}

const denied = await verificar('/atracoes', 403, {
  headers: { Origin: 'https://origem-nao-autorizada.invalid' },
});
assert.equal(denied.headers.get('access-control-allow-origin'), null);

console.log('SUCESSO: leituras, TLS via HTTPS, validações, Bearer e CORS verificados sem gravar dados.');
