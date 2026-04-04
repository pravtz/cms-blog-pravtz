# PRD-09 — Infraestrutura, Segurança e Observabilidade

**Projeto:** Nexus CMS  
**Módulo:** Infra & Security  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Infraestrutura

### 1.1 Containerização (Docker)

- Todo o sistema distribuído e executado via **Docker Compose**
- Containers previstos:

| Container | Responsabilidade |
|---|---|
| `app` | API + Painel Administrativo (Node.js/servidor) |
| `blog` | Build do site estático (gerado em build-time, servido via nginx/CDN) |
| `db` | SQLite (volume persistente) ou referência ao PostgreSQL externo |
| `redis` | Cache de queries e sessões |
| `nginx` | Reverse proxy, SSL termination, servir o blog estático |

- Variáveis de ambiente via `.env` — nunca commitadas no repositório
- `docker-compose.prod.yml` separado do `docker-compose.dev.yml`
- Health checks configurados em todos os containers
- Volumes nomeados para persistência de dados (banco, uploads locais em dev)

### 1.2 Banco de Dados

#### SQLite (Padrão)
- Arquivo de banco em volume Docker persistente
- WAL mode ativado (Write-Ahead Logging) para melhor concorrência
- Backup automático diário (dump para S3/Azure se configurado)
- Indicado para: instâncias com tráfego moderado (< 10k visitas/dia)

#### PostgreSQL (Opcional)
- Suportado como alternativa ao SQLite
- Configurado via variável de ambiente `DATABASE_URL`
- Migrações aplicadas com a mesma ferramenta (Prisma/Drizzle)
- Owner seleciona o banco no **First Run**

#### Migração SQLite → PostgreSQL
- Script de migração documentado no repositório
- Exporta dados do SQLite para SQL compatível com PostgreSQL
- Requer downtime mínimo (< 5 minutos)

### 1.3 Armazenamento de Mídia

| Provider | Configuração |
|---|---|
| **AWS S3** | Bucket, região, access key, secret key, CDN (CloudFront opcional) |
| **Azure Blob Storage** | Connection string, container name, CDN (Azure CDN opcional) |

- Imagens enviadas são **sempre convertidas para WebP** antes do upload (exceto SVG e GIF animado)
- Nomes de arquivo: UUID + extensão (evita colisão e não expõe nomes originais)
- Bucket/container configurado com acesso público de leitura apenas
- URLs de upload pre-signed (não expõe credenciais no frontend)
- Limpeza de imagens não referenciadas: job semanal (órfãos são movidos para quarentena por 30 dias antes de excluir)

### 1.4 Cache (Redis)

- Queries frequentes cacheadas: listagem de posts, categorias, tags
- TTL padrão: 60 segundos para listagens, 300 segundos para posts individuais
- Invalidação: ao publicar, editar ou excluir post, cache do item é invalidado
- Sessões de usuário (refresh tokens ativos): armazenados no Redis com TTL de 7 dias
- Rate limiting: contadores de requisição por IP armazenados no Redis

---

## 2. Segurança — Camadas de Proteção

### 2.1 Autenticação e Sessões

Detalhado em [PRD-04-auth-rbac.md](PRD-04-auth-rbac.md). Resumo:

- JWT com expiração de 15 minutos
- Refresh Token em httpOnly cookie (7 dias)
- Rotação de refresh token a cada uso
- Bloqueio de IP após 5 tentativas falhas de login em 15 minutos

### 2.2 Proteção contra Injeção (XSS, SQL Injection)

#### XSS
- Conteúdo MDX sanitizado com DOMPurify server-side antes de armazenar **e** antes de renderizar
- Tags proibidas: `<script>`, `<iframe>`, `<object>`, `<embed>` e todos os atributos `on*`
- Sanitização aplicada a: conteúdo de posts, comentários, bio de usuários, todos os campos de texto livre
- Headers HTTP: `Content-Security-Policy` restritivo (sem `unsafe-inline`)

#### SQL Injection
- Uso exclusivo de **prepared statements / ORM** — zero SQL concatenado
- Validação de todos os inputs com schema validation (Zod ou equivalente)
- Parâmetros de query (page, limit, filtros) validados e sanitizados antes de usar

#### CSRF
- Tokens CSRF em formulários do painel administrativo
- Cookie `SameSite=Strict` para o refresh token
- Headers `Origin` e `Referer` validados nas requisições de estado

### 2.3 Headers de Segurança HTTP

Configurados no nginx/servidor para **todas** as responses:

```nginx
add_header X-Content-Type-Options      "nosniff" always;
add_header X-Frame-Options             "DENY" always;
add_header X-XSS-Protection            "1; mode=block" always;
add_header Strict-Transport-Security   "max-age=31536000; includeSubDomains; preload" always;
add_header Referrer-Policy             "strict-origin-when-cross-origin" always;
add_header Permissions-Policy          "geolocation=(), microphone=(), camera=()" always;
add_header Content-Security-Policy     "default-src 'self'; img-src 'self' https://cdn.example.com; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com;" always;
```

