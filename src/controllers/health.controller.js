/** Rotas para verificar a disponibilidade do servidor e do banco. */
export function criarHealthCheck(prisma) {
  return async (req, res, next) => {
    try {
      // Uma consulta simples confirma o acesso ao PostgreSQL.
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', banco: 'conectado' });
    } catch (erro) {
      next(erro);
    }
  };
}

// /live confirma apenas que o processo HTTP está respondendo.
export function liveness(req, res) {
  res.json({ status: 'ok' });
}
