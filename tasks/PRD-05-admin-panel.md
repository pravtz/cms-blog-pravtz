# PRD-05 — Painel Administrativo e CRUDs

**Projeto:** Nexus CMS  
**Módulo:** Admin Panel  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

O painel administrativo é o centro nervoso do Nexus CMS. É um ambiente server-side, acessível somente a usuários com conta `active` e aprovada. Cada tela e operação respeita as permissões definidas no RBAC.

### Acesso

- URL: subdomínio ou path dedicado (ex: `/admin`)
- Hospedagem: servidor (não estático)
- Autenticação: JWT (access token + refresh token)
- Acesso negado se: `status !== active` ou role `default`

---

## 2. Layout Global do Painel

### 2.1 Sidebar (`DynamicSidebar`)

**Desktop:**
- Largura expandida: **280px** com ícone + label
- Largura colapsada: **64px** com somente ícones
- Toggle: botão manual para colapsar/expandir
- Comportamento hover: se colapsada, expande ao passar o mouse
- Transição: 200ms ease-in-out

**Mobile:**
- Drawer deslizante da esquerda
- Abre via botão hamburguer no header
- Overlay escuro ao abrir, fechado por clique no overlay ou swipe

**Estrutura do menu (ordem):**

```
📊 Dashboard
✏️ Editor (Novo Post)
📝 Posts
📄 Rascunhos
💬 Comentários
👥 Usuários
🔑 Grupos
🔒 Permissões
🏷️ Tags
📁 Categorias
🖼️ Imagens
💡 Ideias
📧 Newsletter
📢 Email Marketing
🔔 Notificações
📱 Redes Sociais
📈 Métricas
🤖 IA & Cotas
⚙️ Configurações
📚 Documentação
🚀 Releases
🏗️ C4 Model (Arquitetura)
```

> Itens não permitidos pela role do usuário ficam ocultos — não desabilitados, ocultos.

### 2.2 Header do Painel

- Nome do blog + logo (se configurado)
- Ícone de notificações com badge de contagem não lida
- Avatar do usuário logado + dropdown: "Meu Perfil", "Sair"
- Versão do sistema no rodapé da sidebar

### 2.3 Quick Entry Button

- Botão flutuante (FAB) em todas as telas: "Novo Post"
- Atalho de teclado: `Ctrl/Cmd + K` → abre palette de comandos rápidos

### 2.4 Notificações Importantes

- Banner não-dispensável no topo do painel para alertas críticos:
  - Usuários aguardando aprovação (se o usuário tem permissão de aprovar)
  - Variável sensível não configurada (bloqueando funcionalidade)
  - Erro de configuração de e-mail ou storage
  - Versão nova disponível

---

## 3. Dashboard

### 3.1 Objetivo

Visão estratégica e operacional em um único lugar.

### 3.2 Componentes

#### `MetricCards` (linha superior)

| Métrica | Visualização | Período |
|---|---|---|
| Visitantes únicos | Sparkline + número | Últimos 30 dias |
| Views totais | Sparkline + número | Últimos 30 dias |
| Engagement Rate | Sparkline + % | Últimos 30 dias |
| SEO Score | Gauge circular | Atual |
| Novos inscritos (newsletter) | Sparkline + número | Últimos 30 dias |

#### `ActivityFeed`

- Lista cronológica de eventos recentes:
  - Novos usuários cadastrados (pendentes de aprovação — com botão rápido de revisar)
  - Falhas de login (alertas de segurança)
  - Posts publicados
  - Comentários novos
  - Erros do sistema
- Máximo de 20 eventos exibidos, link "Ver todos"

#### `TopPostsWidget`

- 5 posts mais visualizados no período selecionado
- Colunas: título, views, comentários, likes

#### `QuickActions`

- "Novo Post" → Editor MDX
- "Aprovar usuários" → Lista de pendentes (visível se há pendentes)
- "Ver métricas completas" → Tela de Métricas

---

## 4. Telas de CRUD

Todas as telas de CRUD seguem o mesmo padrão de UX:

### 4.1 Padrão de Layout das Telas de CRUD

```
[Título da tela]                    [Botão: Novo ...]
[Campo de busca]  [Filtros opcionais]

[Tabela/Lista de itens]
  - Colunas relevantes
  - Ações por linha: [Editar] [Excluir]
  - Checkbox para seleção múltipla
  - Ações em lote: Excluir selecionados

[Paginação]
```

