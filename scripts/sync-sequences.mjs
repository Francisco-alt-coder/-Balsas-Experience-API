/** Executa a correção administrativa das sequências com opt-in e encerra o cliente Prisma. */
import { loadAdminConnection } from './lib/admin-credentials.mjs';
const adminUrl=await loadAdminConnection();
if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES')throw new Error('Sincronizacao requer autorizacao e opt-in explicito');
process.env.DATABASE_URL=adminUrl.href;
const {default:prisma}=await import('../src/lib/prisma.js');
import { sincronizarSequencias } from '../src/lib/sequences.js';
try { console.log(JSON.stringify(await sincronizarSequencias(prisma))); }
catch (erro) { console.error('Falha ao sincronizar sequências', { codigo: erro.code ?? erro.name }); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
