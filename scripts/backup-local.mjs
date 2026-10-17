/** Gera dump local, verifica seu catálogo e salva um snapshot para comparação posterior. */
import { loadAdminConnection } from './lib/admin-credentials.mjs';
import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url = await loadAdminConnection();
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Somente banco local autorizado');
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)) };
await mkdir('backups', { recursive: true });
const arquivo = 'backups/antes-lab08.dump';
const bin = 'C:/Program Files/PostgreSQL/18/bin/';
const dump = spawnSync(bin + 'pg_dump.exe', ['-Fc', '-f', arquivo], { env, windowsHide: true });
if (dump.status !== 0) throw new Error('Backup falhou; migração bloqueada');
const leitura = spawnSync(bin + 'pg_restore.exe', ['--list', arquivo], { env, windowsHide: true });
if (leitura.status !== 0 || !leitura.stdout.includes(Buffer.from('TABLE DATA'))) throw new Error('Backup ilegível');
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try {
  const original = {};
  for (const tabela of ['atracoes', 'tags', 'atracao_tags']) {
    const { rows } = await client.query(`SELECT * FROM "${tabela}" ORDER BY 1,2`);
    original[tabela] = { rows, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  await writeFile('backups/originais.json', JSON.stringify(original, null, 2));
  await writeFile('backups/backup-lab08.json', JSON.stringify({ arquivo, leitura: true, tabelas: Object.fromEntries(Object.entries(original).map(([k,v]) => [k,{ count:v.rows.length, sha256:v.sha256 }])) }, null, 2));
  console.log('Backup completo criado e catálogo lido; snapshot original salvo sem credenciais.');
} finally { await client.end(); }
