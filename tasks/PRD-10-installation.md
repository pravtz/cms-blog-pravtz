# PRD-10 — Instalação, First Run e Configurações

**Projeto:** Nexus CMS  
**Módulo:** Installation & Setup  
**Versão:** 1.0 | 2026-04-04  

---

## 1. Pré-requisitos

| Requisito | Versão mínima |
|---|---|
| Docker | 24.0+ |
| Docker Compose | 2.20+ |
| Sistema operacional | Linux (produção recomendada), macOS, Windows (WSL2) |
| Memória RAM | 512MB mínimo, 1GB recomendado |
| Disco | 2GB livres para a instalação base |

---

## 2. Instalação

### 2.1 Passo a Passo

```bash
# 1. Clonar o repositório
git clone https://github.com/nexus-cms/nexus-cms.git
cd nexus-cms

# 2. Copiar e editar variáveis de ambiente
cp .env.example .env
# Editar o .env com: APP_SECRET, porta, etc.

# 3. Subir os containers
docker compose up -d

# 4. Acessar o painel para completar o First Run
# → http://localhost:3000/admin  (porta configurável no .env)
```

### 2.2 Arquivo `.env.example`

```env
# Aplicação
APP_SECRET=               # Chave secreta longa e aleatória (min 32 chars)
APP_PORT=3000
APP_URL=http://localhost:3000
BLOG_URL=http://localhost:3001

# Banco de Dados
DATABASE_TYPE=sqlite       # sqlite | postgres
DATABASE_URL=              # Somente se DATABASE_TYPE=postgres

# Redis
REDIS_URL=redis://redis:6379

# E-mail (configuração mínima para o First Run funcionar)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Storage (configurado via painel após First Run)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET=
# AWS_S3_REGION=
```

> Variáveis de storage e IA são configuradas pelo Owner via painel — não são necessárias no `.env`.

---

## 3. Fluxo de First Run (Wizard de Configuração)

Ao acessar o painel pela primeira vez (sem nenhum usuário Owner cadastrado), o sistema redireciona automaticamente para o wizard de configuração.

### Etapa 1 — Cadastro do Usuário Owner

```
┌─────────────────────────────────────────────┐
│  Bem-vindo ao Nexus CMS                     │
│  Configure o acesso do administrador        │
│                                             │
│  Nome completo: [________________]          │
│  Apelido:       [________________]          │
│  E-mail:        [________________]          │
│  Telefone:      [________________]          │
│  Senha:         [________________]          │
│  Confirmar:     [________________]          │
│                                             │
│              [ Continuar →]                 │
└─────────────────────────────────────────────┘
```

- Validações em tempo real
- Senha com indicador de força (fraca / média / forte)
- Este usuário recebe automaticamente o role `owner`

### Etapa 2 — Configuração do Banco de Dados

```
┌─────────────────────────────────────────────┐
│  Banco de Dados                             │
│                                             │
│  ○ SQLite (recomendado para início)         │
│    Simples, sem configuração adicional      │
│                                             │
│  ○ PostgreSQL                               │
│    URL de conexão: [_________________]      │
│    [ Testar conexão ]                       │
│                                             │
│  ← Voltar      [ Continuar →]               │
└─────────────────────────────────────────────┘
```

- SQLite selecionado por padrão
- PostgreSQL: campo de URL, botão de teste antes de prosseguir

### Etapa 3 — Configuração de E-mail

```
┌─────────────────────────────────────────────┐
│  Configuração de E-mail                     │
│  (Necessário para confirmações e alertas)   │
│                                             │
│  Host SMTP:  [________________]             │
│  Porta:      [587            ]              │
│  Usuário:    [________________]             │
│  Senha:      [________________]             │
│  E-mail de envio: [___________]             │
│                                             │
│  [ Enviar e-mail de teste ]                 │
│  Status: ●                                  │
│                                             │
│  ← Voltar      [ Continuar →]               │
└─────────────────────────────────────────────┘
```

- Botão "Enviar e-mail de teste" envia para o e-mail do Owner cadastrado na etapa 1
- Feedback imediato: sucesso (verde) ou erro (vermelho com mensagem)
- Prosseguir somente se teste bem-sucedido (ou Skip com aviso)

