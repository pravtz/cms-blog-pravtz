# Nexus CMS — Task Checklist

> Gerado em: 26/04/2026  
> Baseado no plano de correções (`docs/correction-plan.md`)  
> Progresso: **14 / 14 bugs** com implementação concluída (itens `[ ]` abaixo são validações opcionais ou E2E ainda não cobertos no repositório)

---

## Legenda de status

| Símbolo | Status |
|---------|--------|
| ⬜ | Pendente |
| 🔄 | Em andamento |
| ✅ | Concluído |
| ❌ | Bloqueado |

---

## 🔴 Prioridade CRÍTICA

### BUG-01 — Setup Wizard: formulário não cria o Owner
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/admin/setup/page.tsx`

| # | Subtarefa | Status |
|---|-----------|--------|
| 1.1 | Garantir `name="ownerName"` no `<input>` correto | ✅ |
| 1.2 | Garantir `name="ownerEmail"` e `name="ownerPassword"` | ✅ |
| 1.3 | Botão de avanço com `role="button"` e texto "Next" / "Continue" | ✅ |
| 1.4 | Botão final com texto "Complete Setup", "Finish" ou "Submit" | ✅ |

**Teste de validação:**
- [x] E2E `01-first-run › setup wizard: complete all 4 steps and create owner` passa ✓
- [x] E2E `01-first-run › second access redirects to login` passa ✓
- [x] E2E `01-first-run › owner can log in after setup` passa ✓

---

### BUG-02 — Salvar posts não funciona
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/api/posts/route.ts` + editor de posts

| # | Subtarefa | Status |
|---|-----------|--------|
| 2.1 | Header `Authorization: Bearer <token>` em `new/page.tsx` + tratamento 401/400 | ✅ |
| 2.2 | Header `Authorization: Bearer <token>` em `[id]/edit/page.tsx` + tratamento 401/400 | ✅ |
| 2.3 | Header `Authorization: Bearer <token>` em `posts/page.tsx` + tratamento 401 | ✅ |
| 2.4 | Erros Zod (400) exibem `details` do body JSON ao usuário | ✅ |

**Teste de validação:**
- [x] E2E `04-post-visibility` — posts criados com sucesso ✓
- [x] E2E `05-comments-likes-sharing-newsletter` — desbloqueia após posts criados ✓
- [x] Teste unitário `POST /api/posts` — retorna 201 com `{ post: { id, slug } }` ✓

---

### BUG-03 — Owner não consegue gerenciar usuários pela UI
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/admin/users/page.tsx` + `api/admin/users/[id]/approve/route.ts`

| # | Subtarefa | Status |
|---|-----------|--------|
| 3.1 | Listagem filtra `status = 'pending_approval'` (aba "Pending" + default mostra todos) | ✅ |
| 3.2 | Botão "Aprovar" faz `POST /api/admin/users/:id/approve` com token | ✅ |
| 3.3 | Feedback de sucesso/erro exibido ao aprovar; 401 redireciona para login | ✅ |

**Teste de validação:**
- [x] E2E `02-registration-approval › owner can see user in pending approval list` passa ✓
- [x] E2E `02-registration-approval › owner approves the user via API` passa ✓

---

### BUG-04 — Upload de imagens não funciona
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/api/images/` + `apps/admin/src/app/admin/images/page.tsx`

| # | Subtarefa | Status |
|---|-----------|--------|
| 4.1 | `POST /api/images/upload` implementado com `multipart/form-data` | ✅ |
| 4.2 | `DATA_DIR/images/` existe com permissão de escrita | ✅ |
| 4.3 | Upload retorna URL pública da imagem | ✅ |
| 4.4 | Funciona **sem dependência de IA** | ✅ |

**Teste de validação:**
- [ ] Teste de integração `POST /api/images/upload` — retorna `{ url }` ✓
- [ ] Upload manual via UI retorna imagem listada na Image Library ✓

---

## 🟠 Prioridade ALTA

