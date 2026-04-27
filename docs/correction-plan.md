# Plano de Correções — Nexus CMS

> Gerado em: 26/04/2026  
> Baseado em: 88 testes E2E + testes manuais do owner  
> Resultado dos testes: **65 passaram ✓ | 23 falharam ✘**

---

## Contexto dos testes manuais (owner)

- Não conseguiu salvar posts
- Não conseguiu adicionar usuários sendo owner
- Não encontrou onde gerenciar tags e categorias
- Não conseguiu fazer upload de imagens
- IA é opcional — tudo deve funcionar sem ela

---

## 🔴 Prioridade CRÍTICA

### [BUG-01] Setup Wizard: formulário não cria o Owner

- **E2E:** `01-first-run › setup wizard: complete all 4 steps and create owner` ✘
- **Cascata:** testes "second access redirects to login" e "owner can log in after setup" também falham
- **Sintoma:** os seletores do formulário (`[name="ownerName"]`, `[name="ownerEmail"]`, etc.) não encontram os `<input>` na página, ou o botão "Next/Continue" não tem o `role="button"` esperado.
- **Arquivos:** `apps/admin/src/app/admin/setup/page.tsx`
- **Correção:**
  - Garantir que cada `<input>` tem o atributo `name` correto (`ownerName`, `ownerEmail`, `ownerPassword`)
  - Garantir que o botão de avanço tem `role="button"` e texto visível "Next" ou "Continue"
  - Garantir que o botão de finalização tem texto "Complete Setup", "Finish" ou "Submit"

---

### [BUG-02] Salvar posts não funciona

- **E2E:** falha em cascata em `04-post-visibility` e `05-comments-likes-sharing`
- **Manual:** owner não conseguiu salvar posts
- **Sintoma:** o editor de posts não persiste o conteúdo.
- **Arquivos:**
  - `apps/admin/src/app/api/posts/route.ts`
  - `apps/admin/src/app/admin/posts/` (editor)
- **Correção:**
  - Verificar se o `POST /api/posts` valida e retorna `{ post: { id, slug } }`
  - Verificar se o editor submete o body correto (title, content, visibility, status)
  - Verificar se erros de validação Zod são exibidos ao usuário
  - Garantir funcionamento **sem IA** (IA apenas como opcional para sugestões)

---

### [BUG-03] Owner não consegue gerenciar usuários pela UI

- **E2E:** `02-registration-approval › owner can see user in pending approval list` ✘ e `owner approves the user via API` ✘
- **Manual:** owner não conseguiu adicionar usuário
- **Sintoma:** `/admin/users` não lista usuários pendentes; botão de aprovação não chama a API.
- **Arquivos:**
  - `apps/admin/src/app/admin/users/page.tsx`
  - `apps/admin/src/app/api/admin/users/[id]/approve/route.ts`
- **Correção:**
  - Garantir que a listagem filtra `status = 'pending_approval'`
  - Garantir que o botão "Aprovar" faz `POST /api/admin/users/:id/approve`
  - Exibir feedback de sucesso/erro ao aprovar

---

### [BUG-04] Upload de imagens não funciona

- **E2E:** página de Image Library existe (a11y passa), mas upload não testado
- **Manual:** owner não conseguiu adicionar imagens
- **Sintoma:** formulário de upload não envia, ou a API de upload não existe.
- **Arquivos:**
  - `apps/admin/src/app/api/images/` (verificar se rota existe)
  - `apps/admin/src/app/admin/images/page.tsx`
- **Correção:**
  - Implementar/corrigir `POST /api/images/upload` com `multipart/form-data`
  - Garantir que `DATA_DIR/images/` existe e tem permissão de escrita
  - Retornar URL pública da imagem após upload
  - **Sem dependência de IA** para upload básico

---

## 🟠 Prioridade ALTA

### [BUG-05] Tags e Categorias sem página de gerenciamento acessível

- **E2E:** `GET /api/v1/categories` passa (API existe), mas UI não testada
- **Manual:** owner não encontrou onde criar tags/categorias
- **Arquivos:**
  - `apps/admin/src/components/AdminLayout/DynamicSidebar.tsx`
  - `apps/admin/src/app/admin/categories/` (verificar existência)
  - `apps/admin/src/app/admin/tags/` (verificar existência)
- **Correção:**
  - Adicionar links de "Categorias" e "Tags" na sidebar
  - Criar páginas com CRUD completo (listar, criar, editar, deletar)
  - Conectar ao editor de posts (selector de categoria/tags ao criar post)

---

### [BUG-06] RBACBanner ausente em posts `allPrivate`

- **E2E:** `04-post-visibility › blog page shows RBACBanner for allPrivate post (anonymous visitor)` ✘
- **Sintoma:** visitante anônimo acessa post privado sem ver aviso de login/registro.
- **Arquivos:** `apps/blog/src/app/blog/[slug]/page.tsx`
- **Correção:**
  - Verificar lógica condicional: se `post.visibility === 'allPrivate'` e usuário não autenticado → renderizar `<RBACBanner>`
  - O banner deve ser server-side rendered (não depende de JS do cliente)

---

### [BUG-07] API v1: posts `allPrivate` sendo listados publicamente

- **E2E:** `04-post-visibility › public API v1 does not list allPrivate posts` ✘
- **Sintoma:** `GET /api/v1/posts` retorna posts com `visibility !== 'public'`.
- **Arquivos:** `apps/admin/src/app/api/v1/posts/route.ts`
- **Correção:**
  - Adicionar cláusula `WHERE visibility = 'public' AND status = 'published'` na query
  - Confirmar com teste: nenhum post privado deve aparecer na listagem pública

