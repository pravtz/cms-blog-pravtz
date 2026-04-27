# Plano de Tarefas — MailHog automático + seed local de posts

> Gerado em: 26/04/2026  
> Status geral: `planejado`  
> Execução de testes neste turno: `não executada`

**Sprint operacional:** [docs/sprint-mailhog-seed-local.md](/home/pravtz/pravtz/blogpravtz/docs/sprint-mailhog-seed-local.md)

---

## Objetivo

Garantir que, em `development` e `test`, o projeto funcione sem configuração SMTP explícita, usando MailHog como fallback padrão, e que o setup inicial crie 10 posts de exemplo sem duplicação.

---

## Estado atual observado

- [docker-compose.override.yml](/home/pravtz/pravtz/blogpravtz/docker-compose.override.yml) hoje expõe apenas overrides de `admin`, `blog` e `redis`; não existe serviço `mailhog`.
- [apps/admin/src/lib/email.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/lib/email.ts) resolve SMTP apenas via `getSetting('smtp_*')`; se `host` ou `port` não existirem, o envio é abortado.
- [apps/admin/src/app/api/setup/complete/route.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/app/api/setup/complete/route.ts) cria owner e settings, mas ainda não faz seed de posts.
- Os testes de integração relevantes já mockam `@/lib/db` e `@/lib/email`, então a mudança precisa preservar esse isolamento.
- Os helpers E2E atuais dependem de `POST /api/setup/complete`, mas não assumem explicitamente a existência de posts seed.

---

## Escopo

### Em escopo

- Adicionar MailHog ao override local de Docker.
- Introduzir fallback SMTP por precedência `settings -> env -> MailHog`.
- Criar seed condicional de 10 posts no setup inicial.
- Ajustar testes de integração e revisar impacto em E2E.

### Fora de escopo

- Alterações no `docker-compose.yml` de produção.
- Seed de outros dados além de posts.
- Mudança de comportamento em `production` para forçar envio de e-mails.

---

## Arquivos envolvidos

- [docker-compose.override.yml](/home/pravtz/pravtz/blogpravtz/docker-compose.override.yml)
- [apps/admin/src/lib/email.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/lib/email.ts)
- [apps/admin/src/app/api/setup/complete/route.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/app/api/setup/complete/route.ts)
- [apps/admin/src/__tests__/integration/newsletter.test.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/__tests__/integration/newsletter.test.ts)
- [apps/admin/src/__tests__/integration/auth-login.test.ts](/home/pravtz/pravtz/blogpravtz/apps/admin/src/__tests__/integration/auth-login.test.ts)
- `apps/admin/src/__tests__/integration/*setup*` ou novo teste dedicado do setup, se não existir cobertura adequada
- [apps/e2e/fixtures/helpers.ts](/home/pravtz/pravtz/blogpravtz/apps/e2e/fixtures/helpers.ts) apenas se os defaults passarem a exigir ajuste de fixture

---

## Plano de execução

### Fase 1 — Infra local com MailHog

**Objetivo:** disponibilizar SMTP local padrão no fluxo Docker de desenvolvimento.

| # | Tarefa | Arquivo | Status |
|---|---|---|---|
| 1.1 | Adicionar serviço `mailhog` com portas `1025` (SMTP) e `8025` (UI) | `docker-compose.override.yml` | ⬜ |
| 1.2 | Injetar defaults de `SMTP_HOST`, `SMTP_PORT` e `SMTP_FROM` no serviço `admin`, preservando override do usuário | `docker-compose.override.yml` | ⬜ |
| 1.3 | Incluir `mailhog` em `depends_on` do `admin` no override local | `docker-compose.override.yml` | ⬜ |
| 1.4 | Confirmar que a mudança não altera o stack de produção | `docker-compose.override.yml` | ⬜ |

**Observações de implementação:**

- Usar apenas o arquivo de override local para não contaminar o compose base.
- O default de `SMTP_FROM` precisa continuar coerente com o fallback do backend.

### Fase 2 — Resolução SMTP com fallback controlado

**Objetivo:** centralizar a resolução SMTP no backend com precedência explícita e fallback seguro.

| # | Tarefa | Arquivo | Status |
|---|---|---|---|
| 2.1 | Extrair função única para resolver config SMTP | `apps/admin/src/lib/email.ts` | ⬜ |
| 2.2 | Aplicar precedência `settings -> env -> fallback MailHog` | `apps/admin/src/lib/email.ts` | ⬜ |
| 2.3 | Restringir fallback implícito a `NODE_ENV=development` ou `test` | `apps/admin/src/lib/email.ts` | ⬜ |
| 2.4 | Manter `auth` opcional e `secure` por porta (`465`) | `apps/admin/src/lib/email.ts` | ⬜ |
| 2.5 | Preservar comportamento atual em produção: sem SMTP configurado, não envia | `apps/admin/src/lib/email.ts` | ⬜ |

