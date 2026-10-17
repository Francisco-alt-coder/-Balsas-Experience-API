/** Inicializa o Express, registra as rotas públicas e centraliza erros e encerramento da API. */
import './lib/load-runtime-env.js';
import express from 'express';
import { configurarCors } from './middlewares/cors.js';
import atracoesRoutes from './routes/atracoes.routes.js';
import webRoutes from './routes/web.routes.js';
import { listarCategorias } from './controllers/atracoes.controller.js';
import prisma from './lib/prisma.js';
import { validarTokenConfigurado } from './middlewares/autenticacao.js';
import { criarHealthCheck, liveness } from './controllers/health.controller.js';
import { erroSanitizado } from './lib/safe-error.js';

const app = express();
const PORTA = process.env.PORT || 3000;
if (!/^\d+$/.test(String(PORTA)) || Number(PORTA) < 1 || Number(PORTA) > 65535) {
  throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
}

app.disable('x-powered-by');
// Informa ao navegador que ele não deve tentar adivinhar o tipo dos arquivos.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
validarTokenConfigurado();
app.use(configurarCors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    nome: 'Balsas Experience API',
    versao: '2.0.0',
    descricao: 'API de experiências turísticas em Balsas-MA com PostgreSQL e Prisma ORM',
  });
});

app.get('/health', criarHealthCheck(prisma));
app.get('/live', liveness);

// A apresentação HTML é solicitada apenas por navegadores; a API REST mantém JSON.
app.use(webRoutes);
app.get('/categorias', listarCategorias);
app.use('/atracoes', atracoesRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Traduz falhas de parsing, CORS e Prisma para o contrato HTTP sem expor detalhes internos.
app.use((erro, req, res, next) => {
  // Não registre corpo, URL de conexão ou mensagens que possam conter credenciais.
  console.error('Falha na requisição', erroSanitizado(erro));

  if (erro?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Corpo da requisição inválido' });
  }

  if (erro?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição excede o limite permitido' });
  }
  if (erro?.type === 'charset.unsupported' || erro?.type === 'encoding.unsupported') {
    return res.status(415).json({ erro: 'Codificação do corpo não suportada' });
  }

  if (erro?.code === 'P2025') {
    return res.status(404).json({ erro: 'Atração não encontrada' });
  }

  if (erro?.code === 'CORS_ORIGIN_DENIED') {
    return res.status(403).json({ erro: 'Origem não permitida' });
  }
  // P2002 indica unicidade e P2003 integridade referencial: ambos geram conflito HTTP 409.
  if (['P2002', 'P2003'].includes(erro?.code)) {
    return res.status(409).json({ erro: 'Conflito com os dados existentes' });
  }

  res.status(500).json({ erro: 'Erro interno no servidor' });
});

// Em produção o servidor escuta a rede; localmente aceita só conexões do computador.
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const servidor = app.listen(Number(PORTA), host, () => {
  console.log(`Servidor executando na porta ${PORTA}`);
});

servidor.on('error', (erro) => {
  console.error('Falha ao iniciar servidor', { codigo: erro.code });
  process.exitCode = 1;
  void prisma.$disconnect();
});

let encerrando = false;
/**
 * Evita encerramentos duplicados, fecha o servidor e desconecta o Prisma com prazo de dez segundos.
 */
function encerrar() {
  if (encerrando) return;
  encerrando = true;
  const prazo = setTimeout(() => process.exit(1), 10000);
  prazo.unref();
  servidor.close(async () => {
    try {
      await prisma.$disconnect();
      clearTimeout(prazo);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
