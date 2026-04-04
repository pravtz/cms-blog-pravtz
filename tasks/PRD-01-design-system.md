# PRD-01 — Design System, Identidade Visual e Acessibilidade

**Projeto:** Nexus CMS  
**Módulo:** Design System  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Conceito Visual: "Ink & Steel" (Nanquim e Aço)

A identidade visual do Nexus CMS funde a tradição da tipografia editorial impressa com a precisão da tecnologia moderna. O resultado é uma interface densa de informação, mas visualmente leve — onde o conteúdo é sempre o protagonista.

**Princípios:**
- O texto lidera; os elementos de UI servem ao conteúdo
- Hierarquia clara, sem ornamentos desnecessários
- Escuridão proposital: fundos escuros para reduzir fadiga de leitura prolongada
- Toda escolha de cor deve passar no teste de contraste mínimo de 4.5:1

---

## 2. Tipografia

### 2.1 Fontes

| Papel | Fonte | Uso |
|---|---|---|
| Serif | **Newsreader** | Títulos (`h1`–`h3`), corpo de texto longo de artigos |
| Sans-Serif | **Inter** | Interface (botões, labels, inputs, menus, metadados) |

### 2.2 Escala Tipográfica (base 16px)

| Token | Tamanho | Peso | Uso típico |
|---|---|---|---|
| `text-hero` | 56–72px | 700 | HeroSection — título do post em destaque |
| `text-h1` | 40px | 700 | Título principal de página |
| `text-h2` | 32px | 600 | Subtítulo de seção |
| `text-h3` | 24px | 600 | Título de card ou widget |
| `text-body-lg` | 18px | 400 | Corpo de artigo (leitura longa) |
| `text-body` | 16px | 400 | Interface geral |
| `text-sm` | 14px | 400 | Metadados, labels, datas |
| `text-xs` | 12px | 400 | Badges, tags, versões |

### 2.3 Espaçamento de Linha (Line Height)

- Títulos: `1.2`
- Corpo de leitura longa: `1.75` (máxima legibilidade)
- Interface: `1.5`

### 2.4 Largura de Coluna de Leitura

- Máximo de **70ch** (caracteres) para texto de artigo — padrão tipográfico editorial

---

## 3. Paleta de Cores — Temas

O produto nasce em **Dark Mode** como padrão. Todos os temas devem garantir contraste mínimo **4.5:1** (WCAG 2.1 AA) entre texto e fundo.

### 3.1 Temas Disponíveis

| # | Nome | Fundo (`--bg`) | Destaque (`--accent`) | Descrição |
|---|---|---|---|---|
| 1 | **Onyx** *(Default)* | `#060e20` | `#c0c1ff` | Azul profundo + Lavanda |
| 2 | **Emerald** | `#061a15` | `#34d399` | Verde floresta + Esmeralda |
| 3 | **Crimson** | `#1a0606` | `#f87171` | Vinho escuro + Coral |
| 4 | **Slate** | `#0f172a` | `#38bdf8` | Ardósia + Céu |
| 5 | **Amber** | `#1a1206` | `#fbbf24` | Mogno escuro + Âmbar |
| 6 | **Rose** | `#1a0614` | `#f472b6` | Noite rosada + Rosa |
| 7 | **Violet** | `#13061a` | `#a78bfa` | Roxo profundo + Violeta |

### 3.2 Tokens de Cor por Tema (Estrutura CSS)

```css
:root[data-theme="onyx"] {
  --bg-primary:    #060e20;
  --bg-secondary:  #0d1a36;  /* cards, painéis */
  --bg-elevated:   #142042;  /* modais, dropdowns */
  --accent:        #c0c1ff;
  --accent-hover:  #a8a9ff;
  --text-primary:  #f0f1ff;
  --text-secondary:#a0a8c8;
  --text-muted:    #5a6480;
  --border:        #1e2d52;
  --border-subtle: #0f1a36;
}
```

> Cada tema segue a mesma estrutura de tokens — apenas os valores mudam.

### 3.3 Cores Semânticas (Independentes de Tema)

| Token | Cor | Uso |
|---|---|---|
| `--color-success` | `#22c55e` | Confirmações, uploads ok |
| `--color-warning` | `#f59e0b` | Alertas não-críticos |
| `--color-danger` | `#ef4444` | Erros, exclusões |
| `--color-info` | `#3b82f6` | Informações neutras |

---

## 4. Formas e Espaçamento

### 4.1 Border Radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `4px` | Tags, badges, inputs |
| `--radius-md` | `8px` | Cards, botões |
| `--radius-lg` | `12px` | Modais, painéis |
| `--radius-xl` | `16px` | Cards de destaque (Hero) |

> "Cantos levemente arredondados" — nunca totalmente redondos, nunca quadrados.

### 4.2 Bordas

- Espessura: **1px** (padrão) — minimalista
- Estilo: `solid`
- Cor: `var(--border)` — sempre sutil, nunca chamativa

### 4.3 Sistema de Grid

- Grid de **12 colunas** com gutter de `24px`
- Breakpoints:

| Nome | Largura mínima | Layout |
|---|---|---|
| `xs` | 320px | 1 coluna |
| `sm` | 640px | 2 colunas |
| `md` | 768px | 4 colunas |
| `lg` | 1024px | 8 colunas |
| `xl` | 1280px | 12 colunas |

