# PRD Mestre — Nexus CMS: "The Editorial Monograph"

**Versão:** 1.0  
**Data:** 2026-04-04  
**Status:** Draft  
**Classificação:** Open-Source  

---

## Sobre este documento

Este PRD está dividido em módulos para facilitar o trabalho em paralelo por equipes. Cada arquivo cobre um domínio específico do produto.

---

## Índice de Módulos

| # | Arquivo | Domínio |
|---|---|---|
| 01 | [/tasks/PRD-01-design-system.md](../tasks/PRD-01-design-system.md) | Design System, Identidade Visual e Acessibilidade |
| 02 | [/tasks/PRD-02-public-blog.md](../tasks/PRD-02-public-blog.md) | Blog Público — Home, Feed, Post, Card |
| 03 | [/tasks/PRD-03-api-publica.md](../tasks/PRD-03-api-publica.md) | API Pública REST |
| 04 | [/tasks/PRD-04-auth-rbac.md](../tasks/PRD-04-auth-rbac.md) | Autenticação, Usuários e Controle de Acesso (RBAC) |
| 05 | [/tasks/PRD-05-admin-panel.md](../tasks/PRD-05-admin-panel.md) | Painel Administrativo e CRUDs |
| 06 | [/tasks/PRD-06-editor-mdx.md](../tasks/PRD-06-editor-mdx.md) | Editor MDX e Gestão de Conteúdo |
| 07 | [/tasks/PRD-07-content-features.md](../tasks/PRD-07-content-features.md) | Comentários, Newsletter, Multilinguagem e Compartilhamento |
| 08 | [/tasks/PRD-08-ai-features.md](../tasks/PRD-08-ai-features.md) | Funcionalidades de IA e Gestão de Cotas |
| 09 | [/tasks/PRD-09-infra-security.md](../tasks/PRD-09-infra-security.md) | Infraestrutura, Segurança e Observabilidade |
| 10 | [/tasks/PRD-10-installation.md](../tasks/PRD-10-installation.md) | Instalação, First Run e Configurações |
| 11 | [/tasks/PRD-11-testing-roadmap.md](../tasks/PRD-11-testing-roadmap.md) | Estratégia de Testes e Roadmap de Entrega |

---

## Visão Geral do Produto

**Nexus CMS** é um sistema de gerenciamento de conteúdo open-source projetado para criadores que valorizam estética editorial, segurança e inteligência artificial. Posiciona-se entre a simplicidade do Ghost e a robustez do WordPress — com foco em tipografia, performance e controle granular de acesso (RBAC).

### Pilares do Produto

1. **Segurança** — prioridade máxima em todas as camadas
2. **SEO** — melhores práticas em cada página e componente
3. **Acessibilidade** — WCAG 2.1 AA em todo o produto
4. **IA** — funcionalidades controláveis e com gestão de custos
5. **Open-Source** — código aberto, documentado e extensível

### Divisão dos Ambientes

| Ambiente | Hospedagem | Acesso |
|---|---|---|
| Blog Público | Storage estático (CDN) | Público |
| Painel Administrativo | Servidor (server-side) | Autenticado |
| API Pública | Servidor com rate limiting | Público (somente GET) |
| Storybook | Página estática | Público |

### Tech Stack Resumido

| Camada | Tecnologia |
|---|---|
| Banco de Dados | SQLite → PostgreSQL (migração suportada) |
| Armazenamento de Mídia | AWS S3 ou Azure Blob Storage |
| Autenticação | JWT com Refresh Tokens |
| Infraestrutura | Docker |
| Observabilidade | Microsoft Clarity |
| Arquitetura | C4 Model (atualizado por release) |
| Componentes | Storybook |
| Extensibilidade | MCP (Model Context Protocol) |

---

## Glossário Global

| Termo | Definição |
|---|---|
| **Owner** | Superusuário com acesso irrestrito; máx. 10 por instância |
| **Default** | Usuário com permissões mínimas (like, share, comment) |
| **RBAC** | Role-Based Access Control — controle por papel e operação |
| **MDX** | Markdown com suporte a JSX/componentes interativos |
| **SSG** | Static Site Generation — geração estática do frontend público |
| **Double Opt-in** | Confirmação de e-mail com token antes de ativar inscrição |
| **Frontmatter** | Metadados YAML no cabeçalho de cada arquivo MDX |
| **Slug** | Identificador único de URL de um post |
| **MCP** | Model Context Protocol — extensibilidade via IA |
| **Ghost Text** | Sugestão de autocomplete exibida em texto "fantasma" (Tab para aceitar) |
| **Visibility** | Campo do Frontmatter que controla quem pode ver o post |
