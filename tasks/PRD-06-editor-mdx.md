# PRD-06 — Editor MDX e Gestão de Conteúdo

**Projeto:** Nexus CMS  
**Módulo:** Editor MDX  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

O Editor MDX é a ferramenta central de criação de conteúdo do Nexus CMS. Deve proporcionar uma experiência de escrita fluida, sem distrações, com preview em tempo real e assistência de IA opcional.

### Princípios do Editor

- **Foco na escrita:** interface limpa, controles acessíveis mas discretos
- **Preview fiel:** o que o autor vê é exatamente o que o leitor verá
- **Auto-save:** nunca perder trabalho por esquecimento
- **MDX completo:** suporte a componentes JSX dentro do markdown

---

## 2. Layout do Editor

### 2.1 Split View (padrão)

```
┌──────────────────────────────────────────────────────────┐
│  [Toolbar MDX]                      [Toggle: Split|Full] │
├────────────────────────┬─────────────────────────────────┤
│                        │                                 │
│   ÁREA DE ESCRITA      │   PREVIEW RENDERIZADO           │
│   (Markdown/MDX)       │   (HTML estilizado)             │
│                        │                                 │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
│ [FrontmatterDrawer — painel lateral direito, expansível] │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Modos de Visualização

| Modo | Comportamento |
|---|---|
| **Split** (padrão) | Editor esquerda + Preview direita |
| **Full Editor** | Somente editor, sem preview (foco máximo) |
| **Full Preview** | Somente preview (revisão do artigo) |

Toggle entre modos via botão no header do editor ou atalho de teclado.

---

## 3. Toolbar MDX

Barra de ferramentas acima da área de escrita com atalhos visuais:

| Ação | Atalho | Markdown inserido |
|---|---|---|
| **Negrito** | `Ctrl/Cmd + B` | `**texto**` |
| *Itálico* | `Ctrl/Cmd + I` | `*texto*` |
| ~~Riscado~~ | — | `~~texto~~` |
| Título H1 | — | `# Título` |
| Título H2 | — | `## Título` |
| Título H3 | — | `### Título` |
| Link | `Ctrl/Cmd + K` | `[texto](url)` |
| Imagem | — | Abre modal de seleção de imagem da biblioteca |
| Bloco de código | — | ` ```linguagem ``` ` |
| Código inline | — | `` `código` `` |
| Citação (blockquote) | — | `> texto` |
| Lista não-ordenada | — | `- item` |
| Lista ordenada | — | `1. item` |
| Tabela | — | Template de tabela markdown |
| Divisor horizontal | — | `---` |
| Callout/Alerta | — | Componente MDX `<Callout type="info">` |

---

## 4. FrontmatterDrawer (Painel de Metadados)

Painel lateral direito, expandido por padrão ou acessível via botão "Metadados".

### 4.1 Campos do Frontmatter

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| **Título** | text | Sim | Max 100 chars; pré-preenchido se digitado no editor |
| **Subtítulo** | text | Sim | Max 200 chars |
| **Excerpt** | textarea | Sim | Max 200 chars; usado em cards e SEO |
| **Categoria** | select | Sim | Criação inline disponível |
| **Tags** | multi-select | Não | Criação inline disponível |
| **Data de publicação** | datetime | Sim | Default: agora; pode ser data futura (agendamento) |
| **Idioma** | select | Sim | `pt-BR` ou `en` |
| **Visibilidade** | select | Sim | `public` / `allPrivate` / `groupPrivate` / `listPrivate` / `iPrivate` |
| **Grupo/Lista** (condicional) | select | Se `groupPrivate` ou `listPrivate` | Aparece apenas quando relevante |
| **Imagem de capa** | image picker | Não | Abre biblioteca de imagens; preview 16:9 |
| **Post vinculado** (tradução) | search | Não | Para vincular como tradução de outro post |
| **SEO Title** | text | Não | Override do título para SEO (max 60 chars) |
| **SEO Description** | textarea | Não | Override do excerpt para SEO (max 160 chars) |

### 4.2 Preview de SEO

No drawer, seção expansível "Preview de SEO" mostrando como o post aparecerá:
- Simulação do snippet do Google (título, URL, descrição)
- Indicadores visuais de comprimento (verde/amarelo/vermelho)

---

## 5. Auto-save

- Salva rascunho automaticamente a cada **30 segundos** de inatividade
- Indicador de status no header: "Salvo às 14:32" / "Salvando..." / "Erro ao salvar"
- Ctrl/Cmd + S para salvar manualmente
- Ao fechar o browser com alterações não salvas: `beforeunload` event com aviso nativo

---

## 6. IA — Ghost Writer (AIAutocomplete)

> Funcionalidade ativa somente se o Owner habilitou IA para o usuário e inseriu API Key.

### 6.1 Autocomplete por Tab

- Ao pausar a digitação por **1.5 segundos**, o sistema envia o contexto atual para a IA
- A sugestão aparece como **ghost text** (texto em cor `--text-muted`, em itálico) após o cursor
- Pressionar `Tab`: aceita a sugestão completa
- Pressionar `→`: aceita palavra por palavra
- Pressionar `Esc` ou continuar digitando: descarta a sugestão

### 6.2 Contexto enviado para a IA

- Últimos 500 tokens escritos (contexto imediato)
- Título e categoria do post (para manter coerência temática)
- Idioma selecionado no Frontmatter

### 6.3 Segmento de Sugestão

- Sugestão de **até 2 frases** por ativação
- Sugestões de: continuação de parágrafo, conclusão de frase, tópico de lista

### 6.4 Indicador de Uso

- Badge no editor: "IA Ativa — [X tokens usados hoje / cota Y]"
- Quando cota atingida: ghost text desabilitado + tooltip "Cota de tokens atingida"

---

## 7. Agendamento de Publicação

- Campo "Data de publicação" no Frontmatter aceita datas futuras
- Post agendado: status `scheduled`, não visível no blog até a data
- No painel: lista de posts agendados com countdown
- Job de publicação: cron que publica automaticamente posts agendados

---

## 8. Histórico de Versões do Post

- A cada publicação ou save manual: snapshot do conteúdo salvo
- Tela de histórico: lista de versões com data, autor e resumo de mudanças
- Ação: Comparar versões (diff visual), Restaurar versão anterior
- Máximo de **50 versões** por post (as mais antigas são purgadas)

---

## 9. Suporte MDX Completo

### 9.1 Componentes Disponíveis no MDX

```mdx
<Callout type="info|warning|danger|success">
  Conteúdo do alerta
</Callout>

<CodeBlock language="typescript" filename="app.ts">
  // código aqui
</CodeBlock>

<ImageWithCaption 
  src="/caminho/imagem.webp" 
  alt="Descrição da imagem"
  caption="Legenda opcional"
/>

<Blockquote author="Autor" source="Fonte">
  Texto da citação
</Blockquote>
```

### 9.2 Syntax Highlighting

- Ferramenta: **Shiki** (tema alinhado ao Design System, fundo `--bg-elevated`)
- Linguagens suportadas: TypeScript, JavaScript, Python, Go, Rust, SQL, Shell, YAML, JSON, HTML, CSS, MDX e mais
- Linhas destacáveis: `{1,3-5}` na abertura do bloco
- Cópia de código com botão

---

## 10. Importação e Exportação

### 10.1 Exportar post

- Exportar como arquivo `.mdx` (markdown + frontmatter)
- Exportar como PDF (renderização do preview)

### 10.2 Importar conteúdo

- Importar arquivo `.md` ou `.mdx` existente
- Importar do WordPress (XML de exportação) — parsing básico de conteúdo e metadados
