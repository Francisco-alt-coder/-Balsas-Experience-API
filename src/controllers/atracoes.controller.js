/** Executa operações de atrações, categorias e avaliações e monta as respostas do contrato REST. */
import prisma from '../lib/prisma.js';
import { relacionarCategoria } from '../lib/categorias.js';

/**
 * Converte o registro Prisma no formato público, agrupando cidade/estado e extraindo nomes das tags.
 * @param {object} atracao - Registro com os vínculos de tags carregados.
 * @returns {object} Representação da atração exposta pela API.
 */
function serializarAtracao(atracao) {
  return {
    id: atracao.id,
    nome: atracao.nome,
    categoria: atracao.categoria,
    descricao: atracao.descricao,
    localizacao: {
      cidade: atracao.cidade,
      estado: atracao.estado,
    },
    distanciaCentroKm: atracao.distanciaCentroKm,
    tags: atracao.tags?.map((relacao) => relacao.tag.nome) ?? [],
  };
}

/**
 * Remove espaços, valores vazios e nomes repetidos antes de criar vínculos.
 * @param {string[]} [tags=[]] - Nomes recebidos na requisição.
 * @returns {string[]} Nomes únicos após normalização.
 */
function normalizarTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

/**
 * Monta a escrita aninhada da associação muitos-para-muitos AtracaoTag; reutiliza ou cria cada Tag.
 * @param {string[]} tags - Nomes das tags a associar.
 * @returns {object[]} Operações aninhadas para o Prisma.
 */
function relacionamentosDeTags(tags) {
  return normalizarTags(tags).map((nome) => ({
    tag: {
      connectOrCreate: {
        where: { nome },
        create: { nome },
      },
    },
  }));
}