---

### [BUG-08] Comentários, likes e share não aparecem na página do post

- **E2E:** todos os 9 testes de `05-comments-likes-sharing` falham
- **Sintoma:** componentes de engajamento não renderizados na página de post do blog.
- **Arquivos:**
  - `apps/blog/src/app/blog/[slug]/page.tsx`
  - `apps/blog/src/components/` (CommentSection, LikeButton, ShareDropdown)
- **Correção:**
  - Importar e renderizar `CommentSection`, `LikeButton`, `ShareDropdown` na página do post
  - Verificar se os componentes existem; se não, implementá-los
  - **Funcionam sem IA** — IA é opcional apenas para features como sugestão de comentário

---

### [BUG-09] Newsletter sem feedback de sucesso após inscrição

- **E2E:** `newsletter subscribe form shows "Verifique seu e-mail!"` ✘
- **Arquivos:**
  - `apps/blog/src/app/newsletter/` ou componente do formulário de newsletter
- **Correção:**
  - Após `POST /api/newsletter/subscribe` retornar 200, exibir: "Verifique seu e-mail!"
  - Se SMTP não configurado, o token deve ser salvo e o fluxo de confirmação deve funcionar localmente

---

## 🟡 Prioridade MÉDIA

### [BUG-10] PUT permissões de grupo não funciona

- **E2E:** `03-rbac-permissions › can update permissions for a non-system group` ✘
- **Arquivos:** `apps/admin/src/app/api/groups/[id]/permissions/route.ts`
- **Correção:**
  - Implementar ou corrigir handler `PUT`
  - Schema aceito: `{ permissions: { posts: ['read','write'], comments: ['read'] } }`
  - Garantir que `DELETE` e outros ops não aparecem no resultado se não foram concedidos

---

### [BUG-11] Página de grupos vazia na UI

- **E2E:** `03-rbac-permissions › owner navigates to groups page and sees group list` ✘
- **Arquivos:** `apps/admin/src/app/admin/groups/page.tsx`
- **Correção:**
  - Verificar fetch dos dados na montagem do componente
  - Garantir que grupos `owner` e `default` são listados
  - Exibir estado de loading e empty state corretos

---

### [BUG-12] Rate limiting sem Redis não ativa 429 no login

- **E2E:** `06-security › brute-force protection returns 429 after 5 failures` ✘
- **Arquivos:** `apps/admin/src/app/api/auth/login/route.ts`
- **Correção:**
  - O rate limiter de tentativas de login deve ter **fallback em memória** quando Redis não está disponível
  - Após 5 falhas do mesmo IP → retornar 429 com header `Retry-After`
  - **Não depende de Redis** para funcionar (Redis melhora performance em produção)

---

## 🟢 Prioridade BAIXA

### [BUG-13] Command Palette (Ctrl+K) não abre

- **E2E:** `07-a11y › command palette accessible via Ctrl+K` ✘
- **Arquivos:** `apps/admin/src/components/AdminLayout/` ou layout principal
- **Correção:**
  - Verificar handler `keydown`: `e.key === 'k' && (e.ctrlKey || e.metaKey)` deve abrir o modal
  - Garantir que o campo de busca recebe foco automaticamente ao abrir

---

### [BUG-14] A11y: página de post do blog sem estrutura semântica

- **E2E:** `07-a11y › blog post page has no critical a11y violations` ✘ e `blog post page has correct article structure` ✘
- **Arquivos:** `apps/blog/src/app/blog/[slug]/page.tsx`
- **Correção:**
  - Envolver conteúdo em `<article>`
  - Garantir hierarquia de headings: `<h1>` para título do post
  - Usar `<time dateTime="...">` para data de publicação
  - Verificar contraste de cores conforme WCAG 2.1 AA

---

## Resumo

| # | Bug | Prioridade | Área |
|---|-----|-----------|------|
| BUG-01 | Setup Wizard não cria Owner | 🔴 Crítico | Admin UI |
| BUG-02 | Salvar posts não funciona | 🔴 Crítico | Admin + API |
| BUG-03 | Owner não gerencia usuários na UI | 🔴 Crítico | Admin UI |
| BUG-04 | Upload de imagens não funciona | 🔴 Crítico | Admin + API |
| BUG-05 | Tags/Categorias sem página de gestão | 🟠 Alto | Admin UI |
| BUG-06 | RBACBanner ausente em posts privados | 🟠 Alto | Blog |
| BUG-07 | API v1 expõe posts privados | 🟠 Alto | API |
| BUG-08 | Comentários/likes/share ausentes no blog | 🟠 Alto | Blog |
| BUG-09 | Newsletter sem feedback de sucesso | 🟠 Alto | Blog |
| BUG-10 | PUT permissões de grupo não funciona | 🟡 Médio | API |
| BUG-11 | Página de grupos vazia | 🟡 Médio | Admin UI |
| BUG-12 | Rate limiting sem Redis não funciona | 🟡 Médio | API/Segurança |
| BUG-13 | Command Palette Ctrl+K não abre | 🟢 Baixo | Admin UI |
| BUG-14 | A11y: estrutura do post do blog | 🟢 Baixo | Blog |

---

## Ordem de execução sugerida

1. BUG-01 → desbloqueia todos os testes que dependem de owner criado
2. BUG-02 + BUG-04 + BUG-05 → core do CMS (criar e publicar conteúdo)
3. BUG-03 → gestão de time
4. BUG-08 + BUG-09 → engajamento do blog
5. BUG-06 + BUG-07 → segurança/visibilidade
6. BUG-10 + BUG-11 + BUG-12 → RBAC e segurança
7. BUG-13 + BUG-14 → polish
