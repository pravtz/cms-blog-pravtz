'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import styles from './group-detail.module.css'
import { Button, Badge, Input, useToast } from '@/components'
import PermissionMatrix from '@/components/PermissionMatrix/PermissionMatrix'
import type { PermissionMap } from '@/components/PermissionMatrix/PermissionMatrix'
import { ALL_RESOURCES, ALL_OPERATIONS } from '@/lib/rbac'
import type { Resource, Operation } from '@/lib/rbac'

interface Group {
  id: string
  name: string
  description: string | null
  is_system: number
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  status: string
}

interface AllUser {
  id: string
  name: string
  email: string
  role: string
  status: string
}

function emptyMatrix(): PermissionMap {
  const matrix = {} as PermissionMap
  for (const r of ALL_RESOURCES) {
    matrix[r] = {} as Record<Operation, boolean>
    for (const op of ALL_OPERATIONS) {
      matrix[r][op] = false
    }
  }
  return matrix
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [permissions, setPermissions] = useState<PermissionMap>(emptyMatrix())
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPerms, setSavingPerms] = useState(false)
  const [savingMembers, setSavingMembers] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [descValue, setDescValue] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [groupRes, permsRes, usersRes] = await Promise.all([
        fetch(`/api/groups/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/groups/${params.id}/permissions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (!groupRes.ok) {
        toast({ variant: 'error', title: 'Group not found.' })
        router.push('/admin/groups')
        return
      }
      const groupData = await groupRes.json()
      const permsData = permsRes.ok ? await permsRes.json() : null
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] }

      setGroup(groupData.group)
      setNameValue(groupData.group.name)
      setDescValue(groupData.group.description ?? '')
      setMembers(groupData.members ?? [])
      setSelectedMemberIds(new Set((groupData.members ?? []).map((m: Member) => m.id)))
      if (permsData?.permissions) setPermissions(permsData.permissions)
      setAllUsers(usersData.users)
    } catch {
      toast({ variant: 'error', title: 'Failed to load group data.' })
    } finally {
      setLoading(false)
    }
  }, [params.id, token, toast, router])

  useEffect(() => { fetchData() }, [fetchData])

  function handlePermChange(resource: Resource, operation: Operation, value: boolean) {
    setPermissions((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [operation]: value },
    }))
  }

  async function savePermissions() {
    setSavingPerms(true)
    try {
      const res = await fetch(`/api/groups/${params.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to save permissions.' })
        return
      }
      toast({ variant: 'success', title: 'Permissions saved.' })
    } finally {
      setSavingPerms(false)
    }
  }

  async function saveMembers() {
    setSavingMembers(true)
    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberIds: Array.from(selectedMemberIds) }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to save members.' })
        return
      }
      toast({ variant: 'success', title: 'Members updated.' })
      fetchData()
    } finally {
      setSavingMembers(false)
    }
  }

  async function saveName() {
    if (!nameValue.trim() || !group) return
    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nameValue.trim(), description: descValue.trim() || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to update group.' })
        return
      }
      toast({ variant: 'success', title: 'Group updated.' })
      setEditingName(false)
      fetchData()
    } catch {
      toast({ variant: 'error', title: 'Failed to update group.' })
    }
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  if (loading) {
    return <div className={styles.loading}>Loading…</div>
  }

  if (!group) return null

  const isOwnerGroup = group.name === 'owner'
  const isSystem = group.is_system === 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {editingName && !isSystem ? (
            <div className={styles.editNameForm}>
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="Group name"
              />
              <Input
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="Description (optional)"
              />
              <div className={styles.editNameActions}>
                <Button size="sm" onClick={saveName} disabled={!nameValue.trim()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.title}>{group.name}</h1>
              {isSystem && <Badge variant="info">Default</Badge>}
              {!isSystem && (
                <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                  Edit Name
                </Button>
              )}
            </>
          )}
        </div>
        {group.description && !editingName && (
          <p className={styles.desc}>{group.description}</p>
        )}
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/groups')}>
          ← Back to Groups
        </Button>
      </div>

      {/* Permission Matrix */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Access Matrix</h2>
          {isOwnerGroup && (
            <p className={styles.note}>
              The owner group bypasses all permission checks and cannot be configured.
            </p>
          )}
        </div>
        <PermissionMatrix
          permissions={permissions}
          readOnly={isOwnerGroup}
          disabled={isOwnerGroup}
          onChange={handlePermChange}
        />
        {!isOwnerGroup && (
          <div className={styles.saveRow}>
            <Button onClick={savePermissions} loading={savingPerms}>
              Save Permissions
            </Button>
          </div>
        )}
      </section>

      {/* Member Management */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Members ({members.length})
          </h2>
          {!isSystem && (
            <Button size="sm" onClick={saveMembers} loading={savingMembers}>
              Save Members
            </Button>
          )}
        </div>
        {isSystem ? (
          <p className={styles.note}>
            System group membership is managed automatically.
          </p>
        ) : (
          <div className={styles.memberGrid}>
            {allUsers.map((user) => {
              const isMember = selectedMemberIds.has(user.id)
              return (
                <label key={user.id} className={styles.memberCard}>
                  <input
                    type="checkbox"
                    checked={isMember}
                    onChange={() => toggleMember(user.id)}
                    className={styles.memberCheck}
                  />
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{user.name}</span>
                    <span className={styles.memberEmail}>{user.email}</span>
                  </div>
                  <Badge variant={isMember ? 'success' : 'default'} size="sm">
                    {isMember ? 'Member' : 'Not member'}
                  </Badge>
                </label>
              )
            })}
            {allUsers.length === 0 && (
              <p className={styles.note}>No users found.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
