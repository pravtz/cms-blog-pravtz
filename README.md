# Nexus CMS

A self-hosted, Docker-based CMS for editorial blogs with an MDX editor, RBAC, AI features, and a public SSG blog frontend.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

## Overview

Nexus CMS is a monorepo built with Next.js 14, TypeScript, SQLite, and Redis. It ships as a Docker Compose stack with everything required to run an editorial blog in production: an admin panel, a public SSG blog, a REST API v1, an MCP server, AI integrations, and a complete RBAC system.

## Features

- **MDX Editor** with split-view, live preview, frontmatter drawer, auto-save, and AI Ghost Writer autocomplete
- **Public SSG Blog** with home, feed, post pages, search, filters, and full SEO (Open Graph, JSON-LD, hreflang, sitemaps)
- **RBAC** — per-group and per-user permissions across every resource × operation
- **Authentication** — JWT (access + refresh), bcrypt, brute-force protection, audit trail
- **Comments, Likes, Shares** with moderation, voting, and anti-spam
- **Newsletter** with Double Opt-in and LGPD compliance
- **Multilingual posts** (pt-BR + EN) with hreflang and AI auto-translation
- **AI features** — Ghost Writer, Image Generator, Trends Analysis, Auto-translation (OpenAI / Anthropic)
- **Public REST API v1** — rate-limited, OpenAPI-documented
- **MCP server** — programmatic access for AI agents and external tools
- **7 themes** (Onyx, Emerald, Crimson, Slate, Amber, Rose, Violet) — all WCAG 2.1 AA certified
- **Storybook** with full component documentation and a11y addon
- **CI/CD** — lint, unit, integration, E2E, a11y, and security pipelines

## Architecture

```
nexus-cms/
├── apps/
│   ├── admin/         # Next.js 14 — admin panel + REST API + MCP
│   ├── blog/          # Next.js 14 — public SSG blog
│   └── e2e/           # Playwright E2E suite
├── packages/
│   ├── db/            # SQLite schema, migrations, queries
│   └── mcp-server/    # MCP server implementation
├── docker-compose.yml # Production stack (admin + blog + redis + nginx)
├── nginx/             # Reverse proxy config
└── docs/              # PRD and design docs
```

## Quick start

### Prerequisites

- Docker and Docker Compose
- Node.js >= 20 (for local development)

### Running with Docker

```bash
git clone <repo-url> nexus-cms
cd nexus-cms
cp .env.example .env
# Edit .env: set JWT_SECRET, JWT_REFRESH_SECRET, REDIS_PASSWORD, ENCRYPTION_KEY
# Generate secrets with: openssl rand -base64 64

docker compose up -d
```

Open `http://localhost` and complete the **First Run wizard** (Owner registration, DB selection, SMTP, blog identity).

### Local development

```bash
npm install
npm run dev          # starts admin (3001) and blog (3000) via Turbo
npm run typecheck
npm run lint
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright E2E
```

Storybook (admin components):

```bash
npm run storybook --workspace=apps/admin
```

## Configuration

All configuration is driven by `.env`. See `.env.example` for the full reference. Key variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys (64+ chars) |
| `REDIS_PASSWORD` | Redis auth |
| `ENCRYPTION_KEY` | AES-256-GCM key for sensitive settings (API keys, etc.) |
| `DATA_DIR` | SQLite + uploads volume mount |
| `BLOG_URL` | Public URL of the blog |
| `SMTP_*` | Email (optional, required for newsletter and notifications) |

## Testing

| Suite | Command | Stack |
|---|---|---|
| Unit | `npm test` | Vitest |
| Integration | `npm test --workspace=apps/admin` | Vitest + in-memory SQLite |
| E2E | `npm run test:e2e` | Playwright + PostgreSQL container + MailHog |
| A11y | `npm run test:e2e -- --grep a11y` | axe-core via Playwright |

## Documentation

- [PRD](docs/PRD.md) — full product requirements
- [CONTRIBUTING](CONTRIBUTING.md) — setup, branching, PR process
- [SECURITY](SECURITY.md) — responsible disclosure
- [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) — Contributor Covenant
- Storybook — published to GitHub Pages per release
- Admin panel `/admin/docs` — system documentation, editable per release
- Admin panel `/admin/c4` — C4 Model architecture diagrams

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for the responsible disclosure process. Do **not** open a public issue.

The application has been audited with OWASP ZAP and manually reviewed for OWASP Top 10. All responses include strict security headers (CSP, HSTS, X-Frame-Options DENY, nosniff). Free-text fields are sanitized server-side with DOMPurify.

## License

[MIT](LICENSE) © Nexus CMS Contributors