### 4.4 Escala de Espaçamento (base 4px)

`4, 8, 12, 16, 24, 32, 48, 64, 96, 128px`

---

## 5. Componentes Base (Design Tokens)

### 5.1 Botões

| Variante | Aparência | Uso |
|---|---|---|
| `primary` | Background `--accent`, texto escuro | Ação principal da tela |
| `secondary` | Border `--accent`, background transparente | Ação secundária |
| `ghost` | Sem border, sem background | Ações em toolbars |
| `danger` | Background `--color-danger` | Exclusões, ações destrutivas |

- Estado `disabled`: opacidade 40%, cursor `not-allowed`
- Estado `loading`: spinner substituindo texto, tamanho preservado
- Todos os botões têm `:focus-visible` com outline de 2px `--accent`

### 5.2 Inputs e Formulários

- Background: `--bg-secondary`
- Border: `--border` em repouso → `--accent` em foco
- Label sempre acima do campo (nunca placeholder como único label)
- Mensagens de erro abaixo do campo, em `--color-danger`
- Campos obrigatórios marcados com `*` e `aria-required="true"`

### 5.3 Cards

- Background: `--bg-secondary`
- Border: `1px solid var(--border)`
- Border-radius: `--radius-md`
- Sombra em hover: `0 4px 24px rgba(0,0,0,0.4)`
- Transição: `box-shadow 200ms ease, transform 150ms ease`
- Transform em hover: `translateY(-2px)` (sutil)

### 5.4 Modais e Overlays

- Overlay: `rgba(0,0,0,0.7)` com `backdrop-filter: blur(4px)`
- Modal: `--bg-elevated`, `--radius-lg`
- Foco movido para o modal ao abrir (`focus trap`)
- Fechado com `Escape`, botão X e clique fora

### 5.5 Badges e Tags

- Background: `--bg-elevated`
- Border: `1px solid var(--border)`
- Border-radius: `--radius-sm`
- Tamanho: `text-xs`

---

## 6. Iconografia

- **Prioridade total para SVG** — sem fontes de ícone (ex: Font Awesome)
- Biblioteca de referência: **Lucide Icons** (linha fina, consistente com o conceito "Ink & Steel")
- Tamanhos padrão: 16px, 20px, 24px
- Sempre incluir `aria-hidden="true"` quando decorativo; `aria-label` quando funcional
- Cor: `currentColor` — herda do contexto

---

## 7. Imagens e Mídia

- **Formato preferido:** WebP e AVIF (fallback JPEG/PNG)
- `alt` obrigatório em todas as `<img>` — descritivo, não "imagem de..."
- Imagens decorativas: `alt=""` + `role="presentation"`
- Proporção padrão de cover: **16:9** (hero) e **3:2** (cards)
- Lazy loading: `loading="lazy"` em todas as imagens fora do viewport inicial
- Servidas via CDN (S3 + CloudFront ou Azure CDN)

---

## 8. Animações e Transições

| Elemento | Duração | Easing |
|---|---|---|
| Hover em cards | 150ms | `ease` |
| Abertura de modal | 250ms | `ease-out` |
| Skeleton screen → conteúdo | 300ms | `ease` |
| Sidebar collapse/expand | 200ms | `ease-in-out` |
| Toast/notificação | 350ms | `ease-out` |

- `prefers-reduced-motion`: todas as animações reduzidas a `opacity` apenas, sem `transform`

---

## 9. Acessibilidade (WCAG 2.1 AA — Obrigatório)

### 9.1 Contraste

- Texto normal: mínimo **4.5:1**
- Texto grande (≥18px normal ou ≥14px bold): mínimo **3:1**
- Componentes de UI (ícones, bordas de input): mínimo **3:1**
- Todos os 7 temas devem passar nestas métricas

### 9.2 Navegação por Teclado

- Toda funcionalidade acessível via teclado
- Ordem de foco (`tabindex`) lógica e sequencial
- `:focus-visible` visível em todos os elementos interativos
- `focus trap` em modais e drawers abertos
- Atalho `Escape` fecha modais, dropdowns e drawers

### 9.3 Semântica HTML

- Uso correto de `<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<aside>`, `<section>`
- Hierarquia de headings (`h1`→`h6`) sem pulos
- `<button>` para ações, `<a>` para navegação — nunca misturar
- `<label>` associado a cada `<input>` via `for`/`id`

### 9.4 ARIA

- `aria-label` em ícones funcionais
- `aria-expanded` em accordions, menus, drawers
- `aria-live="polite"` em áreas de atualização dinâmica (notificações, contadores)
- `aria-current="page"` no item ativo do menu de navegação
- `role="dialog"` + `aria-labelledby` em modais

### 9.5 Leitores de Tela

- Conteúdo visualmente oculto mas lido: classe `.sr-only` (não usar `display:none`)
- Toasts/notificações anunciados via `aria-live`
- Tabelas com `<caption>`, `<th scope>` corretos

---

## 10. Storybook

- **Todos** os componentes documentados no Storybook
- Cada componente com stories para: todos os estados, todas as variantes, todos os temas
- Página estática do Storybook publicada separadamente
- Componentes marcados com status: `stable`, `beta`, `deprecated`
- Testes de acessibilidade via `@storybook/addon-a11y` em cada story
