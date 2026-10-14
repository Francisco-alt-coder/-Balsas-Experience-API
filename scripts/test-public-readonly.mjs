// Reproduz leituras na URL real após publicação; não carrega credenciais locais.
import assert from 'node:assert/strict';
const base = new URL(process.env.PUBLIC_API_URL);
assert.equal(base.protocol, 'https:');
assert.equal(base.username + base.password, '');
const paths = ['/', '/health', '/atracoes', '/categorias', '/categorias?formato=nomes', '/atracoes?q=rio', '/atracoes?categoria=Lazer', '/atracoes?tag=cachoeira', '/atracoes?ate=60'];
for (const path of paths) {
  const r = await fetch(new URL(path, base), { signal: AbortSignal.timeout(120000) });
  assert.equal(r.status, 200, path);
  const body = await r.json();
  if (path === '/health') assert.equal(body.banco, 'conectado');
  if (path === '/atracoes' && body.length) paths.push('/atracoes/' + body[0].id);
  console.log('APROVADO GET ' + path + ' HTTP 200');
}
