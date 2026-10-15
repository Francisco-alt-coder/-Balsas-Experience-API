/** Garante que a interface HTML não altere o formato das respostas da API REST. */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import webRoutes from '../src/routes/web.routes.js';

test('catálogo HTML e contrato JSON coexistem no mesmo caminho', async (t) => {
  const app = express();
  app.use(webRoutes);
  // Resposta simulada: não exige conexão ao Neon nem modifica dados.
  app.get('/atracoes', (_req, res) => res.json([
    { id: 1, nome: 'Exemplo de teste', categoria: 'Lazer', descricao: 'Descrição simulada' },
  ]));
  const servidor = await new Promise((resolve) => {
    const http = app.listen(0, '127.0.0.1', () => resolve(http));
  });
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const origem = 'http://127.0.0.1:' + servidor.address().port;

  await t.test('navegador recebe HTML com página estruturada', async () => {
    const resposta = await fetch(origem + '/atracoes', { headers: { Accept: 'text/html,application/xhtml+xml' } });
    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get('content-type'), /text\/html/);
    assert.match(resposta.headers.get('vary'), /Accept/i);
    assert.match(resposta.headers.get('content-security-policy'), /script-src 'self'/);
    const html = await resposta.text();
    assert.match(html, /<main id="conteudo">/);
    assert.match(html, /Atrações para explorar/);
  });

  await t.test('client REST continua recebendo JSON', async () => {
    for (const aceitacao of ['application/json', '*/*']) {
      const resposta = await fetch(origem + '/atracoes', { headers: { Accept: aceitacao } });
      assert.equal(resposta.status, 200);
      assert.match(resposta.headers.get('content-type'), /application\/json/);
      const dados = await resposta.json();
      assert.equal(dados[0].nome, 'Exemplo de teste');
    }
  });

  await t.test('usuário pode escolher JSON mesmo no navegador', async () => {
    const resposta = await fetch(origem + '/atracoes?formato=json', { headers: { Accept: 'text/html' } });
    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get('content-type'), /application\/json/);
  });

  await t.test('URL independente e arquivos estáticos funcionam', async () => {
    const pagina = await fetch(origem + '/explorar');
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get('content-type'), /text\/html/);
    const estilo = await fetch(origem + '/site/atracoes.css');
    assert.equal(estilo.status, 200);
    assert.match(estilo.headers.get('content-type'), /text\/css/);
    const script = await fetch(origem + '/site/atracoes.js');
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
  });
});
