/** Carrega a configuração privada de testes e verifica o destino das credenciais de fixtures. */
import {readFile} from 'node:fs/promises';
import {configurarBanco} from '../src/lib/database-config.js';

const fail = code => { throw Object.assign(new Error(code), {code}); };

async function readConfig(file) {
 let text;
 try { text = await readFile(file, 'utf8'); } catch { fail('TEST_CONFIG_FILE_READ_FAILED'); }
 try { return JSON.parse(text.replace(/^\uFEFF/, '')); } catch { fail('TEST_CONFIG_JSON_INVALID'); }
}

function validateConnection(value) {
 if (typeof value !== 'string' || !value) fail('TEST_CONFIG_URL_INVALID');
 let url;
 try { url = new URL(value); } catch { fail('TEST_CONFIG_URL_INVALID'); }
 if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('TEST_CONFIG_PROTOCOL_REJECTED');
 if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) fail('TEST_CONFIG_HOST_REJECTED');
 if (!/^\/balsas_lab08_test_\d+$/.test(url.pathname)) fail('TEST_CONFIG_DATABASE_REJECTED');
 try { configurarBanco({DATABASE_URL: value, NODE_ENV: 'test'}); } catch { fail('TEST_CONFIG_PARAMETERS_REJECTED'); }
 return url;
}

function validateConfig(config) {
 if (!config || Array.isArray(config) || typeof config !== 'object') fail('TEST_CONFIG_OBJECT_INVALID');
 const runtime = validateConnection(config.DATABASE_URL);
 if (Object.hasOwn(config, 'TEST_FIXTURE_DATABASE_URL')) {
  const fixture = validateConnection(config.TEST_FIXTURE_DATABASE_URL);
  if (fixture.host !== runtime.host || fixture.pathname !== runtime.pathname) fail('TEST_CONFIG_FIXTURE_IDENTITY_MISMATCH');
 }
 return runtime;
}

function username(url) {
 try { return decodeURIComponent(url.username); } catch { fail('TEST_CONFIG_URL_INVALID'); }
}

// Fixtures stay in the test runner; callers must not export this key to the API.
export async function loadTestConfig({env = process.env} = {}){
 const config=await readConfig(env.TEST_ENV_PATH || 'backups/test-env.json');
 const runtime=validateConfig(config);
 if(username(runtime)==='balsas_api'&&!Object.hasOwn(config, 'TEST_FIXTURE_DATABASE_URL')){
  const fixture=await readConfig('backups/isolamento-testes/fixture-env.json');
  validateConfig(fixture);
  if (fixture.DATABASE_URL !== config.DATABASE_URL) fail('TEST_CONFIG_FALLBACK_RUNTIME_MISMATCH');
  if (!Object.hasOwn(fixture, 'TEST_FIXTURE_DATABASE_URL')) fail('TEST_CONFIG_FIXTURE_MISSING');
  const direct=validateConnection(fixture.TEST_FIXTURE_DATABASE_URL);
  if(username(direct)!=='balsas_migrate') fail('TEST_CONFIG_FIXTURE_ROLE_REJECTED');
  config.TEST_FIXTURE_DATABASE_URL=direct.href;
 }
 validateConfig(config);
 return config;
}
