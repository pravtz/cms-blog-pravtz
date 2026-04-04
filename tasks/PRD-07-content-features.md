# PRD-07 — Comentários, Newsletter, Multilinguagem e Compartilhamento

**Projeto:** Nexus CMS  
**Módulo:** Content Features  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Sistema de Comentários

### 1.1 Visão Geral

O sistema de comentários promove discussão qualificada em torno dos posts. Herda as permissões de visibilidade do post pai e requer login para interação.

### 1.2 Modelo de Dados

```
Comment {
  id: UUID
  postId: UUID (FK posts)
  parentId: UUID? (FK comments — para threads)
  authorId: UUID (FK users)
  content: text (max 2000 chars)
  status: visible | hidden | flagged
  upvotes: integer
  downvotes: integer
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 1.3 Permissões de Visualização

- Comentários herdam **exatamente** a visibilidade do post pai
- Um post `groupPrivate` → comentários visíveis somente para o mesmo grupo
- Um post `public` → comentários visíveis para todos (incluindo não logados)
- Ações de like/dislike e escrever comentário: **somente usuários logados e aprovados**

### 1.4 Fluxo de Comentário

1. Usuário logado clica em "Comentar" no post
2. Exibe textarea com contador de caracteres (máx. 2000)
3. Botão "Publicar comentário" envia para moderação ou publica direto (configurável por admin)
4. Se moderação ativa: status `pending` até aprovação do admin
5. Notificação para o autor do post quando novo comentário aprovado

### 1.5 Threads (Respostas)

- Cada comentário pode ter respostas diretas (um nível de profundidade na UI)
- Botão "Responder" exibe textarea inline abaixo do comentário
- Thread exibida como bloco indentado com linha vertical colorida (`--accent`)
- Colapsar/expandir threads longas (+5 respostas)

### 1.6 Sistema de Votação

| Ação | Usuário logado | Usuário não logado |
|---|---|---|
| Visualizar contagem | ✓ | ✓ |
| Upvote (positivo) | ✓ | ✗ → modal login |
| Downvote (negativo) | ✓ | ✗ → modal login |

- Um usuário pode votar **uma vez** por comentário
- Trocar o voto: clicar no voto ativo remove, clicar no oposto troca
- Votos anônimos não são aceitos — cada voto vinculado a um `userId`
- Contagem visível: `+12 / -3`

### 1.7 Moderação no Painel

- Status dos comentários: `visible`, `hidden`, `flagged`
- Usuário pode **reportar** um comentário (status → `flagged`, notificação ao admin)
- Admin pode: ocultar, excluir, restaurar
- Comentários ocultos: não aparecem no blog mas mantêm contagem no painel

### 1.8 Notificações

- Autor do post notificado (pelo canal de notificação configurado) quando:
  - Novo comentário publicado no seu post
  - Novo voto no post
- Usuário notificado quando:
  - Alguém responde ao seu comentário

---

## 2. Newsletter

### 2.1 Visão Geral

Sistema de captação de e-mails com compliance total de privacidade. Sem opções de inscrição silenciosa — o usuário sempre confirma ativamente.

### 2.2 Fluxo Completo (Double Opt-in)

```
[1] Usuário preenche e-mail no NewsletterCard do blog
[2] Marca checkbox obrigatório de privacidade
[3] Clica em "Inscrever-se"
[4] Validação de formato de e-mail
[5] Verificação se e-mail já está cadastrado
    → Se já ativo: exibe "Você já está inscrito!"
    → Se já pendente: reenvio do e-mail de confirmação
    → Se novo: continua o fluxo
[6] Token único gerado (UUID v4, expira em 48h)
[7] E-mail de confirmação enviado:
    - Assunto: "Confirme sua inscrição em {Blog Name}"
    - Corpo: nome do blog, botão "Confirmar inscrição", link textual alternativo
    - Token na URL: https://blog.com/newsletter/confirm?token=...
[8] Usuário clica no link de confirmação
[9] Token validado (não expirado, não usado)
[10] Status da inscrição: pending → active
[11] Página de confirmação: "Inscrição confirmada! Boas-vindas."
[12] E-mail de boas-vindas opcional (configurável pelo admin)
```

### 2.3 Modelo de Dados

```
NewsletterSubscriber {
  id: UUID
  email: string (unique)
  status: pending | active | unsubscribed
  confirmationToken: string?
  tokenExpiresAt: timestamp?
  confirmedAt: timestamp?
  subscribedAt: timestamp
  unsubscribedAt: timestamp?
  source: string (slug do post onde se inscreveu)
  ipAddress: string (do momento da inscrição — para auditoria)
}
```

### 2.4 Cancelamento de Inscrição (Unsubscribe)

- Link de descadastro em **todos** os e-mails enviados (obrigatório por LGPD/GDPR)
- URL: `https://blog.com/newsletter/unsubscribe?token=...`
- Processo: um clique, sem formulário, sem confirmação adicional
- Após descadastro: e-mail de confirmação de remoção enviado
- Status atualizado para `unsubscribed` (não deletado — para auditoria)
- Re-inscrição: possível, passa pelo fluxo Double Opt-in novamente

