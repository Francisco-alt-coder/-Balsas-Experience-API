/** Verifica conexão e SELECT 1; considera a credencial antiga revogada apenas quando recebe 28P01. */
// Somente conexão e SELECT 1; não carrega .env nem mostra URLs/erros internos.
import pg from 'pg';
const mode = process.argv[2];
if (!['new', 'old'].includes(mode)) throw new Error('Use new ou old');
const connectionString = process.env[mode === 'new' ? 'NEW_DATABASE_URL' : 'OLD_DATABASE_URL'];
if (!connectionString) throw new Error('Variável de credencial não definida');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('SELECT 1');
  console.log(mode === 'new' ? 'NOVA CREDENCIAL: conexão aprovada' : 'ANTIGA CREDENCIAL: ainda válida; publicação bloqueada');
  process.exitCode = mode === 'new' ? 0 : 1;
} catch (error) {
  // Timeout/DNS/rede não comprovam revogação. Somente rejeição de senha.
  const revoked = mode === 'old' && error.code === '28P01';
  console.log(revoked ? 'ANTIGA CREDENCIAL: senha rejeitada (28P01)' : 'INCONCLUSIVO/FALHA: conexão não confirmada');
  process.exitCode = revoked ? 0 : 1;
} finally {
  await client.end().catch(() => {});
}
