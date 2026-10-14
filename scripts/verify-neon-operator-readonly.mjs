/** Lê arquivo preenchido privadamente pelo operador; não carrega .env nem inicia a API. */
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configurarBanco} from '../src/lib/database-config.js';

const fail = code => { throw Object.assign(new Error(), {code}); };
let stage = 'FILE';

try {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('TLS_VERIFICATION_DISABLED');
  const file = new URL('../backups/neon/operator-credentials.private.json', import.meta.url);
  const bytes = await readFile(file, 'utf8');
  stage = 'JSON';
  const credentials = JSON.parse(bytes.replace(/^\uFEFF/, ''));
  if (!credentials || Array.isArray(credentials) || typeof credentials !== 'object' || !Object.hasOwn(credentials, 'DIRECT_URL')) fail('NEON_OPERATOR_DIRECT_URL_MISSING');
  if (typeof credentials.DIRECT_URL !== 'string') fail('NEON_OPERATOR_DIRECT_URL_TYPE_INVALID');
  if (!credentials.DIRECT_URL.trim()) fail('NEON_OPERATOR_DIRECT_URL_EMPTY');
  stage = 'URL';
  const url = new URL(credentials.DIRECT_URL);
  const host = 'ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech';
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('NEON_OPERATOR_PROTOCOL_INVALID');
  if (url.hostname !== host || (url.port && url.port !== '5432')) fail('NEON_ENDPOINT_MISMATCH');
  if (decodeURIComponent(url.pathname.slice(1)) !== 'balsas_experience') fail('DATABASE_IDENTITY_MISMATCH');
  if (url.searchParams.get('sslmode') !== 'verify-full') fail('TLS_VERIFY_FULL_REQUIRED');
  if (!url.username || !url.password) fail('NEON_OPERATOR_AUTH_FIELDS_MISSING');
  stage = 'CONFIG';
  configurarBanco({DATABASE_URL: credentials.DIRECT_URL, NODE_ENV: 'production'});
  const env = {
    NEON_READONLY_URL: credentials.DIRECT_URL,
    NEON_EXPECTED_HOST: host,
    NEON_EXPECTED_DATABASE: 'balsas_experience',
    NEON_EXPECTED_PG_MAJOR: '18',
  };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  stage = 'EXECUTION';
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-neon-readonly.mjs', import.meta.url))], {
    env, encoding: 'utf8', windowsHide: true, timeout: 45000,
  });
  // O probe filho emite somente metadados e códigos sanitizados.
  if (result.error || result.signal) fail('NEON_OPERATOR_PROBE_EXECUTION_FAILED');
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.status ?? 1;
} catch (error) {
  const controlled = /^(NEON_OPERATOR_|NEON_ENDPOINT_MISMATCH$|DATABASE_IDENTITY_MISMATCH$|TLS_)/;
  const code = controlled.test(error.code || '') ? error.code
    : stage === 'FILE' ? ({ENOENT: 'NEON_OPERATOR_FILE_NOT_FOUND', EACCES: 'NEON_OPERATOR_FILE_PERMISSION_DENIED', EPERM: 'NEON_OPERATOR_FILE_PERMISSION_DENIED'}[error.code] || 'NEON_OPERATOR_FILE_READ_FAILED')
    : stage === 'JSON' ? 'NEON_OPERATOR_JSON_INVALID'
    : stage === 'URL' ? 'NEON_OPERATOR_URL_INVALID'
    : stage === 'CONFIG' ? 'NEON_OPERATOR_CONNECTION_PARAMETERS_INVALID'
    : 'NEON_OPERATOR_PROBE_EXECUTION_FAILED';
  console.error(JSON.stringify({ok: false, code}));
  process.exitCode = 1;
}
