# E2E Context

## Scope

- `apps/e2e` contains Playwright coverage for end-to-end behavior across admin and blog.

## Commands

- Run suite: `npm run test:e2e --workspace=apps/e2e`
- UI mode: `npm run test:e2e:ui --workspace=apps/e2e`
- Debug: `npm run test:e2e:debug --workspace=apps/e2e`
- A11y subset: `npm run test:a11y --workspace=apps/e2e`

## Test Conventions

- Keep specs focused on user-observable flows.
- Extend existing helpers in `fixtures/helpers.ts` before duplicating setup logic.
- Prefer stable selectors and accessible roles over brittle CSS selectors.
- Add `@a11y` only for accessibility-targeted cases.
- If a product change affects registration, RBAC, comments, newsletter, or public post visibility, check whether an E2E scenario should be added or updated.