**Detalhes esperados da regra:**

1. Buscar `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from` em `settings`.
2. Completar ausências com `process.env.SMTP_*`.
3. Se ainda faltar `host` ou `port`, usar `mailhog:1025` apenas em `development` e `test`.
4. Se o ambiente for `production` e a configuração continuar incompleta, retornar `null`.

**Dependência:** esta fase deve vir antes dos ajustes de testes, porque define o contrato a ser validado.

### Fase 3 — Seed de 10 posts no setup

**Objetivo:** gerar dados mínimos de uso local após a conclusão do setup.

| # | Tarefa | Arquivo | Status |
|---|---|---|---|
| 3.1 | Criar helper interno para seed condicional de posts | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 3.2 | Executar seed apenas em `development` e `test` | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 3.3 | Verificar `COUNT(*) = 0` em `posts` antes de inserir | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 3.4 | Inserir 10 posts publicados, públicos e com slugs únicos | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 3.5 | Associar autoria ao owner recém-criado dentro da mesma transação | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 3.6 | Garantir idempotência em reexecuções e resets | `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |

**Critérios de modelagem do seed:**

- Títulos e slugs previsíveis o bastante para depuração local.
- Conteúdo simples, sem depender de assets, IA ou tabelas auxiliares opcionais.
- Inserção transacional para não deixar setup parcialmente concluído.

### Fase 4 — Cobertura de testes e compatibilidade

**Objetivo:** alinhar a suíte ao novo comportamento, sem ampliar acoplamento desnecessário.

| # | Tarefa | Arquivo | Status |
|---|---|---|---|
| 4.1 | Adicionar teste de integração para fallback MailHog quando não houver SMTP em settings/env | `apps/admin/src/__tests__/integration/newsletter.test.ts` ou teste dedicado de `email.ts` | ⬜ |
| 4.2 | Adicionar teste para garantir ausência de fallback implícito em produção | mesmo arquivo ou teste dedicado | ⬜ |
| 4.3 | Adicionar cobertura para setup criar 10 posts com banco vazio em `test` | teste de integração do setup | ⬜ |
| 4.4 | Adicionar cobertura para setup não duplicar posts em reexecução/reset equivalente | teste de integração do setup | ⬜ |
| 4.5 | Revisar `apps/e2e/fixtures/helpers.ts` para confirmar que o seed não quebra pré-condições existentes | `apps/e2e/fixtures/helpers.ts` | ⬜ |

**Observações:**

- Como `newsletter.test.ts` hoje mocka `@/lib/email`, pode ser mais limpo criar um teste focado na resolução de transporte ao invés de forçar asserts indiretos sobre a rota.
- `auth-login.test.ts` não é o melhor lugar para validar MailHog; ele só entra no escopo se algum helper compartilhado de mock precisar ser alinhado.

---

## Ordem recomendada

1. Fase 2
2. Fase 3
3. Fase 1
4. Fase 4

**Justificativa curta:** primeiro vale estabilizar o contrato do backend e do setup; depois alinhar a infraestrutura local e, por fim, ajustar a cobertura com base no comportamento final.

---

## Critérios de aceite

- Sem `SMTP_*` definidos, o ambiente local usa `mailhog:1025` em `development` e `test`.
- O painel do MailHog fica acessível em `http://localhost:8025`.
- Em `production`, ausência de SMTP continua resultando em envio desabilitado, sem fallback implícito.
- O primeiro setup em base vazia cria exatamente 10 posts públicos publicados.
- Reexecuções não duplicam os posts seed.
- A suíte de testes relevante é atualizada para refletir o novo contrato, mesmo que não seja executada neste turno.

---

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Testes existentes assumirem que SMTP ausente sempre desabilita envio | Médio | Isolar fallback por `NODE_ENV` e cobrir explicitamente `production` |
| Seed automático interferir em cenários que esperam base vazia | Alto | Aplicar seed apenas no setup inicial e somente quando `posts` estiver vazia |
| Mistura de fontes entre `settings` e `env` gerar comportamento implícito difícil de rastrear | Médio | Centralizar resolução em função única e documentar precedência no código |
| E2E começar a depender acidentalmente dos posts seed | Médio | Manter fixtures independentes e revisar helpers antes de adaptar specs |

---

## Checklist de validação planejada

- [ ] `docker compose up` inicia MailHog e admin com defaults corretos
- [ ] envio de newsletter em `development` usa MailHog sem `SMTP_*`
- [ ] envio em `production` sem SMTP continua sendo ignorado
- [ ] setup inicial cria 10 posts
- [ ] segunda execução não duplica posts
- [ ] cobertura de integração atualizada
- [ ] revisão de impacto em E2E concluída

> Nota: este checklist foi planejado, mas nenhum teste ou validação automatizada foi executado neste turno.
