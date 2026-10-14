/** Abre auditorias com a identidade do migrador em transação PostgreSQL somente de leitura. */
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {assertPrivateFile,loadAdminConnection,AdminCredentialError} from './admin-credentials.mjs';
// Usa privilégios existentes do migrador; nenhuma cópia ou fallback administrativo.
export async function loadReadOnlyConnection({scope='production',env=process.env}={}){
 if(!['production','test'].includes(scope))throw new AdminCredentialError('READONLY_SCOPE');
 let value=env.BALSAS_READONLY_DATABASE_URL;
 if(value===undefined){
  const file=env.BALSAS_READONLY_CREDENTIAL_FILE||(scope==='production'?'backups/isolamento-principal/credentials.json':'backups/isolamento-testes/credentials.json');
  await assertPrivateFile(file);
  try{value=JSON.parse(await readFile(file,'utf8')).DIRECT_URL;}catch{throw new AdminCredentialError('READONLY_FILE_FORMAT');}
 }
 if(typeof value!=='string'||!value.trim())throw new AdminCredentialError('READONLY_SOURCE_MISSING');
 const u=await loadAdminConnection({env:{BALSAS_ADMIN_DATABASE_URL:value}});
 const role=scope==='production'?'balsas_migrate_prod':'balsas_migrate';
 if(decodeURIComponent(u.username)!==role||(scope==='production'?u.pathname!=='/balsas_experience':!/^\/balsas_lab08_test_\d+$/.test(u.pathname)))throw new AdminCredentialError('READONLY_IDENTITY_REJECTED');
 u.searchParams.set('application_name','balsas-readonly-audit');return u;
}
/**
 * Abre REPEATABLE READ READ ONLY e verifica a identidade efetiva; o chamador deve encerrar o cliente.
 * @param {object} [options] - Opções de escopo e ambiente de loadReadOnlyConnection.
 * @returns {Promise<import("pg").Client>} Cliente com transação de leitura aberta.
 */
export async function connectReadOnly(options){
 const u=await loadReadOnlyConnection(options);
 const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:5000,query_timeout:10000});
 try{
  await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL statement_timeout='10s'");
  const r=(await c.query("SELECT current_user,current_database(),current_setting('transaction_read_only') readonly,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser")).rows[0];
  if(r.current_user!==decodeURIComponent(u.username)||r.current_database!==u.pathname.slice(1)||r.superuser||r.readonly!=='on')throw new AdminCredentialError('READONLY_EFFECTIVE_IDENTITY');
  return c;
 }catch(e){await c.end().catch(()=>{});throw e;}
}
