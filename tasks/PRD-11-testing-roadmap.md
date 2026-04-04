# PRD-11 — Estratégia de Testes e Roadmap de Entrega

**Projeto:** Nexus CMS  
**Módulo:** Testing & Roadmap  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Estratégia de Testes

### 1.1 Princípio Central

**Testes entregues junto com cada feature** — não em sprint separado. Cada pull request que adiciona ou modifica uma funcionalidade deve incluir os testes correspondentes. PRs sem testes para código de negócio não são aceitos.

### 1.2 Pirâmide de Testes

```
         /\
        /E2E\          ← Poucos, lentos, alto valor — fluxos críticos
       /──────\
      / Integr.\       ← Médios — comunicação entre camadas
     /──────────\
    / Unitários  \     ← Muitos, rápidos — lógica isolada
   ──────────────────
```

---

## 2. Testes Unitários

### 2.1 Escopo

- Funções de lógica de negócio (validações, cálculos, transformações)
- Utilitários (formatação de data, slugify, sanitização, geração de tokens)
- Resolvers/controllers isolados com mocks de dependências
- Helpers de RBAC (verificação de permissão)
- Componentes de UI (renderização, estados, variantes)

### 2.2 Ferramentas

| Camada | Ferramenta |
|---|---|
| Backend (Node.js) | **Vitest** ou **Jest** |
| Frontend (React/Vue/etc.) | **Vitest** + **Testing Library** |
| Componentes UI | **Storybook** + `@storybook/addon-a11y` + `@storybook/test` |

### 2.3 Cobertura mínima esperada

- Lógica de negócio crítica (auth, RBAC, visibilidade de posts): **90%+**
- Utilitários: **80%+**
- Componentes UI: cobertura de todos os estados e variantes documentados no Storybook

### 2.4 Exemplos de casos de teste (unitário)

```
auth/
  ✓ hashPassword deve gerar hash bcrypt com custo >= 12
  ✓ verifyPassword deve retornar true para senha correta
  ✓ verifyPassword deve retornar false para senha incorreta
  ✓ generateToken deve retornar JWT com expiração de 15 minutos
  ✓ generateRefreshToken deve retornar string UUID v4

rbac/
  ✓ hasPermission deve retornar true quando usuário tem permissão direta
  ✓ hasPermission deve retornar true quando grupo do usuário tem permissão
  ✓ hasPermission deve retornar false quando nenhum grupo tem permissão
  ✓ role 'owner' deve ter acesso a qualquer recurso
  ✓ role 'default' deve ter acesso somente a: like, comment, share

posts/
  ✓ slugify deve converter título com acentos para slug URL-safe
  ✓ calculateReadingTime deve retornar 1 para textos < 200 palavras
  ✓ isVisibleTo deve retornar true para post public sem usuário logado
  ✓ isVisibleTo deve retornar false para post allPrivate sem usuário logado
  ✓ isVisibleTo deve retornar true para post allPrivate com usuário logado e aprovado
  ✓ isVisibleTo deve retornar false para post groupPrivate com usuário fora do grupo
```

---

## 3. Testes de Integração

### 3.1 Escopo

- Endpoints da API (request → response completo)
- Fluxos de autenticação (login, refresh, logout, expiração)
- Operações de banco de dados (CRUD real, transações)
- Envio de e-mails (mock do SMTP, verificar conteúdo do e-mail)
- Upload de imagens (mock do S3/Azure)
- Rate limiting (verificar headers e bloqueio)

### 3.2 Ferramentas

| Ferramenta | Uso |
|---|---|
| **Supertest** | Teste de endpoints HTTP |
| **Testcontainers** | SQLite em memória ou PostgreSQL real em container |
| **MSW (Mock Service Worker)** | Mock de APIs externas (IA, S3, SMTP) |

### 3.3 Exemplos de casos de teste (integração)

