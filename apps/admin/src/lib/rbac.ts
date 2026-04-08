/**
 * Role-Based Access Control helpers for Nexus CMS.
 *
 * v0.1 implements a static permission matrix.
 * US-13 will extend this with per-group and per-user overrides stored in the DB.
 */

export type Resource =
  | 'posts'
  | 'comments'
  | 'users'
  | 'groups'
  | 'permissions'
  | 'tags'
  | 'categories'
  | 'images'
  | 'newsletter'
  | 'metrics'
  | 'settings'
  | 'notifications'
  | 'ai'

export type Operation = 'read' | 'write' | 'delete' | 'manage'

/**
 * Static permission matrix for built-in roles.
 * 'owner' is handled separately (bypasses all checks).
 */
const ROLE_PERMISSIONS: Record<string, Partial<Record<Resource, Operation[]>>> = {
  admin: {
    posts: ['read', 'write', 'delete', 'manage'],
    comments: ['read', 'write', 'delete', 'manage'],
    users: ['read', 'write', 'manage'],
    groups: ['read', 'write', 'manage'],
    tags: ['read', 'write', 'delete', 'manage'],
    categories: ['read', 'write', 'delete', 'manage'],
    images: ['read', 'write', 'delete'],
    newsletter: ['read', 'write', 'manage'],
    metrics: ['read'],
    settings: ['read'],
    notifications: ['read'],
    ai: ['read', 'write'],
  },
  author: {
    posts: ['read', 'write', 'delete'],
    comments: ['read', 'write', 'delete'],
    tags: ['read', 'write'],
    categories: ['read'],
    images: ['read', 'write'],
    metrics: ['read'],
  },
  default: {
    posts: ['read'],
    comments: ['read'],
    tags: ['read'],
    categories: ['read'],
    images: ['read'],
  },
}

/**
 * Check whether a user with the given role can perform an operation on a resource.
 *
 * - 'owner' role bypasses all checks (always returns true).
 * - Unknown roles fall back to 'default' permissions.
 */
export function canPerform(
  role: string,
  resource: Resource,
  operation: Operation
): boolean {
  if (role === 'owner') return true

  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['default']!
  return permissions[resource]?.includes(operation) ?? false
}

/**
 * Check whether a user with the given role can create posts.
 * Convenience wrapper used in the posts API route.
 */
export function canCreatePost(role: string): boolean {
  return canPerform(role, 'posts', 'write')
}

/**
 * Check whether a user with the given role can manage users.
 */
export function canManageUsers(role: string): boolean {
  return canPerform(role, 'users', 'manage')
}
