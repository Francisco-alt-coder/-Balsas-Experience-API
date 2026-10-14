/** Testes automatizados de bloqueio de rotação sem flag e formato da instrução SCRAM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {newStrongPassword,scramVerifier,rotationStatement} from '../scripts/lib/rotation-password.mjs';
test('rotação não inicia sem flag explícita',()=>{const r=spawnSync(process.execPath,['scripts/rotate-postgres-authorized.mjs'],{encoding:'utf8',windowsHide:true});assert.equal(r.status,1);assert.match(r.stderr,/ROTATION_AUTHORIZATION_REQUIRED/);assert.equal(r.stdout,'');});
test('instrução altera somente postgres e rejeita verificador injetado',()=>{const p=newStrongPassword();assert.equal(p.length,64);const v=scramVerifier(p);const sql=rotationStatement(v);assert.ok(sql.startsWith('ALTER ROLE postgres PASSWORD '));assert.ok(!sql.includes(p));assert.throws(()=>rotationStatement("invalid'; ALTER ROLE other SUPERUSER; --"),e=>e.code==='ROTATION_VERIFIER_INVALID');});
