# Publicação GitHub, Neon e Render — guia operacional

Estado local vigente: consultar [estado-publicacao.md](estado-publicacao.md). Este documento prepara ações futuras; não autoriza commit/push, infraestrutura, migrações remotas, transferência ou deploy. PostgreSQL/API locais devem permanecer ativos.

## Ambiente e comandos

Repositório dedicado com package.json na raiz; Node 24.x, versão local 24.20.0, Prisma/Client/adapter 7.10.0, Express 5.2.1 e pg 8.16.3. `npm ci --include=dev` respeita o lockfile; `npm run build` gera o Client; `npm start` executa node src/app.js. Build/start não aplicam migrações nem seed. No Render: build `npm ci --include=dev && npm run build`, start `npm start`, health `/health`, NODE_ENV=production, HOST=0.0.0.0 e PORT fornecida pela plataforma. render.yaml.example continua inativo e depende de autorização para importação.

Runtime recebe DATABASE_URL pooled quando apropriado, API_WRITE_TOKEN novo e forte, CORS_ORIGINS com origens HTTPS exatas e parâmetros DB_POOL_MAX/DB_CONNECTION_TIMEOUT_MS/DB_QUERY_TIMEOUT_MS. Defaults testados: 10 conexões, 5000 ms de conexão, 10000 ms de query, idle 30000 ms por processo. Não usar parâmetros de pool da versão Prisma 6 na URL. Medir cold start/concorrência no destino antes de ajustar limites; pool não garante limite global de todos os consumidores.

DIRECT_URL só no ambiente privado do operador; nunca no serviço web. .env.example é local; .env.render.example é remoto e .env.migration.example é do operador. Nenhuma URL real ou senha deve ser copiada para o repositório.

## GitHub

Revisar candidatos com `node scripts/check-publication-files.mjs`, Git ignore, histórico e `git add --dry-run .`, sem fazer staging nesta preparação. Repositório atual não tem commits, arquivos rastreados ou remoto; isso não garante a segurança de um remoto/histórico futuro. Usar um repositório dedicado aprovado, evitando reutilizar históricos de outro projeto.

Excluir .env privado, backups, fontes administrativas, dumps, logs, tmp, dependências/cache e JSON/TXT operacionais da raiz de docs. Somente a documentação pública do manifesto aprovado será incluída; relatórios de incidentes, inventários e referências locais ficam excluídos. .gitattributes preserva os bytes das migrações SQL para não mudar checksums ao clonar. Não normalizar/reformatar migrações já aplicadas.

## Neon: driver e segurança

Preservar PrismaPg/node-postgres por TCP; o serviço Node persistente do Render não exige trocar para adapter-neon/WebSocket. Prisma 7.10 usa prisma7.config.ts com datasource.url = DIRECT_URL || DATABASE_URL na CLI. Runtime usa configurarBanco(DATABASE_URL) no adapter e não lê DIRECT_URL. [Prisma PostgreSQL](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql), [pool Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool).

