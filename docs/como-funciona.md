# Entendendo o Balsas Experience API

Este arquivo resume o projeto de um jeito que podemos explicar em sala, sem substituir os relatórios e as evidências da disciplina.

## 1. Qual problema o projeto aborda?

Reunir informações de atrações turísticas de Balsas (MA) em um catálogo que pode ser consultado no navegador e também por outros programas por meio de uma API.

## 2. O que é cada parte?

- **Front-end:** arquivos de `public/`. Mostram o catálogo e os detalhes das atrações.
- **Back-end:** arquivos de `src/`. Recebem pedidos HTTP, validam dados e organizam as respostas.
- **Banco de dados:** PostgreSQL. Guarda atrações, categorias, tags e avaliações.
- **Prisma:** biblioteca usada pelo servidor para consultar e atualizar o banco.

### Caminho de uma consulta

~~~text
Pessoa abre /explorar
    ↓
JavaScript da página faz GET /atracoes
    ↓
Express recebe a requisição
    ↓
Controlador consulta o banco com Prisma
    ↓
API devolve JSON
    ↓
A página mostra as atrações
~~~

## 3. Onde está cada parte no código?

| Arquivo ou pasta | Para que serve |
| --- | --- |
| `src/app.js` | Inicia o servidor e registra as rotas |
| `src/routes/atracoes.routes.js` | Define as rotas da API |
| `src/controllers/atracoes.controller.js` | Faz as operações de atrações, categorias e avaliações |
| `src/middlewares/validacao.js` | Confere os dados antes de gravar |
| `src/middlewares/autenticacao.js` | Exige token nas operações de escrita |
| `src/lib/prisma.js` | Faz a conexão entre Prisma e PostgreSQL |
| `prisma/schema.prisma` | Define as entidades e os relacionamentos |
| `public/atracoes.js` e `public/atracao.js` | Mostram os dados nas páginas |

## 4. Exemplos práticos

- `GET /atracoes?formato=json`: consulta atrações.
- `GET /atracoes/1?formato=json`: consulta uma atração pelo ID.
- `POST /atracoes`: cria uma atração, mas precisa do token Bearer.
- `GET /health`: verifica se o servidor consegue consultar o banco.

As rotas de leitura são públicas. Nas rotas de escrita, a autenticação e a validação são importantes para evitar alterações não autorizadas ou dados inválidos.

## 5. Como executar e testar

Na pasta do projeto, use `npm ci --include=dev`, configure um `.env` privado com um banco de desenvolvimento e rode `npm run build` e `npm run dev`. Para verificar o código: `npm run check`, `npm test` e `npm run build`.

Os testes unitários não demonstram, sozinhos, o funcionamento do banco remoto. Testes que escrevem no banco devem usar um ambiente de teste isolado.

## 6. O que ainda pode melhorar?

A interface pública é de leitura e não tem login por usuário. Melhorias futuras, como formulários administrativos ou contas individuais, exigem planejamento e testes; não fazem parte das funcionalidades atuais.

**Autoria e validação:** este guia foi organizado com apoio do ChatGPT e deve ser conferido pelos integrantes antes da apresentação.