### Etapa 4 — Identidade do Blog

```
┌─────────────────────────────────────────────┐
│  Identidade do Blog                         │
│                                             │
│  Nome do blog: [___________________]        │
│  Tagline:      [___________________]        │
│                                             │
│  Logo (opcional):                           │
│  [  Arrastar imagem ou clique para upload ] │
│  Formatos: SVG, PNG, WebP — máx. 1MB       │
│                                             │
│  ← Voltar      [ Finalizar ✓]               │
└─────────────────────────────────────────────┘
```

- Nome do blog obrigatório
- Logo opcional — pode ser adicionado depois nas Configurações
- Preview em tempo real do logo carregado

### Etapa 5 — Conclusão

```
┌─────────────────────────────────────────────┐
│  ✓ Nexus CMS configurado com sucesso!       │
│                                             │
│  Próximos passos recomendados:              │
│  → Configure o storage de imagens           │
│  → Crie as primeiras categorias             │
│  → Escreva seu primeiro post                │
│  → Leia a documentação de boas práticas     │
│                                             │
│  [ Ir para o Dashboard ]                    │
└─────────────────────────────────────────────┘
```

---

## 4. Configurações do Sistema (Pós-Instalação)

Acessível em: Painel → Configurações  
Permissão: Owner (configurações sensíveis), Admin (configurações gerais)

### 4.1 Configurações Gerais (Admin+)

| Configuração | Tipo | Descrição |
|---|---|---|
| Nome do blog | texto | Exibido no header e SEO |
| Tagline | texto | Subtítulo do blog |
| Logo | imagem | Upload de logo (SVG/PNG/WebP) |
| Favicon | imagem | Upload de favicon (ICO/PNG 32x32) |
| Idioma padrão | select | `pt-BR` ou `en` |
| Fuso horário | select | Lista de timezones |
| Posts por página | número | Default: 20 |
| Moderação de comentários | toggle | On = comentários vão para revisão |
| Bio do Owner (para BioCard) | textarea | Exibida na Home |

### 4.2 Configurações de E-mail (Admin+)

| Configuração | Tipo |
|---|---|
| SMTP Host | texto |
| SMTP Porta | número |
| SMTP Usuário | texto |
| SMTP Senha | senha (mascarada) |
| E-mail de envio (From) | e-mail |
| Nome do remetente | texto |
| [ Testar configuração ] | botão |

### 4.3 Configurações de Storage (Owner only)

| Configuração | Provider |
|---|---|
| Provider | select: AWS S3 / Azure Blob |
| **AWS S3** | Access Key ID, Secret Access Key, Bucket Name, Região, CDN URL (opcional) |
| **Azure Blob** | Connection String, Container Name, CDN URL (opcional) |
| [ Testar conexão ] | botão |

### 4.4 Configurações de IA (Owner only)

Ver [PRD-08-ai-features.md](PRD-08-ai-features.md) — seção 2.

### 4.5 Configurações de Domínio e SSL

| Configuração | Descrição |
|---|---|
| Domínio público do blog | URL base para links canônicos e SEO |
| Domínio do painel administrativo | URL do admin |
| SSL | Gerenciado via Certbot no container nginx |

### 4.6 Variáveis Sensíveis (Owner only)

- Interface para inserir/atualizar tokens e API keys de integrações
- Funcionalidades bloqueadas exibem badge "Aguardando configuração"
- Lista de variáveis com status (configurado / não configurado) — sem exibir valores

---

## 5. Boas Práticas Recomendadas na Documentação

A documentação do sistema deve incluir e recomendar:

- Uso de senhas fortes e gerenciador de senhas
- Rotação periódica de `APP_SECRET` e tokens de integração
- Backup regular e teste de restauração
- Manter o sistema atualizado (notificações automáticas de nova versão)
- Configurar autenticação de dois fatores (feature futura)
- Usar HTTPS em produção (obrigatório)
- Limitar o acesso SSH ao servidor aos IPs necessários
- Monitorar o Audit Trail regularmente
- Revisar permissões de usuários a cada 3 meses
