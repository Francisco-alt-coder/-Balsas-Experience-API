/** Executa somente status de migrações ou validação do Prisma, ocultando credenciais na saída. */
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const command=process.argv[2];assert.ok(['status','validate'].includes(command));
const creds=JSON.parse(await readFile('backups/isolamento-principal/credentials.json','utf8'));
const args=command==='status'?['migrate','status']:['validate'];
const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args,'--config','prisma7.config.ts'],{env:{...process.env,DATABASE_URL:creds.DATABASE_URL,DIRECT_URL:creds.DIRECT_URL},windowsHide:true,encoding:'utf8',timeout:30000});
let output=(r.stdout||'')+(r.stderr||'');for(const u of Object.values(creds))output=output.replaceAll(u,'[URL PRIVADA]').replaceAll(decodeURIComponent(new URL(u).password),'[SEGREDO]');
console.log(output.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]'));process.exitCode=r.status??1;
