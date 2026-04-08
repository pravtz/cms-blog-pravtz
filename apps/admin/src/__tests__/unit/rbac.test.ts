import { describe, it, expect } from 'vitest'
import { canPerform, canCreatePost, canManageUsers } from '@/lib/rbac'
import type { Resource, Operation } from '@/lib/rbac'

describe('canPerform — owner role', () => {
  it('always returns true for owner regardless of resource/operation', () => {
    const resources: Resource[] = ['posts', 'comments', 'users', 'settings', 'ai']
    const ops: Operation[] = ['read', 'write', 'delete', 'manage']
    for (const r of resources) {
      for (const op of ops) {
        expect(canPerform('owner', r, op)).toBe(true)
      }
    }
  })
})

describe('canPerform — admin role', () => {
  it('can manage posts', () => {
    expect(canPerform('admin', 'posts', 'read')).toBe(true)
    expect(canPerform('admin', 'posts', 'write')).toBe(true)
    expect(canPerform('admin', 'posts', 'delete')).toBe(true)
    expect(canPerform('admin', 'posts', 'manage')).toBe(true)
  })

  it('can manage users', () => {
    expect(canPerform('admin', 'users', 'manage')).toBe(true)
  })

  it('can only read settings (not write)', () => {
    expect(canPerform('admin', 'settings', 'read')).toBe(true)
    expect(canPerform('admin', 'settings', 'write')).toBe(false)
  })

  it('cannot manage permissions', () => {
    expect(canPerform('admin', 'permissions', 'manage')).toBe(false)
  })
})

describe('canPerform — author role', () => {
  it('can read/write/delete posts but not manage', () => {
    expect(canPerform('author', 'posts', 'read')).toBe(true)
    expect(canPerform('author', 'posts', 'write')).toBe(true)
    expect(canPerform('author', 'posts', 'delete')).toBe(true)
    expect(canPerform('author', 'posts', 'manage')).toBe(false)
  })

  it('cannot manage users', () => {
    expect(canPerform('author', 'users', 'manage')).toBe(false)
    expect(canPerform('author', 'users', 'read')).toBe(false)
  })

  it('can read metrics but not write', () => {
    expect(canPerform('author', 'metrics', 'read')).toBe(true)
    expect(canPerform('author', 'metrics', 'write')).toBe(false)
  })
})

describe('canPerform — default role', () => {
  it('can only read posts', () => {
    expect(canPerform('default', 'posts', 'read')).toBe(true)
    expect(canPerform('default', 'posts', 'write')).toBe(false)
    expect(canPerform('default', 'posts', 'delete')).toBe(false)
  })

  it('cannot access users, settings, or ai', () => {
    expect(canPerform('default', 'users', 'read')).toBe(false)
    expect(canPerform('default', 'settings', 'read')).toBe(false)
    expect(canPerform('default', 'ai', 'read')).toBe(false)
  })
})

describe('canPerform — unknown role falls back to default', () => {
  it('gives the same permissions as default for an unknown role', () => {
    expect(canPerform('nonexistent', 'posts', 'read')).toBe(true)
    expect(canPerform('nonexistent', 'posts', 'write')).toBe(false)
    expect(canPerform('nonexistent', 'users', 'read')).toBe(false)
  })
})

describe('canCreatePost', () => {
  it('returns true for owner', () => expect(canCreatePost('owner')).toBe(true))
  it('returns true for admin', () => expect(canCreatePost('admin')).toBe(true))
  it('returns true for author', () => expect(canCreatePost('author')).toBe(true))
  it('returns false for default', () => expect(canCreatePost('default')).toBe(false))
})

describe('canManageUsers', () => {
  it('returns true for owner', () => expect(canManageUsers('owner')).toBe(true))
  it('returns true for admin', () => expect(canManageUsers('admin')).toBe(true))
  it('returns false for author', () => expect(canManageUsers('author')).toBe(false))
  it('returns false for default', () => expect(canManageUsers('default')).toBe(false))
})
