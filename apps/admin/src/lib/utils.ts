/**
 * Shared utility functions used across API routes and tests.
 */

/**
 * Convert a string to a URL-safe slug.
 * Handles accented characters via NFD normalization.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/**
 * Generate a unique slug by appending a base-36 timestamp suffix.
 */
export function uniqueSlug(base: string): string {
  const suffix = Date.now().toString(36)
  return base ? `${base}-${suffix}` : suffix
}

/**
 * Calculate estimated reading time in minutes (words ÷ 200, minimum 1).
 */
export function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * Determine whether a post with the given visibility level should be
 * accessible to a user with the given role.
 *
 * For v0.1:
 * - 'public'      → always visible
 * - 'iPrivate'    → only the owner role (author-level check handled separately)
 * - everything else requires at least an authenticated (non-null) role
 */
export function isVisibleTo(
  visibility: string,
  userRole: string | null
): boolean {
  if (visibility === 'public') return true
  if (visibility === 'iPrivate') return userRole === 'owner'
  // allPrivate / groupPrivate / listPrivate require authentication
  return userRole !== null
}
