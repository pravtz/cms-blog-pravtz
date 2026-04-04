# PRD-02 — Blog Público

**Projeto:** Nexus CMS  
**Módulo:** Blog Público (Home, Feed, Post, Card)  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

O blog público é a face do produto — entregue como **site estático (SSG)**, publicado em storage estático (S3/Azure ou equivalente). Toda a experiência deve ser rápida, acessível, otimizada para SEO e visualmente coerente com o Design System.

**Ambientes:**
- Hospedagem: estático (CDN)
- Geração: SSG com revalidação incremental
- Autenticação: não necessária para conteúdo público; necessária para ações de engajamento

---

## 2. Modelo de Dados — Post (Frontmatter)

```yaml
title: string           # Obrigatório
subtitle: string        # Obrigatório
date: ISO 8601          # Obrigatório
tags: string[]          # Obrigatório
category: string        # Obrigatório
excerpt: string         # Obrigatório (max 200 chars)
coverImage: string      # Opcional — URL S3/Azure
visibility: enum        # public | iPrivate | allPrivate | groupPrivate | listPrivate
lang: enum              # pt-BR | en
slug: string            # Gerado automaticamente a partir do título
readingTime: number     # Calculado automaticamente (palavras ÷ 200)
```

### 2.1 Regras de Visibilidade no Blog Público

| Valor | Comportamento no Blog Público |
|---|---|
| `public` | Totalmente visível para qualquer visitante |
| `allPrivate` | Exige login e aprovação do admin |
| `groupPrivate` | Exige login e pertencer ao grupo definido |
| `listPrivate` | Exige login e estar na lista definida |
| `iPrivate` | Invisível para qualquer um exceto o autor/Owner |

Posts com visibilidade restrita exibem **blur no conteúdo** + CTA de login/cadastro no lugar do texto.

---

## 3. Página Home (`/`)

### 3.1 Objetivo

Capturar imediatamente o leitor, destacar o conteúdo mais relevante e guiar para exploração.

### 3.2 Componentes

#### `HeroSection`
- Post mais recente com `visibility: public` **ou** post marcado como "Editor's Choice" pelo Owner
- Imagem de capa em alta resolução (16:9), cobrindo a largura total
- Título em `text-hero` (Newsreader, serif), com contraste total sobre a imagem (overlay escuro)
- Subtítulo, autor, data e tempo estimado de leitura
- Categoria exibida de forma sutil (badge)
- Botão CTA "Ler artigo" → `/blog/[slug]`

#### `BioCard`
- Foto do Owner (avatar circular, fallback com inicial do nome)
- Nome e bio curta (máx. 160 chars)
- Links sociais com ícones SVG (GitHub, Instagram, LinkedIn, Facebook)
- Posicionamento: lateral em desktop (sticky), abaixo do Hero em mobile

#### `PostGrid` — Top 12
- Os **12 posts** mais vistos (`visibility: public`), ordenados por `views DESC`
- Layout mosaico responsivo (ver seção 6 — Card do Post)
- Skeleton screen durante carregamento
- Scroll suave ou botão "Carregar mais" com lazy loading

#### `LoadMoreButton`
- Gatilho para carregar o arquivo completo ou redirecionar para `/blog`
- Exibição: somente quando há mais de 12 posts públicos

### 3.3 SEO da Home

- `<title>`: `{Blog Name} — {tagline}`
- `<meta name="description">`: bio do Owner (máx. 160 chars)
- `<meta property="og:image">`: cover image do post em destaque
- JSON-LD: `WebSite` + `Person` (Owner)
- `canonical`: URL da home
- Nenhum post com `iPrivate` aparece — nem no HTML gerado

---

## 4. Feed do Blog (`/blog`)

### 4.1 Objetivo

Exploração profunda do arquivo de conteúdo. Busca, filtragem e navegação por todo o conteúdo público.

### 4.2 Componentes

#### `SearchBar`
- Input flutuante com ícone de lupa
- Autocomplete em tempo real: sugere títulos de posts e nomes de autores
- Busca por: título, subtítulo, excerpt, tags, categoria
- Atalho de teclado: `/` abre o campo de busca de qualquer lugar da página
- Debounce de 300ms para evitar requisições excessivas
- Estado vazio: "Nenhum resultado para '...'" com sugestão de termos relacionados

#### `FilterBar` (Sticky)
- Fixa no topo após scroll passar o header
- Filtros disponíveis:
  - **Categoria**: dropdown ou pills horizontais
  - **Tags**: multi-select com chips
  - **Data**: seletor Ano → Mês
