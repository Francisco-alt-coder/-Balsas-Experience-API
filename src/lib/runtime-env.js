/** Filtra variáveis administrativas em uma cópia do ambiente, preservando a identidade de execução. */
// Nomes são insensíveis à capitalização no ambiente Windows.
/**
 * Retorna uma cópia sem variáveis administrativas, de migração, fixtures e fontes libpq listadas.
 * @param {object} input - Ambiente original, que não é modificado.
 * @returns {object} Ambiente filtrado.
 */
export function runtimeEnv(input){const env={...input};for(const key of Object.keys(env)){const canonical=key.toUpperCase();if(['DIRECT_URL','TEST_FIXTURE_DATABASE_URL','OLD_DATABASE_URL','NEW_DATABASE_URL'].includes(canonical)||/^BALSAS_(?:ADMIN|READONLY|MIGRATION)_/.test(canonical)||['PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE'].includes(canonical))delete env[key];}return env;}
