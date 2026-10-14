/** Corrige sequências de IDs após inserções explícitas; realiza escrita no PostgreSQL. */
// IDs explícitos do seed não avançam sequências SERIAL do PostgreSQL.
// Só avance uma sequência atrasada; nunca reduza IDs já reservados.
/**
 * Bloqueia as tabelas durante a comparação e avança somente sequências inferiores ao maior ID existente.
 * @param {import("@prisma/client").PrismaClient} prisma - Cliente com permissão de escrita administrativa.
 * @returns {Promise<object>} Valores ajustados ou indicação de ausência de alteração.
 */
export async function sincronizarSequencias(prisma) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "atracoes", "tags" IN SHARE ROW EXCLUSIVE MODE`;
    const atracoes = await tx.$queryRaw`
      SELECT setval(pg_get_serial_sequence('atracoes', 'id'), (SELECT MAX(id) FROM "atracoes"), true)::text AS valor
      WHERE (SELECT MAX(id) FROM "atracoes") > (SELECT last_value FROM "atracoes_id_seq")
    `;
    const tags = await tx.$queryRaw`
      SELECT setval(pg_get_serial_sequence('tags', 'id'), (SELECT MAX(id) FROM "tags"), true)::text AS valor
      WHERE (SELECT MAX(id) FROM "tags") > (SELECT last_value FROM "tags_id_seq")
    `;
    return { atracoes: atracoes[0]?.valor ?? 'sem alteração', tags: tags[0]?.valor ?? 'sem alteração' };
  });
}