- Filtros ativos visíveis como chips removíveis
- URL reflete os filtros ativos (ex: `/blog?category=tech&tag=react&year=2025`)
- H1 dinâmico baseado no filtro aplicado:
  - `/blog` → "Todos os artigos"
  - `?category=tech` → "Artigos em Tech"
  - `?tag=react` → "Artigos com tag React"

#### `PostCardList`
- Layout vertical (lista editorial)
- Prioriza título e excerpt — sem imagem grande (diferente do grid da Home)
- Imagem miniatura à esquerda (3:2, 120px de largura) — opcional se sem coverImage
- Ordenação padrão: data decrescente
- Paginação: 20 posts por página com navegação numerada

### 4.3 SEO do Feed

- `<title>`: `Blog — {filtro ativo} | {Blog Name}`
- `<meta name="description">`: descrição dinâmica conforme filtro
- JSON-LD: `ItemList` com os posts da página atual
- Sitemaps dinâmicos gerados por categoria, tag e data
- `robots: index, follow` para filtros de categoria/tag; `noindex` para páginas de busca com query

---

## 5. Página de Leitura (`/blog/[slug]`)

### 5.1 Objetivo

Experiência de leitura imersiva, focada no texto. Toda distração visual é eliminada. Conversão para newsletter e engajamento no final.

### 5.2 Componentes

#### `FloatingProgressBar`
- Barra fina (2–3px) no topo da janela
- Cor: `--accent`
- Progresso baseado no scroll relativo ao tamanho do artigo
- `aria-hidden="true"` (decorativo)

#### `ArticleHeader`
- Imagem de capa (16:9, largura total) — renderizada somente se `coverImage` presente
- Overlay escuro gradiente na parte inferior da imagem para o título
- Categoria (badge sutil, link para `/blog?category=...`)
- Tags (chips, links para `/blog?tag=...`)
- Título (`text-h1`, Newsreader)
- Subtítulo (`text-h2`, peso 400)
- Autor (avatar + nome) | Data formatada (ex: "12 de março de 2025") | Tempo de leitura

#### `MDXContent`
- Renderizador de MDX estilizado
- Tipografia editorial: Newsreader, `text-body-lg`, `line-height: 1.75`, máx. `70ch`
- **Suporte a:**
  - Blocos de código com **syntax highlighting** (Shiki ou Prism — tema escuro alinhado ao Design System)
  - Tabelas complexas (scroll horizontal em mobile)
  - Blockquotes estilizados (borda esquerda `--accent`, itálico, padding interno)
  - Listas ordenadas e não-ordenadas com marcadores customizados
  - Imagens com caption (`<figure>` + `<figcaption>`)
  - Callouts/alertas (info, warning, danger)
  - Notas de rodapé

#### `RBACBanner`
- Exibido quando o post tem visibilidade restrita e o usuário não tem permissão
- Conteúdo do artigo com `blur(8px)` + `user-select: none`
- Card centralizado sobre o blur:
  - Ícone de cadeado
  - Mensagem: "Este conteúdo é exclusivo para [descrição do grupo]"
  - Botões: "Fazer login" e "Criar conta"

#### `RecommendationSection`
- Localização: acima do rodapé da página
- Título: "Outros artigos em {categoria}"
- Exibe **3 posts** da mesma categoria, excluindo o atual
- Ordenação: mais recentes
- Layout: 3 cards horizontais (1 coluna em mobile)

#### `NewsletterCard`
- Localização: entre `RecommendationSection` e rodapé
- Título: "Receba os próximos artigos"
- Campo de e-mail (input `type="email"`)
- **Checkbox obrigatório** com label: "Autorizo receber e-mails com novos artigos. Veja nossa [Política de Privacidade]."
  - `aria-required="true"`, não pode submeter sem marcar
- Botão "Inscrever-se" desabilitado até checkbox marcado
- Fluxo após submissão:
  1. Validação do e-mail (formato e domínio básico)
  2. E-mail de confirmação enviado com token único (Double Opt-in)
  3. Exibe mensagem: "Verifique seu e-mail para confirmar a inscrição."
  4. Usuário clica no link do e-mail → token validado → inscrição ativada

