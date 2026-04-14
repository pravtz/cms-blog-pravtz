'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import { Badge, Modal } from '@/components'
import { useToast } from '@/components'

interface Campaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number
  sent_count: number
  created_at: string
  updated_at: string
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'; label: string }> = {
  draft: { variant: 'default', label: 'Rascunho' },
  scheduled: { variant: 'warning', label: 'Agendada' },
  sent: { variant: 'success', label: 'Enviada' },
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

const EMPTY_FORM = { name: '', subject: '', body: '' }

export default function EmailMarketingPage() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [smtpConfigured, setSmtpConfigured] = useState(false)

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Send modal
  const [sendOpen, setSendOpen] = useState(false)
  const [sendingCampaign, setSendingCampaign] = useState<Campaign | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const params = new URLSearchParams({ limit: '20', page: String(page) })
    if (statusFilter !== 'all') params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/admin/email-marketing?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCampaigns(data.data)
      setTotal(data.meta.total)
      setTotalPages(data.meta.totalPages)
      setSmtpConfigured(data.meta.smtpConfigured)
    } catch {
      toast({ variant: 'error', title: 'Erro ao carregar campanhas.' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, toast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  function openCreate() {
    setEditingCampaign(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  function openEdit(c: Campaign) {
    setEditingCampaign(c)
    setForm({ name: c.name, subject: c.subject, body: c.body })
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast({ variant: 'error', title: 'Preencha todos os campos obrigatórios.' })
      return
    }
    setSaving(true)
    const token = getToken()
    try {
      const url = editingCampaign
        ? `/api/admin/email-marketing/${editingCampaign.id}`
        : '/api/admin/email-marketing'
      const method = editingCampaign ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao salvar campanha')
      }
      toast({ variant: 'success', title: editingCampaign ? 'Campanha atualizada.' : 'Campanha criada.' })
      setEditorOpen(false)
      fetchCampaigns()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Erro ao salvar campanha.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta campanha permanentemente?')) return
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/email-marketing/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast({ variant: 'success', title: 'Campanha excluída.' })
      fetchCampaigns()
    } catch {
      toast({ variant: 'error', title: 'Erro ao excluir campanha.' })
    }
  }

  function openSend(c: Campaign) {
    setSendingCampaign(c)
    setScheduledAt('')
    setSendOpen(true)
  }

  async function handleSend() {
    if (!sendingCampaign) return
    setSending(true)
    const token = getToken()
    try {
      const payload: Record<string, string> = {}
      if (scheduledAt) payload.scheduled_at = scheduledAt

      const res = await fetch(`/api/admin/email-marketing/${sendingCampaign.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao enviar campanha')
      }
      toast({
        variant: 'success',
        title: scheduledAt ? 'Campanha agendada com sucesso.' : 'Campanha enviada com sucesso.',
      })
      setSendOpen(false)
      fetchCampaigns()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Erro ao enviar campanha.' })
    } finally {
      setSending(false)
    }
  }

  const STATUS_TABS = [
    { key: 'all', label: 'Todas' },
    { key: 'draft', label: 'Rascunhos' },
    { key: 'scheduled', label: 'Agendadas' },
    { key: 'sent', label: 'Enviadas' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>E-mail Marketing</h1>
          <p className={styles.subtitle}>{total} campanha{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          className={styles.createBtn}
          onClick={openCreate}
          disabled={!smtpConfigured}
          title={!smtpConfigured ? 'Configure o SMTP antes de criar campanhas' : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Campanha
        </button>
      </div>

      {!smtpConfigured && (
        <div className={styles.smtpBanner} role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            E-mail Marketing requer configuração de SMTP.{' '}
            <a href="/admin/settings" className={styles.smtpLink}>Configurar agora</a>
          </span>
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className={styles.empty}>
          <p>Nenhuma campanha encontrada.</p>
          {smtpConfigured && (
            <button className={styles.emptyCreateBtn} onClick={openCreate}>
              Criar primeira campanha
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Destinatários</th>
                  <th>Enviados</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const badge = STATUS_BADGE[c.status] ?? { variant: 'default' as const, label: c.status }
                  return (
                    <tr key={c.id}>
                      <td className={styles.nameCell}>{c.name}</td>
                      <td className={styles.subjectCell}>{c.subject}</td>
                      <td>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className={styles.numCell}>{c.recipient_count || '—'}</td>
                      <td className={styles.numCell}>{c.sent_count || '—'}</td>
                      <td className={styles.dateCell}>
                        {c.status === 'sent'
                          ? formatDate(c.sent_at)
                          : c.status === 'scheduled'
                          ? `Agendada: ${formatDate(c.scheduled_at)}`
                          : formatDate(c.created_at)}
                      </td>
                      <td className={styles.actionsCell}>
                        {c.status !== 'sent' && (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => openEdit(c)}
                              aria-label={`Editar ${c.name}`}
                            >
                              Editar
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.sendBtn}`}
                              onClick={() => openSend(c)}
                              disabled={!smtpConfigured}
                              aria-label={`Enviar ${c.name}`}
                            >
                              Enviar
                            </button>
                          </>
                        )}
                        {c.status === 'sent' && (
                          <span className={styles.sentLabel}>Concluída</span>
                        )}
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => handleDelete(c.id)}
                          aria-label={`Excluir ${c.name}`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {/* Campaign editor modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
        footer={
          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="campaign-name">Nome interno *</label>
          <input
            id="campaign-name"
            className={styles.input}
            type="text"
            placeholder="Ex: Newsletter de Abril"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={200}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="campaign-subject">Assunto do e-mail *</label>
          <input
            id="campaign-subject"
            className={styles.input}
            type="text"
            placeholder="Ex: Novidades de {{nome}} — Abril 2026"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            maxLength={500}
          />
          <p className={styles.hint}>Use {'{{nome}}'} e {'{{email}}'} como variáveis.</p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="campaign-body">Conteúdo (HTML) *</label>
          <textarea
            id="campaign-body"
            className={styles.textarea}
            placeholder="<p>Olá {{nome}},</p><p>Confira as novidades...</p>"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={12}
          />
          <p className={styles.hint}>HTML aceito. Use {'{{nome}}'} e {'{{email}}'} para personalização.</p>
        </div>
      </Modal>

      {/* Send / schedule modal */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={`Enviar: ${sendingCampaign?.name ?? ''}`}
        footer={
          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={() => setSendOpen(false)} disabled={sending}>
              Cancelar
            </button>
            <button
              className={`${styles.saveBtn} ${styles.sendConfirmBtn}`}
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? 'Processando…' : scheduledAt ? 'Agendar' : 'Enviar agora'}
            </button>
          </div>
        }
      >
        <div className={styles.sendInfo}>
          <p>A campanha será enviada para todos os assinantes <strong>ativos</strong> da newsletter.</p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="scheduled-at">
            Agendar envio (opcional)
          </label>
          <input
            id="scheduled-at"
            className={styles.input}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className={styles.hint}>Deixe em branco para enviar imediatamente.</p>
        </div>
      </Modal>
    </div>
  )
}
