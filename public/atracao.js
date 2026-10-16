/** Página de detalhes: consome apenas GET da API e não expõe credenciais. */
'use strict';

const $ = (seletor) => document.querySelector(seletor);

function preencher(seletor, valor) {
  $(seletor).textContent = String(valor ?? '');
}

function textoOuPadrao(valor, padrao) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : padrao;
}

function distanciaFormatada(distancia) {
  return typeof distancia === 'number' && Number.isFinite(distancia) && distancia >= 0
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(distancia) + ' km'
    : 'Não informada';
}

function localizacaoFormatada(atracao) {
  const partes = [atracao.localizacao?.cidade, atracao.localizacao?.estado]
    .filter((parte) => typeof parte === 'string' && parte.trim());
  return partes.length ? partes.join(' · ') : 'Não informada';
}

// Um único conteúdo é utilizado na visualização e na cópia, sem inventar campos.
let jsonParaCopiar = '';

function construirLinhaJson(linha) {
  const elemento = document.createElement('span');
  elemento.className = 'json-code-linha';
  const padrao = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let inicio = 0;
  for (const token of linha.matchAll(padrao)) {
    const posicao = token.index;
    if (posicao > inicio) {
      elemento.append(document.createTextNode(linha.slice(inicio, posicao)));
    }
    const texto = token[0];
    const tipo = texto.startsWith('"')
      ? (/^\s*:/.test(linha.slice(posicao + texto.length)) ? 'chave' : 'texto')
      : (/^(?:true|false|null)$/.test(texto) ? 'booleano' : 'numero');
    const destaque = document.createElement('span');
    destaque.className = 'json-token-' + tipo;
    // Nunca usar innerHTML com conteúdo retornado pela API.
    destaque.textContent = texto;
    elemento.append(destaque);
    inicio = posicao + texto.length;
  }
  if (inicio < linha.length) {
    elemento.append(document.createTextNode(linha.slice(inicio)));
  }
  // Linhas vazias ainda ocupam espaço vertical.
  if (!linha.length) elemento.append(document.createTextNode(' '));
  return elemento;
}

function renderizarJson(atracao) {
  jsonParaCopiar = JSON.stringify(atracao, null, 2);
  const linhas = jsonParaCopiar.split('\n');
  const codigos = document.createDocumentFragment();
  const numeros = document.createDocumentFragment();
  for (let indice = 0; indice < linhas.length; indice++) {
    const numero = document.createElement('span');
    numero.className = 'json-numero-linha';
    numero.textContent = String(indice + 1);
    numeros.append(numero);
    codigos.append(construirLinhaJson(linhas[indice]));
  }
  document.querySelector('#jsonLinhas').replaceChildren(numeros);
  document.querySelector('#jsonCode').replaceChildren(codigos);
}

async function copiarJson() {
  const status = document.querySelector('#statusCopia');
  const botao = document.querySelector('#copiarJson');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard não disponível');
    await navigator.clipboard.writeText(jsonParaCopiar);
    status.textContent = 'JSON copiado para a área de transferência.';
    botao.textContent = '✓ Copiado!';
  } catch {
    status.textContent = 'Não foi possível copiar automaticamente. Selecione o JSON para copiar manualmente.';
    botao.textContent = 'Copiar JSON';
  }
}

function mostrarErro(mensagem) {
  $('#paginaAtracao').hidden = true;
  $('#mensagem').hidden = true;
  $('#erroAtracao').hidden = false;
  preencher('#descricaoErro', mensagem);
  document.title = 'Atração indisponível | Explore Balsas';
}

function mostrarAtracao(atracao, id) {
  if (!atracao || typeof atracao !== 'object' || Number(atracao.id) !== id) {
    throw new Error('Resposta de atração incompatível');
  }

  const nome = textoOuPadrao(atracao.nome, 'Atração sem nome');
  const categoria = textoOuPadrao(atracao.categoria, 'Não informada');
  const descricao = textoOuPadrao(atracao.descricao, 'Descrição não informada.');
  preencher('#tituloAtracao', nome);
  preencher('#categoriaHero', categoria);
  preencher('#numeroHero', 'REGISTRO ' + String(id).padStart(2, '0'));
  preencher('#descricaoAtracao', descricao);
  preencher('#localizacaoAtracao', localizacaoFormatada(atracao));
  preencher('#categoriaAtracao', categoria);
  preencher('#distanciaAtracao', distanciaFormatada(atracao));

  renderizarJson(atracao);

  $('#linkJson').href = '/atracoes/' + id + '?formato=json';
  document.title = nome + ' | Explore Balsas';
  $('#mensagem').hidden = true;
  $('#erroAtracao').hidden = true;
  $('#paginaAtracao').hidden = false;
}

async function iniciar() {
  const correspondencia = /^\/atracoes\/([1-9]\d*)\/?$/.exec(window.location.pathname);
  const id = correspondencia ? Number(correspondencia[1]) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) {
    mostrarErro('O endereço desta atração não é válido. Volte ao catálogo e escolha um lugar.');
    return;
  }

  try {
    // O cabeçalho explícito preserva a resposta REST JSON para integração.
    const resposta = await fetch('/atracoes/' + id + '?formato=json', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (resposta.status === 404) {
      mostrarErro('Esta atração não foi encontrada. Você pode escolher outra no catálogo.');
      return;
    }
    if (!resposta.ok) throw new Error('Erro HTTP ' + resposta.status);
    const atracao = await resposta.json();
    mostrarAtracao(atracao, id);
  } catch {
    mostrarErro('Não conseguimos carregar os detalhes agora. Tente atualizar a página ou volte ao catálogo.');
  }
}

document.querySelector('#copiarJson').addEventListener('click', copiarJson);

void iniciar();