#### `CommentSystem`
- Localização: abaixo do `MDXContent`, antes do `RecommendationSection`
- **Requer login** para comentar — visitantes veem os comentários existentes
- Comentários exibem: avatar, nome, data, texto, contadores de like/dislike
- **Votação:** botão positivo (👍) e negativo (👎) — somente usuários logados
- Suporte a **threads** (respostas a comentários)
- Ordenação: mais recentes por padrão; opção de ordenar por mais votados
- Comentários herdam a visibilidade do post (ex: post `groupPrivate` → comentários só visíveis para o mesmo grupo)
- Moderação: admins com permissão podem ocultar/excluir comentários

### 5.3 SEO da Página de Post

- `<title>`: `{title} | {Blog Name}`
- `<meta name="description">`: `excerpt` do post
- `<meta property="og:title">`: título do post
- `<meta property="og:description">`: excerpt
- `<meta property="og:image">`: `coverImage` ou imagem padrão do blog
- `<meta property="og:type">`: `article`
- `<meta property="article:published_time">`: data ISO 8601
- `<meta property="article:tag">`: tags do post
- JSON-LD: `Article` com `author`, `datePublished`, `image`, `headline`
- `canonical`: URL canônica do post
- Hreflang: quando existir versão em outro idioma

---

## 6. Card do Post (Componente Compartilhado)

Utilizado em: Home (PostGrid), Feed (PostCardList), RecommendationSection.

### 6.1 Conteúdo do Card

| Campo | Obrigatório | Notas |
|---|---|---|
| Título | Sim | Máx. 2 linhas com `line-clamp` |
| Subtítulo | Sim | Máx. 2 linhas com `line-clamp` |
| Data | Sim | Formato localizado |
| Imagem de capa | Não | Placeholder se ausente |
| Número de views | Sim | Ícone + número formatado (ex: 1.2k) |
| Número de comentários | Sim | Ícone + número |
| Categoria | Sim | Badge sutil no canto |
| Botão de compartilhamento | Sim | Ver seção 6.3 |
| Botão de like | Sim | Ver seção 6.4 |

### 6.2 Aparência

- Background: `--bg-secondary`
- Border: `1px solid var(--border)`
- Border-radius: `--radius-md`
- Hover: elevação sutil (`translateY(-2px)`) + sombra
- Transição: 150ms ease
- Link: card inteiro é clicável (exceto botões de ação)

### 6.3 Compartilhamento

- Ícone de compartilhamento sempre visível
- Ao clicar: dropdown com opções:
  - WhatsApp (`https://wa.me/?text=...`)
  - Instagram (cópia de link + instrução — API não permite compartilhamento direto)
  - LinkedIn (`https://www.linkedin.com/sharing/share-offsite/?url=...`)
  - "Copiar link" (Clipboard API)
- **Restrição:** ação de compartilhar (registrar no sistema) somente para usuários logados
- Contagem de compartilhamentos: visível para todos

### 6.4 Like

- Ícone de coração (outline → preenchido quando curtido)
- **Restrição:** ação somente para usuários logados
- Tentativa sem login: exibe modal/tooltip "Faça login para curtir"
- Contagem de likes: visível para todos
- Estado otimista: atualização visual imediata, confirmação assíncrona

---

## 7. Multilinguagem

### 7.1 Modelo

- Cada post pode ter versões em **pt-BR** e **en**
- Versões são posts separados no sistema, vinculados pelo campo `translationGroup` (UUID compartilhado)
- O `slug` de cada versão pode ser diferente

### 7.2 Troca de Idioma

- Quando um post possui versão em outro idioma: exibe toggle de idioma no `ArticleHeader`
- Toggle: `PT-BR | EN` (flag + código)
- Ao trocar: navega para o slug correspondente da outra versão
- Se não houver versão no idioma: toggle desabilitado com tooltip "Sem versão em [idioma]"

### 7.3 SEO Multilinguagem

- Tag `hreflang` no `<head>` indicando as versões disponíveis:
```html
<link rel="alternate" hreflang="pt-BR" href="https://blog.com/blog/meu-post" />
<link rel="alternate" hreflang="en" href="https://blog.com/blog/my-post" />
```

---

## 8. Performance

- Frontend gerado como **SSG** — sem renderização server-side em tempo real
- Revalidação incremental (ISR) para posts atualizados
- Imagens: WebP/AVIF servidas via CDN, `srcset` para responsividade
- Fontes: preload das fontes críticas, `font-display: swap`
- CSS crítico inline no `<head>`
- JavaScript: code splitting por rota, lazy import de componentes pesados (ex: MDX renderer, comentários)
- Core Web Vitals alvo:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
