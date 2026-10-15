# Registro de preparação remota: Neon e Render (15/10/2026)

## Escopo e limites

Demanda: tornar a Balsas Experience API 2.0.0 acessível por HTTPS com PostgreSQL Neon e privilégio mínimo. Esta etapa foi conduzida com acesso a GitHub e Neon, **sem conexão autorizada ao Render**. Não há URL pública validada, não foram executados testes remotos HTTP nem comprovada autenticação TCP/Prisma usando a futura role de produção.

## Neon: ações executadas

Projeto `little-surf-82939047`, branch principal `main` (`br-steep-violet-b8t7my2h`), banco `balsas_experience`.

1. Consultado inventário inicial: 0 tabelas de domínio, sem `_prisma_migrations`.
2. Criada branch isolada `validacao-publicacao-20261015` (`br-young-haze-b84mn0nl`), a partir de `main`, antes das escritas principais.
3. Na branch isolada, executadas em transação as instruções SQL das duas migrações versionadas, com `BEGIN/COMMIT` de arquivo tratados pelo executor transacional. O histórico foi registrado manualmente em `_prisma_migrations`, com os checksums documentados.
4. Validados 6 objetos do tipo tabela (5 de negócio e ledger), 4 chaves estrangeiras, 14 índices e duas entradas de migração.
5. Reconfirmado que o banco principal continuava vazio; repetido nele o mesmo procedimento transacional.
6. Inserida no banco principal **uma carga de demonstração** proveniente de `src/data/atracoes.json`, sem alterar o JSON, os registros locais ou as migrações versionadas. Resultados: 8 atrações, 15 tags, 32 vínculos, 3 categorias, 0 avaliações. Comparação campo a campo e dos arrays de tags com o arquivo público: 8/8 sem divergências. Verificados 0 vínculos órfãos e sequência de atrações no ID 8.
7. Criada no banco principal `balsas_runtime_restrito` com `NOLOGIN`, sem superusuário, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS ou memberships. Concedidos somente CONNECT, USAGE, SELECT/INSERT, UPDATE/DELETE por tabela conforme operações previstas e USAGE nas sequências necessárias. Consulta a `pg_roles` e `has_*_privilege` confirmou ausência de CREATE e de SELECT no ledger.
8. A criação de role pelo mecanismo administrativo Neon na branch de ensaio concedeu inesperadamente membership `neon_superuser` e capacidades excessivas. A tentativa de revogação foi rejeitada; por segurança, essa role de ensaio foi excluída. Restou apenas uma role manual `NOLOGIN` para análise na branch isolada.

**Aviso sobre Prisma:** o esquema foi aplicado por executor SQL, não pelo Prisma CLI. A tabela `_prisma_migrations` foi criada e preenchida manualmente. Antes de qualquer atualização futura de esquema ou declaração de equivalência plena, executar `prisma migrate status` com conexão autenticada direta, conferir checksums e detectar drift contra o schema versionado. Não executar `migrate deploy` às cegas; jamais executar `migrate reset` ou `db push` no destino.

**Segurança:** a role `balsas_runtime_restrito` não tem login nem senha configurados; portanto **a API ainda não possui credencial runtime válida**. Não substituir por `balsas_experience_owner` ou por qualquer role com membership `neon_superuser`. A configuração privada de senha requer canal seguro do operador. O catálogo de grants não substitui teste de conexão e de operações com a identidade final.

## GitHub/Render: mudanças publicadas

- `render.yaml`: Blueprint Render Free em Virginia, Node 24, build `npm ci --include=dev && npm run build`, start `npm start`, health `/health`, autodisparo desativado, secrets `sync: false`. Não contém URLs privadas nem tokens.
- `scripts/test-public-security.mjs`: smoke HTTPS sem gravações, cobrindo saúde, lista, categorias, ID inválido, Bearer ausente/inválido e origem CORS não permitida.
- `.github/workflows/remote-readonly.yml`: acionamento manual com URL HTTPS real; executa o script público de leitura existente e o novo teste de segurança.
- README atualizado com o estágio real.

## Pendências para serviço público

1. Configurar com segurança uma credencial de login para a role restrita, sem armazenar senha em repositório, chat ou argumentos de comando; validar autenticação TCP/TLS e permissões efetivas como essa role. Não habilitar login sem senha forte.
2. Validar `prisma migrate status` com a URL direta privada e revisar a equivalência estrutural; registrar o resultado.
3. Conectar a conta Render e importar `render.yaml` usando plano gratuito. Configurar DATABASE_URL da role restrita, API_WRITE_TOKEN forte, CORS_ORIGINS=none, HOST=0.0.0.0 e demais envs. Nunca instalar DIRECT_URL na aplicação.
4. Publicar e testar URL HTTPS **real**, inclusive status HTTP, leituras, Bearer, CORS, cold start e logs. Escritas remotas apenas em branch isolada e autorizada.
5. Executar novamente CI e testes aplicáveis, documentar resultados e limitações de recursos Free.

Classificação desta etapa: **BANCO REMOTO PREPARADO E POVOADO; API PÚBLICA AINDA NÃO IMPLANTADA / NÃO VALIDADA**.

## Registro de IA

Ferramenta: ChatGPT; finalidade: diagnóstico, execução controlada do esquema/dados, revisão de segurança e automação da validação. Validações reais: consultas SQL de tabelas, índices, chaves, contagens, órfãos, sequência e comparação do JSON; commits GitHub dos arquivos de implantação. A autenticação da role, `prisma migrate status` e testes HTTP remotos permanecem pendentes de execução e evidência.
