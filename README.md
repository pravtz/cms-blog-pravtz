# Nexus CMS

Monorepo do Nexus CMS com painel administrativo em Next.js, blog público, suíte E2E em Playwright e um pacote de servidor MCP.

O repositório mistura implementação em andamento com documentação de produto em `docs/` e `tasks/`. Este `README` descreve o que existe no checkout atual e como rodar o projeto localmente.

## Estrutura

```text
.
├── apps/
│   ├── admin/        # painel administrativo + APIs + fluxo de setup
│   ├── blog/         # frontend público do blog
│   └── e2e/          # testes end-to-end com Playwright
├── packages/
│   ├── db/           # workspace reservado para camada de dados
│   └── mcp-server/   # servidor MCP para integração com agentes
├── docs/             # PRD mestre, notas e planos de correção
├── tasks/            # PRDs modulares por domínio
├── docker-compose.yml           # stack base
├── docker-compose.override.yml  # sobreposição local de desenvolvimento
└── turbo.json
```

## Stack principal

- Node.js 20+
- npm workspaces + Turbo
- TypeScript
- Next.js 14 App Router
- SQLite com `better-sqlite3` no admin
- Redis com `ioredis`
- Validação com `zod`
- Playwright para E2E

## Aplicações e portas

- `apps/admin`: roda em `http://localhost:3001`
- `apps/blog`: roda em `http://localhost:3000`
- `apps/e2e`: suíte Playwright para fluxos integrados
- `packages/mcp-server`: binário `nexus-mcp` após build

No admin, a raiz redireciona para `/admin`. Em ambiente novo, o fluxo inicial passa por `/admin/setup`.

## Pré-requisitos

- Node.js `>=20`
- npm `>=10`
- Docker e Docker Compose, se você quiser subir a stack containerizada

## Desenvolvimento local

Instale as dependências na raiz:

```bash
npm install
```

Suba o monorepo em modo desenvolvimento:

```bash
npm run dev
```

Comandos úteis na raiz:

```bash
npm run build
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Comandos por workspace:

```bash
npm run storybook --workspace=apps/admin
npm run test:coverage --workspace=apps/admin
npm run test:e2e:ui --workspace=apps/e2e
npm run install-browsers --workspace=apps/e2e
```

## Ambiente com Docker

Copie o arquivo de exemplo e ajuste os segredos:

```bash
cp .env.example .env
```

Variáveis importantes:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `REDIS_PASSWORD`
- `ENCRYPTION_KEY`
- `BLOG_URL`
- `ADMIN_URL`

Depois:

```bash
docker compose up -d --build
```

O Compose da raiz funciona em camadas:

- `docker-compose.yml`: definição base da stack
- `docker-compose.override.yml`: ajustes de desenvolvimento carregados automaticamente pelo `docker compose`

Isso não representa dois ambientes concorrentes; é uma única stack com override local.

Serviços da definição base:

- `admin`
- `blog`
- `redis`
- `nginx`

Por padrão, o proxy expõe `80` e `443`, configuráveis via `HTTP_PORT` e `HTTPS_PORT`.

No override de desenvolvimento, também entram bind mounts, portas locais para `3000` e `3001`, e o serviço `mailhog`.

## Testes

- `npm test`: executa os testes configurados via Turbo
- `npm run test:e2e`: executa a suíte Playwright em `apps/e2e`
- `npm run test:a11y --workspace=apps/e2e`: executa os testes marcados com `@a11y`

Se for a primeira execução do Playwright no ambiente local, instale os browsers antes:

```bash
npm run install-browsers --workspace=apps/e2e
```

## Documentação

- [PRD mestre](docs/PRD.md)
- [Checklist de tarefas](docs/task-checklist.md)
- [Plano de correção](docs/correction-plan.md)
- [PRDs modulares](tasks/)
- [README do MCP server](packages/mcp-server/README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## Observações

- O workspace `packages/db` existe no monorepo, mas não está documentado aqui como pacote finalizado.
- Parte do escopo funcional detalhado em `docs/PRD.md` e `tasks/` ainda representa planejamento de produto, não garantia de implementação concluída.
- Antes de editar arquivos dentro de `apps/admin`, `apps/blog`, `apps/e2e` ou `packages/mcp-server`, leia o `AGENTS.md` mais próximo.

## Licença

[MIT](LICENSE)
