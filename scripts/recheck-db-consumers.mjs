import { loadAdminConnection } from './lib/admin-credentials.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
const config = dotenv.parse(await readFile('.env'));
const report = { checkedAt: new Date().toISOString(), configs: [] };
function describe(label, value) {
  if (!value) return;
  const u = new URL(value);
  report.configs.push({ label, host: u.hostname, port: u.port || '5432', database: decodeURIComponent(u.pathname.slice(1)), user: decodeURIComponent(u.username), passwordPresent: Boolean(u.password) });
}
describe('.env DATABASE_URL', config.DATABASE_URL);
describe('.env DIRECT_URL', config.DIRECT_URL);
describe('process DATABASE_URL', process.env.DATABASE_URL);
describe('process DIRECT_URL', process.env.DIRECT_URL);
try {
  const test = JSON.parse(await readFile('backups/test-env.json', 'utf8'));
  describe('backups/test-env.json DATABASE_URL', test.DATABASE_URL);
} catch(e) { report.testConfigReadError = e.code || 'INVALID'; }
const client = new pg.Client({ connectionString: (await loadAdminConnection()).href, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  report.connection = 'SELECT approved';
  report.identity = (await client.query('SELECT current_user, current_database(), inet_server_addr()::text server_address, inet_server_port() server_port')).rows[0];
  report.activity = (await client.query('SELECT datname, usename, application_name, client_addr::text, state, count(*)::int connections FROM pg_stat_activity WHERE usename = current_user GROUP BY 1,2,3,4,5 ORDER BY 1,2,3')).rows;
  report.databases = (await client.query('SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname')).rows;
} catch(e) { report.connection = 'failed'; report.sqlState = e.code; process.exitCode = 1; }
finally { await client.end().catch(() => {}); }
await writeFile('backups/rechecagem-banco-consumidores.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
