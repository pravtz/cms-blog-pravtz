# PRD-03 — API Pública REST

**Projeto:** Nexus CMS  
**Módulo:** API Pública  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Visão Geral

A API pública do Nexus CMS expõe os conteúdos do blog para consumo externo (integrações, apps mobile, scripts, etc.). É restrita a operações de **leitura** (`GET`) de posts com `visibility: public`. Não expõe dados de usuários, rascunhos, posts privados ou informações administrativas.

### Princípios

- **Somente leitura:** nenhum endpoint de escrita, atualização ou exclusão
- **Segurança por padrão:** rate limiting, sanitização de outputs, sem exposição de dados sensíveis
- **Previsibilidade:** respostas consistentes, paginação padronizada, erros documentados
- **Boas práticas:** versionamento de API, status HTTP corretos, padrões REST

---

## 2. Arquitetura

- **Protocolo:** HTTPS obrigatório (HTTP redirecionado com 301)
- **Formato:** JSON (`Content-Type: application/json`)
- **Versionamento:** prefixo na URL — `/api/v1/`
- **Autenticação:** não requerida (API pública)
- **Base URL:** `https://{domínio}/api/v1`

---

## 3. Rate Limiting

### 3.1 Limites por IP

| Janela | Limite |
|---|---|
| 1 minuto | 60 requisições |
| 1 hora | 500 requisições |
| 1 dia | 2.000 requisições |

### 3.2 Headers de Rate Limit

Toda resposta inclui:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1712250060
```

### 3.3 Resposta ao Exceder o Limite

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Try again in 30 seconds.",
  "retryAfter": 30
}
```

---

## 4. Endpoints

### 4.1 Listar Posts

```
GET /api/v1/posts
```

**Parâmetros de query:**

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `page` | integer | 1 | Página atual |
| `limit` | integer | 20 | Itens por página (máx. 50) |
| `category` | string | — | Filtrar por categoria (slug) |
| `tag` | string | — | Filtrar por tag |
| `lang` | string | — | Filtrar por idioma (`pt-BR`, `en`) |
| `sort` | string | `date_desc` | Ordenação: `date_desc`, `date_asc`, `views_desc` |

**Exemplo de Request:**

```http
GET /api/v1/posts?category=tech&limit=10&page=2
```

**Resposta 200:**

```json
{
  "data": [
    {
      "slug": "meu-primeiro-post",
      "title": "Meu Primeiro Post",
      "subtitle": "Uma introdução ao Nexus CMS",
      "excerpt": "Neste artigo exploramos...",
      "date": "2025-03-12T10:00:00Z",
      "readingTime": 5,
      "coverImage": "https://cdn.example.com/images/post-cover.webp",
      "category": {
        "name": "Tech",
        "slug": "tech"
      },
      "tags": ["cms", "open-source"],
      "lang": "pt-BR",
      "views": 1234,
      "commentsCount": 8,
      "url": "https://blog.example.com/blog/meu-primeiro-post"
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 87,
    "totalPages": 9,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

### 4.2 Obter Post por Slug

```
GET /api/v1/posts/{slug}
```

**Parâmetros de path:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `slug` | string | Slug único do post |

**Resposta 200:**

```json
{
  "data": {
    "slug": "meu-primeiro-post",
    "title": "Meu Primeiro Post",
    "subtitle": "Uma introdução ao Nexus CMS",
    "excerpt": "Neste artigo exploramos...",
    "content": "...", 
    "date": "2025-03-12T10:00:00Z",
    "updatedAt": "2025-03-15T08:30:00Z",
    "readingTime": 5,
    "coverImage": "https://cdn.example.com/images/post-cover.webp",
    "category": {
      "name": "Tech",
      "slug": "tech"
    },
    "tags": ["cms", "open-source"],
    "lang": "pt-BR",
    "translations": [
      { "lang": "en", "slug": "my-first-post", "url": "https://blog.example.com/blog/my-first-post" }
    ],
    "views": 1234,
    "commentsCount": 8,
    "url": "https://blog.example.com/blog/meu-primeiro-post"
  }
}
```

> **Nota:** `content` é retornado como texto HTML sanitizado. Tags perigosas (`<script>`, `on*`) são removidas antes de incluir na resposta.

---

### 4.3 Listar Categorias

```
GET /api/v1/categories
```

**Resposta 200:**

```json
{
  "data": [
    {
      "name": "Tech",
      "slug": "tech",
      "postsCount": 32
    },
    {
      "name": "Design",
      "slug": "design",
      "postsCount": 18
    }
  ]
}
```

---

### 4.4 Listar Tags

```
GET /api/v1/tags
```

**Parâmetros de query:**

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `limit` | integer | 50 | Máx. de tags retornadas |

**Resposta 200:**

```json
{
  "data": [
    { "name": "React", "slug": "react", "postsCount": 12 },
    { "name": "TypeScript", "slug": "typescript", "postsCount": 9 }
  ]
}
```

---

## 5. Padrão de Erros

Todos os erros seguem o mesmo envelope:

```json
{
  "error": "not_found",
  "message": "Post with slug 'inexistente' not found.",
  "statusCode": 404
}
```

### 5.1 Códigos de Status Utilizados

| Status | Significado | Quando |
|---|---|---|
| `200 OK` | Sucesso | Leitura bem-sucedida |
| `400 Bad Request` | Parâmetro inválido | `limit=abc`, `page=-1` |
| `404 Not Found` | Recurso não encontrado | Slug inexistente ou post privado |
| `429 Too Many Requests` | Rate limit excedido | Ver seção 3 |
| `500 Internal Server Error` | Erro inesperado | Nunca expõe stack trace |

> Posts com `visibility != public` retornam **404** — não revelam a existência do conteúdo privado.

---

## 6. Segurança

### 6.1 Headers de Segurança

Toda resposta inclui:

```http
Content-Security-Policy: default-src 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

### 6.2 CORS

- `Access-Control-Allow-Origin: *` (API pública, qualquer origem pode consumir)
- Somente métodos `GET` e `OPTIONS` permitidos

### 6.3 Sanitização de Output

- HTML do campo `content`: processado com sanitizador (ex: DOMPurify server-side)
- Nenhum dado de usuário (e-mail, telefone, senha) exposto em nenhum endpoint
- Campos de e-mail de autor: **nunca** incluídos na resposta

### 6.4 Proteção contra Enumeração

- Posts privados retornam 404 (não 403) para não revelar existência
- IDs internos nunca expostos — somente slugs

---

## 7. Cache

- CDN cache: 60 segundos para listagens, 300 segundos para posts individuais
- `stale-while-revalidate`: 5 minutos
- Invalidação de cache ao publicar ou atualizar um post
- ETag suportado para cache condicional (`If-None-Match`)

---

## 8. Documentação

- Documentação interativa gerada automaticamente (OpenAPI 3.0 / Swagger)
- Disponível em: `/api/v1/docs`
- Atualizada a cada release do sistema
- Inclui: exemplos de request/response, descrição de campos, códigos de erro
