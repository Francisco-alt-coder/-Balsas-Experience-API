// Inicia o procedimento documentado com somente a configuração runtime.
import {readFile} from 'node:fs/promises';
import dotenv from 'dotenv';
import {runtimeEnv} from './lib/runtime-env.mjs';
const env=runtimeEnv({...process.env,...dotenv.parse(await readFile('.env'))});
for(const key of Object.keys(process.env)) if(!(key in env)) delete process.env[key];
Object.assign(process.env,env);
await import('../src/app.js');