### 2.4 Variáveis Sensíveis

- Todas as variáveis sensíveis (tokens, API keys, SMTP credentials) inseridas pelo Owner via interface
- **Nunca armazenadas em texto claro** — criptografadas com AES-256-GCM, chave derivada de `APP_SECRET` no `.env`
- Nunca retornadas em API responses — somente status (configurado / não configurado)
- `.env` nunca commitado — `.env.example` com todas as variáveis necessárias (sem valores)
- Rotação de secrets: Owner pode revogar e inserir nova key a qualquer momento

### 2.5 Rate Limiting

| Endpoint | Limite | Janela |
|---|---|---|
| API pública (`/api/v1/*`) | 60 req | 1 minuto |
| Login (`/api/auth/login`) | 5 tentativas | 15 minutos |
| Cadastro (`/api/auth/register`) | 3 req | 1 hora |
| Confirmar e-mail | 3 req | 1 hora |
| Newsletter inscrição | 3 req | 1 hora |
| Upload de imagem | 20 uploads | 1 hora |

- Implementado via Redis (sliding window algorithm)
- Headers de rate limit incluídos em todas as responses (ver PRD-03)

### 2.6 Upload de Arquivos

- Validação de MIME type real (não apenas extensão — leitura do magic bytes)
- Tamanho máximo configurável (padrão: 10MB por imagem)
- Quarentena de arquivo antes de processar: nunca executa arquivo enviado
- Imagens processadas com Sharp (redimensionamento + conversão WebP) em container isolado
- Arquivos não-imagem: bloqueados no upload de mídia do blog

### 2.7 Proteção contra Enumeração

- Usuários não-encontrados e e-mails não-cadastrados retornam a mesma mensagem genérica
- Posts privados retornam 404 (não 403)
- IDs internos não expostos em URLs ou responses — somente slugs e UUIDs públicos

---

## 3. HTTPS e Certificados

- HTTPS **obrigatório** em produção (HTTP → 301 para HTTPS)
- Certificado: Let's Encrypt via Certbot (integrado ao docker-compose de produção)
- Renovação automática configurada
- HSTS com `preload` ativado após setup inicial

---

## 4. Observabilidade

### 4.1 Microsoft Clarity

- Script de integração injetado no `<head>` do blog público (não no painel administrativo)
- Habilitado somente para usuários não-logados (respeito à privacidade dos usuários cadastrados)
- Configurável: Owner pode desativar nas configurações

### 4.2 Logs do Sistema

- Logs estruturados em JSON para todos os serviços
- Níveis: `error`, `warn`, `info`, `debug`
- Logs de erro: stack trace, request id, user id, timestamp
- Rotação de logs: 30 dias de retenção padrão
- Logs de acesso do nginx: formato combinado + rotação diária

### 4.3 Health Checks

- Endpoint: `GET /api/health`
- Resposta:

```json
{
  "status": "ok",
  "version": "1.2.3",
  "db": "ok",
  "redis": "ok",
  "storage": "ok",
  "timestamp": "2026-04-04T10:00:00Z"
}
```

- Utilizado pelo Docker health check e por monitoramento externo

### 4.4 Alertas (via Integrações de Notificação)

Eventos que disparam alerta para o canal configurado (Teams/Slack/Discord/e-mail):

- Erro 500 repetido (mais de 5 em 1 minuto)
- Tentativas de login suspeitas (bloqueio de IP ativado)
- Falha no envio de e-mail
- Uso de storage próximo do limite configurado
- Certificado SSL expirando em menos de 14 dias

---

## 5. Backup

### 5.1 Banco de Dados

- Backup automático diário às 03:00 (fuso configurável)
- SQLite: dump completo `.sql.gz` enviado para S3/Azure
- PostgreSQL: `pg_dump` + compressão, enviado para S3/Azure
- Retenção: 30 backups diários, 12 backups mensais
- Verificação de integridade: hash SHA-256 do backup gerado e armazenado separadamente

### 5.2 Mídias

- S3/Azure já proveem redundância por padrão
- Habilitar versionamento no bucket (proteção contra deleção acidental)
- Cross-region replication recomendada para produção crítica

### 5.3 Restauração

- Script de restauração documentado e testado
- Procedimento de DR (Disaster Recovery) descrito na documentação do sistema

---

## 6. Atualizações do Sistema

- Sistema verifica nova versão ao inicializar (ping para repositório GitHub)
- Badge de "Nova versão disponível" no painel (Owner vê primeiro)
- Processo de atualização via Docker: `docker compose pull && docker compose up -d`
- Migrações de banco aplicadas automaticamente no startup (com rollback seguro)
- Changelog visível na tela de Releases antes de atualizar
