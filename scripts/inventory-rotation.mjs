import { loadAdminConnection } from './lib/admin-credentials.mjs';
import 'dotenv/config';
import pg from 'pg';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const url = await loadAdminConnection();
const report = { local: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), configMatches: [], scanErrors: [], scanRoots: process.argv.slice(2) };
const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  report.urlPasswordPresent = Boolean(url.password);
  report.effectivePasswordPresent = Boolean(client.password);
  report.credentialEnvNames = Object.keys(process.env).filter(k => /^(PG|DATABASE_URL|DIRECT_URL)/.test(k));
  report.roleHasPassword = (await client.query('SELECT rolpassword IS NOT NULL present FROM pg_authid WHERE rolname=current_user')).rows[0].present;
  report.role = (await client.query("SELECT current_user, current_database(), (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser, current_setting('log_statement') log_statement, current_setting('log_min_duration_statement') log_min_duration_statement")).rows[0];
  report.activity = (await client.query('SELECT datname,application_name,client_addr::text,state,count(*)::int connections FROM pg_stat_activity WHERE usename=current_user GROUP BY 1,2,3,4 ORDER BY 1,2')).rows;
  report.hba = (await client.query('SELECT type,database,user_name,address,auth_method,error FROM pg_hba_file_rules ORDER BY rule_number')).rows;
  report.databases = (await client.query('SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname')).rows;
} catch { console.error('Inventário PostgreSQL falhou; nenhum segredo exibido'); process.exitCode = 1; }
finally { await client.end(); }
const skips = new Set(['node_modules', '.git', '.npm-cache', '.tools', 'tmp', '.venv', 'venv', 'AppData']);
async function walk(dir) {
  let items;
  try { items = await readdir(dir, { withFileTypes: true }); } catch { report.scanErrors.push(dir); return; }
  for (const item of items) {
    const file = path.join(dir, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) { if (!skips.has(item.name)) await walk(file); continue; }
    if (!/(?:\.env(?:\..*)?|\.(?:json|js|mjs|ts|yaml|yml|toml|ini|conf|config|xml|properties|ps1|bat|cmd))$/i.test(item.name)) continue;
    let body;
    try { body = await readFile(file, 'utf8'); } catch { report.scanErrors.push(file); continue; }
    const exactSecret = Boolean(url.password && body.includes(decodeURIComponent(url.password)));
    const related = [];
    for (const m of body.matchAll(/postgres(?:ql)?:\/\/[^\s"'`<>]+/g)) {
      try {
        const other = new URL(m[0]);
        if (decodeURIComponent(other.username) === decodeURIComponent(url.username) && ['localhost', '127.0.0.1', '[::1]'].includes(other.hostname) && (other.port || '5432') === (url.port || '5432')) related.push({ database: decodeURIComponent(other.pathname.slice(1)), samePassword: other.password === url.password });
      } catch {}
    }
    if (exactSecret || related.length) report.configMatches.push({ file, exactSecret, related });
  }
}
for (const root of report.scanRoots) await walk(root);
await writeFile('backups/inventario-rotacao.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