- Campo de busca: busca em tempo real (debounce 300ms) por campos relevantes
- Confirmação de exclusão: modal "Tem certeza? Esta ação não pode ser desfeita."
- Exclusão em lote: confirmação com contagem (ex: "Excluir 5 itens selecionados?")
- Toast de feedback para todas as ações (sucesso, erro)

---

## 5. CRUD de Posts

Detalhado no módulo [PRD-06-editor-mdx.md](PRD-06-editor-mdx.md).

**Nesta tela:**
- Lista de posts com: título, categoria, status, data, views, autor
- Filtros: status (publicado, rascunho, agendado), categoria, autor, período
- Busca por título
- Ações: Editar, Visualizar (abre o post público), Duplicar, Mover para rascunho, Excluir

---

## 6. CRUD de Rascunhos

- Lista todos os rascunhos do usuário logado (admins com permissão veem todos)
- Colunas: título, última modificação, autor
- Ações: Abrir no editor, Publicar, Excluir
- Auto-save no editor a cada 30 segundos

---

## 7. CRUD de Comentários

- Lista todos os comentários com: texto (truncado), autor, post vinculado, data, likes, dislikes, status
- Status: `visible`, `hidden`, `flagged`
- Filtros: status, post, período
- Busca por texto ou autor
- Ações: Visualizar contexto, Ocultar, Exibir, Excluir
- Comentários ocultos ainda contam nas métricas mas não aparecem no blog público

---

## 8. CRUD de Usuários

- Lista todos os usuários com: nome, apelido, e-mail, role principal, status, data de cadastro
- Filtros: status (`pending_approval`, `active`, `suspended`), role
- Busca por nome, apelido ou e-mail
- **Lista de pendentes** com destaque visual (badge de contagem)
- Ações por usuário:
  - Aprovar / Rejeitar (somente pendentes)
  - Editar role e grupos
  - Suspender / Reativar
  - Ver perfil completo (conteúdo consumido, comentários, likes, compartilhamentos)
  - Encerrar sessões ativas
  - Excluir (somente Owner)

### 8.1 Perfil Detalhado do Usuário

- Dados pessoais
- Posts mais consumidos (lista com links)
- Quantidade total de likes dados
- Quantidade de conteúdos compartilhados
- Histórico de comentários (lista com links)
- Log de atividade recente

---

## 9. CRUD de Grupos

- Lista de grupos com: nome, descrição, quantidade de membros
- Grupos padrão (`owner`, `default`) exibidos com badge "Padrão" e sem botão de excluir/editar nome
- Ações: Criar grupo, Editar (nome/descrição), Gerenciar membros, Configurar permissões, Excluir
- Ao criar/editar: modal com nome, descrição e seleção de membros (multi-select com busca)

---

## 10. Gestão de Permissões (RBAC)

- Detalhado no [PRD-04-auth-rbac.md](PRD-04-auth-rbac.md) — seção 6
- Nesta tela:
  - Seletor: "Configurar por Grupo" ou "Configurar por Usuário"
  - Access Matrix com checkboxes humanizados
  - Botão "Salvar" com confirmação
  - Log de última alteração: "Modificado por [nome] em [data]"

---

## 11. CRUD de Tags

- Lista de tags com: nome, slug, quantidade de posts
- Busca por nome
- Ações: Criar, Editar, Mesclar (une dois tags em um), Excluir
- Ao excluir tag com posts vinculados: alerta com opção de remover a tag dos posts ou cancelar

---

## 12. CRUD de Categorias

- Lista de categorias com: nome, slug, quantidade de posts, descrição
- Busca por nome
- Ações: Criar, Editar, Excluir
- Ao excluir categoria com posts vinculados: bloqueado com mensagem (deve mover posts antes)

---

## 13. CRUD de Imagens

- Grid de imagens (thumbnails) com lazy loading
- Campos exibidos: thumbnail, nome, tamanho, dimensões, data de upload, alt text
- Busca por nome ou alt text
- Upload:
  - Drag & drop ou seleção de arquivo
  - Formatos aceitos: JPG, PNG, WebP, SVG, GIF
  - Conversão automática para WebP (exceto SVG e GIF)
  - Ferramenta de **crop** integrada antes do upload final
  - Alt text **obrigatório** antes de salvar (campo de texto)
  - Nomeação automática SEO-friendly baseada no alt text
- Ações: Visualizar, Editar alt text, Copiar URL, Excluir
- Ao excluir imagem em uso: alerta com lista de posts que a utilizam

