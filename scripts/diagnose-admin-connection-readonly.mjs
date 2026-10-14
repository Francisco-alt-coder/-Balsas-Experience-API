import {loadAdminConnection,nativeAdminEnv} from './lib/admin-credentials.mjs';
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import pg from 'pg';
const u=await loadAdminConnection(),results=[];
for(const host of ['127.0.0.1','[::1]']){const endpoint=new URL(u);endpoint.hostname=host;const c=new pg.Client({connectionString:endpoint.href,connectionTimeoutMillis:3000});let code='CONNECTED';try{await c.connect();await c.query('SELECT 1');}catch(e){code=e.code||'FAILED';}finally{await c.end().catch(()=>{});}const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-tAc','SELECT 1'],{env:nativeAdminEnv(endpoint),windowsHide:true,encoding:'utf8',timeout:10000});let error=(r.stderr||'').replaceAll(endpoint.href,'[URL PRIVADA]').replaceAll(decodeURIComponent(u.password),'[SEGREDO]');error=error.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[URL PRIVADA]');results.push({host,pgCode:code,psqlExit:r.status,psqlError:error});}
await writeFile('docs/admin-conexao-incidente.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
