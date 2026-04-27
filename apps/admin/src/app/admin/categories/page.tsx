'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import styles from './categories.module.css'
import { Button, Modal, Input, useToast } from '@/components'

interface Category {
  id: string
  name: string
  slug: string
  created_at: string
  post_count: number
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to load categories')
      const data = await res.json()
      setCategories(data.categories)
    } catch {
      toast({ variant: 'error', title: 'Failed to load categories.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
    }
  }, [editingId])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to create category.' })
        return
      }
      toast({ variant: 'success', title: 'Category created.' })
      setShowCreate(false)
      setNewName('')
      fetchCategories()
    } finally {
      setCreating(false)
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setEditName(category.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to update category.' })
        return
      }
      toast({ variant: 'success', title: 'Category updated.' })
      setEditingId(null)
      fetchCategories()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ variant: 'error', title: err.error ?? 'Failed to delete category.' })
        return
      }
      toast({ variant: 'success', title: `Category "${category.name}" deleted.` })
      setDeleteTarget(null)
      fetchCategories()
    } catch {
      toast({ variant: 'error', title: 'Failed to delete category.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Categorias</h1>
          <p className={styles.subtitle}>
            Gerencie as categorias dos posts. O slug é gerado automaticamente a partir do nome.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nova Categoria</Button>
      </div>

      {loading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          Carregando categorias…
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Lista de categorias">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Slug</th>
                <th scope="col">Posts</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                editingId === category.id ? (
                  <tr key={category.id} className={styles.inlineEditRow}>
                    <td colSpan={2}>
                      <input
                        ref={editInputRef}
                        className={styles.inlineEditInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(category.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        aria-label="Edit category name"
                      />
                    </td>
                    <td>{category.post_count}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(category.id)}
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
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td className={styles.slugCell}>{category.slug}</td>
                    <td>{category.post_count}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(category)}
                          aria-label={`Edit category ${category.name}`}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(category)}
                          aria-label={`Delete category ${category.name}`}
                        >
                          Deletar
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Nenhuma categoria encontrada.
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
        title="Nova Categoria"
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
            label="Nome da Categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            placeholder="ex: Tecnologia"
            required
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Deletar Categoria"
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
            Tem certeza que deseja deletar a categoria{' '}
            <strong>{deleteTarget.name}</strong>? Os posts associados a ela
            ficarão sem categoria.
          </p>
        </Modal>
      )}
    </div>
  )
}
