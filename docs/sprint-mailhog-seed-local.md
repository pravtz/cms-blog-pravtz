# Sprint — MailHog automático + seed local de posts

> Gerado em: 26/04/2026  
> Baseado em: [docs/feature-mailhog-seed-local.md](/home/pravtz/pravtz/blogpravtz/docs/feature-mailhog-seed-local.md)  
> Status da sprint: `planejada`  
> Execução de testes neste turno: `não executada`

---

## Objetivo da sprint

Entregar um fluxo local previsível para e-mail e dados iniciais, garantindo:

- fallback SMTP para MailHog em `development` e `test`
- seed de 10 posts no setup inicial
- cobertura de testes entregue junto com a feature

---

## Regra da sprint

Conforme [tasks/PRD-11-testing-roadmap.md](/home/pravtz/pravtz/blogpravtz/tasks/PRD-11-testing-roadmap.md), testes não ficam em sprint separada. Cada história abaixo já inclui sua própria entrega de cobertura.

---

## Escopo fechado

- `docker-compose.override.yml`
- `apps/admin/src/lib/email.ts`
- `apps/admin/src/app/api/setup/complete/route.ts`
- testes de integração do admin afetados
- revisão pontual de fixture E2E, somente se necessário

## Fora da sprint

- mudanças no compose de produção
- seed de categorias, tags, usuários ou assets
- refactor amplo do sistema de e-mail além da resolução SMTP necessária

---

## Backlog da sprint

## SP-01 — Resolver SMTP com fallback controlado
**Prioridade:** crítica  
**Owner sugerido:** backend admin  
**Dependências:** nenhuma  
**Resultado esperado:** backend passa a resolver SMTP por `settings -> env -> MailHog`, sem fallback implícito em `production`.

| # | Tarefa | Status |
|---|---|---|
| 1.1 | Extrair função única de resolução SMTP em `apps/admin/src/lib/email.ts` | ⬜ |
| 1.2 | Aplicar precedência `settings -> env -> fallback` | ⬜ |
| 1.3 | Restringir fallback a `development` e `test` | ⬜ |
| 1.4 | Preservar `auth` opcional e `secure` por porta | ⬜ |
| 1.5 | Garantir retorno `null` em produção sem SMTP válido | ⬜ |
| 1.6 | Entregar teste cobrindo fallback local | ⬜ |
| 1.7 | Entregar teste cobrindo ausência de fallback em produção | ⬜ |

**Definição de pronto:**

- transporte SMTP é resolvido por função central única
- fluxos de envio existentes continuam usando essa função
- cobertura da regra local x produção foi adicionada

## SP-02 — Seedar 10 posts no setup inicial
**Prioridade:** crítica  
**Owner sugerido:** backend admin  
**Dependências:** SP-01 pode ocorrer em paralelo; não é bloqueante  
**Resultado esperado:** setup cria 10 posts públicos publicados apenas em base vazia de `development` ou `test`.

| # | Tarefa | Status |
|---|---|---|
| 2.1 | Criar helper de seed dentro de `apps/admin/src/app/api/setup/complete/route.ts` | ⬜ |
| 2.2 | Executar seed apenas em `development` e `test` | ⬜ |
| 2.3 | Validar `COUNT(*) = 0` antes da inserção | ⬜ |
| 2.4 | Inserir 10 posts com slugs únicos e autoria do owner | ⬜ |
| 2.5 | Manter tudo dentro da transação de setup | ⬜ |
| 2.6 | Entregar teste para criação de 10 posts em banco vazio | ⬜ |
| 2.7 | Entregar teste para não duplicação em reexecução | ⬜ |

**Definição de pronto:**

- setup continua concluindo owner + settings normalmente
- seed ocorre só quando as pré-condições forem verdadeiras
- reexecução não duplica posts

## SP-03 — Subir MailHog no fluxo local Docker
**Prioridade:** alta  
**Owner sugerido:** infra local / devx  
**Dependências:** SP-01 definido para manter defaults coerentes  
**Resultado esperado:** `docker compose` local sobe MailHog e admin com defaults consistentes.

| # | Tarefa | Status |
|---|---|---|
| 3.1 | Adicionar serviço `mailhog` em `docker-compose.override.yml` | ⬜ |
| 3.2 | Expor portas `1025` e `8025` | ⬜ |
| 3.3 | Adicionar defaults `SMTP_HOST`, `SMTP_PORT` e `SMTP_FROM` no `admin` | ⬜ |
| 3.4 | Incluir `mailhog` em `depends_on` do `admin` | ⬜ |
| 3.5 | Verificar que a mudança fica restrita ao override local | ⬜ |

**Definição de pronto:**

- override local passa a incluir MailHog
- admin usa defaults compatíveis com o backend
- compose base de produção permanece intocado

## SP-04 — Compatibilidade da suíte e revisão de impacto
**Prioridade:** alta  
**Owner sugerido:** backend admin + e2e  
**Dependências:** SP-01, SP-02, SP-03  
**Resultado esperado:** a suíte fica alinhada ao novo contrato sem introduzir dependência implícita dos posts seed.

| # | Tarefa | Status |
|---|---|---|
| 4.1 | Revisar mocks existentes em testes de integração afetados | ⬜ |
| 4.2 | Decidir entre teste dedicado para `email.ts` ou ajuste em `newsletter.test.ts` | ⬜ |
| 4.3 | Revisar `apps/e2e/fixtures/helpers.ts` quanto ao impacto do seed | ⬜ |
| 4.4 | Atualizar documentação curta de comportamento, se necessário | ⬜ |

**Definição de pronto:**

- testes da feature ficam acoplados à implementação correta, não a efeitos colaterais
- fixtures E2E continuam utilizáveis com ou sem posts seed

---

## Sequência recomendada

1. SP-01
2. SP-02
3. SP-03
4. SP-04

**Racional:** primeiro fecha o contrato da aplicação; depois fecha o comportamento do setup; em seguida alinha o ambiente local; por último consolida o impacto nos testes e fixtures.

---

## Critérios de aceite da sprint

- Em `development` e `test`, sem SMTP explícito, o sistema usa MailHog.
- Em `production`, sem SMTP explícito, o sistema não tenta fallback implícito.
- O setup inicial cria exatamente 10 posts quando `posts` estiver vazia.
- Reexecuções do setup não duplicam posts.
- A cobertura necessária é entregue junto com as histórias alteradas.
- Nenhuma mudança da sprint exige alteração do compose de produção.

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Testes antigos assumirem ausência total de SMTP | Médio | Cobrir explicitamente o comportamento por ambiente |
| Seed afetar cenários que esperam banco vazio | Alto | Restringir seed ao setup inicial e a `posts` vazia |
| Fixture E2E começar a depender dos dados seed | Médio | Revisar helper e manter criação explícita de posts onde já existir |

---

## Checklist operacional

- [ ] SP-01 concluída
- [ ] SP-02 concluída
- [ ] SP-03 concluída
- [ ] SP-04 concluída
- [ ] critérios de aceite revisados
- [ ] pronto para implementação

> Nota: esta sprint foi criada e estruturada neste turno, mas nenhuma implementação ou teste foi executado.