/**
 * GET /atracoes: combina filtros e aplica ordenação e paginação somente quando solicitadas.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function listar(req, res, next) {
  try {
    const { categoria, tag, cidade, ate, ordem, pagina, tamanho, q } = req.query;
    if (Object.values(req.query).some((valor) => typeof valor !== 'string' || valor.includes('\0'))) {
      return res.status(400).json({ erro: 'Os parâmetros de consulta devem ter um único valor textual' });
    }
    const where = {};

    if (categoria) {
      where.categoriaRelacao = { chave: categoria.trim().replace(/\s+/gu, ' ').toLowerCase() };
    }

    if (cidade) {
      where.cidade = { equals: String(cidade), mode: 'insensitive' };
    }

    if (tag) {
      where.tags = {
        some: {
          tag: { nome: { equals: String(tag), mode: 'insensitive' } },
        },
      };
    }

    if (ate !== undefined) {
      const distanciaMaxima = Number(ate);
      if (ate.trim() === '' || !Number.isFinite(distanciaMaxima) || distanciaMaxima < 0) {
        return res.status(400).json({ erro: 'O parâmetro ate deve ser um número maior ou igual a zero' });
      }
      where.distanciaCentroKm = { not: null, lte: distanciaMaxima };
    }

    if (q?.trim()) {
      // Escapa curingas do LIKE para que a busca textual trate %, _ e barra invertida literalmente.
      const termo = q.trim().replace(/[\\%_]/g, '\\$&');
      where.OR = [{ nome: { contains: termo, mode: 'insensitive' } }, { descricao: { contains: termo, mode: 'insensitive' } }];
    }

    const consulta = {
      where,
      include: { tags: { include: { tag: true } } },
    };

    if (ordem === 'nome') {
      consulta.orderBy = { nome: 'asc' };
    } else if (ordem) {
      return res.status(400).json({ erro: 'Ordenação suportada: ordem=nome' });
    }

    if (pagina !== undefined || tamanho !== undefined) {
      const numeroPagina = Number(pagina ?? 1);
      const tamanhoPagina = Number(tamanho ?? 3);
      if (!Number.isSafeInteger(numeroPagina) || numeroPagina < 1 || !Number.isSafeInteger(tamanhoPagina) || tamanhoPagina < 1 || tamanhoPagina > 2147483647 || !Number.isSafeInteger((numeroPagina - 1) * tamanhoPagina) || (numeroPagina - 1) * tamanhoPagina > 2147483647) {
        return res.status(400).json({ erro: 'pagina e tamanho devem ser números inteiros positivos' });
      }
      // skip é o deslocamento; take limita o número de registros retornados.
      consulta.skip = (numeroPagina - 1) * tamanhoPagina;
      consulta.take = tamanhoPagina;
    }

    const atracoes = await prisma.atracao.findMany(consulta);
    res.json(atracoes.map(serializarAtracao));
  } catch (erro) {
    next(erro);
  }
}

/**
 * GET /atracoes/:id: consulta tags e avaliações, calcula média/total e responde 404 se ausente.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function buscarPorId(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const atracao = await prisma.atracao.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, avaliacoes: { orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }] } },
    });

    if (!atracao) {
      return res.status(404).json({ erro: 'Atração não encontrada' });
    }

    const resumo = await prisma.avaliacao.aggregate({ where: { atracaoId: id }, _avg: { nota: true }, _count: true });
    res.json({ ...serializarAtracao(atracao), avaliacoes: atracao.avaliacoes, notaMedia: resumo._avg.nota, totalAvaliacoes: resumo._count });
  } catch (erro) {
    next(erro);
  }
}

/**
 * POST /atracoes: cria a atração e seus vínculos; responde 201 com Location.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function criar(req, res, next) {
  try {
    const { nome, categoria, descricao, localizacao, distanciaCentroKm, tags } = req.body ?? {};

    if (!nome || !categoria || !descricao) {
      return res.status(400).json({
        erro: 'Os campos nome, categoria e descricao são obrigatórios',
      });
    }

    const nova = await prisma.atracao.create({
      data: {
        nome,
        categoria,
        categoriaRelacao: relacionarCategoria(categoria),
        descricao,
        cidade: localizacao?.cidade ?? 'Balsas',
        estado: localizacao?.estado ?? 'MA',
        distanciaCentroKm: distanciaCentroKm ?? null,
        tags: { create: relacionamentosDeTags(tags) },
      },
      include: { tags: { include: { tag: true } } },
    });

    res.status(201).location(`/atracoes/${nova.id}`).json(serializarAtracao(nova));
  } catch (erro) {
    next(erro);
  }
}

/**
 * PUT /atracoes/:id: substitui os campos previstos, usando os padrões quando opcionais são omitidos.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { nome, categoria, descricao, localizacao, distanciaCentroKm, tags } = req.body ?? {};

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    if (!nome || !categoria || !descricao) {
      return res.status(400).json({
        erro: 'Os campos nome, categoria e descricao são obrigatórios',
      });
    }

    const existente = await prisma.atracao.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      return res.status(404).json({ erro: 'Atração não encontrada' });
    }

    // A transação mantém a remoção dos vínculos e a atualização juntas; não exclui as tags compartilhadas.
    const atracao = await prisma.$transaction(async (tx) => {
      await tx.atracaoTag.deleteMany({ where: { atracaoId: id } });
      return tx.atracao.update({
      where: { id },
      data: {
        nome,
        categoria,
        categoriaRelacao: relacionarCategoria(categoria),
        descricao,
        cidade: localizacao?.cidade ?? 'Balsas',
        estado: localizacao?.estado ?? 'MA',
        distanciaCentroKm: distanciaCentroKm ?? null,
        tags: {
          create: relacionamentosDeTags(tags),
        },
      },
      include: { tags: { include: { tag: true } } },
      });
    });

    res.json(serializarAtracao(atracao));
  } catch (erro) {
    next(erro);
  }
}

/**
 * PATCH /atracoes/:id: modifica somente campos enviados e substitui tags apenas se presentes.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function atualizarParcial(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const existente = await prisma.atracao.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      return res.status(404).json({ erro: 'Atração não encontrada' });
    }

    const corpo = req.body ?? {};
    const data = {};

    if (corpo.nome !== undefined) data.nome = corpo.nome;
    if (corpo.categoria !== undefined) { data.categoria = corpo.categoria; data.categoriaRelacao = relacionarCategoria(corpo.categoria); }
    if (corpo.descricao !== undefined) data.descricao = corpo.descricao;
    if (corpo.distanciaCentroKm !== undefined) data.distanciaCentroKm = corpo.distanciaCentroKm;
    if (corpo.localizacao?.cidade !== undefined) data.cidade = corpo.localizacao.cidade;
    if (corpo.localizacao?.estado !== undefined) data.estado = corpo.localizacao.estado;
    if (corpo.tags !== undefined) {
      data.tags = {
        create: relacionamentosDeTags(corpo.tags),
      };
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo válido foi enviado para atualização' });
    }

    const atracao = await prisma.$transaction(async (tx) => {
      if (corpo.tags !== undefined) await tx.atracaoTag.deleteMany({ where: { atracaoId: id } });
      return tx.atracao.update({
      where: { id },
      data,
      include: { tags: { include: { tag: true } } },
      });
    });

    res.json(serializarAtracao(atracao));
  } catch (erro) {
    next(erro);
  }
}

/**
 * DELETE /atracoes/:id: exclui o registro existente e responde 204 sem corpo.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function remover(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const existente = await prisma.atracao.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      return res.status(404).json({ erro: 'Atração não encontrada' });
    }

    // O schema define cascata para avaliações e AtracaoTag; categorias e tags não são excluídas aqui.
    await prisma.atracao.delete({ where: { id } });
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
}

/**
 * GET /categorias: lista nomes ou objetos com a contagem de atrações por categoria.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function listarCategorias(req, res, next) {
  try {
    if (Object.values(req.query).some((v) => typeof v !== 'string') || (req.query.formato !== undefined && req.query.formato !== 'nomes')) {
      return res.status(400).json({ erro: 'Formato suportado: formato=nomes' });
    }
    const categorias = await prisma.categoria.findMany({
      include: { _count: { select: { atracoes: true } } }, orderBy: { nome: 'asc' },
    });
    res.json(req.query.formato === 'nomes' ? categorias.map((c) => c.nome) : categorias.map(({ id, nome, _count }) => ({ id, nome, atracoes: _count.atracoes })));
  } catch (erro) { next(erro); }
}

/**
 * POST /atracoes/:id/avaliacoes: conecta a avaliação à atração e responde 201 após a validação da rota.
 * @param {import("express").Request} req - Requisição validada pelos middlewares da rota.
 * @param {import("express").Response} res - Resposta HTTP.
 * @param {import("express").NextFunction} next - Encaminha falhas ao tratamento central de erros.
 */
export async function avaliar(req, res, next) {
  try {
    const atracaoId = Number(req.params.id);
    const { visitante, nota, comentario } = req.body;
    const avaliacao = await prisma.avaliacao.create({ data: {
      visitante: visitante.trim(), nota, comentario: comentario ?? null,
      atracao: { connect: { id: atracaoId } },
    } });
    res.status(201).location(`/atracoes/${atracaoId}`).json(avaliacao);
  } catch (erro) { next(erro); }
}
