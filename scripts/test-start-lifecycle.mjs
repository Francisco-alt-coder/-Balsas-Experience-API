/** Preload de teste que emite SIGTERM quando encontra o arquivo de controle da instância temporária. */
// Preload exclusivo da matriz local; nunca configurar NODE_OPTIONS assim no Render.
import {existsSync,writeFileSync} from 'node:fs';
const flag=process.env.BALSAS_TEST_STOP_FILE;
const isApp=process.argv[1]?.replaceAll('\\','/').endsWith('/src/app.js');
if(flag&&isApp){if(process.env.BALSAS_TEST_PID_FILE)writeFileSync(process.env.BALSAS_TEST_PID_FILE,String(process.pid));const timer=setInterval(()=>{if(existsSync(flag)){clearInterval(timer);process.emit('SIGTERM');}},100);timer.unref();}
