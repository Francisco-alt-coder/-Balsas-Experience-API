# Ativação privada do Neon e conexão ao Render

Atualizado em 15/10/2026. Este procedimento prepara os passos que exigem interação autenticada do operador, sem publicar credenciais.

## Estado confirmado

- Projeto Neon: `little-surf-82939047`, branch `main`, banco `balsas_experience`.
- Esquema preparado e dados de demonstração existentes: 8 atrações, 15 tags, 32 associações e 3 categorias.
- A role `balsas_runtime_restrito` existe com `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS` e sem memberships; permissões de tabelas e sequências já foram concedidas.
- O Render ainda não está conectado à conta neste contexto. Não há deploy nem URL pública real.
- A política de `CORS_ORIGINS=none` permite clientes HTTP sem cabeçalho Origin e bloqueia origens de navegador.
- O `render.yaml` contém `API_WRITE_TOKEN: generateValue: true`, para geração do segredo pela plataforma na criação do serviço, e `DATABASE_URL: sync: false`, que exige preenchimento privado.

## 1. Definir a senha da role sem expô-la

Este passo deve ser realizado na máquina do operador autenticado. **Não envie a senha, URL de conexão completa ou captura de tela com credenciais para o chat, GitHub ou logs.**

1. Obtenha a senha da conta `balsas_experience_owner` na área autenticada do Neon, sem copiá-la para repositórios.
2. No terminal com PostgreSQL `psql` 16+ instalado, conecte como owner usando uma linha **sem senha**:

```powershell
psql "host=ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech port=5432 dbname=balsas_experience user=balsas_experience_owner sslmode=verify-full sslrootcert=system"
```

3. Dentro do `psql`, use `\password` para fornecer, interativamente, uma senha aleatória forte e **mantida em gerenciador de senhas**. O `psql` não imprime a senha em texto claro no histórico SQL:

```text
\password balsas_runtime_restrito
```

4. Apenas depois de confirmar que o comando de senha funcionou, habilite o login e confira atributos:

```sql
ALTER ROLE balsas_runtime_restrito LOGIN;
SELECT rolname, rolcanlogin, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = 'balsas_runtime_restrito';
```

5. Feche a sessão administrativa e conecte com `user=balsas_runtime_restrito` para conferir `SELECT 1`, `SELECT count(*) FROM atracoes`, e a recusa de acesso a `_prisma_migrations` e de `CREATE TABLE`. Testes negativos que envolvam DDL devem usar uma transação descartável e nunca modificar dados reais.
6. Mantenha o segredo fora de variáveis de ambiente persistidas em arquivos versionados. Se qualquer teste falhar, interrompa o deploy e registre apenas mensagem de erro sanitizada.

Observação: `sslrootcert=system` exige libpq/psql compatível. Se o cliente Windows não conseguir carregar o repositório de certificados do sistema, configure um arquivo de CA confiável conforme a documentação do PostgreSQL; **não reduza a verificação TLS**.

## 2. Conectar Render

1. No ChatGPT, instalar e autorizar a integração **Render** quando solicitado. Isso requer consentimento do titular; esta documentação não concede acesso automaticamente.
2. Na conta Render, conectar o provedor GitHub com acesso ao repositório `Francisco-alt-coder/-Balsas-Experience-API`, caso não esteja conectado.
3. Em **New > Blueprint**, selecionar o repositório e sua branch `main`; Render deverá carregar o arquivo `render.yaml` da raiz.
4. Conferir o serviço `balsas-experience-api` com plano `free`, região `virginia`, `npm ci --include=dev && npm run build`, `npm start` e `/health`.
5. Preencher `DATABASE_URL` somente na interface de segredos do Render usando a role restrita. Exemplo de formato **sem senha verdadeira**:

```text
postgresql://balsas_runtime_restrito:<SENHA_URL_ENCODED>@ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech/balsas_experience?sslmode=verify-full
```

6. `API_WRITE_TOKEN` será gerado pelo Render no fluxo de Blueprint a partir de `generateValue: true`. Não colocá-lo no frontend público.
7. Não adicionar `DIRECT_URL`, papel owner/migrador ou arquivos privados ao runtime. Conferir também `NODE_ENV=production`, `HOST=0.0.0.0` e `CORS_ORIGINS=none`.
8. Não ativar autodeploy até finalizar a validação.

## 3. Validação e evidências

- Antes de concluir, validar `prisma migrate status` por `DIRECT_URL` de operador, em ambiente isolado com configuração protegida. O ledger foi preenchido por executor SQL, não pelo Prisma CLI; confirmar equivalência estrutural.
- Com a **URL HTTPS verdadeira** do serviço, executar `PUBLIC_API_URL=https://... node scripts/test-public-readonly.mjs` e `node scripts/test-public-security.mjs`, ou acionar manualmente `HTTPS remote smoke (read-only)` no GitHub Actions.
- Registrar certificados, status HTTP, respostas sem segredos, horário, commit e endpoint real. Testar escrita somente em banco/branch de testes autorizado.
- Não classificar a API como publicamente funcional até comprovar `/health`, leituras, TLS, autenticação, permissões mínimas, cold start e ausência de erro no serviço.

## Referências oficiais

- Render Blueprints: https://render.com/docs/infrastructure-as-code
- Variáveis de ambiente Render: https://render.com/docs/configure-environment-variables
- PostgreSQL psql: https://www.postgresql.org/docs/current/app-psql.html
- Neon TLS/psql: https://neon.com/blog/avoid-mitm-attacks-with-psql-postgres-16

## Registro de IA

O ChatGPT preparou o procedimento, revisou a configuração do Blueprint e verificou o estado da role no Neon. A ativação privada da role, autorização Render, publicação e testes remotos dependem de ações/reprodução humana e não foram declarados como executados.
