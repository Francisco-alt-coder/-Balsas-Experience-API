/** Cria e restaura um banco local de testes com autorização por opt-in; não provisiona a identidade runtime. */
import { loadAdminConnection } from './lib/admin-credentials.mjs';
import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const url = await loadAdminConnection();
if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES')throw new Error('Preparacao de banco requer autorizacao e opt-in explicito');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Somente PostgreSQL local');
const nome = 'balsas_lab08_test_' + Date.now();
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try { await client.query(`CREATE DATABASE "${nome}"`); } finally { await client.end(); }
url.pathname = '/' + nome;
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: nome, DATABASE_URL: url.href };
const restored = spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe', ['--exit-on-error', '-d', nome, 'backups/antes-lab08.dump'], { env, windowsHide: true });
if (restored.status !== 0) throw new Error('Restauração falhou');
const test = new pg.Client({ connectionString: url.href });
await test.connect();
try {
  const { rows } = await test.query('SELECT (SELECT count(*) FROM atracoes)::int atracoes, (SELECT count(*) FROM tags)::int tags, (SELECT count(*) FROM atracao_tags)::int vinculos');
  if (rows[0].atracoes !== 8 || rows[0].tags !== 15 || rows[0].vinculos !== 32) throw new Error('Contagens restauradas divergentes');
  // Never replace isolated runtime configuration with an administrative secret.
  // Provision runtime/fixtures/HBA separately under a reviewed authorization.
  await writeFile('backups/restauracao-lab08.json', JSON.stringify({ banco: nome, restaurado: true, contagens: rows[0] }, null, 2));
  console.log('Restauração isolada validada:', nome);
} finally { await test.end(); }
