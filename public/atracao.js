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

  const tags = $('#tagsAtracao');
  tags.replaceChildren();
  const listaTags = Array.isArray(atracao.tags) ? atracao.tags : [];
  if (listaTags.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'detalhe-ajuda';
    vazio.textContent = 'Nenhum tema cadastrado para esta atração.';
    tags.append(vazio);
  } else {
    for (const tema of listaTags) {
      if (typeof tema !== 'string') continue;
      const chip = document.createElement('span');
      chip.className = 'detalhe-tag';
      chip.textContent = tema;
      tags.append(chip);
    }
  }

  const quantidade = Number(atracao.totalAvaliacoes);
  const media = atracao.notaMedia;
  if (Number.isInteger(quantidade) && quantidade > 0) {
    const prefixo = quantidade === 1 ? '1 avaliação registrada.' : quantidade + ' avaliações registradas.';
    const nota = typeof media === 'number' && Number.isFinite(media)
      ? ' Média: ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(media) + ' de 5.'
      : '';
    preencher('#resumoAvaliacoes', prefixo + nota);
  } else {
    preencher('#resumoAvaliacoes', 'Ainda não há avaliações registradas para esta atração.');
  }

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

void iniciar();
