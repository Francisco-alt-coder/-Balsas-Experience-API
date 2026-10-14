/** Testes automatizados de controladores com consultas simuladas e validação de PATCH. */
import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { listar } from '../src/controllers/atracoes.controller.js';
import { validarCorpo } from '../src/middlewares/validacao.js';

test('listagem de tabela vazia retorna 200 e [] sem alterar banco real', async () => {
  const original = prisma.atracao.findMany;
  prisma.atracao.findMany = async () => [];
  try {
    let resposta;
    await listar({ query: {} }, { json(valor) { resposta = valor; } }, (erro) => { throw erro; });
    assert.deepEqual(resposta, []);
  } finally { prisma.atracao.findMany = original; }
});

test('falha de consulta é encaminhada ao middleware de erros', async () => {
  const original = prisma.atracao.findMany;
  const falha = new Error('falha simulada');
  prisma.atracao.findMany = async () => { throw falha; };
  try {
    let recebido;
    await listar({ query: {} }, { json() { assert.fail('não pode responder sucesso'); } }, (erro) => { recebido = erro; });
    assert.equal(recebido, falha);
  } finally { prisma.atracao.findMany = original; }
});

test('validação de PATCH protege campos obrigatórios e tipos', () => {
  for (const corpo of [{ nome: null }, { categoria: ' ' }, { descricao: [] }, { tags: [3] }, { localizacao: 'Balsas - MA' }, { distanciaCentroKm: -1 }, { id: 1 }, {}]) {
    assert.equal(typeof validarCorpo(corpo, true), 'string');
  }
  assert.equal(validarCorpo({ descricao: 'Nova descrição' }, true), null);
});
