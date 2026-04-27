'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import styles from './tags.module.css'
import { Button, Modal, Input, useToast } from '@/components'

interface Tag {
  id: string
  name: string
  slug: string
  post_count: number
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tags', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to load tags')
      const data = await res.json()
      setTags(data.tags)
    } catch {
      toast({ variant: 'error', title: 'Failed to load tags.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
    }
  }, [editingId])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to create tag.' })
        return
      }
      toast({ variant: 'success', title: 'Tag created.' })
      setShowCreate(false)
      setNewName('')
      fetchTags()
    } finally {
      setCreating(false)
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to update tag.' })
        return
      }
      toast({ variant: 'success', title: 'Tag updated.' })
      setEditingId(null)
      fetchTags()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tag: Tag) {
    try {
      const res = await fetch(`/api/admin/tags/${tag.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to delete tag.' })
        return
      }
      toast({ variant: 'success', title: `Tag "${tag.name}" deleted.` })
      setDeleteTarget(null)
      fetchTags()
    } catch {
      toast({ variant: 'error', title: 'Failed to delete tag.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tags</h1>
          <p className={styles.subtitle}>
            Gerencie as tags dos posts. O slug é gerado automaticamente a partir do nome.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nova Tag</Button>
      </div>

      {loading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          Carregando tags…
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Lista de tags">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Slug</th>
                <th scope="col">Posts</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) =>
                editingId === tag.id ? (
                  <tr key={tag.id} className={styles.inlineEditRow}>
                    <td colSpan={2}>
                      <input
                        ref={editInputRef}
                        className={styles.inlineEditInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(tag.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        aria-label="Edit tag name"
                      />
                    </td>
                    <td>{tag.post_count}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(tag.id)}
                          loading={saving}
                          disabled={!editName.trim()}
                        >
                          Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={tag.id}>
                    <td>{tag.name}</td>
                    <td className={styles.slugCell}>{tag.slug}</td>
                    <td>{tag.post_count}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(tag)}
                          aria-label={`Edit tag ${tag.name}`}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(tag)}
                          aria-label={`Delete tag ${tag.name}`}
                        >
                          Deletar
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {tags.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Nenhuma tag encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false)
          setNewName('')
        }}
        title="Nova Tag"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!newName.trim()}
            >
              Criar
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Nome da Tag"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            placeholder="ex: javascript"
            required
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Deletar Tag"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteTarget)}>
                Deletar
              </Button>
            </>
          }
        >
          <p>
            Tem certeza que deseja deletar a tag <strong>{deleteTarget.name}</strong>?
            Ela será removida de todos os posts associados.
          </p>
        </Modal>
      )}
    </div>
  )
}
