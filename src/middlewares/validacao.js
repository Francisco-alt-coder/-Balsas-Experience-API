/** Valida o corpo JSON e os identificadores antes de executar os controladores. */
const campos = new Set(['nome', 'categoria', 'descricao', 'localizacao', 'distanciaCentroKm', 'tags']);
const objeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor) => typeof valor === 'string' && valor.trim().length > 0 && !valor.includes('\0');

/**
 * Aceita visitante não vazio, nota inteira de 1 a 5 e comentário opcional textual ou null.
 */
export function validarAvaliacao(req, res, next) {
  const corpo = req.body;
  if (!objeto(corpo) || Object.keys(corpo).some((k) => !['visitante', 'nota', 'comentario'].includes(k)) ||
      !texto(corpo.visitante) || !Number.isInteger(corpo.nota) || corpo.nota < 1 || corpo.nota > 5 ||
      (corpo.comentario !== undefined && corpo.comentario !== null && (typeof corpo.comentario !== 'string' || corpo.comentario.includes('\0')))) {
    return res.status(400).json({ erro: 'Informe visitante textual, nota inteira de 1 a 5 e comentário textual opcional' });
  }
  next();
}

/**
 * Retorna a primeira falha do corpo; no PATCH exige os campos obrigatórios apenas quando enviados.
 * @param {unknown} corpo - Valor desserializado pelo express.json().
 * @param {boolean} [parcial=false] - Ativa a validação de atualização parcial.
 * @returns {string|null} Mensagem de validação ou null quando aceito.
 */
export function validarCorpo(corpo, parcial = false) {
  if (!objeto(corpo)) return 'O corpo deve ser um objeto JSON';
  if (Object.keys(corpo).some((campo) => !campos.has(campo))) return 'Campo desconhecido no corpo da requisição';
  if (parcial && Object.keys(corpo).length === 0) return 'Nenhum campo válido foi enviado para atualização';
  for (const campo of ['nome', 'categoria', 'descricao']) {
    if ((!parcial || campo in corpo) && !texto(corpo[campo])) {
      return 'Os campos nome, categoria e descricao devem ser textos não vazios';
    }
  }
  if ('localizacao' in corpo) {
    if (!objeto(corpo.localizacao) || Object.keys(corpo.localizacao).length === 0) return 'localizacao deve ser um objeto com cidade e/ou estado';
    if (Object.keys(corpo.localizacao).some((campo) => !['cidade', 'estado'].includes(campo))) return 'Campo desconhecido em localizacao';
    for (const valor of Object.values(corpo.localizacao)) {
      if (!texto(valor)) return 'cidade e estado devem ser textos não vazios';
    }
  }
  if ('distanciaCentroKm' in corpo && corpo.distanciaCentroKm !== null &&
      (typeof corpo.distanciaCentroKm !== 'number' || !Number.isFinite(corpo.distanciaCentroKm) || corpo.distanciaCentroKm < 0)) {
    return 'distanciaCentroKm deve ser um número finito maior ou igual a zero, ou null';
  }
  if ('tags' in corpo && (!Array.isArray(corpo.tags) || corpo.tags.some((tag) => !texto(tag)))) return 'tags deve ser uma lista de textos não vazios';
  return null;
}

/**
 * Cria o middleware de validação de POST/PUT ou PATCH; falhas recebem HTTP 400.
 * @param {boolean} [parcial=false] - Permite omitir campos no PATCH.
 * @returns {import("express").RequestHandler} Middleware da rota.
 */
export function validarAtracao(parcial = false) {
  return (req, res, next) => {
    const erro = validarCorpo(req.body, parcial);
    if (erro) return res.status(400).json({ erro });
    next();
  };
}

/**
 * Restringe o ID ao intervalo positivo de um Int PostgreSQL, rejeitando formatos não decimais.
 */
export function validarId(req, res, next) {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({ erro: 'ID inválido: use um inteiro positivo de até 2147483647' });
  }
  next();
}