```
POST /api/auth/login
  ✓ retorna 200 e tokens para credenciais válidas
  ✓ retorna 401 para senha incorreta
  ✓ retorna 403 para usuário com status pending_approval
  ✓ retorna 429 após 5 tentativas falhas consecutivas
  ✓ refresh token está em httpOnly cookie

GET /api/v1/posts
  ✓ retorna somente posts com visibility=public
  ✓ retorna 429 após 60 requisições por minuto
  ✓ filtra por category quando query param informado
  ✓ paginação retorna total e hasNext corretos

POST /api/posts (criação de post — autenticado)
  ✓ retorna 201 para usuário com permissão posts:create
  ✓ retorna 403 para usuário sem permissão
  ✓ retorna 401 para requisição sem token
  ✓ salva slug gerado a partir do título
  ✓ rejeita content com tags <script>

Newsletter Double Opt-in
  ✓ POST /api/newsletter cria inscrição com status pending
  ✓ POST /api/newsletter envia e-mail com token
  ✓ GET /newsletter/confirm?token=X ativa inscrição
  ✓ GET /newsletter/confirm?token=expirado retorna 400
  ✓ GET /newsletter/confirm?token=já_usado retorna 400
```

---

## 4. Testes E2E (End-to-End)

### 4.1 Escopo

Fluxos completos do usuário, do browser ao banco de dados. Priorizar os **caminhos críticos**:

1. Instalação / First Run
2. Cadastro e aprovação de usuário
3. Login e navegação no painel
4. Criação, publicação e visualização de post
5. Leitura de post com conteúdo restrito (RBAC)
6. Inscrição na newsletter (Double Opt-in)
7. Comentar em um post
8. Compartilhar um post

### 4.2 Ferramenta

**Playwright** — suporte a múltiplos browsers (Chromium, Firefox, WebKit), screenshots e traces em falhas.

### 4.3 Exemplos de casos de teste (E2E)

```
First Run
  ✓ Acesso a /admin redireciona para /admin/setup quando sem Owner
  ✓ Wizard completo cria Owner e redireciona para Dashboard
  ✓ Segundo acesso a /admin/setup redireciona para /admin/login

Fluxo de publicação
  ✓ Owner faz login, cria post, publica e vê post na home do blog
  ✓ Post com visibility=allPrivate não aparece para visitante anônimo
  ✓ Post com visibility=allPrivate aparece para usuário logado e aprovado

Comentários
  ✓ Usuário logado comenta em post público e comentário aparece na página
  ✓ Usuário não logado vê botão "Fazer login para comentar"
  ✓ Usuário dá upvote em comentário e contagem incrementa

Newsletter
  ✓ Usuário preenche e-mail e checkbox, clica em inscrever
  ✓ Página exibe mensagem "Verifique seu e-mail"
  ✓ Acesso ao link de confirmação exibe "Inscrição confirmada"
```

### 4.4 Ambiente E2E

- Banco de dados: PostgreSQL em container (estado limpo antes de cada suite)
- E-mail: MailHog local (captura e-mails sem enviar)
- Storage: MinIO local (compatível com S3)
- CI: executa em pipeline antes do merge para `main`

---

## 5. Testes de Acessibilidade

- Storybook com `@storybook/addon-a11y`: verificação automática de violations em todos os componentes
- Playwright com `axe-core`: varredura automática de cada página nos testes E2E
- Testes manuais (periódicos): navegação por teclado + leitor de tela (NVDA/VoiceOver)
- Critério de aceite: zero violations do nível AA do axe-core em todas as páginas

---

## 6. Testes de Segurança

- OWASP ZAP (scan automatizado) — executado antes de cada release
- Verificação manual de: autenticação, autorização, rate limiting, XSS, SQL injection, CSRF
- Headers de segurança validados via `securityheaders.com` ou equivalente nos testes E2E

---

## 7. Roadmap de Entrega

### v0.1 — MVP Core

**Objetivo:** Sistema funcional para uso básico.

| Feature | Módulo |
|---|---|
| Instalação via Docker (First Run wizard) | PRD-10 |
| Cadastro de Owner e autenticação JWT | PRD-04 |
| Editor MDX (sem IA) | PRD-06 |
| Publicação de posts (visibility: public) | PRD-06 |
| Blog público: Home + Feed + Post | PRD-02 |
| API pública com rate limiting | PRD-03 |
| Design System base (tema Onyx) | PRD-01 |
| Storybook com componentes base | PRD-01 |
| Testes unitários e integração das features acima | PRD-11 |

---

### v0.2 — Usuários e Controle de Acesso

**Objetivo:** Sistema multiusuário com controle granular.

