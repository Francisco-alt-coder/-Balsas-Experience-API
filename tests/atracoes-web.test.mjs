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
  app.get('/atracoes/:id', (req, res) => {
    if (req.params.id !== '1') return res.status(404).json({ erro: 'Atração não encontrada' });
    return res.json({ id: 1, nome: 'Exemplo de teste', categoria: 'Lazer', descricao: 'Descrição simulada', localizacao: { cidade: 'Balsas', estado: 'MA' }, tags: ['teste'], totalAvaliacoes: 0 });
  });
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

  await t.test('navegação por /atracoes/1 mostra página HTML estilizada', async () => {
    const resposta = await fetch(origem + '/atracoes/1', { headers: { Accept: 'text/html,application/xhtml+xml' } });
    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get('content-type'), /text\/html/);
    assert.match(resposta.headers.get('vary'), /Accept/i);
    assert.match(resposta.headers.get('content-security-policy'), /script-src 'self'/);
    const html = await resposta.text();
    assert.match(html, /<main id="conteudo">/);
    assert.match(html, /Informações do local/);
    assert.match(html, /\/site\/atracao\.css/);
    assert.match(html, /\/site\/atracao\.js/);
  });

  await t.test('GET /atracoes/1 permanece JSON para clientes REST', async () => {
    for (const accept of ['application/json', '*/*']) {
      const resposta = await fetch(origem + '/atracoes/1', { headers: { Accept: accept } });
      assert.equal(resposta.status, 200);
      assert.match(resposta.headers.get('content-type'), /application\/json/);
      const dados = await resposta.json();
      assert.equal(dados.nome, 'Exemplo de teste');
    }
    const respostaHtmlForcandoJson = await fetch(origem + '/atracoes/1?formato=json', { headers: { Accept: 'text/html' } });
    assert.equal(respostaHtmlForcandoJson.status, 200);
    assert.match(respostaHtmlForcandoJson.headers.get('content-type'), /application\/json/);
  });

  await t.test('IDs inexistentes mantêm status 404 no contrato JSON', async () => {
    const resposta = await fetch(origem + '/atracoes/9999', { headers: { Accept: 'application/json' } });
    assert.equal(resposta.status, 404);
    assert.equal((await resposta.json()).erro, 'Atração não encontrada');
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
    const detalheCss = await fetch(origem + '/site/atracao.css');
    assert.equal(detalheCss.status, 200);
    assert.match(detalheCss.headers.get('content-type'), /text\/css/);
    const detalheJs = await fetch(origem + '/site/atracao.js');
    assert.equal(detalheJs.status, 200);
    assert.match(detalheJs.headers.get('content-type'), /javascript/);
  });
});
