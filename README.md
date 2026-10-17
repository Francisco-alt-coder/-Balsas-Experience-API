# Balsas Experience API

Projeto da disciplina **Programação para Web**, do curso de **Análise e Desenvolvimento de Sistemas** da UNIBALSAS. Criamos uma API REST e um catálogo de atrações turísticas de Balsas (MA).

## Equipe

- Caio Vinícius Lima Soares
- David Rodrigues Costa
- Francisco Wesley de Souza Dias
- Pedro Henrique Guedes

## Tecnologias

- **Node.js 24** e **Express 5**: servidor e rotas da API.
- **PostgreSQL** e **Prisma 7**: banco de dados e acesso aos registros.
- **HTML, CSS e JavaScript**: páginas do catálogo.
- **Render e Neon**: hospedagem da API e do banco publicado.

## Pré-requisitos

Instale uma vez no computador:

- [Node.js 24](https://nodejs.org/)
- [Git](https://git-scm.com/downloads)
- [PostgreSQL](https://www.postgresql.org/download/windows/) com pgAdmin

## Como executar no Windows

**1. Baixe o projeto.** Abra o PowerShell (ou terminal do VS Code) e execute:

```powershell
git clone https://github.com/Francisco-alt-coder/-Balsas-Experience-API.git balsas-experience-api
cd balsas-experience-api
npm ci --include=dev
```

**2. Crie o banco.** Abra o **pgAdmin**, clique com o botão direito em **Databases**, escolha **Create > Database**, informe `balsas_experience` e salve.

**3. Configure o projeto.** No mesmo PowerShell, execute:

```powershell
Copy-Item .env.example .env
notepad .env
```

No arquivo aberto, preencha ou acrescente estas linhas com **a senha do seu PostgreSQL local** e um token aleatório:

```dotenv
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/balsas_experience?schema=public"
API_WRITE_TOKEN="COLE_AQUI_UM_TOKEN_ALEATORIO_FORTE_COM_PELO_MENOS_32_CARACTERES"
BALSAS_ADMIN_DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/balsas_experience?schema=public"
BALSAS_ADMIN_ALLOW_MUTATION=YES
```

Para gerar um token local de exemplo, execute `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e copie o resultado para `API_WRITE_TOKEN`. Salve e feche o Bloco de Notas. Se sua senha do banco tiver caracteres especiais (`@`, `#`, etc.), eles precisam estar codificados na URL.

**Atenção:** `BALSAS_ADMIN_DATABASE_URL` e `BALSAS_ADMIN_ALLOW_MUTATION` são usados **somente para popular seu banco local**. Não configure essas variáveis no Render e nunca publique o arquivo `.env` no GitHub.

**4. Prepare e inicie a API.** Execute, nesta ordem:

```powershell
npm run build
npm run db:migrate
npm run db:seed
npm start
```

Depois, abra no navegador: **http://localhost:3000/explorar**

Para encerrar o servidor, pressione **Ctrl + C**. Nas próximas vezes, com o banco já preparado, basta entrar na pasta do projeto e executar `npm start`.

Se o banco não conectar, confira se o PostgreSQL está ligado, se o banco `balsas_experience` existe e se a senha do `.env` está correta. **Não use o banco Neon de produção nesses comandos locais.**

## Rotas da API

| Método | Caminho | O que faz | Status de sucesso |
| --- | --- | --- | --- |
| GET | `/` | Identifica a API | 200 |
| GET | `/health` | Verifica a conexão com o banco | 200 |
| GET | `/live` | Verifica se o servidor está ativo | 200 |
| GET | `/atracoes?formato=json` | Lista atrações em JSON | 200 |
| GET | `/atracoes/:id?formato=json` | Consulta uma atração | 200 |
| GET | `/categorias` | Lista categorias | 200 |
| POST | `/atracoes` | Cadastra atração | 201 |
| PUT | `/atracoes/:id` | Substitui atração | 200 |
| PATCH | `/atracoes/:id` | Altera alguns campos | 200 |
| DELETE | `/atracoes/:id` | Remove atração | 204 |
| POST | `/atracoes/:id/avaliacoes` | Registra avaliação | 201 |

As operações de escrita exigem o cabeçalho `Authorization: Bearer SEU_TOKEN`. Uma atração inexistente retorna **404**. Para ver o JSON no navegador, utilize `?formato=json`.

**Exemplo de consulta:** `GET http://localhost:3000/atracoes/1?formato=json`

Outros exemplos, incluindo criação e exclusão, estão no arquivo [requisicoes.http](requisicoes.http). Faça essas operações de teste apenas no **banco local**.

## Testes

Na pasta do projeto:

```powershell
npm run check
npm test
npm run build
```

Os testes unitários usam simulações. Os testes de integração precisam de um banco de testes separado.

## Páginas para testar cadastro e exclusão

- **Cadastro (POST 201):** /cadastro
- **Exclusão (DELETE 204):** /exclusao

As duas páginas seguem a aparência do catálogo e exibem o código HTTP e a resposta **apenas depois de executar a operação real**. É necessário informar o token de escrita do ambiente, que não fica salvo no navegador. Para proteger o catálogo, a página de exclusão aceita somente registros com nome iniciado por "Teste acadêmico - " e exige confirmação.

**Prefira testar localmente em um banco separado.** No serviço publicado, essas operações modificam o banco conectado ao Render. Não envie a credencial para o GitHub, para o relatório nem para capturas de tela. Após cadastrar uma atração de teste, anote o ID retornado e exclua somente esse registro.

## Links importantes

- **Repositório no GitHub:** https://github.com/Francisco-alt-coder/-Balsas-Experience-API
- **API publicada:** https://balsas-experience-api-g7ru.onrender.com/
- **Catálogo de atrações:** https://balsas-experience-api-g7ru.onrender.com/explorar
- **Cadastro de teste:** https://balsas-experience-api-g7ru.onrender.com/cadastro
- **Exclusão de teste:** https://balsas-experience-api-g7ru.onrender.com/exclusao
- **Listagem JSON:** https://balsas-experience-api-g7ru.onrender.com/atracoes?formato=json
- **Exemplo de atração:** https://balsas-experience-api-g7ru.onrender.com/atracoes/1?formato=json

A versão publicada pode levar algum tempo para responder após ficar ociosa no plano gratuito do Render.
