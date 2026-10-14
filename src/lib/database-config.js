/** Valida a conexão PostgreSQL e limita o pool e os tempos de espera do adaptador pg. */
/**
 * Valida URL, parâmetros permitidos e limites; produção remota exige sslmode=verify-full.
 * @param {object} [env=process.env] - Variáveis de conexão e limites do pool.
 * @returns {object} Opções utilizadas pelo adaptador PostgreSQL.
 */
export function configurarBanco(env=process.env){
 const connectionString=env.DATABASE_URL;
 if(!connectionString)throw new Error('DATABASE_URL não definida. Configure a conexão privada.');
 let url;try{url=new URL(connectionString);}catch{throw new Error('DATABASE_URL inválida; revise a configuração privada.');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.pathname==='/')throw new Error('DATABASE_URL deve identificar um banco PostgreSQL.');
 const parameters=new Set(['schema','sslmode','application_name','connect_timeout']);
 for(const key of url.searchParams.keys())if(!parameters.has(key)||url.searchParams.getAll(key).length!==1)throw new Error('DATABASE_URL contém parâmetro de conexão não suportado.');
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(env.NODE_ENV==='production'&&!local&&url.searchParams.get('sslmode')!=='verify-full')throw new Error('Conexão remota de produção exige sslmode=verify-full.');
 const integer=(key,fallback,max)=>{const raw=env[key]??String(fallback);if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>max)throw new Error(key+' deve conter um inteiro positivo dentro do limite permitido.');return Number(raw);};
 return {connectionString,connectionTimeoutMillis:integer('DB_CONNECTION_TIMEOUT_MS',5000,60000),query_timeout:integer('DB_QUERY_TIMEOUT_MS',10000,120000),max:integer('DB_POOL_MAX',10,100),idleTimeoutMillis:30000};
}
