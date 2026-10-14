// Leitura de objetos Git; imprime somente hashes, caminhos e indicadores.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
const root = process.argv[2];
if (!root) throw new Error('Informe a raiz Git relacionada');
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const env = dotenv.parse(await readFile('.env'));
const secrets = [env.API_WRITE_TOKEN, env.DATABASE_URL];
if (env.DATABASE_URL) secrets.push(decodeURIComponent(new URL(env.DATABASE_URL).password));
const objects = git('rev-list', '--objects', '--all').split('\n').filter(Boolean);
const hits = [];
let scanned = 0;
for (const row of objects) {
  const [hash, ...parts] = row.split(' ');
  if (git('cat-file', '-t', hash).trim() !== 'blob') continue;
  const body = git('cat-file', '-p', hash);
  scanned++;
  if (secrets.filter(s => s && s.length >= 6).some(s => body.includes(s)) || /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/.test(body)) hits.push({ hash, file: parts.join(' '), reason: 'Segredo atual ou URL autenticada; revisar privadamente' });
}
const remote = git('config', '--get', 'remote.origin.url').trim();
const report = { commits: Number(git('rev-list', '--all', '--count')), scannedBlobs: scanned, relatedToSistemaOficina: remote.includes('sistema-oficina'), hits, scope: 'Objetos alcançáveis --all; sem fetch, sem reflog, sem alteração do repositório; ocorrências podem incluir placeholders.' };
await writeFile('docs/historico-relacionado-publicacao.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
