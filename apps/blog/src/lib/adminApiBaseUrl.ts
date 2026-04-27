/**
 * Admin API base URL for browser calls (session, comments, likes, etc.).
 * Prefer `<meta name="nexus-admin-api" content="...">` from the document so split-port
 * E2E and dev servers always match the runtime env, even if NEXT_PUBLIC_* was not
 * present when the client bundle was first compiled.
 */
export function getAdminApiBaseUrl(): string {
  if (typeof document !== 'undefined') {
    const fromMeta = document.querySelector('meta[name="nexus-admin-api"]')?.getAttribute('content')
    if (fromMeta?.trim()) {
      return fromMeta.trim().replace(/\/$/, '')
    }
  }
  return (process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001').replace(/\/$/, '')
}
