/** Prepara o vínculo de cada atração com uma categoria identificada por chave normalizada. */
/**
 * Prepara connectOrCreate por chave em minúsculas, mantendo o nome normalizado para exibição.
 * @param {string} nome - Categoria textual já validada.
 * @returns {object} Operação de relacionamento para uma escrita Prisma.
 */
export function relacionarCategoria(nome) {
  const normalizado = nome.trim().replace(/\s+/gu, ' ');
  const chave = normalizado.toLowerCase();
  return { connectOrCreate: { where: { chave }, create: { nome: normalizado, chave } } };
}
