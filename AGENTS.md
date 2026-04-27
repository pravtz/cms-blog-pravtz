# Nexus CMS Codex Context

## Repository Shape

- Monorepo with npm workspaces and Turbo.
- Main apps:
  - `apps/admin` - Next.js 14 admin panel, authenticated APIs, setup flow, RBAC, AI features.
  - `apps/blog` - Next.js 14 public blog frontend.
  - `apps/e2e` - Playwright end-to-end coverage.
  - `packages/mcp-server` - standalone MCP server package.
- Product and planning docs live in `docs/` and `tasks/`.

## Core Stack

- Node.js 20+, npm 10+, TypeScript.
- Next.js 14 App Router.
- SQLite through `better-sqlite3` in admin.
- Redis through `ioredis`.
- Validation with `zod`.
- Auth with JWT and `bcryptjs`.

## Commands

- Install: `npm install`
- Monorepo dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- E2E: `npm run test:e2e`

## Working Rules

- Prefer `rg` for searches.
- Respect existing user changes in a dirty worktree; do not revert unrelated edits.
- Keep changes scoped to the target app or package.
- Prefer small, typed changes over broad refactors.
- Do not introduce secrets in code or docs; configuration belongs in `.env`.

## Code Standards

- Avoid `any`; prefer explicit types or `unknown` with narrowing.
- Validate external input with `zod`.
- Use ESM imports and `import type` where appropriate.
- Follow existing CSS Modules patterns; do not introduce Tailwind or inline layout styling.
- Use existing design tokens instead of hard-coded colors, spacing, or radii.

## Testing Expectations

- Behavior changes should come with appropriate tests.
- Admin backend changes usually require Vitest coverage in `apps/admin/src/__tests__`.
- Cross-app flows or regressions may require Playwright coverage in `apps/e2e/tests`.

## Subdirectory Guidance

- Read the nearest `AGENTS.md` before editing inside:
  - `apps/admin/AGENTS.md`
  - `apps/blog/AGENTS.md`
  - `apps/e2e/AGENTS.md`
  - `packages/mcp-server/AGENTS.md`
