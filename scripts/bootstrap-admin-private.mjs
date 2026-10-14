// One-time authorized provisioning of a current secret, not a runtime fallback.
import {readFile,writeFile} from 'node:fs/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import {assertPrivateFile,assertPrivateDirectory,loadAdminConnection,AdminCredentialError} from './lib/admin-credentials.mjs';
if(process.argv[2]!=='--from-runtime-authorized'||!process.env.BALSAS_ADMIN_DATABASE_URL)throw new AdminCredentialError('ADMIN_PROVISION_EXPLICIT_SOURCE_REQUIRED');
const u=await loadAdminConnection();
if(u.username!=='postgres'||u.pathname!=='/balsas_experience')throw new AdminCredentialError('ADMIN_PROVISION_IDENTITY');
try{const old=new URL(dotenv.parse(await readFile('backups/isolamento-principal/env-original.private')).DATABASE_URL);if(decodeURIComponent(u.password)===decodeURIComponent(old.password))throw new AdminCredentialError('ADMIN_COMPROMISED_VALUE_REJECTED');}catch(e){if(e.code!=='ENOENT')throw e;}
const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:5000});
try{await c.connect();await c.query('BEGIN READ ONLY');const r=(await c.query("SELECT current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser")).rows[0];if(r.current_user!=='postgres'||!r.superuser)throw new AdminCredentialError('ADMIN_PROVISION_IDENTITY');}finally{await c.end().catch(()=>{});}
await assertPrivateDirectory('backups/admin');
await writeFile('backups/admin/credentials.json',JSON.stringify({DATABASE_URL:u.href}),{flag:'wx',mode:0o600});
await assertPrivateFile('backups/admin/credentials.json');console.log('Fonte privada nova provisionada; nenhuma senha PostgreSQL alterada, nenhum snapshot antigo utilizado como credencial.');
