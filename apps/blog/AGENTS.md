# Blog App Context

## Scope

- `apps/blog` is the public frontend on port `3000`.
- It renders the homepage, feed, post pages, newsletter flows, privacy page, and sitemap behavior.

## Commands

- Dev: `npm run dev --workspace=@nexus/blog`
- Typecheck: `npm run typecheck --workspace=@nexus/blog`
- Lint: `npm run lint --workspace=@nexus/blog`

## Working Rules

- Preserve SSG-friendly patterns and public-page performance.
- Keep public-facing changes SEO-safe:
  - metadata
  - structured content
  - sitemap behavior
  - accessibility
- Reuse existing component and CSS Module patterns under `src/components`.
- Avoid pulling admin-only utilities into the blog app unless already established.

## Code Conventions

- Prefer server components unless client interactivity is required.
- Keep route-level files in `src/app/**` minimal and push reusable UI into `src/components/**`.
- Use typed fetch helpers and existing lib utilities when available.
- Maintain accessible controls and visible focus states.
