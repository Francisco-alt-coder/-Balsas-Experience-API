/* Catálogo público: apresentação de dados existentes, sem escrita e sem credenciais. */
'use strict';

const elementos = {
  lista: document.querySelector('#lista'),
  pesquisa: document.querySelector('#pesquisa'),
  categoria: document.querySelector('#categoria'),
  ordenacao: document.querySelector('#ordenacao'),
  chips: document.querySelector('#categoriasRapidas'),
  contagem: document.querySelector('#contagem'),
  aviso: document.querySelector('#aviso'),
  vazio: document.querySelector('#vazio'),
  dialogo: document.querySelector('#detalhes'),
};

const estado = { atracoes: [], categoria: '' };

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = String(texto);
  return elemento;
}

function categoriaVisual(categoria) {
  const valor = normalizar(categoria);
  if (valor.includes('natureza')) return 'natureza';
  if (valor.includes('historico')) return 'historico';
  if (valor.includes('lazer')) return 'lazer';
  return 'outros';
}

function localizacao(atracao) {
  return [atracao.localizacao?.cidade, atracao.localizacao?.estado].filter(Boolean).join(' · ') || 'Localização não informada';
}

function distancia(atracao) {
  return typeof atracao.distanciaCentroKm === 'number' && atracao.distanciaCentroKm >= 0
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(atracao.distanciaCentroKm) + ' km'
    : 'Não informada';
}

function abrirDetalhes(atracao) {
  document.querySelector('#detalheTitulo').textContent = atracao.nome || 'Atração';
  document.querySelector('#detalheCategoria').textContent = atracao.categoria || 'Sem categoria';
  document.querySelector('#detalheDescricao').textContent = atracao.descricao || 'Descrição não informada.';
  document.querySelector('#detalheLocalizacao').textContent = localizacao(atracao);
  document.querySelector('#detalheDistancia').textContent = distancia(atracao);
  const tags = document.querySelector('#detalheTags');
  tags.replaceChildren();
  (Array.isArray(atracao.tags) ? atracao.tags : []).forEach((tag) => {
    tags.append(criarElemento('span', 'tag', tag));
  });
  const id = Number(atracao.id);
  // O modal continua acessível; o link abre a página visual do lugar.
  document.querySelector('#detalheJson').href = Number.isSafeInteger(id) && id > 0
    ? '/atracoes/' + id : '/explorar';
  if (typeof elementos.dialogo.showModal === 'function') elementos.dialogo.showModal();
}

function criarCartao(atracao, indice) {
  const cartao = criarElemento('article', 'cartao');
  const capa = criarElemento('div', 'cartao-capa ' + categoriaVisual(atracao.categoria));
  capa.append(
    criarElemento('span', 'capa-selo', atracao.categoria || 'Sem categoria'),
    criarElemento('span', 'capa-numero', String(indice + 1).padStart(2, '0')),
  );
  const conteudo = criarElemento('div', 'cartao-conteudo');
  const titulo = criarElemento('h3', '', atracao.nome || 'Atração sem nome');
  const descricao = criarElemento('p', 'cartao-descricao', atracao.descricao || 'Descrição não informada.');
  const tags = criarElemento('div', 'cartao-tags');
  (Array.isArray(atracao.tags) ? atracao.tags : []).slice(0, 3).forEach((tag) => {
    tags.append(criarElemento('span', 'tag', tag));
  });
  const rodape = criarElemento('div', 'cartao-rodape');
  const botao = criarElemento('button', 'cartao-botao', 'Ver detalhes →');
  botao.type = 'button';
  botao.setAttribute('aria-label', 'Ver detalhes de ' + (atracao.nome || 'atração'));
  botao.addEventListener('click', () => abrirDetalhes(atracao));
  rodape.append(criarElemento('span', 'cartao-local', localizacao(atracao)), botao);
  conteudo.append(titulo, descricao, tags, rodape);
  cartao.append(capa, conteudo);
  return cartao;
}

function atualizarChips(categorias) {
  elementos.chips.replaceChildren();
  const opcoes = ['', ...categorias];
  opcoes.forEach((categoria) => {
    const botao = criarElemento('button', 'categoria-chip', categoria || 'Todas');
    botao.type = 'button';
    botao.setAttribute('aria-pressed', String(estado.categoria === categoria));
    botao.addEventListener('click', () => {
      estado.categoria = categoria;
      elementos.categoria.value = categoria;
      renderizar();
    });
    elementos.chips.append(botao);
  });
}

function renderizar() {
  const termo = normalizar(elementos.pesquisa.value.trim());
  const resultados = estado.atracoes.filter((atracao) => {
    const confereCategoria = !estado.categoria || atracao.categoria === estado.categoria;
    const conteudo = [atracao.nome, atracao.descricao, atracao.localizacao?.cidade, ...(atracao.tags || [])].join(' ');
    return confereCategoria && normalizar(conteudo).includes(termo);
  });
  if (elementos.ordenacao.value === 'nome') {
    resultados.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  const fragmento = document.createDocumentFragment();
  resultados.forEach((atracao, indice) => fragmento.append(criarCartao(atracao, indice)));
  elementos.lista.replaceChildren(fragmento);

  const categorias = [...new Set(estado.atracoes.map((a) => a.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  atualizarChips(categorias);
  elementos.vazio.hidden = resultados.length > 0;
  elementos.contagem.textContent = resultados.length + (resultados.length === 1 ? ' atração' : ' atrações');
  elementos.aviso.textContent = 'Exibindo ' + resultados.length + ' de ' + estado.atracoes.length + ' atrações cadastradas.';
}

function limparFiltros() {
  estado.categoria = '';
  elementos.pesquisa.value = '';
  elementos.categoria.value = '';
  elementos.ordenacao.value = 'padrao';
  renderizar();
}

async function iniciar() {
  try {
    // Accept explícito mantém o endpoint REST em JSON mesmo quando a página /atracoes é HTML.
    const resposta = await fetch('/atracoes', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error('Formato de resposta inesperado.');
    estado.atracoes = dados;

    const categorias = [...new Set(dados.map((a) => a.categoria).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    categorias.forEach((categoria) => {
      const opcao = document.createElement('option');
      opcao.value = categoria;
      opcao.textContent = categoria;
      elementos.categoria.append(opcao);
    });
    document.querySelector('#totalHero').textContent = String(dados.length);
    document.querySelector('#totalCategorias').textContent = String(categorias.length);
    renderizar();
  } catch {
    elementos.contagem.textContent = 'Indisponível';
    elementos.aviso.textContent = 'Não foi possível carregar as atrações agora. Atualize a página para tentar novamente.';
    elementos.lista.replaceChildren();
  }
}

elementos.pesquisa.addEventListener('input', renderizar);
elementos.categoria.addEventListener('change', () => {
  estado.categoria = elementos.categoria.value;
  renderizar();
});
elementos.ordenacao.addEventListener('change', renderizar);
document.querySelector('#filtros').addEventListener('reset', (evento) => {
  evento.preventDefault();
  limparFiltros();
});
document.querySelector('#limparVazio').addEventListener('click', limparFiltros);
document.querySelector('#fecharDetalhes').addEventListener('click', () => elementos.dialogo.close());
elementos.dialogo.addEventListener('click', (evento) => {
  if (evento.target === elementos.dialogo) elementos.dialogo.close();
});

void iniciar();
