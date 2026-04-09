'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'
import { Button, Badge, Modal, Input, useToast } from '@/components'

interface User {
  id: string
  name: string
  nickname: string | null
  email: string
  phone: string | null
  role: string
  status: string
  created_at: string
  groups?: { id: string; name: string; is_system: number }[]
}

interface Group {
  id: string
  name: string
  is_system: number
}

const STATUS_LABELS: Record<string, string> = {
  pending_email: 'Email Unconfirmed',
  pending_approval: 'Awaiting Approval',
  active: 'Active',
  suspended: 'Suspended',
}

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  pending_email: 'warning',
  pending_approval: 'info',
  active: 'success',
  suspended: 'error',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  default: 'Member',
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending_email', label: 'Unconfirmed' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function UsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editGroupIds, setEditGroupIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [detailUser, setDetailUser] = useState<User | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'reactivate'
    user: User
  } | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter
        ? `/api/admin/users?status=${encodeURIComponent(statusFilter)}`
        : '/api/admin/users'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      toast({ variant: 'error', title: 'Failed to load users.' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, token, toast])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAllGroups(data.groups.filter((g: Group) => !g.is_system))
      }
    } catch {
      // ignore
    }
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchGroups() }, [fetchGroups])

  function setTab(status: string) {
    const url = status ? `/admin/users?status=${status}` : '/admin/users'
    router.push(url)
  }

  async function doAction(type: 'approve' | 'reject' | 'suspend' | 'reactivate', user: User) {
    const endpointMap = {
      approve: `/api/admin/users/${user.id}/approve`,
      reject: `/api/admin/users/${user.id}/reject`,
      suspend: `/api/admin/users/${user.id}/suspend`,
      reactivate: `/api/admin/users/${user.id}/reactivate`,
    }
    const methodMap = { approve: 'POST', reject: 'POST', suspend: 'POST', reactivate: 'POST' }
    const successMsg = {
      approve: 'User approved.',
      reject: 'User rejected.',
      suspend: 'User suspended.',
      reactivate: 'User reactivated.',
    }

    try {
      const res = await fetch(endpointMap[type], {
        method: methodMap[type],
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Action failed.' })
        return
      }
      toast({ variant: 'success', title: successMsg[type] })
      setConfirmAction(null)
      fetchUsers()
    } catch {
      toast({ variant: 'error', title: 'Action failed.' })
    }
  }

  async function fetchUserDetail(user: User) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDetailUser(data.user)
      }
    } catch {
      // fallback to current data
      setDetailUser(user)
    }
  }

  function openEdit(user: User) {
    setEditUser(user)
    setEditRole(user.role)
    setEditGroupIds((user.groups ?? []).filter((g) => !g.is_system).map((g) => g.id))
  }

  async function saveEdit() {
    if (!editUser) return
    setSaving(true)
    try {
      const body: { role?: string; groupIds?: string[] } = {}
      if (editRole !== editUser.role) body.role = editRole
      body.groupIds = editGroupIds

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to update user.' })
        return
      }
      toast({ variant: 'success', title: 'User updated.' })
      setEditUser(null)
      fetchUsers()
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = users.filter((u) => u.status === 'pending_approval').length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>Manage user accounts, roles, and group memberships.</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className={styles.tabs} role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`${styles.tab} ${statusFilter === tab.value ? styles.tabActive : ''}`}
            onClick={() => setTab(tab.value)}
            role="tab"
            aria-selected={statusFilter === tab.value}
          >
            {tab.label}
            {tab.value === 'pending_approval' && pendingCount > 0 && (
              <span className={styles.tabBadge}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading users…</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button
                      className={styles.userCell}
                      onClick={() => fetchUserDetail(user)}
                      title="View profile"
                    >
                      <span className={styles.userAvatar}>{user.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <div className={styles.userName}>{user.name}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                      </div>
                    </button>
                  </td>
                  <td>
                    <Badge variant={user.role === 'owner' ? 'primary' : 'default'}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={STATUS_VARIANT[user.status] ?? 'default'}>
                      {STATUS_LABELS[user.status] ?? user.status}
                    </Badge>
                  </td>
                  <td className={styles.date}>{formatDate(user.created_at)}</td>
                  <td>
                    <div className={styles.actions}>
                      {user.status === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'approve', user })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'reject', user })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {user.status === 'active' && user.role !== 'owner' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'suspend', user })}>
                            Suspend
                          </Button>
                        </>
                      )}
                      {user.status === 'suspended' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'reactivate', user })}>
                            Reactivate
                          </Button>
                        </>
                      )}
                      {user.role === 'owner' && (
                        <span className={styles.ownerNote}>Owner</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* User Detail Modal */}
      {detailUser && (
        <Modal
          open={!!detailUser}
          onClose={() => setDetailUser(null)}
          title="User Profile"
          footer={
            <Button variant="ghost" onClick={() => setDetailUser(null)}>Close</Button>
          }
        >
          <div className={styles.detailGrid}>
            <div className={styles.detailAvatarLg}>{detailUser.name.slice(0, 1).toUpperCase()}</div>
            <div className={styles.detailInfo}>
              <div className={styles.detailName}>{detailUser.name}</div>
              {detailUser.nickname && <div className={styles.detailNick}>@{detailUser.nickname}</div>}
            </div>
            <DetailRow label="Email" value={detailUser.email} />
            {detailUser.phone && <DetailRow label="Phone" value={detailUser.phone} />}
            <DetailRow label="Role" value={ROLE_LABELS[detailUser.role] ?? detailUser.role} />
            <DetailRow label="Status" value={STATUS_LABELS[detailUser.status] ?? detailUser.status} />
            <DetailRow label="Joined" value={formatDate(detailUser.created_at)} />
            {detailUser.groups && detailUser.groups.length > 0 && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Groups</span>
                <div className={styles.groupChips}>
                  {detailUser.groups.map((g) => (
                    <Badge key={g.id} variant={g.is_system ? 'info' : 'default'}>
                      {g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          title={`Edit ${editUser.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button onClick={saveEdit} loading={saving}>Save</Button>
            </>
          }
        >
          <div className={styles.editForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Role</label>
              <select
                className={styles.select}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="default">Member</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {allGroups.length > 0 && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Groups</label>
                <div className={styles.checkboxList}>
                  {allGroups.map((g) => (
                    <label key={g.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={editGroupIds.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditGroupIds((ids) => [...ids, g.id])
                          } else {
                            setEditGroupIds((ids) => ids.filter((id) => id !== g.id))
                          }
                        }}
                      />
                      <span>{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <Modal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={`Confirm: ${confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)} User`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction.type === 'approve' || confirmAction.type === 'reactivate' ? 'primary' : 'danger'}
                onClick={() => doAction(confirmAction.type, confirmAction.user)}
              >
                {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
              </Button>
            </>
          }
        >
          <p>
            Are you sure you want to <strong>{confirmAction.type}</strong>{' '}
            <strong>{confirmAction.user.name}</strong> ({confirmAction.user.email})?
          </p>
        </Modal>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>}>
      <UsersContent />
    </Suspense>
  )
}
