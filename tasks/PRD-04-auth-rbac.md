# PRD-04 — Autenticação, Usuários e Controle de Acesso (RBAC)

**Projeto:** Nexus CMS  
**Módulo:** Auth & RBAC  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

O sistema de autenticação e controle de acesso é o componente mais crítico de segurança do Nexus CMS. Cada decisão de design deve priorizar segurança acima de conveniência.

### Premissas de Segurança

- Nenhum usuário acessa o painel sem cadastro aprovado por um Admin
- Senhas nunca armazenadas em texto claro (bcrypt, custo mínimo 12)
- Tokens sensíveis sempre com expiração curta
- Todas as ações sensíveis registradas em audit log

---

## 2. Roles do Sistema

### 2.1 Definição dos Roles Padrão

| Role | Descrição | Limite |
|---|---|---|
| **owner** | Acesso total e irrestrito ao sistema | Máx. 10 por instância |
| **default** | Like, comentar e compartilhar. Sem acesso ao painel | Ilimitado |
| **admin** | Acesso ao painel conforme permissões definidas pelo Owner | Ilimitado |
| **custom** | Qualquer role criado via RBAC Matrix pelo Owner/Admin | Ilimitado |

### 2.2 Regras Imutáveis dos Roles

- Roles `owner` e `default` **não podem ser deletados nem modificados**
- Somente um `owner` pode promover outro usuário a `owner` ou `admin`
- Somente um `owner` pode ativar funcionalidades de IA para usuários específicos
- Um usuário pode participar de **múltiplos grupos** simultaneamente
- A permissão mais permissiva do conjunto de grupos do usuário prevalece

---

## 3. Modelo de Dados do Usuário

### 3.1 Campos de Cadastro

| Campo | Obrigatório | Visível para | Notas |
|---|---|---|---|
| Nome completo | Sim | Admin, Owner | |
| Apelido | Sim | Todos | Exibido publicamente nos comentários |
| E-mail | Sim | Admin, Owner | Único no sistema |
| Telefone | Sim | Admin, Owner | Não exibido publicamente |
| Avatar (foto) | Não | Todos | Upload de imagem, crop disponível |
| Bio | Não | Todos (exceto default) | Máx. 500 chars |
| GitHub URL | Não | Todos (exceto default) | |
| Instagram URL | Não | Todos (exceto default) | |
| LinkedIn URL | Não | Todos (exceto default) | |
| Facebook URL | Não | Todos (exceto default) | |

> **Usuário `default`:** não pode preencher bio nem redes sociais no painel.

### 3.2 Campos do Sistema (não editáveis pelo usuário)

| Campo | Descrição |
|---|---|
| `id` | UUID gerado na criação |
| `status` | `pending_email` → `pending_approval` → `active` → `suspended` |
| `emailVerifiedAt` | Timestamp da confirmação de e-mail |
| `approvedAt` | Timestamp da aprovação pelo Admin |
| `approvedBy` | ID do admin que aprovou |
| `createdAt` | Timestamp de criação |
| `lastLoginAt` | Último login com sucesso |
| `roles` | Array de roles/grupos do usuário |

---

## 4. Fluxo de Cadastro e Aprovação

```
[1] Usuário preenche formulário de cadastro
        ↓
[2] Sistema valida campos (e-mail único, formato válido, etc.)
        ↓
[3] Conta criada com status: pending_email
        ↓
[4] E-mail de confirmação enviado com token único (expiração: 24h)
        ↓
[5] Usuário clica no link de confirmação
        ↓
[6] Status atualizado: pending_approval
        ↓
[7] Admins com permissão são notificados de novo cadastro pendente
        ↓
[8] Admin acessa lista de pendentes, analisa e aprova (ou rejeita)
        ↓
[9] Se aprovado: status → active; usuário recebe e-mail de boas-vindas
[9] Se rejeitado: status → rejected; usuário recebe e-mail informando
        ↓
[10] Usuário pode fazer login somente após status: active
```

### 4.1 Comportamento no Login Antes da Aprovação

| Status | Mensagem exibida no login |
|---|---|
| `pending_email` | "Confirme seu e-mail antes de prosseguir. Reenviar e-mail de confirmação." |
| `pending_approval` | "Seu cadastro está aguardando aprovação de um administrador. Você será notificado por e-mail." |
| `rejected` | "Seu cadastro não foi aprovado. Entre em contato com o administrador." |
| `suspended` | "Sua conta foi suspensa. Entre em contato com o administrador." |

> O usuário nunca acessa o painel administrativo em nenhum desses estados — mesmo que a role seja `default`.

### 4.2 Primeiro Acesso (após aprovação)

- Exibe tela de boas-vindas com seleção de **categorias de interesse**
- Mínimo 1 categoria selecionada para prosseguir
- Essa seleção alimenta as recomendações personalizadas futuras

---

## 5. Autenticação

### 5.1 Fluxo de Login

1. Usuário envia e-mail + senha
2. Sistema valida credenciais (bcrypt compare)
3. Verifica status da conta (somente `active` prossegue)
4. Gera par de tokens: `accessToken` + `refreshToken`
5. `accessToken`: JWT, expiração **15 minutos**
6. `refreshToken`: opaque token armazenado em banco, expiração **7 dias**
7. `refreshToken` enviado via **httpOnly cookie** (não acessível por JavaScript)
8. `accessToken` retornado no body da resposta

