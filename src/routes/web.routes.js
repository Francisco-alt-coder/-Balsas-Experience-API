/** Interface de leitura para visitantes, sem modificar o contrato JSON da API REST. */
import express from 'express';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';

const router = express.Router();
const pastaPublica = fileURLToPath(new URL('../../public/', import.meta.url));
const pagina = fileURLToPath(new URL('../../public/atracoes.html', import.meta.url));
const paginaDetalhes = fileURLToPath(new URL('../../public/atracao.html', import.meta.url));
const paginaCadastro = fileURLToPath(new URL('../../public/cadastro.html', import.meta.url));
const paginaExclusao = fileURLToPath(new URL('../../public/exclusao.html', import.meta.url));
const paginaNaoEncontrada = fileURLToPath(new URL('../../public/erro-404.html', import.meta.url));

function apresentarPagina(req, res, arquivo, status = 200) {
  // A política impede execução de scripts externos e mantém as consultas no mesmo domínio.
  res.set({
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  return res.status(status).sendFile(arquivo);
}

function apresentarCatalogo(req, res) {
  return apresentarPagina(req, res, pagina);
}

function apresentarDetalhes(req, res) {
  return apresentarPagina(req, res, paginaDetalhes);
}

// Recursos públicos limitados à pasta da interface, sem expor arquivos do projeto.
router.use('/site', express.static(pastaPublica, { index: false, dotfiles: 'deny', maxAge: '5m' }));

// Endereço direto, útil para apresentação e divulgação do catálogo.
router.get('/explorar', apresentarCatalogo);
// Formulários acadêmicos: páginas visuais; as escritas continuam protegidas nas rotas REST.
router.get('/cadastro', (req, res) => apresentarPagina(req, res, paginaCadastro));
router.get('/exclusao', (req, res) => apresentarPagina(req, res, paginaExclusao));

// Navegadores pedem HTML. Clientes REST continuam recebendo JSON (application/json ou */*).
router.get('/atracoes', (req, res, next) => {
  res.vary('Accept');
  const aceitaHtml = /\btext\/html\b/i.test(req.get('Accept') || '');
  if (aceitaHtml && req.query.formato !== 'json') return apresentarCatalogo(req, res);
  return next();
});

// HTML segue o status do registro: 404 real quando o ID não existe no banco.
// Clientes que pedem JSON continuam usando a rota REST, sem consultas duplicadas.
router.get('/atracoes/:id', async (req, res, next) => {
  res.vary('Accept');
  const aceitaHtml = /\btext\/html\b/i.test(req.get('Accept') || '');
  if (!aceitaHtml || req.query.formato === 'json') return next();

  // IDs inválidos continuam sujeitos à validação padrão da API (HTTP 400).
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    return next();
  }
  try {
    const atracao = await prisma.atracao.findUnique({ where: { id }, select: { id: true } });
    return atracao
      ? apresentarDetalhes(req, res)
      : apresentarPagina(req, res, paginaNaoEncontrada, 404);
  } catch (erro) {
    return next(erro);
  }
});

export default router;
