/* Formulários demonstrativos: o sucesso aparece apenas após resposta HTTP real. */
'use strict';
const $ = (seletor) => document.querySelector(seletor);
const pagina = document.body.dataset.operacao;
const form = $(pagina === 'cadastro' ? '#formCadastro' : '#formExclusao');
const botao = $('#enviar');
function atualizarResultado(metodo, caminho, status, texto, corpo, localizacao) {
  $('#metodoResultado').textContent = metodo;
  $('#enderecoResultado').textContent = caminho;
  $('#horaResultado').textContent = new Date().toLocaleString('pt-BR');
  $('#locationResultado').textContent = localizacao || 'Não disponível';
  const titulo = status === 201 ? '201 • Criado' : status === 204 ? '204 • Excluído' : 'HTTP ' + status;
  const indicador = $('#status');
  indicador.textContent = titulo;
  indicador.className = 'op-status ' + (status >= 200 && status < 300 ? 'sucesso' : 'falha');
  $('#corpoResultado').textContent = corpo || texto || '(Sem corpo: resposta HTTP 204)';
}
function mostrarFalha(mensagem) {
  const indicador = $('#status');
  indicador.textContent = mensagem;
  indicador.className = 'op-status falha';
}
async function corpoDaResposta(resposta) {
  const texto = await resposta.text();
  if (!texto) return {texto: '', dados: null};
  try { return {texto: JSON.stringify(JSON.parse(texto), null, 2), dados: JSON.parse(texto)}; }
  catch { return {texto: texto, dados: null}; }
}
async function cadastrar(token) {
  const nome = $('#nome').value.trim();
  if (!nome.startsWith('Teste acadêmico - ') || nome.length <= 'Teste acadêmico - '.length) {
    mostrarFalha('Use um nome iniciado por "Teste acadêmico - " seguido do título do teste.');
    return;
  }
  const distancia = Number($('#distancia').value);
  if (!Number.isFinite(distancia) || distancia < 0) {
    mostrarFalha('Informe uma distância válida.');
    return;
  }
  const corpo = {
    nome,
    categoria: $('#categoria').value.trim(),
    descricao: $('#descricao').value.trim(),
    localizacao: {cidade: $('#cidade').value.trim(), estado: $('#estado').value.trim()},
    distanciaCentroKm: distancia,
    tags: []
  };
  const resposta = await fetch('/atracoes', {
    method:'POST',
    headers:{'Accept':'application/json','Content-Type':'application/json','Authorization':'Bearer ' + token},
    body:JSON.stringify(corpo),
    cache:'no-store'
  });
  const resultado = await corpoDaResposta(resposta);
  const localizacao = resposta.headers.get('Location') || '';
  atualizarResultado('POST', '/atracoes', resposta.status, '', resultado.texto, localizacao);
  if (resposta.status === 201 && Number.isSafeInteger(resultado.dados?.id)) {
    sessionStorage.setItem('balsasUltimoIdTeste', String(resultado.dados.id));
  }
}
async function excluir(token) {
  const id = Number($('#idAtracao').value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    mostrarFalha('Informe um ID válido.');
    return;
  }
  if ($('#confirmacao').value.trim() !== 'EXCLUIR') {
    mostrarFalha('Digite EXCLUIR para confirmar.');
    return;
  }
  const caminho = '/atracoes/' + id;
  const consulta = await fetch(caminho + '?formato=json', {headers:{'Accept':'application/json'},cache:'no-store'});
  const anterior = await corpoDaResposta(consulta);
  if (!consulta.ok) {
    atualizarResultado('GET', caminho + '?formato=json', consulta.status, '', anterior.texto, 'Registro não localizado');
    return;
  }
  if (typeof anterior.dados?.nome !== 'string' || !anterior.dados.nome.startsWith('Teste acadêmico - ')) {
    mostrarFalha('Exclusão bloqueada: o ID informado não pertence a um registro identificado como teste.');
    return;
  }
  const nome = anterior.dados.nome;
  const resposta = await fetch(caminho, {
    method:'DELETE',
    headers:{'Accept':'application/json','Authorization':'Bearer ' + token},
    cache:'no-store'
  });
  const resultado = await corpoDaResposta(resposta);
  atualizarResultado('DELETE', caminho, resposta.status, '', resultado.texto, nome);
  if (resposta.status === 204 && sessionStorage.getItem('balsasUltimoIdTeste') === String(id)) {
    sessionStorage.removeItem('balsasUltimoIdTeste');
  }
}
if (pagina === 'exclusao') {
  const ultimoId = sessionStorage.getItem('balsasUltimoIdTeste');
  if (ultimoId && /^\d+$/.test(ultimoId)) $('#idAtracao').value = ultimoId;
}
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!form.reportValidity()) return;
  const token = $('#token').value.trim();
  if (!token) {mostrarFalha('Informe o token de escrita.');return;}
  botao.disabled = true;
  $('#status').textContent = 'Executando requisição...';
  $('#status').className = 'op-status';
  try {
    if (pagina === 'cadastro') await cadastrar(token);
    else await excluir(token);
  } catch {
    mostrarFalha('Falha de conexão: não foi possível obter uma resposta HTTP do servidor.');
  } finally {
    $('#token').value = '';
    botao.disabled = false;
  }
});