### 2.5 Privacidade e Compliance

- Checkbox de privacidade com link para a Política de Privacidade
- Política de Privacidade: página pública do blog (`/privacidade`)
- Dados coletados e armazenados: somente e-mail, IP (auditoria) e data
- Nenhum dado de comportamento vinculado ao e-mail sem consentimento explícito
- Direito ao esquecimento: opção de excluir dados no painel (Owner)

---

## 3. Multilinguagem

### 3.1 Idiomas Suportados

| Código | Nome |
|---|---|
| `pt-BR` | Português (Brasil) |
| `en` | English |

> Sistema preparado para adicionar novos idiomas em futuras versões.

### 3.2 Modelo de Vinculação

- Posts em idiomas diferentes são **entidades separadas** no banco
- Vinculados pelo campo `translationGroupId` (UUID compartilhado entre as versões)
- Cada versão tem seu próprio `slug`, `title`, `content`, `frontmatter`

```
Post A (pt-BR) ─── translationGroupId: "xyz" ─── Post B (en)
```

### 3.3 Interface de Troca de Idioma (Blog Público)

- Exibido somente quando o post tem versão em outro idioma
- Local: `ArticleHeader`, linha de metadados
- Visual: toggle com flag + código do idioma (ex: `🇧🇷 PT-BR | 🇺🇸 EN`)
- Idioma atual destacado, outro clicável
- Ao clicar: navegação para o slug do post no outro idioma
- Se não houver versão: toggle desabilitado + tooltip "Sem versão em inglês"

### 3.4 No Editor MDX

- Campo "Idioma" no FrontmatterDrawer
- Campo "Post vinculado" (search por título): para linkar a tradução manual
- Badge no painel indicando se o post tem versão em outro idioma

### 3.5 SEO Multilinguagem

```html
<!-- Na <head> de cada versão do post -->
<link rel="alternate" hreflang="pt-BR" href="https://blog.com/blog/meu-post" />
<link rel="alternate" hreflang="en"    href="https://blog.com/blog/my-post" />
<link rel="alternate" hreflang="x-default" href="https://blog.com/blog/meu-post" />
```

---

## 4. Compartilhamento

### 4.1 Canais Disponíveis

| Canal | Método |
|---|---|
| **WhatsApp** | URL scheme: `https://wa.me/?text={título}%20{url}` |
| **LinkedIn** | URL scheme: `https://www.linkedin.com/sharing/share-offsite/?url={url}` |
| **Instagram** | Cópia de link + instrução (API não suporta sharing direto) |
| **Copiar link** | Clipboard API (`navigator.clipboard.writeText`) |

> Instagram: ao clicar, copia o link e exibe tooltip "Link copiado! Cole no Instagram." — comportamento padrão do mercado.

### 4.2 UI do Compartilhamento

- Ícone de compartilhamento no Card do Post
- Ao clicar: dropdown com lista de canais (ícones SVG + labels)
- Também disponível na página do post (`ArticleHeader`) e na `RecommendationSection`

### 4.3 Contagem e Registro

- Contagem de compartilhamentos: visível para **todos** (logados e não logados)
- **Registrar** o compartilhamento (para contagem): somente usuários logados
- Usuários não logados podem abrir o dropdown e usar os links, mas a contagem não incrementa
- Prevenção de spam: máximo de 1 registro por usuário por post por hora

### 4.4 Metadata Open Graph (para compartilhamento nas redes)

Em cada post:

```html
<meta property="og:title"       content="{title}" />
<meta property="og:description" content="{excerpt}" />
<meta property="og:image"       content="{coverImage ou imagem padrão do blog}" />
<meta property="og:url"         content="{url canônica}" />
<meta property="og:type"        content="article" />
<meta property="og:site_name"   content="{Blog Name}" />
<meta name="twitter:card"       content="summary_large_image" />
<meta name="twitter:title"      content="{title}" />
<meta name="twitter:description" content="{excerpt}" />
<meta name="twitter:image"      content="{coverImage}" />
```

---

## 5. Sistema de Likes dos Posts

### 5.1 Comportamento

- Ícone de coração no Card e na página do post
- Contagem visível para todos
- Ação (curtir/descurtir): somente usuários logados
- Usuário não logado clica: modal/tooltip "Faça login para curtir"
- Estado visual: coração outline (não curtido) → preenchido (curtido)
- Animação ao curtir: pulse suave no ícone

### 5.2 Regras de Negócio

- 1 like por usuário por post (toggle: curtir/descurtir)
- Atualização otimista (UI atualiza antes da confirmação do servidor)
- Rollback se o servidor retornar erro