### BUG-05 — Tags e Categorias sem página de gerenciamento
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/components/AdminLayout/DynamicSidebar.tsx` + páginas de categories/tags

| # | Subtarefa | Status |
|---|-----------|--------|
| 5.1 | Links "Categorias" e "Tags" adicionados à sidebar | ✅ |
| 5.2 | Página `/admin/categories` com CRUD completo | ✅ |
| 5.3 | Página `/admin/tags` com CRUD completo | ✅ |
| 5.4 | Selector de categoria/tags conectado ao editor de posts (`FrontmatterDrawer` no `MDXEditor`) | ✅ |

**Teste de validação:**
- [ ] E2E navega para `/admin/categories` e lista/cria/deleta categoria ✓
- [ ] E2E navega para `/admin/tags` e lista/cria/deleta tag ✓
- [ ] Selector de categoria visível no editor de posts ✓

---

### BUG-06 — RBACBanner ausente em posts `allPrivate`
**Status geral:** ✅ Concluído  
**Área:** `apps/blog/src/app/blog/[slug]/page.tsx` + `apps/admin/src/app/api/blog/posts/[slug]/route.ts`

| # | Subtarefa | Status |
|---|-----------|--------|
| 6.1 | Lógica condicional: `post.visibility === 'allPrivate'` + usuário não autenticado → `<RBACBanner>` | ✅ |
| 6.2 | Banner renderizado server-side (sem dependência de JS do cliente) | ✅ |
| 6.3 | API `/api/blog/posts/[slug]` não retorna `content_html` para posts com visibilidade restrita | ✅ |

**Teste de validação:**
- [x] E2E `04-post-visibility › blog page shows RBACBanner for allPrivate post (anonymous visitor)` passa ✓

---

### BUG-07 — API v1 expõe posts privados publicamente
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/api/v1/posts/route.ts`

| # | Subtarefa | Status |
|---|-----------|--------|
| 7.1 | Query filtra `WHERE visibility = 'public' AND status = 'published'` | ✅ |
| 7.2 | Nenhum post privado retornado na listagem pública | ✅ |

**Teste de validação:**
- [x] E2E `04-post-visibility › public API v1 does not list allPrivate posts` passa ✓
- [x] Teste de integração `apps/admin/src/__tests__/integration/v1-posts.test.ts` — `returns only published+public posts` ✓

---

### BUG-08 — Comentários, likes e share ausentes no blog
**Status geral:** ✅ Concluído  
**Área:** `apps/blog/src/app/blog/[slug]/page.tsx` + componentes de engajamento

| # | Subtarefa | Status |
|---|-----------|--------|
| 8.1 | `CommentSystem` importado e renderizado na página de post (dentro de `!isRestricted`) | ✅ |
| 8.2 | `LikeButton` e `ShareButton` renderizados via `ArticleHeader` (em todos os posts) | ✅ |
| 8.3 | APIs `GET/POST /api/blog/comments`, `/likes`, `/shares` existem com CORS | ✅ |
| 8.4 | Componentes funcionam **sem IA** | ✅ |

**Teste de validação:**
- [x] Todos 9 testes de engajamento no spec `05-comments-likes-sharing-newsletter.spec.ts` (plano: `05-comments-likes-sharing`) passam ✓

---

### BUG-09 — Newsletter sem feedback de sucesso após inscrição
**Status geral:** ✅ Concluído  
**Área:** `apps/blog/src/app/newsletter/` ou componente do formulário

| # | Subtarefa | Status |
|---|-----------|--------|
| 9.1 | Após 200 de `POST /api/newsletter/subscribe` → exibir "Verifique seu e-mail!" | ✅ |
| 9.2 | Fluxo de confirmação funciona localmente sem SMTP | ✅ |

**Teste de validação:**
- [x] E2E `newsletter subscribe form shows "Verifique seu e-mail!"` passa ✓

---

## 🟡 Prioridade MÉDIA

### BUG-10 — PUT permissões de grupo não funciona
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/api/groups/[id]/permissions/route.ts`

| # | Subtarefa | Status |
|---|-----------|--------|
| 10.1 | Handler `PUT` implementado/corrigido | ✅ |
| 10.2 | Schema aceito: `{ permissions: { posts: ['read','write'], comments: ['read'] } }` | ✅ |
| 10.3 | Ops não concedidas não aparecem no resultado | ✅ |

**Teste de validação:**
- [x] E2E `03-rbac-permissions › can update permissions for a non-system group` passa ✓
- [ ] Teste unitário PUT retorna permissões atualizadas ✓

---

### BUG-11 — Página de grupos vazia na UI
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/admin/groups/page.tsx`

