/** Insere atrações iniciais ausentes por ID e sincroniza sequências mediante opt-in administrativo. */
import {loadAdminConnection} from '../scripts/lib/admin-credentials.mjs';
if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES')throw new Error('Seed requer autorizacao e opt-in explicito');
import 'dotenv/config';
import { relacionarCategoria } from '../src/lib/categorias.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { sincronizarSequencias } from '../src/lib/sequences.js';
import atracoes from '../src/data/atracoes.json' with { type: 'json' };

const adapter = new PrismaPg({ connectionString: (await loadAdminConnection()).href });
const prisma = new PrismaClient({ adapter });

function normalizarTags(tags = []) {
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

/**
 * Percorre os dados iniciais: upsert com update vazio preserva registros que já têm o mesmo ID.
 */
async function main() {
  for (const item of atracoes) {
    await prisma.atracao.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        categoriaRelacao: relacionarCategoria(item.categoria),
        descricao: item.descricao,
        cidade: item.localizacao.cidade,
        estado: item.localizacao.estado,
        distanciaCentroKm: item.distanciaCentroKm,
        tags: {
          create: normalizarTags(item.tags).map((nome) => ({
            tag: {
              connectOrCreate: {
                where: { nome },
                create: { nome },
              },
            },
          })),
        },
      },
    });
  }

  await sincronizarSequencias(prisma);
  console.log(`${atracoes.length} atrações inseridas/atualizadas no PostgreSQL.`);
}

main()
  .catch((erro) => {
    console.error('Falha no seed', { codigo: erro.code ?? erro.name });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
