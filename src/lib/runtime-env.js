/** Retira variáveis administrativas antes de iniciar a aplicação. */
export function runtimeEnv(input) {
  // Criamos uma cópia para não modificar o objeto recebido.
  const env = { ...input };

  for (const chave of Object.keys(env)) {
    // No Windows, nomes de variáveis podem ter letras maiúsculas ou minúsculas.
    const nome = chave.toUpperCase();
    const credencialSeparada = [
      'DIRECT_URL',
      'TEST_FIXTURE_DATABASE_URL',
      'OLD_DATABASE_URL',
      'NEW_DATABASE_URL',
    ].includes(nome);
    const variavelAdministrativa = /^BALSAS_(?:ADMIN|READONLY|MIGRATION)_/.test(nome);
    const variavelPostgres = ['PGPASSWORD', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE'].includes(nome);

    if (credencialSeparada || variavelAdministrativa || variavelPostgres) {
      delete env[chave];
    }
  }

  return env;
}
