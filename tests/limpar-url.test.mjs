/** Verifica a remoção do parâmetro de origem sem modificar as rotas REST. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const codigo = readFileSync(new URL('../public/limpar-url.js', import.meta.url), 'utf8');

function simularEndereco(href) {
  const chamadas = [];
  const estado = { sessao: 'preservada' };
  const window = {
    location: { href },
    history: {
      state: estado,
      replaceState(...args) { chamadas.push(args); },
    },
  };
  runInNewContext(codigo, { window, URL });
  return { chamadas, estado };
}

test('remove o parâmetro de origem sem recarregar nem perder âncora', () => {
  const { chamadas, estado } = simularEndereco(
    'https://exemplo.onrender.com/atracoes/1?utm_source=compartilhamento#informacoes',
  );
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], estado);
  assert.equal(chamadas[0][2], '/atracoes/1#informacoes');
});

test('preserva parâmetros funcionais da navegação', () => {
  const { chamadas } = simularEndereco(
    'https://exemplo.onrender.com/explorar?utm_source=mensagem&categoria=Lazer#catalogo',
  );
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][2], '/explorar?categoria=Lazer#catalogo');
});

test('não altera links sem o parâmetro de origem', () => {
  assert.equal(simularEndereco('https://exemplo.onrender.com/atracoes/1').chamadas.length, 0);
  assert.equal(simularEndereco('https://exemplo.onrender.com/explorar?categoria=Lazer').chamadas.length, 0);
});

test('o mesmo script é carregado nas páginas visual e individual', () => {
  for (const path of ['atracoes.html', 'atracao.html']) {
    const html = readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');
    assert.match(html, /<script src="\/site\/limpar-url\.js" defer><\/script>/);
  }
});
