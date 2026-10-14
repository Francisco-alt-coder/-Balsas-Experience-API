# Plano de integração remota — execução ainda bloqueada

13/10/2026. Projeto autorizado para inspeção: little-surf-82939047, main/br-steep-violet-b8t7my2h, balsas_experience, endpoint direto ep-patient-brook-b88gj2rm.c-14.us-east-1.aws.neon.tech, PostgreSQL 18.6, Free, AWS us-east-1, 0.25 CU. Pooler desabilitado; nenhum recurso adicional necessário para o probe.

Inventário atual READ ONLY: public vazio, sem tabelas/índices/sequências/constraints/ledger. Papel do conector é owner com capacidades administrativas. Role proposta balsas_experience_runtime ainda não existe, conforme consulta de catálogo. Isso não autoriza criação ou alteração de permissões.

## Pré-requisitos e recuperação

1. Disponibilizar DIRECT_URL real no JSON privado existente. Estado atual: CREDENCIAL_NEON_PENDENTE. Não alterar .env local nem ACLs para obter acesso. Primeiro executar probe autenticado com TLS verify-full, certificado/hostname, destino e identidade esperados.
2. Repetir inventário imediatamente antes de qualquer mudança. Se surgirem objetos/dados/ledger, interromper a proposta de inicialização em vazio e comparar o estado real.
3. Produzir backup remoto consistente por pg_dump com credencial transmitida apenas no ambiente privado do subprocesso; arquivo em diretório privado ignorado. Conferir SHA-256 e catálogo pg_restore. Confirmar recuperação por restauração em ambiente autorizado e isolado. **Backup remoto consistente/recuperável ainda não comprovado:** depende da credencial e, para ensaio que crie recursos, de autorização própria. Não usar backup local como prova de recuperação do Neon.
4. Não executar rollback automático com DROP. Em falha, preservar estado, ledger e logs sanitizados; avaliar transação, migração incompleta e restauração autorizada. A primeira migração não tem BEGIN/COMMIT explícitos; não presumir aplicação totalmente atômica. A segunda tem transação explícita.

## Mudança de schema proposta, não executada

Aplicar somente migrações locais existentes em ordem, após revisão/backup/aprovação específica:

| Ordem | Migração | SHA-256 |
|---:|---|---|
| 1 | 20261011200553_init | d7850ea6c25a735a435e99e65bc54d503057b85a135800c9769afb189746539e |
| 2 | 20261012140000_categorias_avaliacoes | b4fd8165612a4eb2895ddaaca143a6534331173f340c99636bd6d2fe2f41fea2 |

A primeira cria atracoes/tags/atracao_tags, sequências SERIAL, PKs, UNIQUE e FKs CASCADE. A segunda cria categorias/avaliacoes, normaliza categoriaId com INSERT/UPDATE antes de NOT NULL, adiciona FK de categoria RESTRICT, índices e CHECK nota 1–5. Em vazio, backfill não tem linhas. Riscos: conflitos com objetos preexistentes, migração interrompida, locks, transformação/normalização caso haja dados e privilégios insuficientes. Não são SQL idempotentes. Não há DROP no SQL existente, mas isso não dispensa recuperação.

Não editar migrações históricas, gerar migrações desnecessárias, resetar banco, usar db push ou migrate dev em produção. CLI deve receber DIRECT_URL direta de forma explícita; recusar fallback acidental à URL local/runtime. Após aplicação autorizada: conferir ledger/checksums, colunas, PK/FK/unique/CHECK, índices e sequências. Código zero do probe sozinho não é comparação estrutural completa.

## Role runtime proposta

Proposta para aprovação futura: role dedicada sem superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, sem associação administrativa ou SET ROLE para owner. CONNECT no banco, USAGE no public, SELECT nas cinco tabelas; INSERT/UPDATE/DELETE em atracoes; INSERT em categorias/tags/avaliacoes; INSERT/DELETE em atracao_tags; USAGE/SELECT nas sequências necessárias. Sem acesso ao ledger, CREATE no schema, TRUNCATE, ALTER/DROP ou setval. Confirmar permissões efetivamente exigidas pelo Prisma em ambiente isolado antes de fixar grants finais. Nenhuma role, senha ou grant foi alterado.

## Dados acadêmicos e produção

Uma carga dos oito registros do JSON público poderá ser proposta separadamente, depois do schema e mediante autorização de escrita. Não copiar o PostgreSQL local automaticamente, não apagar registros e não inserir avaliações como se fossem reais. O seed atual é local e explicitamente recusa Neon; não executá-lo contra remoto. Conferir equivalência do JSON, política de IDs/sequências e comportamento se houver dados antes de implementar a carga remota.

Arquivo privado runtime-secrets.private.json preparado em backups/neon: API_WRITE_TOKEN novo/forte, CORS_ORIGINS=none, DATABASE_URL vazia. O token não foi publicado nem instalado no Render. none permite clientes sem Origin e nega origens de navegador; quando existir frontend, cadastrar sua origem HTTPS real. Não expor Bearer compartilhado em frontend público.

Render: modelo Free/Virginia, rootDir conforme repositório (package.json na raiz do pacote), Node 24.20.0, build npm ci --include=dev && npm run build, start npm start, HOST 0.0.0.0, PORT dinâmica e health /health. Acesso Render precisa ser disponibilizado; integração encontrada, ainda sem conexão confirmada. Commit/push, criação/configuração de serviço e deploy são autorizações separadas. Conferir [limites Free](https://render.com/docs/free); apropriado à demonstração com suspensão/cold start, sem comprovação de disponibilidade contínua. Não foi contratado plano pago.

Após eventual deploy autorizado: guardar URL real, testar TLS/health/leituras/CORS/Bearer/falhas, confirmar identidade do banco e persistência após reinício. Testes de escrita remotos somente em dados descartáveis/ambiente autorizado. O workflow Linux de unitários foi preparado, não executado. Nenhuma URL pública foi simulada.