Runtime: host pooled com -pooler e papel simples balsas_api_prod. Migração/restore: host direto, papel migrador separado balsas_migrate_prod, em database/branch dedicada. Usar credenciais remotas novas, nunca postgres local ou sua senha rotacionada. A conexão remota de produção exige sslmode=verify-full; certificados/hostname são verificados pelo driver. Não desativar rejectUnauthorized. TLS real ainda depende de teste no destino. [Neon conexão segura](https://neon.com/docs/connect/connect-securely).

Parâmetros URI aceitos pela aplicação: schema, sslmode, application_name e connect_timeout, sem duplicatas. Parâmetros que sobrescrevem host/user/password e opções de arquivo SSL são recusados. pg 8.16.3 usa a opção enableChannelBinding para oferecer SCRAM-PLUS; `channel_binding=require` de libpq não é implementado como exigência por este wrapper, portanto é rejeitado em vez de ignorado. Usar o exemplo específico desta aplicação com verify-full; não afirmar channel binding sem teste/implementação próprios.

Em destino dedicado e após autorização, provisionar runtime sem atributos administrativos/membership elevado, sem ownership ou DDL. Migrador é proprietário dos objetos. Replicar o plano local: runtime SELECT/INSERT nas tabelas de negócio, UPDATE somente atracoes, DELETE somente atracoes/atracao_tags, USAGE nas sequências, sem ledger/TRUNCATE/CREATE/UPDATE de sequência. Revisar PUBLIC/default privileges para não herdar permissões adicionais; testar negações no ambiente remoto isolado. Não copiar regras HBA locais para Neon. Os loaders administrativos locais recusam destinos remotos: não utilizá-los para operar Neon.

## Sequência consistente de schema e dados

Escolher um dos dois caminhos antes de escrever no destino. Não combinar aplicação das duas migrações com restauração completa do mesmo esquema.

### Caminho recomendado para preservar os registros existentes

1. Aprovar destino dedicado vazio e transferência, janela de snapshot e operador direto. Conferir versões de PostgreSQL origem/destino, compatibilidade do dump, tamanho e TOC. Ensaiar em branch/base remota separada antes do destino final.
2. Preservar backups existentes e gerar snapshot aprovado, registrando seis contagens/hashes, FK/órfãos, ledger/checksums e sequências. Não congelar/parar consumidores locais com esta autorização de preparação.
3. Configurar os papéis remotos e permissões necessárias do migrador para restore no schema dedicado. Não aplicar migrate deploy antes da restauração completa: o dump já contém schema, dados e _prisma_migrations.
4. Restaurar por conexão direta com pg_restore --no-owner --no-acl --exit-on-error --single-transaction. Examinar TOC e schema public antes; o destino deve estar vazio e dedicado. Não usar --clean nem desabilitar constraints indiscriminadamente. Não restaurar roles/ACL/ownership locais. A restauração deve criar objetos sob o migrador autorizado.
5. Credenciais de pg_dump/pg_restore/psql por ambiente privado/pgpass protegido, PGHOST/PGPORT/PGUSER/PGDATABASE e TLS/CA adequados; não usar uma URL com senha em --dbname/argv. Rever logging antes de executar. Node pg e libpq podem precisar de configurações de CA diferentes.
6. Conferir todos os seis hashes/contagens, incluindo ledger: 8 atrações, 15 tags, 32 associações, 3 categorias, 0 avaliações, 2 migrações. Comparar colunas em ordem e serialização/timestamps consistentes; confirmar IDs, FKs, constraints, ausência de órfãos e nextval superior aos IDs atuais sem alterar a origem.
7. Executar migrate status com DIRECT_URL. As duas migrações devem aparecer aplicadas e os checksums devem corresponder aos arquivos preservados. migrate deploy somente se houver migração posterior pendente, compatível e separadamente autorizada.
8. Aplicar/validar grants runtime e testes CRUD em branch/base remota isolada. Só mudar a URL do serviço quando destino, integridade, TLS e privilégios estiverem aprovados.

### Caminho alternativo: banco novo sem transferência

Após aprovação de criação/esquema, usar migrate deploy em banco vazio por DIRECT_URL. Isso cria o esquema e ledger, mas não importa as oito atrações. Seed/importação é decisão e autorização separada. Não rodar seed automaticamente no build/start. Se decidir transferir os registros depois, preparar um plano específico de importação de dados em esquema existente, excluindo ledger e respeitando ordem de FKs/sequências; não usar o dump completo sobre esse esquema.

Comandos CLI futuros, somente após configurar o destino privado e receber autorização:

```powershell
# Leitura/validação da configuração; não imprime senha.
node --env-file=.env.migration node_modules/prisma/build/index.js validate --config prisma7.config.ts
node --env-file=.env.migration node_modules/prisma/build/index.js migrate status --config prisma7.config.ts
# Somente quando o caminho escolhido exige migrações e houver autorização:
# node --env-file=.env.migration node_modules/prisma/build/index.js migrate deploy --config prisma7.config.ts
```

## Recuperação

Antes da troca de URL, guardar configuração privada anterior e snapshots verificáveis. Falha de implantação: restaurar configuração aprovada do serviço ou versão anterior, preservando os dados de ambas as origens; avaliar novas escritas antes de qualquer retorno. Não apagar o destino nem sobrescrever origem com dump. Backup de dados não recupera senha administrativa. Não voltar à credencial local comprometida, comprovadamente rejeitada; usar fonte corrente/operador autorizado. Recuperação emergencial que exige HBA, restart ou intervenção em terceiros precisa de autorização própria.

## Limites gratuitos, verificados em 12/10/2026

Render Free: suspende após 15 minutos sem tráfego; retomada aproximada de um minuto; filesystem efêmero e sem disco persistente. Workspace tem 750 horas gratuitas/mês, compartilhadas; exceder quotas pode suspender serviços ou builds. Tráfego externo excessivo pode suspender o serviço. Sem escala horizontal, shell ou one-off jobs; não contar com pre-deploy em Free. Não usar keepalive artificial. Quotas de banda/build do workspace devem ser conferidas no painel. É ambiente de demonstração, sem promessa de disponibilidade de produção. [Render Free](https://render.com/docs/free).

O blueprint atual documenta Free com 0,1 CPU/512 MB; medir memória do Prisma no destino. [Especificação Render](https://render.com/docs/blueprint-spec). Banco Neon externo não depende do armazenamento efêmero do web service.

Neon Free: 100 projetos, 100 CU-hours por projeto, 1 GB de PostgreSQL por projeto/20 GB na conta, dez branches e 5 GB de egress; scale-to-zero após cinco minutos. Esgotar compute/egress suspende compute até o próximo período; exceder storage bloqueia escritas. Histórico indicado de seis horas/limite de 1 GB não substitui backup exportado. Conferir cotas da conta antes de criar recursos. [Neon pricing](https://neon.com/pricing).

Nenhum recurso remoto foi criado, nenhum dado foi transferido e nenhum deploy ocorreu. Ver [checklist de autorizações](checklist-publicacao-github-neon-render.md).
