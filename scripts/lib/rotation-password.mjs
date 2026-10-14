/** Gera senhas e verificadores SCRAM e monta a instrução restrita de rotação do papel postgres. */
import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
export function newStrongPassword(){return randomBytes(48).toString('base64url');}
export function scramVerifier(password){
 const salt=randomBytes(16),salted=pbkdf2Sync(password,salt,4096,32,'sha256');
 const client=createHmac('sha256',salted).update('Client Key').digest();
 const stored=createHash('sha256').update(client).digest('base64');
 const server=createHmac('sha256',salted).update('Server Key').digest('base64');
 salted.fill(0);client.fill(0);
 return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
}
export function rotationStatement(verifier){
 if(!/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$/.test(verifier))throw Object.assign(new Error('Verificador de rotação inválido'),{code:'ROTATION_VERIFIER_INVALID'});
 return `ALTER ROLE postgres PASSWORD '${verifier}'`;
}