| # | Subtarefa | Status |
|---|-----------|--------|
| 11.1 | Fetch dos dados na montagem do componente funciona | ✅ |
| 11.2 | Grupos `owner` e `default` listados | ✅ |
| 11.3 | Estado de loading e empty state corretos | ✅ |

**Teste de validação:**
- [x] E2E `03-rbac-permissions › owner navigates to groups page and sees group list` passa ✓

---

### BUG-12 — Rate limiting sem Redis não ativa 429 no login
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/app/api/auth/login/route.ts`

| # | Subtarefa | Status |
|---|-----------|--------|
| 12.1 | Fallback em memória para rate limiting quando Redis indisponível | ✅ |
| 12.2 | Após 5 falhas do mesmo IP → retorna 429 com header `Retry-After` | ✅ |

**Teste de validação:**
- [x] E2E `06-security › brute-force protection returns 429 after 5 failures` passa ✓
- [x] Teste de integração: 5 logins falhos → 429 (sem Redis) ✓

---

## 🟢 Prioridade BAIXA

### BUG-13 — Command Palette (Ctrl+K) não abre
**Status geral:** ✅ Concluído  
**Área:** `apps/admin/src/components/AdminLayout/`

| # | Subtarefa | Status |
|---|-----------|--------|
| 13.1 | Handler `keydown` detecta `e.key === 'k' && (e.ctrlKey || e.metaKey)` | ✅ |
| 13.2 | Campo de busca recebe foco automático ao abrir | ✅ |

**Teste de validação:**
- [x] E2E `07-a11y › command palette accessible via Ctrl+K` passa ✓

---

### BUG-14 — A11y: página de post do blog sem estrutura semântica
**Status geral:** ✅ Concluído  
**Área:** `apps/blog/src/app/blog/[slug]/page.tsx`

| # | Subtarefa | Status |
|---|-----------|--------|
| 14.1 | Conteúdo envolvido em `<article>` | ✅ |
| 14.2 | `<h1>` para título do post | ✅ |
| 14.3 | `<time dateTime="...">` para data de publicação | ✅ |
| 14.4 | Contraste de cores conforme WCAG 2.1 AA | ✅ |

**Teste de validação:**
- [x] E2E `07-a11y › blog post page has no critical a11y violations` passa ✓
- [x] E2E `07-a11y › blog post page has correct article structure` passa ✓

---

## Resumo de Progresso

| Prioridade | Total | ✅ Concluído | 🔄 Em andamento | ⬜ Pendente |
|-----------|-------|-------------|----------------|------------|
| 🔴 Crítico | 4 | 4 | 0 | 0 |
| 🟠 Alto | 5 | 5 | 0 | 0 |
| 🟡 Médio | 3 | 3 | 0 | 0 |
| 🟢 Baixo | 2 | 2 | 0 | 0 |
| **Total** | **14** | **14** | **0** | **0** |

---

## Ordem de Execução (wave strategy)

| Wave | BUGs | Execução |
|------|------|----------|
| Wave 1 | BUG-01 | Sequencial (desbloqueia todos) |
| Wave 2 | BUG-02, BUG-04, BUG-05 | **Paralelo** |
| Wave 3 | BUG-03 | Sequencial |
| Wave 4 | BUG-08, BUG-09 | **Paralelo** |
| Wave 5 | BUG-06, BUG-07 | **Paralelo** |
| Wave 6 | BUG-10, BUG-11, BUG-12 | **Paralelo** |
| Wave 7 | BUG-13, BUG-14 | **Paralelo** |

---

*Última atualização: 26/04/2026 — Checklist alinhado ao `docs/correction-plan.md`: os 14 BUGs estão com status de implementação ✅; permanecem opcionais os itens de validação manual/E2E ainda marcados com `[ ]` (BUG-04, BUG-05, BUG-10).*
