# Contributing to Nexus CMS

Thank you for your interest in contributing to Nexus CMS! This document outlines the process for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Test Requirements](#test-requirements)
- [Commit Messages](#commit-messages)

## Development Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm 10+

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/nexus-cms.git
   cd nexus-cms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure it:
   ```bash
   cp .env.example .env
   ```

4. Start the full stack with Docker Compose:
   ```bash
   docker compose up -d
   ```

5. Or run in development mode (without Docker):
   ```bash
   # Start admin (port 3001)
   npm run dev --workspace=@nexus/admin

   # Start blog (port 3000)
   npm run dev --workspace=@nexus/blog
   ```

6. Access the First Run wizard at `http://localhost:3001/admin/setup` to configure your local instance.

### Running Tests

```bash
# Unit and integration tests
npm run test --workspace=@nexus/admin

# Tests with coverage
npm run test:coverage --workspace=@nexus/admin

# E2E tests (requires running stack)
npm run test --workspace=@nexus/e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Branching Strategy

We use a feature-branch workflow:

- `main` — stable, production-ready code. Direct pushes are not allowed.
- `feat/<description>` — new features (e.g., `feat/comment-moderation`)
- `fix/<description>` — bug fixes (e.g., `fix/login-redirect-loop`)
- `chore/<description>` — maintenance tasks (e.g., `chore/update-deps`)
- `docs/<description>` — documentation changes (e.g., `docs/api-reference`)

Branch from `main`:
```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

## Pull Request Process

1. **Open a draft PR early** to share your approach before investing heavily.
2. Ensure your branch is up to date with `main` before requesting review:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
3. Fill out the PR template completely, including:
   - Summary of changes
   - Related issue(s)
   - Test plan
   - Screenshots for UI changes
4. All CI checks must pass before requesting review.
5. At least one maintainer approval is required to merge.
6. Squash-merge is preferred to keep `main` history clean.
7. Delete your branch after merging.

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] Tests added or updated for all changed behavior
- [ ] TypeScript types are correct (no `any` unless justified)
- [ ] No new ESLint errors or warnings
- [ ] Documentation updated if needed
- [ ] Migrations use `IF NOT EXISTS` patterns
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Security headers and rate limiting preserved on new API routes

## Coding Standards

### General

- **TypeScript** — all code must be typed; avoid `any` unless absolutely necessary and clearly commented.
- **ESLint** — follow the project ESLint config; do not suppress rules without justification.
- **CSS Modules** — use co-located `.module.css` files for component styles.
- **Design tokens** — use CSS custom properties (`--bg-primary`, `--accent`, etc.) rather than hard-coded colors or sizes.

### File Organization

- API routes live in `apps/admin/src/app/api/`
- Shared utilities live in `apps/admin/src/lib/`
- React components live in `apps/admin/src/components/<ComponentName>/` with a co-located CSS module
- Export components from the barrel file `apps/admin/src/components/index.ts`
- Blog-specific components live in `apps/blog/src/components/`

### API Routes

- All routes that use native Node modules require `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- Use `requireAuth()` or `requireRole()` from `lib/auth-middleware.ts` for protected routes.
- Apply `applyRateLimit()` and `handleOptions()` from `lib/v1-helpers.ts` on all public v1 API routes.
- Always include security headers via `buildV1Headers()` on public API responses.
- Return `404` for private resources (not `403`) to avoid enumeration.

### Database

- Add new migrations to `apps/admin/src/lib/db.ts` in `runMigrations()`.
- Always use `IF NOT EXISTS` and `ON CONFLICT DO UPDATE` patterns.
- When adding a migration, also add it to `apps/admin/src/__tests__/helpers/db.ts` so integration tests stay in sync.

### Accessibility

- All interactive elements must have visible focus styles (`:focus-visible`).
- Table `<th>` elements must have `scope="col"` or `scope="row"`.
- Modals must implement focus trapping and close on Escape.
- ARIA attributes: `aria-expanded`, `aria-live`, `aria-current`, `role="dialog"` + `aria-labelledby`.
- Screen-reader-only text: use the `.sr-only` utility class.

### Security

- Never return sensitive values (API keys, tokens) in API responses; use `maskApiKey()`.
- Sanitize all user-generated content with `sanitize-html` or `DOMPurify` before storage.
- Use `bcrypt` with cost factor 12 for password hashing.
- API keys stored with AES-256-GCM encryption.

## Test Requirements

All contributions must include appropriate tests:

| Change type | Required tests |
|---|---|
| New utility function | Unit test in Vitest |
| New API route | Integration test with Supertest |
| Auth/RBAC change | Unit + integration tests |
| New UI component | Storybook story + a11y check |
| Critical user flow | Playwright E2E test |

### Coverage Targets

- Auth and RBAC logic: 90%+ line coverage
- New utility modules: 80%+ line coverage

### Integration Tests

Integration tests use an in-memory SQLite database via `createTestDb()` in `apps/admin/src/__tests__/helpers/db.ts`. Mock `@/lib/db` with `vi.mock()` — never call `getDb()` directly in test setup.

### E2E Tests

E2E tests live in `apps/e2e/` and use Playwright with MailHog for email capture and a PostgreSQL container. Tag tests with `@a11y` for accessibility-specific tests.

## Continuous Integration

Every pull request to `main` runs the full CI pipeline (`.github/workflows/ci.yml`). All jobs must pass before a PR can be merged.

| Job | What it runs | Required |
|---|---|---|
| `lint` | `npm run lint` (ESLint via `next lint`) | yes |
| `typecheck` | `npm run typecheck` (`tsc --noEmit`) | yes |
| `test-unit` | Vitest on `apps/admin/src/__tests__/unit` | yes |
| `test-integ` | Vitest on `apps/admin/src/__tests__/integration` (in-memory SQLite) | yes |
| `test-e2e` | Playwright (excludes `@a11y`) | yes |
| `test-a11y` | Playwright `@a11y` (axe-core, zero AA violations) | yes |
| `build` | `docker compose build` for all services | yes |
| `ci-success` | Aggregate gate that fails if any of the above fail | yes |

Configure branch protection on `main` to require the `CI Success` check. The aggregator job also fails on cancellation, preventing accidental "skipped" merges.

The OWASP ZAP baseline scan runs only on tagged releases (`.github/workflows/security.yml`) and on manual `workflow_dispatch`. It boots the full Docker Compose stack and fails on any high-severity findings.

## Commit Messages

Use the conventional commit format:

```
<type>: <short summary>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `perf`, `ci`

Examples:
```
feat: [US-46] - open-source community files
fix: correct token expiry calculation in auth refresh
docs: update API route documentation
```

Keep the summary under 72 characters. Reference issues in the footer:
```
Closes #42
```
