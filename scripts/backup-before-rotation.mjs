import { loadAdminConnection } from './lib/admin-credentials.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
// Ler explicitamente arquivo privado evita DATABASE_URL injetada por outro ambiente.
const config = dotenv.parse(await readFile('.env'));
const url = await loadAdminConnection();
if(process.env.BALSAS_ADMIN_ALLOW_MUTATION!=='YES')throw new Error('Restauracao de verificacao requer autorizacao e opt-in explicito');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Somente local');
const stamp = Date.now();
const dir = 'backups/rotacao-' + stamp;
await mkdir(dir, { recursive: true });
const binary = 'C:/Program Files/PostgreSQL/18/bin/';
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
function run(name, args, database) {
  const r = spawnSync(binary + name + '.exe', args, { env: { ...env, PGDATABASE: database }, windowsHide: true });
  if (r.status !== 0) throw new Error(name + ' falhou; rotação bloqueada');
  return r;
}
async function snapshot(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const result = {};
    for (const { tablename } of tables) {
      const name = '"' + tablename.replaceAll('"', '""') + '"';
      const rows = (await client.query('SELECT * FROM ' + name + ' ORDER BY 1,2')).rows;
      result[tablename] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }
    return result;
  } finally { await client.end(); }
}
const testConfig = JSON.parse(await readFile('backups/test-env.json', 'utf8'));
const testUrl = new URL(testConfig.DATABASE_URL);
if (testUrl.hostname !== url.hostname || !testUrl.pathname.startsWith('/balsas_lab08_test_')) throw new Error('Teste fora do escopo');
const testAdminUrl=new URL(url);testAdminUrl.pathname=testUrl.pathname;
const databases = [url, testAdminUrl];
const report = { dir, backupVerified: false, databases: [] };
for (const source of databases) {
  const dbname = decodeURIComponent(source.pathname.slice(1));
  const file = dir + '/' + dbname + '.dump';
  const before = await snapshot(source.href);
  run('pg_dump', ['-Fc', '-f', file], dbname);
  const catalog = run('pg_restore', ['--list', file], dbname);
  if (!catalog.stdout.includes(Buffer.from('TABLE DATA'))) throw new Error('Catálogo sem dados');
  report.databases.push({ database: dbname, file, sha256: createHash('sha256').update(await readFile(file)).digest('hex'), before });
}
const verifyName = 'balsas_rotation_verify_' + stamp;
const admin = new pg.Client({ connectionString: url.href });
await admin.connect();
try { await admin.query('CREATE DATABASE "' + verifyName + '"'); }
finally { await admin.end(); }
run('pg_restore', ['--exit-on-error', '-d', verifyName, report.databases[0].file], verifyName);
const restoredUrl = new URL(url.href); restoredUrl.pathname = '/' + verifyName;
const restored = await snapshot(restoredUrl.href);
if (JSON.stringify(restored) !== JSON.stringify(report.databases[0].before)) throw new Error('Hashes da restauração divergentes; interromper');
report.restore = { database: verifyName, hashesEqual: true, tables: restored };
report.backupVerified = true;
await writeFile(dir + '/verificacao.json', JSON.stringify(report, null, 2));
await writeFile('docs/backup-rotacao-verificado.json', JSON.stringify(report, null, 2));
console.log('Backup das duas bases criado; restauração da base principal com hashes de todas as tabelas idênticos. Base de verificação preservada.');
