import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], { encoding: 'utf8', windowsHide: true });
const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
const secrets = [];
const checkedSources = [];
for (const file of ['.env','backups/neon/operator-credentials.private.json','backups/neon/runtime-secrets.private.json','backups/isolamento-principal/credentials.json','backups/isolamento-testes/fixture-env.json']) {
  let text;
  try { text = await readFile(file,'utf8'); } catch (error) {
    if(error.code==='ENOENT' && file!=='.env')continue;
    console.error(JSON.stringify({ok:false,code:'PRIVATE_SCAN_SOURCE_UNREADABLE'}));process.exit(1);
  }
  let config;
  try {config=file.endsWith('.json')?JSON.parse(text.replace(/^\uFEFF/,'')):dotenv.parse(text);}catch {
    console.error(JSON.stringify({ok:false,code:'PRIVATE_SCAN_SOURCE_INVALID'}));process.exit(1);
  }
  checkedSources.push(file);
  if(typeof config.API_WRITE_TOKEN==='string')secrets.push(config.API_WRITE_TOKEN);
  for(const [key,value]of Object.entries(config)) {
    if(!key.endsWith('URL') || typeof value!=='string' || !value)continue;
    try {const url=new URL(value);secrets.push(value,url.password,decodeURIComponent(url.password));}catch{}
  }
}
const hits = [];
for (const file of files) {
  const body = await readFile(file, 'utf8');
  if (secrets.filter(s => s && s.length >= 6).some(s => body.includes(s))) hits.push({ file, reason: 'Segredo local encontrado' });
  for (const match of body.matchAll(/postgres(?:ql)?:\/\/[^\s"'`]+/g)) {
    try {
      const url = new URL(match[0]);
      const negativeFixture = file === 'scripts/test-integration.mjs' && url.hostname === '127.0.0.1' && url.port === '1' && url.username === 'teste' && url.password === 'teste';
      const adminTargetFixture = file === 'scripts/test-admin-auth-readonly.mjs' && url.protocol === 'postgresql:' && url.username === 'operator' && url.password === 'dummy' && url.hostname === 'remote.invalid' && url.port === '5432' && url.pathname === '/balsas_experience' && !url.search && !url.hash;
      const configFixture = file === 'tests/health.test.mjs' && url.protocol === 'postgresql:' && url.username === 'dummy' && url.password === 'dummy' && url.hostname === '127.0.0.1' && !url.port && url.pathname === '/test' && !url.search && !url.hash;
      if (url.password && !negativeFixture && !adminTargetFixture && !configFixture && !['senha', 'SENHA', 'password'].includes(decodeURIComponent(url.password))) hits.push({ file, reason: 'URL PostgreSQL com senha não reconhecida como placeholder' });
    } catch {}
  }
  if (/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body)) hits.push({ file, reason: 'Formato de segredo conhecido' });
}
const result = { files: files.length, hits, checkedSources, tracked: git('ls-files').split('\n').filter(Boolean).length, remotes: git('remote').trim(), limitations: 'Inspeção heurística e valores das fontes privadas acessíveis; não garante ausência de todos os segredos ou acesso a históricos externos.' };
await writeFile('docs/inspecao-arquivos-publicacao.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (hits.length) process.exitCode = 1;
