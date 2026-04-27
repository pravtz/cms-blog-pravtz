'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import styles from './groups.module.css'
import { Button, Badge, Modal, Input, useToast } from '@/components'

interface Group {
  id: string
  name: string
  description: string | null
  is_system: number
  member_count: number
  created_at: string
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const { toast } = useToast()

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load groups')
      const data = await res.json()
      setGroups(Array.isArray(data.groups) ? data.groups : [])
    } catch {
      setFetchError('Failed to load groups. Please try again.')
      toast({ variant: 'error', title: 'Failed to load groups.' })
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to create group.' })
        return
      }
      toast({ variant: 'success', title: 'Group created.' })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      fetchGroups()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(group: Group) {
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to delete group.' })
        return
      }
      toast({ variant: 'success', title: `Group "${group.name}" deleted.` })
      setDeleteTarget(null)
      fetchGroups()
    } catch {
      toast({ variant: 'error', title: 'Failed to delete group.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Groups</h1>
          <p className={styles.subtitle}>Manage permission groups and their members.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Group</Button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading groups…</div>
      ) : fetchError ? (
        <div className={styles.empty} role="alert">{fetchError}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Groups list">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col">Members</th>
                <th scope="col">Type</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <Link href={`/admin/groups/${group.id}`} className={styles.groupLink}>
                      {group.name}
                    </Link>
                  </td>
                  <td className={styles.desc}>{group.description ?? '—'}</td>
                  <td>{group.member_count}</td>
                  <td>
                    {group.is_system ? (
                      <Badge variant="info">Default</Badge>
                    ) : (
                      <Badge variant="default">Custom</Badge>
                    )}
                  </td>
                  <td className={styles.actions}>
                    <Link href={`/admin/groups/${group.id}`}>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </Link>
                    {!group.is_system && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(group)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>No groups found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}
        title="New Group"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Group Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Editors"
            required
          />
          <Input
            label="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description"
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Group"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteTarget)}>Delete</Button>
            </>
          }
        >
          <p>
            Are you sure you want to delete the group <strong>{deleteTarget.name}</strong>?
            This will remove all its permissions and member associations.
          </p>
        </Modal>
      )}
    </div>
  )
}