---

## 14. CRUD de Ideias

- Brainstorming de futuros posts
- Campos: título da ideia, descrição (opcional), nota de 0 a 10, lista de pessoas para compartilhar
- Lista com: título, nota (badge colorido por faixa), data, compartilhada com
- Ordenação padrão: nota mais alta primeiro
- Filtros: nota mínima, compartilhada/não
- Ações: Criar, Editar, Transformar em Rascunho, Excluir

---

## 15. Newsletter

- Lista de todos os inscritos com: e-mail, status (`pending_confirm`, `active`, `unsubscribed`), data de inscrição
- Busca por e-mail
- Filtros: status
- Ações: Exportar lista (CSV), Remover inscrição
- Sem ação de "adicionar manualmente" — inscrição somente via blog público com Double Opt-in

---

## 16. Email Marketing

- **Desativado por padrão** — ativado somente após configuração de SMTP nas configurações
- Quando desativado: tela exibe mensagem "Configure o servidor de e-mail nas Configurações para ativar esta funcionalidade."
- Quando ativo:
  - Criar e enviar campanhas para a lista de inscritos
  - Editor de e-mail (template simples com suporte a variáveis `{{nome}}`)
  - Histórico de campanhas enviadas com métricas (aberturas, cliques — se disponível)
  - Agendamento de envio

---

## 17. Gerador de Cards Sociais

- Selecionar post existente ou inserir dados manualmente
- Formatos disponíveis:
  - Instagram (1:1 — 1080×1080px)
  - Instagram Stories (9:16 — 1080×1920px)
  - LinkedIn (1.91:1 — 1200×627px)
  - Twitter/X (2:1 — 1200×600px)
- Preview em tempo real do card com Design System aplicado
- Campos editáveis: título, subtítulo, autor, logo, imagem de fundo
- Export: PNG (alta resolução)

---

## 18. Métricas Detalhadas

- Filtro de período: últimos 7 dias, 30 dias, 3 meses, 12 meses, personalizado
- Gráficos:
  - Visitantes únicos × Views ao longo do tempo
  - Posts mais acessados (ranking)
  - Fontes de tráfego (organic, direct, referral, social)
  - Taxa de engajamento (likes + comentários ÷ views)
  - Crescimento de inscritos na newsletter
  - Score de SEO por post (quando integrado com Clarity/analytics)
- Exportar resumo:
  - Via e-mail para usuário com permissão
  - Via link de notificação (integração Teams/Slack/Discord)

---

## 19. Integrações de Notificações

- Canais disponíveis: Microsoft Teams, Slack, Discord, E-mail
- Cada canal ativado individualmente
- Configuração: webhook URL (Teams, Slack, Discord) ou SMTP (e-mail)
- Eventos configuráveis por canal:
  - Novo usuário aguardando aprovação
  - Novo comentário
  - Falha de login suspeita
  - Post publicado
  - Erro crítico do sistema
- Teste de envio disponível ao configurar

---

## 20. Redes Sociais

- Configuração de perfis: URL do GitHub, Instagram, LinkedIn, Facebook, X/Twitter
- Quando a integração direta for possível (via API da rede social):
  - Token de acesso configurável
  - Compartilhamento automático ao publicar post

---

## 21. Configurações Gerais

- Nome do blog
- Logo (upload, opcional)
- Domínio público
- Idioma padrão do painel
- Fuso horário
- SMTP (e-mail marketing e notificações)
- Storage (S3 ou Azure — credenciais)
- Variáveis sensíveis (somente Owner): tokens, API keys, secrets
  - Interface: campo mascarado, sem exibição após salvo
  - Funcionalidades bloqueadas ficam visíveis com badge "Não configurado"

---

## 22. Documentação do Sistema

- Página de documentação de uso (markdown renderizado)
- Editável por Admin com permissão
- Atualizada a cada release pelo mantenedor
- Histórico de versões da documentação

---

## 23. Releases

- Lista de releases com: versão, data, tipo (major/minor/patch), changelog
- Changelog em markdown renderizado
- Link para commits ou PR correspondente (quando open-source)
- Badge de "versão atual" na release ativa

---

## 24. C4 Model (Arquitetura)

- Página com diagrama C4 Model renderizado (nível Context, Container, Component)
- Código-fonte do diagrama editável pelo Owner (PlantUML ou Mermaid)
- Atualizado a cada feature ou release relevante
- Histórico de versões do diagrama
