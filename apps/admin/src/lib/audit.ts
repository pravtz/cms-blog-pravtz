import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'

export type AuditAction =
  | 'login.success'
  | 'login.failure'
  | 'login.blocked'
  | 'user.created'
  | 'user.approved'
  | 'user.updated'
  | 'user.rejected'
  | 'user.suspended'
  | 'user.password_reset'
  | 'user.role_changed'
  | 'post.created'
  | 'post.published'
  | 'post.edited'
  | 'post.deleted'
  | 'post.restored'
  | 'group.created'
  | 'group.updated'
  | 'group.deleted'
  | 'rbac.group_permissions_changed'
  | 'rbac.user_permissions_changed'
  | 'settings.changed'
  | 'setup.completed'

export interface AuditEntry {
  actorId?: string | null
  actorEmail?: string | null
  action: AuditAction
  targetId?: string | null
  targetType?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export function logAudit(entry: AuditEntry): void {
  try {
    const db = getDb()
    db.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_email, action, target_id, target_type, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      entry.actorId ?? null,
      entry.actorEmail ?? null,
      entry.action,
      entry.targetId ?? null,
      entry.targetType ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null
    )
  } catch {
    // Audit logging is non-blocking — never crash the main flow
  }
}
