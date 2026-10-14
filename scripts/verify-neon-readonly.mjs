/** Inspeciona somente metadados Neon; não carrega .env nem credenciais locais. */
import pg from 'pg';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
import {configurarBanco} from '../src/lib/database-config.js';

let client;
let stage = 'VALIDATION';
try {
  const value = process.env.NEON_READONLY_URL;
  if (!value) throw Object.assign(new Error(), {code: 'NEON_READONLY_URL_MISSING'});
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw Object.assign(new Error(), {code: 'TLS_VERIFICATION_DISABLED'});
  const url = new URL(value);
  if (!url.hostname.endsWith('.neon.tech') || !url.hostname.startsWith('ep-'))
    throw Object.assign(new Error(), {code: 'NEON_HOST_REQUIRED'});
  if (process.env.NEON_EXPECTED_HOST && url.hostname !== process.env.NEON_EXPECTED_HOST)
    throw Object.assign(new Error(), {code: 'NEON_ENDPOINT_MISMATCH'});
  const config = configurarBanco({DATABASE_URL: value, NODE_ENV: 'production'});
  const schema = url.searchParams.get('schema') || 'public';
  url.searchParams.delete('schema');
  client = new pg.Client({...config, connectionString: url.href});
  stage = 'CONNECTION';
  await client.connect();
  const socket = client.connection.stream;
  if (!socket.encrypted || socket.authorized !== true || checkServerIdentity(url.hostname, socket.getPeerCertificate()))
    throw Object.assign(new Error(), {code: 'TLS_CERTIFICATE_NOT_VERIFIED'});
  stage = 'QUERY';
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10s'");
  const mode = await client.query('SHOW transaction_read_only');
  if (mode.rows[0].transaction_read_only !== 'on') throw new Error();
  const tls = await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
  if (tls.rows[0]?.ssl !== true) throw Object.assign(new Error(), {code: 'TLS_REQUIRED'});
  const identity = await client.query("SELECT current_database() AS database, current_setting('server_version') AS postgres_version, current_user = session_user AS session_identity_unchanged, has_database_privilege(current_database(), 'CONNECT') AS can_connect, has_database_privilege(current_database(), 'CREATE') AS can_create_schema, has_schema_privilege($1, 'USAGE') AS schema_usage, has_schema_privilege($1, 'CREATE') AS schema_create", [schema]);
  if (identity.rows[0].database !== decodeURIComponent(url.pathname.slice(1)) ||
      (process.env.NEON_EXPECTED_DATABASE && identity.rows[0].database !== process.env.NEON_EXPECTED_DATABASE))
    throw Object.assign(new Error(), {code: 'DATABASE_IDENTITY_MISMATCH'});
  if (process.env.NEON_EXPECTED_PG_MAJOR && identity.rows[0].postgres_version.split('.')[0] !== process.env.NEON_EXPECTED_PG_MAJOR)
    throw Object.assign(new Error(), {code: 'POSTGRES_VERSION_MISMATCH'});
  const tables = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = $2', [schema, 'BASE TABLE']);
  const present = new Set(tables.rows.map(row => row.table_name));
  const expected = ['atracoes', 'categorias', 'avaliacoes', 'tags', 'atracao_tags', '_prisma_migrations'];
  const privileges = await client.query("SELECT c.relname AS table_name, has_table_privilege(c.oid, 'SELECT') AS can_select, has_table_privilege(c.oid, 'INSERT') AS can_insert, has_table_privilege(c.oid, 'UPDATE') AS can_update, has_table_privilege(c.oid, 'DELETE') AS can_delete, has_table_privilege(c.oid, 'TRUNCATE') AS can_truncate, c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) AND c.relkind IN ('r', 'p') ORDER BY c.relname", [schema, expected]);
  const role = await client.query('SELECT rolsuper AS superuser, rolcreatedb AS create_database, rolcreaterole AS create_role, rolreplication AS replication, rolbypassrls AS bypass_rls FROM pg_roles WHERE rolname = current_user');
  const sequences = await client.query("SELECT c.relname AS sequence_name, has_sequence_privilege(c.oid, 'USAGE') AS can_use, has_sequence_privilege(c.oid, 'SELECT') AS can_select, has_sequence_privilege(c.oid, 'UPDATE') AS can_update FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'S' AND c.relname = ANY($2::text[]) ORDER BY c.relname", [schema, ['atracoes_id_seq', 'categorias_id_seq', 'avaliacoes_id_seq', 'tags_id_seq']]);
  const columns = await client.query('SELECT table_name, column_name, udt_name, is_nullable, column_default, datetime_precision FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2::text[]) ORDER BY table_name, ordinal_position', [schema, expected]);
  const constraints = await client.query('SELECT c.relname AS table_name, k.contype AS type, pg_get_constraintdef(k.oid) AS definition, k.convalidated AS validated FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) ORDER BY c.relname, k.conname', [schema, expected]);
  const indexes = await client.query('SELECT c.relname AS table_name, i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) ORDER BY c.relname, i.indexrelid', [schema, expected]);
  const migrations = [];
  for (const name of await readdir(new URL('../prisma/migrations/', import.meta.url))) {
    if (!/^\d+_/.test(name)) continue;
    const bytes = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url));
    migrations.push({name, checksum: createHash('sha256').update(bytes).digest('hex')});
  }
  let ledger = null;
  let unexpectedMigrations = 0;
  if (present.has('_prisma_migrations')) {
    const identifier = '"' + schema.replaceAll('"', '""') + '"';
    const result = await client.query(`SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM ${identifier}."_prisma_migrations"`);
    unexpectedMigrations = result.rows.filter(row => !migrations.some(local => local.name === row.migration_name) && !row.rolled_back).length;
    ledger = migrations.map(local => {
      const rows = result.rows.filter(row => row.migration_name === local.name);
      return {migration: local.name, appliedWithMatchingChecksum: rows.some(row => row.finished && !row.rolled_back && row.checksum === local.checksum), unfinished: rows.some(row => !row.finished && !row.rolled_back)};
    });
  }
  await client.query('ROLLBACK');
  const report = {readOnly: true, connected: true, identity: identity.rows[0], tls: {...tls.rows[0], certificateAuthorized: true, hostnameVerified: true}, pooled: url.hostname.includes('-pooler'), tables: expected.map(table => ({table, present: present.has(table)})), migrations: ledger, unexpectedMigrations, roleCapabilities: role.rows[0], privileges: privileges.rows, sequences: sequences.rows, schemaInventory: {columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows}, compatibility: 'INVENTORY_REQUIRES_SCHEMA_REVIEW'};
  console.log(JSON.stringify(report, null, 2));
  if (expected.some(table => !present.has(table)) || !ledger || ledger.some(row => !row.appliedWithMatchingChecksum || row.unfinished) || unexpectedMigrations || !identity.rows[0].schema_usage || privileges.rows.some(row => !row.can_select)) process.exitCode = 2;
} catch (error) {
  // Mensagens do driver podem conter destinos ou credenciais: somente código controlado.
  const driverCodes = { '28P01': 'NEON_AUTHENTICATION_FAILED', '28000': 'NEON_AUTHENTICATION_FAILED', '42501': 'NEON_QUERY_PERMISSION_DENIED', EACCES: 'NEON_CONNECTION_PERMISSION_DENIED', EPERM: 'NEON_CONNECTION_PERMISSION_DENIED', ECONNREFUSED: 'NEON_CONNECTION_FAILED', ENOTFOUND: 'NEON_CONNECTION_FAILED', EAI_AGAIN: 'NEON_CONNECTION_FAILED', ETIMEDOUT: 'NEON_CONNECTION_TIMEOUT', ECONNRESET: 'NEON_CONNECTION_FAILED' };
  const rawCode = typeof error.code === 'string' ? error.code : '';
  const code = driverCodes[rawCode] || (/CERT|TLS|SSL/.test(rawCode) ? 'NEON_TLS_FAILED'
    : /^(NEON_|TLS_|DATABASE_IDENTITY_MISMATCH$|POSTGRES_VERSION_MISMATCH$)/.test(rawCode) && /^[A-Z0-9_]{1,50}$/.test(rawCode) ? rawCode
    : stage === 'QUERY' ? 'NEON_READONLY_QUERY_FAILED'
    : stage === 'CONNECTION' ? 'NEON_CONNECTION_FAILED' : 'NEON_CONFIGURATION_INVALID');
  console.error(JSON.stringify({ok: false, code}));
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
