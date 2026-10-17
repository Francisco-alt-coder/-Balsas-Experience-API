# Balsas Experience API

Projeto da disciplina **Programação para Web**, do curso de Análise e Desenvolvimento de Sistemas. Nossa equipe criou um site para conhecer atrações turísticas de Balsas (MA) e uma API para consultar os dados.

## Como rodar no seu computador

Este tutorial é para **Windows**. Se você só quer visitar o site, pode pular para **Links do projeto**, mais abaixo. Não precisa instalar nada para acessar a versão publicada.

### Passo 1: instale os programas

Você precisa ter no computador:

- [Node.js 24](https://nodejs.org/)
- [Git](https://git-scm.com/downloads)
- [PostgreSQL](https://www.postgresql.org/download/windows/) (com o **pgAdmin**)

**Esses programas só precisam ser instalados uma vez.**

### Passo 2: baixe o código

Abra o **PowerShell** (ou o terminal do VS Code), copie este bloco e execute:

```powershell
git clone https://github.com/Francisco-alt-coder/-Balsas-Experience-API.git balsas-experience-api
cd balsas-experience-api
npm ci --include=dev
```

Isso baixa o projeto, entra na pasta e instala os pacotes.

### Passo 3: crie o banco de dados

Abra o **pgAdmin**, entre no seu PostgreSQL e faça o seguinte:

1. Clique em **Databases** com o botão direito.
2. Escolha **Create > Database**.
3. Digite `balsas_experience` e clique em **Save**.


## Links do projeto

**Versão publicada: basta clicar, sem instalar nada.**

- [Abrir o catálogo de atrações](https://balsas-experience-api-g7ru.onrender.com/explorar)
- [Página inicial da API](https://balsas-experience-api-g7ru.onrender.com/)
- [Exemplo de atração](https://balsas-experience-api-g7ru.onrender.com/atracoes/1)

Os links não têm parâmetros de rastreamento. O `?formato=json` faz parte da consulta à API. Por estar no plano gratuito do Render, o site pode demorar para abrir depois de ficar um tempo sem visitas.

## Integrantes

- Caio Vinícius Lima Soares
- Francisco Wesley de Souza Dias
- David Rodrigues Costa
- Pedro Henrique Guedes

## O que desenvolvemos

O catálogo permite pesquisar atrações, escolher categorias, ordenar a lista e ver detalhes. A API também permite cadastrar, editar e excluir atrações, com dados organizados no PostgreSQL.

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Site | HTML, CSS e JavaScript |
| API | Node.js 24 e Express 5 |
| Banco | PostgreSQL e Prisma 7 |
| Hospedagem | Render e Neon |
| Código e testes | GitHub e GitHub Actions |

## Rotas principais

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/health` | Confere o banco |
| GET | `/atracoes?formato=json` | Lista atrações em JSON |
| GET | `/atracoes/:id?formato=json` | Mostra uma atração em JSON |
| GET | `/categorias` | Lista categorias |
| POST | `/atracoes` | Cadastra (precisa de token) |
| PUT/PATCH | `/atracoes/:id` | Edita (precisa de token) |
| DELETE | `/atracoes/:id` | Exclui (precisa de token) |

## Testes e arquivos

Para conferir o código, use `npm run check`, `npm test` e `npm run build`, um de cada vez. Testes de integração exigem um banco de testes separado, não o Neon de produção.

Pastas principais: `src/` (API), `public/` (site), `prisma/` (banco), `tests/` (testes) e `scripts/` (comandos auxiliares).
