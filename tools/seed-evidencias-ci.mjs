/** Carga de dados exclusiva do banco descartável do GitHub Actions. Não se aplica à produção. */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import atracoes from '../src/data/atracoes.json' with { type: 'json' };
import { relacionarCategoria } from '../src/lib/categorias.js';
const u = new URL(process.env.DATABASE_URL ?? '');
if (process.env.GITHUB_ACTIONS !== 'true'
    || !['localhost','127.0.0.1'].includes(u.hostname)
    || u.pathname !== '/balsas_evidencias'
    || process.env.NODE_ENV === 'production') {
  throw new Error('Carga de teste permitida exclusivamente no CI e banco local descartável.');
}
const db = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
try {
  for (const item of atracoes) {
    await db.atracao.create({
      data: {
        id: item.id, nome: item.nome, descricao: item.descricao,
        categoria: item.categoria,
        categoriaRelacao: relacionarCategoria(item.categoria),
        cidade: item.localizacao.cidade, estado: item.localizacao.estado,
        distanciaCentroKm: item.distanciaCentroKm,
        tags: {
          create: [...new Set(item.tags)].map(nome => ({
            tag: { connectOrCreate: { where: {nome},create:{nome} }}
          }))
        }
      }
    });
  }
  await db.$executeRawUnsafe('SELECT setval(pg_get_serial_sequence(\'atracoes\',\'id\'), (SELECT MAX(id) FROM atracoes))');
  console.log('Oito atrações inseridas no PostgreSQL descartável do CI.');
} finally {await db.$disconnect();}
