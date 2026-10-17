/** Comprova detecção de segredo privado fora de .env sem imprimir o valor detectado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';

async function scan(leak) {
  const base=path.resolve('tmp');await mkdir(base,{recursive:true});
  const dir=await mkdtemp(path.join(base,'publication-secrets-test-'));
  const token=randomBytes(32).toString('base64url');
  try {
    await mkdir(path.join(dir,'backups/neon'),{recursive:true});await mkdir(path.join(dir,'tmp'));
    await writeFile(path.join(dir,'.gitignore'),'backups/\n.env\n');await writeFile(path.join(dir,'.env'),'');
    await writeFile(path.join(dir,'backups/neon/runtime-secrets.private.json'),JSON.stringify({API_WRITE_TOKEN:token,DATABASE_URL:'',CORS_ORIGINS:'none'}));
    await writeFile(path.join(dir,'candidate.md'),leak?'mock leaked token: '+token:'benign publication fixture');
    const init=spawnSync('git',['init','-q',dir],{windowsHide:true,encoding:'utf8'});assert.equal(init.status,0);
    const result=spawnSync(process.execPath,[path.resolve('scripts/check-publication-files.mjs')],{cwd:dir,windowsHide:true,encoding:'utf8',timeout:10000});
    assert.ok(!((result.stdout||'')+(result.stderr||'')).includes(token));
    const report=JSON.parse(await readFile(path.join(dir,'tmp/inspecao-arquivos-publicacao.json'),'utf8'));
    return {status:result.status,report};
  } finally {
    // A pasta foi criada por este teste; verificar limite absoluto antes da remoção recursiva.
    const target=await realpath(dir),allowed=await realpath(base);
    assert.ok(target.startsWith(allowed+path.sep));assert.ok(path.basename(target).startsWith('publication-secrets-test-'));
    await rm(target,{recursive:true,force:true});
  }
}
test('scanner detecta token da configuração Neon runtime em candidato público sem vazar valor',async()=>{
  const result=await scan(true);assert.equal(result.status,1);assert.ok(result.report.hits.some(hit=>hit.file==='candidate.md'));
});
test('scanner preserva fontes privadas ignoradas e aceita candidato sem segredo',async()=>{
  const result=await scan(false);assert.equal(result.status,0);assert.deepEqual(result.report.hits,[]);assert.ok(result.report.checkedSources.includes('backups/neon/runtime-secrets.private.json'));
});
