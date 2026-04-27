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

interface UserFormState {
  name: string
  nickname: string
  email: string
  phone: string
  role: string
  password: string
  confirmPassword: string
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

const emptyUserForm: UserFormState = {
  name: '',
  nickname: '',
  email: '',
  phone: '',
  role: 'default',
  password: '',
  confirmPassword: '',
}

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
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<UserFormState>(emptyUserForm)
  const [createGroupIds, setCreateGroupIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UserFormState>(emptyUserForm)
  const [editGroupIds, setEditGroupIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [detailUser, setDetailUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'reactivate'
    user: User
  } | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
  const isOwner = currentRole === 'owner'

  const fetchCurrentUser = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setCurrentRole(data.user.role)
    } catch {
      // Ignore and let backend enforce permissions.
    }
  }, [router, token])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter
        ? `/api/admin/users?status=${encodeURIComponent(statusFilter)}`
        : '/api/admin/users'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      toast({ variant: 'error', title: 'Failed to load users.' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, token, toast, router])

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

  useEffect(() => { fetchCurrentUser() }, [fetchCurrentUser])
  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchGroups() }, [fetchGroups])

  function setTab(status: string) {
    const url = status ? `/admin/users?status=${status}` : '/admin/users'
    router.push(url)
  }

  function updateCreateForm<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setCreateForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditForm<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function toggleGroup(groupId: string, selected: string[], setSelected: (value: string[] | ((current: string[]) => string[])) => void, checked: boolean) {
    if (checked) {
      setSelected((ids) => [...ids, groupId])
      return
    }
    setSelected((ids) => ids.filter((id) => id !== groupId))
  }

  function resetCreateState() {
    setShowCreate(false)
    setCreateForm(emptyUserForm)
    setCreateGroupIds([])
  }

  async function handleCreateUser() {
    if (!isOwner) return
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) return
    if (createForm.password !== createForm.confirmPassword) {
      toast({ variant: 'error', title: 'Passwords do not match.' })
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          nickname: createForm.nickname.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          password: createForm.password,
          role: createForm.role,
          groupIds: createGroupIds,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast({ variant: 'error', title: err?.error ?? 'Failed to create user.' })
        return
      }

      toast({ variant: 'success', title: 'User created.' })
      resetCreateState()
      await fetchUsers()
    } catch {
      toast({ variant: 'error', title: 'Failed to create user.' })
    } finally {
      setCreating(false)
    }
  }

  async function doAction(type: 'approve' | 'reject' | 'suspend' | 'reactivate', user: User) {
    const endpointMap = {
      approve: `/api/admin/users/${user.id}/approve`,
      reject: `/api/admin/users/${user.id}/reject`,
      suspend: `/api/admin/users/${user.id}/suspend`,
      reactivate: `/api/admin/users/${user.id}/reactivate`,
    }
    const successMsg = {
      approve: 'User approved.',
      reject: 'User rejected.',
      suspend: 'User suspended.',
      reactivate: 'User reactivated.',
    }

    try {
      const res = await fetch(endpointMap[type], {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast({ variant: 'error', title: err?.error ?? 'Action failed.' })
        return
      }
      toast({ variant: 'success', title: successMsg[type] })
      setConfirmAction(null)
      await fetchUsers()
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
        return
      }
    } catch {
      // fallback to current data
    }
    setDetailUser(user)
  }

  function openEdit(user: User) {
    setEditUser(user)
    setEditForm({
      name: user.name,
      nickname: user.nickname ?? '',
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      password: '',
      confirmPassword: '',
    })
    setEditGroupIds((user.groups ?? []).filter((g) => !g.is_system).map((g) => g.id))
  }

  async function saveEdit() {
    if (!editUser || !isOwner) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          nickname: editForm.nickname.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          role: editForm.role,
          groupIds: editGroupIds,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast({ variant: 'error', title: err?.error ?? 'Failed to update user.' })
        return
      }
      toast({ variant: 'success', title: 'User updated.' })
      setEditUser(null)
      await fetchUsers()
    } catch {
      toast({ variant: 'error', title: 'Failed to update user.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    if (!resetUser || !isOwner) return
    if (resetPassword.length < 8) {
      toast({ variant: 'error', title: 'Password must be at least 8 characters.' })
      return
    }
    if (resetPassword !== resetConfirmPassword) {
      toast({ variant: 'error', title: 'Passwords do not match.' })
      return
    }

    setResettingPassword(true)
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: resetPassword }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast({ variant: 'error', title: err?.error ?? 'Failed to reset password.' })
        return
      }

      toast({ variant: 'success', title: 'Password reset.' })
      setResetUser(null)
      setResetPassword('')
      setResetConfirmPassword('')
    } catch {
      toast({ variant: 'error', title: 'Failed to reset password.' })
    } finally {
      setResettingPassword(false)
    }
  }

  const pendingCount = users.filter((u) => u.status === 'pending_approval').length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>Manage user accounts, roles, approvals, and passwords.</p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowCreate(true)}>+ New User</Button>
        )}
      </div>

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
          <table className={styles.table} aria-label="Users list">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col">Actions</th>
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
                      {isOwner && user.role !== 'owner' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResetUser(user)}>
                            Reset Password
                          </Button>
                        </>
                      )}
                      {isOwner && user.status === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'approve', user })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'reject', user })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {isOwner && user.status === 'active' && user.role !== 'owner' && (
                        <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'suspend', user })}>
                          Suspend
                        </Button>
                      )}
                      {isOwner && user.status === 'suspended' && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'reactivate', user })}>
                          Reactivate
                        </Button>
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

      {showCreate && (
        <Modal
          open={showCreate}
          onClose={resetCreateState}
          title="Create User"
          footer={
            <>
              <Button variant="ghost" onClick={resetCreateState}>Cancel</Button>
              <Button onClick={handleCreateUser} loading={creating}>Create User</Button>
            </>
          }
        >
          <div className={styles.editForm}>
            <Input label="Name" value={createForm.name} onChange={(e) => updateCreateForm('name', e.target.value)} required />
            <Input label="Nickname" value={createForm.nickname} onChange={(e) => updateCreateForm('nickname', e.target.value)} />
            <Input label="Email" type="email" value={createForm.email} onChange={(e) => updateCreateForm('email', e.target.value)} required />
            <Input label="Phone" value={createForm.phone} onChange={(e) => updateCreateForm('phone', e.target.value)} />
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Role</label>
              <select className={styles.select} value={createForm.role} onChange={(e) => updateCreateForm('role', e.target.value)}>
                <option value="default">Member</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Input label="Temporary Password" type="password" value={createForm.password} onChange={(e) => updateCreateForm('password', e.target.value)} required />
            <Input label="Confirm Password" type="password" value={createForm.confirmPassword} onChange={(e) => updateCreateForm('confirmPassword', e.target.value)} required />
            {allGroups.length > 0 && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Groups</label>
                <div className={styles.checkboxList}>
                  {allGroups.map((g) => (
                    <label key={g.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={createGroupIds.includes(g.id)}
                        onChange={(e) => toggleGroup(g.id, createGroupIds, setCreateGroupIds, e.target.checked)}
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
            <Input label="Name" value={editForm.name} onChange={(e) => updateEditForm('name', e.target.value)} required />
            <Input label="Nickname" value={editForm.nickname} onChange={(e) => updateEditForm('nickname', e.target.value)} />
            <Input label="Email" type="email" value={editForm.email} onChange={(e) => updateEditForm('email', e.target.value)} required />
            <Input label="Phone" value={editForm.phone} onChange={(e) => updateEditForm('phone', e.target.value)} />
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Role</label>
              <select
                className={styles.select}
                value={editForm.role}
                onChange={(e) => updateEditForm('role', e.target.value)}
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
                        onChange={(e) => toggleGroup(g.id, editGroupIds, setEditGroupIds, e.target.checked)}
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

      {resetUser && (
        <Modal
          open={!!resetUser}
          onClose={() => {
            setResetUser(null)
            setResetPassword('')
            setResetConfirmPassword('')
          }}
          title={`Reset Password: ${resetUser.name}`}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setResetUser(null)
                  setResetPassword('')
                  setResetConfirmPassword('')
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword} loading={resettingPassword}>Reset Password</Button>
            </>
          }
        >
          <div className={styles.editForm}>
            <Input label="New Password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required />
            <Input label="Confirm New Password" type="password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required />
          </div>
        </Modal>
      )}

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
