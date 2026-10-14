/** Carrega o .env e remove do processo da API as variáveis reservadas a operações administrativas. */
import 'dotenv/config';
import {runtimeEnv} from './runtime-env.js';
const clean=runtimeEnv(process.env);
for(const key of Object.keys(process.env))if(!(key in clean))delete process.env[key];
