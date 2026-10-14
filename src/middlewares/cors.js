/** Restringe as origens de navegador conforme a configuração de CORS_ORIGINS. */
import cors from 'cors';

/**
 * Cria o middleware com origens exatas; requisições sem Origin também são aceitas.
 * @param {object} [env=process.env] - Ambiente com NODE_ENV e CORS_ORIGINS.
 * @returns {import("express").RequestHandler} Middleware CORS.
 */
export function configurarCors(env = process.env) {
  // Política explícita para uma API sem frontend de navegador autorizado.
  const bloquearOrigens = env.CORS_ORIGINS?.trim() === 'none';
  const origens = (bloquearOrigens ? '' : env.CORS_ORIGINS ?? (env.NODE_ENV === 'production' ? '' :
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'))
    .split(',').map((origem) => origem.trim()).filter(Boolean);
  if (env.NODE_ENV === 'production' && origens.length === 0 && !bloquearOrigens) {
    throw new Error('Configure CORS_ORIGINS em produção.');
  }
  for (const origem of origens) {
    let url;try{url=new URL(origem);}catch{throw new Error('CORS_ORIGINS deve conter origens HTTP/HTTPS válidas.');}
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origem) {
      throw new Error('CORS_ORIGINS deve conter origens HTTP/HTTPS exatas, sem caminho.');
    }
  }
  return cors({
    origin(origem, callback) {
      if (!origem || origens.includes(origem)) return callback(null, true);
      const erro = new Error('Origem não permitida');
      erro.status = 403;
      erro.code = 'CORS_ORIGIN_DENIED';
      callback(erro);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
}
