/** Regressões do loader privado em diretórios temporários, sem conexão PostgreSQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

async function probe(contents,expected) {
  const root=path.resolve('tmp');await mkdir(root,{recursive:true});
  const dir=await mkdtemp(path.join(root,'neon-loader-'));
  const directories=['scripts','src','src/lib','backups','backups/neon'];
  const files=[];
  try {
    for(const name of directories)await mkdir(path.join(dir,name));
    for(const [source,destination] of [['scripts/verify-neon-operator-readonly.mjs','scripts/verify-neon-operator-readonly.mjs'],['src/lib/database-config.js','src/lib/database-config.js']]) {
      const target=path.join(dir,destination);files.push(target);await writeFile(target,await readFile(source));
    }
    const packageFile=path.join(dir,'package.json');files.push(packageFile);await writeFile(packageFile,JSON.stringify({type:'module'}));
    if(contents!==undefined) {const file=path.join(dir,'backups/neon/operator-credentials.private.json');files.push(file);await writeFile(file,contents);}
    // CWD é diferente da pasta do script: o arquivo deve ser resolvido via import.meta.url.
    const result=spawnSync(process.execPath,[path.join(dir,'scripts/verify-neon-operator-readonly.mjs')],{cwd:root,env:{...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{})},windowsHide:true,encoding:'utf8',timeout:10000});
    assert.equal(result.status,1);assert.equal(result.stdout,'');
    assert.deepEqual(JSON.parse(result.stderr),{ok:false,code:expected});
    assert.ok(!result.stderr.includes('fixture_mock_only'));assert.ok(!result.stderr.includes('postgresql://'));
  } finally {
    for(const file of files.reverse())await unlink(file);
    for(const name of directories.reverse())await rmdir(path.join(dir,name));
    await rmdir(dir);
  }
}
function mockUrl(changes={}) {
  const url=new URL((changes.protocol||'postgresql:')+'//ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech/balsas_experience');
  url.username='mock_operator';url.password='fixture_mock_only';url.searchParams.set('sslmode','verify-full');
  for(const [key,value]of Object.entries(changes)) {if(key==='parameter')url.searchParams.set(value,'mock_only');else if(key!=='protocol')url[key]=value;}
  return JSON.stringify({DIRECT_URL:url.href});
}
test('loader distingue arquivo ausente sem fallback local',()=>probe(undefined,'NEON_OPERATOR_FILE_NOT_FOUND'));
test('loader aceita BOM e caminhos independentes do CWD',()=>probe('\uFEFF'+JSON.stringify({DIRECT_URL:''}),'NEON_OPERATOR_DIRECT_URL_EMPTY'));
test('loader distingue JSON inválido sem refletir entrada',()=>probe('{fixture_mock_only','NEON_OPERATOR_JSON_INVALID'));
test('loader distingue propriedade ausente e tipo inválido',async()=>{await probe('{}','NEON_OPERATOR_DIRECT_URL_MISSING');await probe(JSON.stringify({DIRECT_URL:123}),'NEON_OPERATOR_DIRECT_URL_TYPE_INVALID');});
test('loader recusa protocolo e endpoint divergentes antes de conectar',async()=>{await probe(mockUrl({protocol:'https:'}),'NEON_OPERATOR_PROTOCOL_INVALID');await probe(mockUrl({hostname:'remote.invalid'}),'NEON_ENDPOINT_MISMATCH');});
test('loader recusa database e TLS divergentes antes de conectar',async()=>{await probe(mockUrl({pathname:'/other'}),'DATABASE_IDENTITY_MISMATCH');await probe(JSON.stringify({DIRECT_URL:JSON.parse(mockUrl()).DIRECT_URL.replace('verify-full','disable')}),'TLS_VERIFY_FULL_REQUIRED');});
test('loader recusa parâmetros que poderiam substituir destino',()=>probe(mockUrl({parameter:'host'}),'NEON_OPERATOR_CONNECTION_PARAMETERS_INVALID'));
