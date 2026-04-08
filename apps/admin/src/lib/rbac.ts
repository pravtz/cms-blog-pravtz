/**
 * Role-Based Access Control helpers for Nexus CMS.
 *
 * Permission resolution hierarchy (per US-13):
 *   1. owner role → always true (bypasses all checks)
 *   2. Individual user_permissions → override group permissions
 *   3. Any user group grants it → true (highest-privilege-group wins)
 *   4. Default group permissions (system-seeded or static fallback)
 */

import type Database from 'better-sqlite3'

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

export const ALL_RESOURCES: Resource[] = [
  'posts', 'comments', 'users', 'groups', 'permissions',
  'tags', 'categories', 'images', 'newsletter', 'metrics',
  'settings', 'notifications', 'ai',
]

export const ALL_OPERATIONS: Operation[] = ['read', 'write', 'delete', 'manage']

/** Human-readable labels for the permission matrix UI */
export const RESOURCE_LABELS: Record<Resource, string> = {
  posts: 'Posts',
  comments: 'Comments',
  users: 'Users',
  groups: 'Groups',
  permissions: 'Permissions',
  tags: 'Tags',
  categories: 'Categories',
  images: 'Images',
  newsletter: 'Newsletter',
  metrics: 'Metrics',
  settings: 'Settings',
  notifications: 'Notifications',
  ai: 'AI',
}

export const OPERATION_LABELS: Record<Operation, string> = {
  read: 'View',
  write: 'Create / Edit',
  delete: 'Delete',
  manage: 'Manage',
}

/**
 * Static permission matrix for built-in roles.
 * Used as a fallback when no DB is available (tests, static checks).
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
 * Uses static role matrix only (no DB). Kept for backward compatibility and tests.
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
 * DB-aware permission check.
 * Resolution order:
 *   1. owner role → always true
 *   2. Individual user_permissions (explicit allow or deny)
 *   3. Group permissions for the user's groups (any allow = true)
 *   4. Default group permissions (group_id = 'group-default')
 *   5. Static role fallback (canPerform)
 */
export function resolvePermission(
  db: Database.Database,
  userId: string,
  role: string,
  resource: Resource,
  operation: Operation
): boolean {
  if (role === 'owner') return true

  // 1. Individual user permission override
  const individualPerm = db
    .prepare(
      'SELECT allowed FROM user_permissions WHERE user_id = ? AND resource = ? AND operation = ?'
    )
    .get(userId, resource, operation) as { allowed: number } | undefined

  if (individualPerm !== undefined) {
    return individualPerm.allowed === 1
  }

  // 2. User's group permissions (any group allowing = grant)
  const groupPerm = db
    .prepare(`
      SELECT gp.allowed
      FROM group_permissions gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = ? AND gp.resource = ? AND gp.operation = ?
      ORDER BY gp.allowed DESC
      LIMIT 1
    `)
    .get(userId, resource, operation) as { allowed: number } | undefined

  if (groupPerm !== undefined) {
    return groupPerm.allowed === 1
  }

  // 3. Default group permissions
  const defaultPerm = db
    .prepare(
      "SELECT allowed FROM group_permissions WHERE group_id = 'group-default' AND resource = ? AND operation = ?"
    )
    .get(resource, operation) as { allowed: number } | undefined

  if (defaultPerm !== undefined) {
    return defaultPerm.allowed === 1
  }

  // 4. Static role fallback
  return canPerform(role, resource, operation)
}

/**
 * Get the full effective permission matrix for a user (all resources × operations).
 * Returns a nested map: resource → operation → boolean.
 */
export function getEffectivePermissions(
  db: Database.Database,
  userId: string,
  role: string
): Record<Resource, Record<Operation, boolean>> {
  const result = {} as Record<Resource, Record<Operation, boolean>>
  for (const resource of ALL_RESOURCES) {
    result[resource] = {} as Record<Operation, boolean>
    for (const operation of ALL_OPERATIONS) {
      result[resource][operation] = resolvePermission(db, userId, role, resource, operation)
    }
  }
  return result
}

/**
 * Get the permission matrix for a group (stored in DB).
 * Returns resource → operation → boolean (defaults to false if not set).
 */
export function getGroupPermissions(
  db: Database.Database,
  groupId: string
): Record<Resource, Record<Operation, boolean>> {
  const rows = db
    .prepare('SELECT resource, operation, allowed FROM group_permissions WHERE group_id = ?')
    .all(groupId) as { resource: string; operation: string; allowed: number }[]

  const result = {} as Record<Resource, Record<Operation, boolean>>
  for (const resource of ALL_RESOURCES) {
    result[resource] = {} as Record<Operation, boolean>
    for (const operation of ALL_OPERATIONS) {
      result[resource][operation] = false
    }
  }

  for (const row of rows) {
    if (
      ALL_RESOURCES.includes(row.resource as Resource) &&
      ALL_OPERATIONS.includes(row.operation as Operation)
    ) {
      result[row.resource as Resource][row.operation as Operation] = row.allowed === 1
    }
  }

  return result
}

/**
 * Get user-level permission overrides (not resolved — raw overrides only).
 */
export function getUserPermissionOverrides(
  db: Database.Database,
  userId: string
): Partial<Record<Resource, Partial<Record<Operation, boolean>>>> {
  const rows = db
    .prepare('SELECT resource, operation, allowed FROM user_permissions WHERE user_id = ?')
    .all(userId) as { resource: string; operation: string; allowed: number }[]

  const result: Partial<Record<Resource, Partial<Record<Operation, boolean>>>> = {}
  for (const row of rows) {
    if (
      ALL_RESOURCES.includes(row.resource as Resource) &&
      ALL_OPERATIONS.includes(row.operation as Operation)
    ) {
      if (!result[row.resource as Resource]) {
        result[row.resource as Resource] = {}
      }
      result[row.resource as Resource]![row.operation as Operation] = row.allowed === 1
    }
  }
  return result
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
