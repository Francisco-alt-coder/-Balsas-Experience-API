# Checklist de publicação — GitHub, Neon e Render

Preparação local executada nesta rodada: instalação limpa, build/schema, suítes, configuração de produção/health/CORS, segurança/isolamento e integridade. Resultados em [estado-publicacao.md](estado-publicacao.md). Todos os itens externos abaixo permanecem **não executados**.

| Ordem | Operação futura | Autorização/evidência exigida |
|---|---|---|
| 1 | Revisão final do Git | Scanner atualizado, ignore, bytes/checksums SQL e histórico/remoto dedicado; revisão pode ser somente leitura |
| 2 | Commit e push | Autorizar explicitamente branch, conteúdo, destino e envio; preparação atual não fez staging |
| 3 | Criar repositório GitHub se necessário | Aprovar conta, nome, visibilidade e histórico novo; nunca incluir privados |
| 4 | Criar projeto/database/branch Neon | Aprovar conta, região, plano/cotas e destino exclusivo; nenhum recurso criado agora |
| 5 | Configurar credenciais remotas | Novos runtime/migrador separados, TLS verify-full, distribuição privada e grants mínimos |
| 6 | Criar esquema | Aprovar um único caminho: restore completo com ledger OU migrate deploy em vazio; não combinar |
| 7 | Transferir dados | Autorização separada de origem/destino/snapshot/janela; ensaio em destino isolado |
| 8 | Verificar integridade Neon | Seis hashes/contagens, 8/15/32, FKs/órfãos, sequences, ledger/checksums, TLS e privilégios |
| 9 | Criar Web Service Render | Aprovar conta/plano/região/repositório; modelo YAML ainda inativo |
| 10 | Variáveis privadas Render | DATABASE_URL runtime, API_WRITE_TOKEN, CORS_ORIGINS, NODE_ENV/HOST/pool; PORT da plataforma, sem DIRECT_URL |
| 11 | Deploy | Aprovação explícita; build npm ci --include=dev && npm run build; start npm start; nenhuma migração automática |
| 12 | Testes remotos | GETs/root/health/busca/categorias/tags/detalhe; falha/recuperação controladas e CRUD somente em destino de testes |
| 13 | Segurança publicada | Bearer, CORS, TLS/certificado, logs, grants, segredos, limites e códigos de erro |
| 14 | Validação externa | Cold start, rede externa, timeout, memória/concorrência, signal Linux/Render e quotas |
| 15 | Registrar evidências/endereço | URL pública e datas/resultados reais; só então declarar funcionamento remoto |

Qualquer falha crítica interrompe o avanço para troca de tráfego. Procedimento de recuperação no [guia de publicação](guia-publicacao-final.md); manter origem/backups. Não alterar roles locais, senha local, HBA, terceiros ou reiniciar PostgreSQL por esta preparação.
