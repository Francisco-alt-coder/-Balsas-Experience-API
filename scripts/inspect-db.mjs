import { connectReadOnly } from './lib/readonly-credentials.mjs';
import 'dotenv/config';
import { createHash } from 'node:crypto';
const client = await connectReadOnly();
try {
  const identity = (await client.query('SELECT current_user,current_database(),current_setting(\'transaction_read_only\') readonly')).rows[0];
  const version = await client.query('SELECT version()');
  const tables = {};
  for (const table of ['atracoes', 'tags', 'atracao_tags']) {
    const { rows } = await client.query(`SELECT * FROM "${table}" ORDER BY 1, 2`);
    tables[table] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  const sequence = await client.query('SELECT last_value, is_called, (SELECT max(id) FROM atracoes) AS max_id FROM atracoes_id_seq');
  const tagSequence = await client.query('SELECT last_value, is_called, (SELECT max(id) FROM tags) AS max_id FROM tags_id_seq');
  const relations = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid IN ('atracoes'::regclass, 'tags'::regclass, 'atracao_tags'::regclass) ORDER BY conname
  `);
  const orphans = await client.query(`SELECT count(*)::int AS orfaos FROM atracao_tags r
    LEFT JOIN atracoes a ON a.id=r."atracaoId" LEFT JOIN tags t ON t.id=r."tagId"
    WHERE a.id IS NULL OR t.id IS NULL`);
  const url = new URL(process.env.DATABASE_URL);
  const environment = { databaseUrlPresent: true, postgresProtocol: ['postgresql:', 'postgres:'].includes(url.protocol), passwordPresent: Boolean(url.password), schema: url.searchParams.get('schema') || 'public', portConfigured: Boolean(process.env.PORT), portValid: /^\d+$/.test(process.env.PORT || '3000') && Number(process.env.PORT || 3000) > 0 && Number(process.env.PORT || 3000) <= 65535 };
  console.log(JSON.stringify({ identity,version: version.rows[0].version, environment, tables, sequence: sequence.rows[0], tagSequence: tagSequence.rows[0], relations: relations.rows, orphans: orphans.rows[0].orfaos }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ connected: false, code: error.code ?? error.name }));
  process.exitCode = 1;
} finally { await client.end(); }
