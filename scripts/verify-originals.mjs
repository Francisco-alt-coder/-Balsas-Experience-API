import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const original=JSON.parse(await readFile('backups/originais.json','utf8'));
const db=new pg.Client({connectionString:process.env.DATABASE_URL}); await db.connect();
try {
  const tabelas={};
  for(const [tabela,snapshot] of Object.entries(original)) {
    const colunas=Object.keys(snapshot.rows[0]).map(k=>'"'+k+'"').join(',');
    const {rows}=await db.query(`SELECT ${colunas} FROM "${tabela}" ORDER BY 1,2`);
    const sha256=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    assert.equal(sha256,snapshot.sha256,`Dados originais alterados: ${tabela}`);
    tabelas[tabela]={antes:snapshot.rows.length,depois:rows.length,sha256,preservado:true};
  }
  const categorias=await db.query('SELECT c.nome,count(a.id)::int atracoes FROM categorias c LEFT JOIN atracoes a ON a."categoriaId"=c.id GROUP BY c.id ORDER BY c.nome');
  const integridade=await db.query(`SELECT
    (SELECT count(*)::int FROM atracoes a LEFT JOIN categorias c ON c.id=a."categoriaId" WHERE c.id IS NULL) categorias_orfas,
    (SELECT count(*)::int FROM avaliacoes v LEFT JOIN atracoes a ON a.id=v."atracaoId" WHERE a.id IS NULL) avaliacoes_orfas,
    (SELECT count(*)::int FROM avaliacoes) avaliacoes`);
  assert.equal(integridade.rows[0].categorias_orfas,0);assert.equal(integridade.rows[0].avaliacoes_orfas,0);assert.equal(integridade.rows[0].avaliacoes,0);
  const relatorio={tabelas,categorias:categorias.rows,integridade:integridade.rows[0]};
  await writeFile('docs/integridade-final-lab08.json',JSON.stringify(relatorio,null,2)); console.log(JSON.stringify(relatorio,null,2));
} finally {await db.end();}