| Feature | Módulo |
|---|---|
| Cadastro de usuários com aprovação | PRD-04 |
| RBAC completo (Access Matrix) | PRD-04 |
| Gestão de grupos | PRD-04 |
| Audit Trail | PRD-04 |
| Todos os níveis de visibilidade de posts | PRD-02 |
| Painel: CRUD de usuários e grupos | PRD-05 |
| Notificações de novos cadastros | PRD-05 |
| Testes E2E: fluxo de cadastro e aprovação | PRD-11 |

---

### v0.3 — Engajamento e Conteúdo Avançado

**Objetivo:** Blog totalmente interativo.

| Feature | Módulo |
|---|---|
| Sistema de comentários com threads | PRD-07 |
| Sistema de likes nos posts | PRD-07 |
| Compartilhamento (WhatsApp, LinkedIn, etc.) | PRD-07 |
| Newsletter com Double Opt-in | PRD-07 |
| Multilinguagem (pt-BR + EN) | PRD-07 |
| Agendamento de publicação | PRD-06 |
| Histórico de versões do post | PRD-06 |
| Temas adicionais (Emerald, Crimson, etc.) | PRD-01 |
| Gerador de Cards Sociais | PRD-05 |
| Testes E2E: comentários e newsletter | PRD-11 |

---

### v0.4 — Integrações e Notificações

**Objetivo:** Sistema conectado ao ecossistema do criador.

| Feature | Módulo |
|---|---|
| Integrações de notificação (Teams, Slack, Discord, e-mail) | PRD-05 |
| Redes sociais (configuração + integração) | PRD-05 |
| Email Marketing (com SMTP configurado) | PRD-05 |
| Gerador de imagem com IA | PRD-08 |
| Ghost Writer (autocomplete no editor) | PRD-08 |
| Gestão de cotas de IA | PRD-08 |
| Microsoft Clarity integrado | PRD-09 |

---

### v0.5 — Inteligência e Observabilidade

**Objetivo:** Ferramentas de análise e crescimento.

| Feature | Módulo |
|---|---|
| Dashboard de métricas detalhadas | PRD-05 |
| Análise de Trends (IA) | PRD-08 |
| Tradução automática para EN (IA) | PRD-08 |
| Exportação de métricas (e-mail / link) | PRD-05 |
| C4 Model no painel (arquitetura) | PRD-05 |
| Storybook público (página estática) | PRD-01 |
| CRUD de Ideias com notas | PRD-05 |
| Documentação do sistema (v1 completa) | PRD-05 |

---

### v1.0 — Release Público (Open-Source)

**Objetivo:** Produto maduro, seguro e documentado para a comunidade.

| Feature | Módulo |
|---|---|
| Auditoria de segurança completa (OWASP ZAP + revisão manual) | PRD-09 |
| Conformidade WCAG 2.1 AA certificada (audit + testes) | PRD-01 |
| Documentação completa de instalação e uso | PRD-10 |
| Tela de Releases com changelog | PRD-05 |
| Suporte a MCP para extensibilidade | PRD-09 |
| Processo de contribuição documentado (CONTRIBUTING.md) | — |
| LICENSE, CODE_OF_CONDUCT, SECURITY.md | — |
| CI/CD completo (lint, tests, build, deploy) | PRD-11 |

---

## 8. Critérios de Aceite por Release

Para cada versão ser considerada "pronta para release":

- [ ] Todos os testes unitários passando (`npm test`)
- [ ] Todos os testes de integração passando
- [ ] Testes E2E dos fluxos críticos passando (Playwright)
- [ ] Zero violations de acessibilidade nível AA (axe-core)
- [ ] Build de produção funcional (`docker compose up`)
- [ ] CHANGELOG.md atualizado com todas as mudanças
- [ ] Tela de Releases no painel atualizada
- [ ] C4 Model atualizado se arquitetura mudou

---

## 9. Pipeline de CI/CD

```yaml
# Executado em todo Pull Request e push para main

jobs:
  lint:        # ESLint + TypeScript check
  test-unit:   # Vitest — testes unitários
  test-integ:  # Testes de integração (Testcontainers)
  test-e2e:    # Playwright — fluxos críticos
  test-a11y:   # axe-core via Playwright
  build:       # docker compose build
  security:    # OWASP ZAP (somente em releases)
```

Merge para `main` bloqueado se qualquer job falhar.
