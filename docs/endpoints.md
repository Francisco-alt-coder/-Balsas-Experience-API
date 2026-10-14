# Endpoints e contratos

A lista completa de campos, filtros, exemplos e códigos está no [README](../README.md). Todas as respostas são JSON, com nosniff; logs não incluem credenciais/corpos. GET é público, escritas exigem Bearer.

| Método | Caminho | Contrato |
|---|---|---|
| GET | / | Identificação 200 |
| GET | /live | Liveness 200, sem provar banco |
| GET | /health | SELECT 1; 200 conectado ou 500 sanitizado |
| GET | /atracoes | Filtros q/categoria/tag/cidade/ate, ordenação/paginação |
| GET | /atracoes/:id | Detalhe, tags, avaliações, média e total |
| GET | /categorias | Categorias com contagens; formato=nomes para compatibilidade |
| POST | /atracoes | Bearer; criação 201/Location |
| PUT/PATCH | /atracoes/:id | Bearer; atualização 200 com validação |
| DELETE | /atracoes/:id | Bearer; 204, avaliações em cascata |
| POST | /atracoes/:id/avaliacoes | Bearer; nota inteira 1..5, visitante e comentário opcional; 201 |

400 para entradas inválidas; 401 para Bearer; 403 para origem proibida; 404 para ausência; 409 para conflitos; 413 para JSON maior que 100 KB; 415 para codificação não suportada; 500 genérico em falha interna. CORS não substitui autenticação; não colocar token compartilhado em frontend público. Testes com escrita somente em base isolada.

Em produção sem frontend publicado, `CORS_ORIGINS=none` permite requisições sem Origin e responde 403 a qualquer Origin de navegador, inclusive preflight. Uma origem só deve ser cadastrada quando houver domínio HTTPS real do frontend. O domínio da API hospedada, por si só, não identifica essa origem.
