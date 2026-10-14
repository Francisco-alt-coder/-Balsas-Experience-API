/** Carrega credenciais administrativas explícitas, valida o alvo local e protege erros e arquivos privados. */
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export class AdminCredentialError extends Error {
 constructor(code){super('Autenticação administrativa indisponível; código: '+code);this.name='AdminCredentialError';this.code=code;}
}
async function assertPrivatePath(file,type){
 try{
  const info=await stat(file);if(type==='directory'?!info.isDirectory():!info.isFile())throw new AdminCredentialError('ADMIN_FILE_TYPE');
  if(process.platform==='win32'){
   const script="$ErrorActionPreference='Stop'; $acl=Get-Acl -LiteralPath $env:BALSAS_ACL_CHECK_PATH; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; foreach($r in $acl.Access){if($r.AccessControlType -eq 'Allow'){ $sid=$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if($sid -notin @($me,'S-1-5-18','S-1-5-32-544')){exit 3}}}; exit 0";
   const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,BALSAS_ACL_CHECK_PATH:path.resolve(file)};
   const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env,windowsHide:true,stdio:'ignore',timeout:10000});
   if(r.status!==0)throw new AdminCredentialError('ADMIN_FILE_ACL');
  }else if(info.mode&0o077)throw new AdminCredentialError('ADMIN_FILE_ACL');
  const relative=path.relative(process.cwd(),path.resolve(file));
  if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)){
   const git=spawnSync('git',['-c','safe.directory='+process.cwd(),'check-ignore','--quiet','--',relative],{windowsHide:true,stdio:'ignore',timeout:10000});
   if(git.status!==0)throw new AdminCredentialError('ADMIN_FILE_NOT_IGNORED');
  }
 }catch(e){if(e instanceof AdminCredentialError)throw e;throw new AdminCredentialError(e.code==='ENOENT'?'ADMIN_FILE_MISSING':'ADMIN_FILE_UNREADABLE');}
}
export async function assertPrivateFile(file){return assertPrivatePath(file,'file');}
export async function assertPrivateDirectory(file){return assertPrivatePath(file,'directory');}
function fields(line){const result=[];let current='',escape=false;for(const ch of line){if(escape){current+=ch;escape=false;}else if(ch==='\\')escape=true;else if(ch===':'){result.push(current);current='';}else current+=ch;}if(escape)current+='\\';result.push(current);return result;}
/**
 * Resolve fonte explícita ou arquivo privado, restringe o destino e resolve pgpass quando necessário.
 * @param {object} [options={}] - database opcional e env com a fonte administrativa.
 * @returns {Promise<URL>} Conexão privada validada; não deve ser registrada em logs.
 */
export async function loadAdminConnection({database,env=process.env}={}){
 let value,passfile;
 if(env.BALSAS_ADMIN_DATABASE_URL!==undefined){value=env.BALSAS_ADMIN_DATABASE_URL;passfile=env.BALSAS_ADMIN_PGPASSFILE;}
 else{
  const file=env.BALSAS_ADMIN_CREDENTIAL_FILE||'backups/admin/credentials.json';await assertPrivateFile(file);
  try{const cfg=JSON.parse(await readFile(file,'utf8'));value=cfg.DATABASE_URL;passfile=cfg.PGPASSFILE||env.BALSAS_ADMIN_PGPASSFILE;}catch{throw new AdminCredentialError('ADMIN_FILE_FORMAT');}
 }
 let u;try{u=new URL(value);}catch{throw new AdminCredentialError('ADMIN_URL_INVALID');}
 if(!['postgresql:','postgres:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||(u.port||'5432')!=='5432'||!u.username)throw new AdminCredentialError('ADMIN_TARGET_REJECTED');
 const supported=new Set(['schema','application_name','sslmode','connect_timeout']);
 for(const key of u.searchParams.keys())if(!supported.has(key)||u.searchParams.getAll(key).length!==1)throw new AdminCredentialError('ADMIN_PARAMETER_REJECTED');
 if(u.searchParams.has('sslmode')&&!['disable','allow','prefer','require','verify-ca','verify-full'].includes(u.searchParams.get('sslmode')))throw new AdminCredentialError('ADMIN_PARAMETER_REJECTED');
 const allowed=name=>name==='balsas_experience'||/^balsas_(?:lab08_test|rotation_verify)_\d+$/.test(name);
 if(!allowed(u.pathname.slice(1)))throw new AdminCredentialError('ADMIN_DATABASE_REJECTED');
 if(database){if(!allowed(database))throw new AdminCredentialError('ADMIN_DATABASE_REJECTED');u.pathname='/'+database;}
 if(!u.password){
  if(!passfile)throw new AdminCredentialError('ADMIN_PASSWORD_MISSING');await assertPrivateFile(passfile);
  const target=[u.hostname.replace(/^\[|\]$/g,''),u.port||'5432',u.pathname.slice(1),decodeURIComponent(u.username)];
  let match;try{for(const line of (await readFile(passfile,'utf8')).split(/\r?\n/)){if(!line.trim()||line.startsWith('#'))continue;const f=fields(line);if(f.length===5&&f.slice(0,4).every((v,i)=>v==='*'||v===target[i])){match=f[4];break;}}}catch{throw new AdminCredentialError('ADMIN_PASSFILE_UNREADABLE');}
  if(!match)throw new AdminCredentialError('ADMIN_PASSFILE_NO_MATCH');u.password=match;
 }
 u.searchParams.set('application_name','balsas-admin-operator');return u;
}
/**
 * Remove fontes alternativas de conexão e monta o ambiente libpq a partir da URL validada.
 * @param {URL} u - Conexão administrativa já validada.
 * @param {object} [base=process.env] - Ambiente do processo chamador.
 * @returns {object} Ambiente privado para subprocessos PostgreSQL.
 */
export function nativeAdminEnv(u,base=process.env){const env={...base};for(const key of Object.keys(env)){const canonical=key.toUpperCase();if(/^(?:BALSAS_(?:ADMIN|READONLY|MIGRATION)_|(?:OLD_|NEW_)?DATABASE_URL$|DIRECT_URL$|TEST_FIXTURE_DATABASE_URL$|PG)/.test(canonical))delete env[key];}return {...env,PGHOST:u.hostname.replace(/^\[|\]$/g,''),PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),...(u.searchParams.has('sslmode')?{PGSSLMODE:u.searchParams.get('sslmode')}:{})};}
// Imported only by administrative scripts; suppress accidental URL-bearing errors.
process.on('uncaughtException',e=>{const code=/^[A-Z0-9_]+$/.test(e?.code||'')?e.code:'ADMIN_OPERATION_FAILED';console.error('Operação administrativa falhou; código:',code);process.exit(1);});
