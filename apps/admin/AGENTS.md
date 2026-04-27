# Admin App Context

## Scope

- `apps/admin` is the operational core of the product.
- It contains:
  - Next.js admin UI on port `3001`
  - authenticated and public API routes
  - setup flow
  - RBAC, audit, newsletter, comments, AI and content management features

## Commands

- Dev: `npm run dev --workspace=@nexus/admin`
- Test: `npm run test --workspace=@nexus/admin`
- Coverage: `npm run test:coverage --workspace=@nexus/admin`
- Typecheck: `npm run typecheck --workspace=@nexus/admin`
- Lint: `npm run lint --workspace=@nexus/admin`
- Storybook: `npm run storybook --workspace=@nexus/admin`

## File Layout

- App routes and pages: `src/app/**`
- API routes: `src/app/api/**`
- Shared server/client utilities: `src/lib/**`
- Components: `src/components/**`
- Tests: `src/__tests__/**`

## API Route Rules

- Routes using Node APIs, DB, JWT, bcrypt, filesystem, or mail should export:
  - `export const runtime = 'nodejs'`
  - `export const dynamic = 'force-dynamic'`
- Private routes should use helpers from `@/lib/auth-middleware`.
- Public `v1` routes should apply rate limiting and response headers from `@/lib/v1-helpers`.
- Validate request bodies and query params with `zod`.
- Return `404` instead of `403` when hiding private resource existence matters.
- Never return raw secrets, tokens, hashes, or API keys.

## Database Rules

- SQLite access goes through `src/lib/db.ts`.
- Add migrations in `runMigrations()` using sequential names.
- Mirror each new migration in `src/__tests__/helpers/db.ts`.
- Use prepared statements and transactions for multi-step writes.
- Avoid `getDb()` at module top level outside DB helpers so tests can mock it.

## UI Rules

- Use CSS Modules only.
- Reuse existing design tokens and patterns from the current admin UI.
- Preserve accessibility behavior: focus states, keyboard support, dialog semantics, table headers, labels.

## Testing Rules

- Unit and integration tests live under `src/__tests__`.
- Integration tests use the in-memory SQLite helper and should mock `@/lib/db` before importing the route under test.
- Auth or RBAC changes should include both behavior and permission coverage.
