/** Define as rotas relativas a /atracoes e a ordem dos middlewares de cada operação. */
import express from 'express';
import { autenticarEscrita } from '../middlewares/autenticacao.js';
import { validarAvaliacao } from '../middlewares/validacao.js';
import { validarAtracao, validarId } from '../middlewares/validacao.js';
import {
  atualizar,
  atualizarParcial,
  buscarPorId,
  criar,
  listar,
  remover,
  avaliar,
} from '../controllers/atracoes.controller.js';

const router = express.Router();

// Leitura pública; as rotas com ID validam o identificador antes da consulta.
router.get('/', listar);
router.get('/:id', validarId, buscarPorId);
// Escrita: autenticação precede validação e controlador; PATCH usa validação parcial.
router.post('/', autenticarEscrita, validarAtracao(), criar);
router.put('/:id', autenticarEscrita, validarId, validarAtracao(), atualizar);
router.patch('/:id', autenticarEscrita, validarId, validarAtracao(true), atualizarParcial);
router.delete('/:id', autenticarEscrita, validarId, remover);
router.post('/:id/avaliacoes', autenticarEscrita, validarId, validarAvaliacao, avaliar);

export default router;
