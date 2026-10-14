/** Protege as operações de escrita com o segredo compartilhado API_WRITE_TOKEN. */
import { createHash, timingSafeEqual } from 'node:crypto';
/**
 * Interrompe a inicialização quando o segredo está ausente ou não atende aos critérios implementados.
 * @param {object} [env=process.env] - Ambiente com API_WRITE_TOKEN.
 * @returns {string} Segredo validado, usado somente internamente.
 * @throws {Error} Quando o segredo é ausente ou trivial.
 */
export function validarTokenConfigurado(env = process.env) {
  const token = env.API_WRITE_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || /\s/u.test(token) || new Set(token).size < 10 || /^(token|changeme|substitua|exemplo)/i.test(token)) {
    throw new Error('API_WRITE_TOKEN deve conter um segredo não trivial de pelo menos 32 caracteres, sem espaços.');
  }
  return token;
}
/**
 * Exige Authorization: Bearer e responde 401 com WWW-Authenticate quando a credencial é inválida.
 */
export function autenticarEscrita(req, res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  // SHA-256 gera buffers de tamanho igual para a comparação por timingSafeEqual.
  const hash = (value) => createHash('sha256').update(value).digest();
  const esperado = process.env.API_WRITE_TOKEN;
  if (!esperado || !match || !timingSafeEqual(hash(match[1]), hash(esperado))) {
    return res.status(401).set('WWW-Authenticate', 'Bearer').json({ erro: 'Credenciais ausentes ou inválidas' });
  }
  next();
}
