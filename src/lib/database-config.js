/** Configuração da conexão PostgreSQL usada pelo Prisma. */
export function configurarBanco(env = process.env) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida. Configure a conexão privada.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL inválida; revise a configuração privada.');
  }

  // Confere se a URL aponta para um banco PostgreSQL.
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/') {
    throw new Error('DATABASE_URL deve identificar um banco PostgreSQL.');
  }

  // Aceita apenas os parâmetros de conexão usados pelo projeto.
  const parametrosPermitidos = new Set(['schema', 'sslmode', 'application_name', 'connect_timeout']);
  for (const parametro of url.searchParams.keys()) {
    if (!parametrosPermitidos.has(parametro) || url.searchParams.getAll(parametro).length !== 1) {
      throw new Error('DATABASE_URL contém parâmetro de conexão não suportado.');
    }
  }

  const bancoLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (env.NODE_ENV === 'production' && !bancoLocal && url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Conexão remota de produção exige sslmode=verify-full.');
  }

  // Usa valores padrão, mas recusa limites inválidos.
  function numeroPositivo(nome, padrao, maximo) {
    const valor = env[nome] ?? String(padrao);
    if (!/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > maximo) {
      throw new Error(nome + ' deve conter um inteiro positivo dentro do limite permitido.');
    }
    return Number(valor);
  }

  return {
    connectionString,
    connectionTimeoutMillis: numeroPositivo('DB_CONNECTION_TIMEOUT_MS', 5000, 60000),
    query_timeout: numeroPositivo('DB_QUERY_TIMEOUT_MS', 10000, 120000),
    max: numeroPositivo('DB_POOL_MAX', 10, 100),
    idleTimeoutMillis: 30000,
  };
}