### 5.2 Refresh de Token

- Endpoint: `POST /api/auth/refresh`
- Lê o `refreshToken` do cookie httpOnly
- Valida no banco (não revogado, não expirado)
- Retorna novo par de tokens
- Rotação de refresh token: cada uso gera um novo token (invalida o anterior)

### 5.3 Logout

- Endpoint: `POST /api/auth/logout`
- Revoga o `refreshToken` no banco
- Limpa o cookie httpOnly

### 5.4 Proteção contra Brute Force

- Máximo de **5 tentativas de login** com falha em 15 minutos por IP
- Após o limite: bloqueio de 30 minutos para aquele IP
- Após 3 bloqueios consecutivos: notificação por e-mail para o usuário
- Log de todas as tentativas de login (sucesso e falha)

### 5.5 Sessões Simultâneas

- Um usuário pode ter até **5 sessões ativas** simultâneas (dispositivos diferentes)
- Owner pode encerrar sessões de um usuário remotamente
- O próprio usuário pode ver e encerrar suas sessões no perfil

---

## 6. RBAC — Controle de Acesso por Role

### 6.1 Modelo de Permissão

Permissões são definidas por **recurso** × **operação**:

| Recurso | Create | Read | Update | Delete |
|---|---|---|---|---|
| Posts | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Posts de outros autores | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Comentários | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Usuários | — | ✓/✗ | ✓/✗ | ✓/✗ |
| Grupos | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Permissões | — | ✓/✗ | ✓/✗ | — |
| Tags | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Categorias | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ |
| Imagens | ✓/✗ | ✓/✗ | — | ✓/✗ |
| Newsletter | — | ✓/✗ | — | ✓/✗ |
| Métricas | — | ✓/✗ | — | — |
| Configurações | — | ✓/✗ | ✓/✗ | — |
| Notificações | — | ✓/✗ | ✓/✗ | — |
| IA (uso) | — | ✓/✗ | — | — |

### 6.2 Interface — Access Matrix

- Checkboxes **humanizados** — não apenas "Create/Read/Update/Delete"
- Exemplos de labels:

| Label exibido | Permissão real |
|---|---|
| "Pode publicar novos artigos" | posts:create |
| "Pode editar artigos de outros autores" | posts:update (others) |
| "Pode excluir artigos" | posts:delete |
| "Pode moderar comentários" | comments:delete |
| "Pode gerenciar usuários" | users:read + users:update |
| "Pode aceitar novos cadastros" | users:approve |
| "Pode ver métricas do blog" | metrics:read |
| "Pode alterar configurações" | settings:update |
| "Pode usar funcionalidades de IA" | ai:use |

- A matrix pode ser configurada por **grupo** ou por **usuário individual**
- Permissão individual tem precedência sobre permissão de grupo

### 6.3 Permissões Exclusivas do Owner

As seguintes ações **somente** o Owner pode realizar:

- Promover usuário a Owner ou Admin
- Ativar/desativar funcionalidades de IA para um usuário
- Definir cotas de uso de IA por usuário
- Inserir variáveis sensíveis (tokens, API keys, secrets)
- Deletar o blog (desintalação)
- Acessar audit trail completo

---

## 7. Gestão de Grupos

### 7.1 Grupos Padrão (Imutáveis)

| Grupo | Descrição |
|---|---|
| `owner` | Superusuários — acesso total |
| `default` | Todos os usuários cadastrados e aprovados que não têm grupo específico |

> Estes grupos **não podem ser deletados, renomeados nem ter permissões alteradas**.

### 7.2 Grupos Customizados

- Criados pelo Owner ou Admin com permissão
- Exemplos comuns: `editors`, `moderators`, `analysts`
- Cada grupo tem sua própria Access Matrix
- Um usuário pode pertencer a múltiplos grupos

### 7.3 Hierarquia de Resolução de Permissão

```
Permissão individual do usuário
  > Permissão do grupo com maior privilégio
    > Permissão do grupo default
```

---

## 8. Audit Trail

Toda ação sensível no sistema é registrada:

| Campo | Descrição |
|---|---|
| `actorId` | ID do usuário que realizou a ação |
| `actorEmail` | E-mail no momento da ação |
| `action` | Descrição da ação (ex: `user.approved`, `post.deleted`) |
| `targetId` | ID do recurso afetado |
| `targetType` | Tipo do recurso (`user`, `post`, `group`, etc.) |
| `metadata` | Dados antes/depois da mudança (JSON) |
| `ipAddress` | IP da requisição |
| `userAgent` | Browser/cliente |
| `timestamp` | Data e hora ISO 8601 |

### 8.1 Ações sempre registradas

- Login (sucesso e falha)
- Aprovação/rejeição de usuário
- Mudança de role ou permissão
- Publicação, edição e exclusão de post
- Mudança de configurações do sistema
- Inserção/remoção de API keys
- Alterações de permissão no RBAC

---

## 9. Segurança de Senhas

- Hash: **bcrypt** com custo mínimo 12
- Política de senha:
  - Mínimo 8 caracteres
  - Ao menos 1 letra maiúscula, 1 minúscula, 1 número
  - Verificação contra lista de senhas comuns (top 10k)
- Redefinição de senha:
  - Token único enviado por e-mail (expiração: 1 hora)
  - Token de uso único — invalidado após uso
  - Após redefinição: todas as sessões ativas são invalidadas
