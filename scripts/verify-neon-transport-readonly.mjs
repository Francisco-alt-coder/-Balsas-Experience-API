/** Confirma TCP/TLS do endpoint autorizado, sem enviar credenciais ou consultar dados. */
import net from 'node:net';
import tls from 'node:tls';

const host='ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech';
let socket;
let secure;
try {
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Object.assign(new Error(),{code:'TLS_VERIFICATION_DISABLED'});
  socket=net.connect({host,port:5432});
  socket.setTimeout(10000,()=>socket.destroy(Object.assign(new Error(),{code:'ETIMEDOUT'})));
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  const request=Buffer.alloc(8);request.writeInt32BE(8,0);request.writeInt32BE(80877103,4);
  const response=new Promise((resolve,reject)=>{socket.once('data',resolve);socket.once('error',reject);socket.once('end',()=>reject(new Error()));});
  socket.write(request);
  const bytes=await response;
  if(bytes.length!==1||bytes[0]!==83)throw Object.assign(new Error(),{code:'TLS_NOT_SUPPORTED'});
  secure=tls.connect({socket,servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2'});
  secure.setTimeout(10000,()=>secure.destroy(Object.assign(new Error(),{code:'ETIMEDOUT'})));
  await new Promise((resolve,reject)=>{secure.once('secureConnect',resolve);secure.once('error',reject);});
  if(secure.authorized!==true||tls.checkServerIdentity(host,secure.getPeerCertificate()))throw Object.assign(new Error(),{code:'TLS_CERTIFICATE_NOT_VERIFIED'});
  console.log(JSON.stringify({ok:true,transportOnly:true,authenticated:false,tls:secure.getProtocol(),certificateAuthorized:true,hostnameVerified:true}));
} catch(error) {
  const code=error.code==='TLS_VERIFICATION_DISABLED'?'TLS_VERIFICATION_DISABLED':/CERT|TLS|SSL/.test(error.code||'')?'NEON_TLS_FAILED':'NEON_TRANSPORT_FAILED';
  console.error(JSON.stringify({ok:false,transportOnly:true,authenticated:false,code}));process.exitCode=1;
} finally {secure?.destroy();socket?.destroy();}
