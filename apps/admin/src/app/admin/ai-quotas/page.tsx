'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { Badge } from '@/components'
import { useToast } from '@/components'

interface Provider {
  id: string
  name: string
  apiKeyMasked: string
  model: string
  baseUrl: string | null
  enabled: boolean
  updatedAt: string
}

interface UsageByUser {
  userId: string
  userName: string
  userEmail: string
  tokensUsed: number
}

interface Usage {
  month: string
  totalTokens: number
  estimatedUsd: number
  byUser: UsageByUser[]
}

interface QuotaRow {
  userId: string
  userName: string
  userEmail: string
  aiEnabled: boolean
  monthlyTokens: number
  resetMonthly: boolean
  accumulating: boolean
  tokensUsed: number
  pct: number
}

interface AiData {
  provider: Provider | null
  usage: Usage
  quotas: QuotaRow[]
}

const PROVIDER_NAMES = ['OpenAI', 'Anthropic', 'Compatible']
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

function tokensToArticles(tokens: number): string {
  const articles = Math.round(tokens / 800)
  return `~${articles} artigo${articles !== 1 ? 's' : ''}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function AiQuotasPage() {
  const { toast } = useToast()
  const [data, setData] = useState<AiData | null>(null)
  const [loading, setLoading] = useState(true)

  // Provider form
  const [providerName, setProviderName] = useState('OpenAI')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [baseUrl, setBaseUrl] = useState('')
  const [providerEnabled, setProviderEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  // Connection test
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; detail?: string } | null>(null)

  // Per-user quota editing (userId → { monthlyTokens, resetMonthly, accumulating })
  const [quotaEdits, setQuotaEdits] = useState<
    Record<string, { monthlyTokens: number; resetMonthly: boolean; accumulating: boolean }>
  >({})
  const [savingQuota, setSavingQuota] = useState<Record<string, boolean>>({})

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchData = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/ai', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const json: AiData = await res.json()
      setData(json)

      // Seed provider form from existing config
      if (json.provider) {
        setProviderName(json.provider.name)
        setModel(json.provider.model)
        setBaseUrl(json.provider.baseUrl ?? '')
        setProviderEnabled(json.provider.enabled)
        setApiKey('') // don't prefill masked key
      }

      // Seed quota edits
      const edits: Record<string, { monthlyTokens: number; resetMonthly: boolean; accumulating: boolean }> = {}
      for (const q of json.quotas) {
        edits[q.userId] = {
          monthlyTokens: q.monthlyTokens,
          resetMonthly: q.resetMonthly,
          accumulating: q.accumulating,
        }
      }
      setQuotaEdits(edits)
    } catch {
      toast({ variant: 'error', title: 'Erro ao carregar configurações de IA.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSaveProvider() {
    if (!providerName || !model) {
      toast({ variant: 'error', title: 'Preencha nome e modelo.' })
      return
    }
    setSaving(true)
    setTestResult(null)
    const token = getToken()
    try {
      const payload: Record<string, unknown> = {
        name: providerName,
        model,
        enabled: providerEnabled,
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()
      if (baseUrl.trim()) payload.baseUrl = baseUrl.trim()

      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Erro ao salvar provedor')
      }
      toast({ variant: 'success', title: 'Configurações salvas.' })
      setApiKey('')
      fetchData()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as { success: boolean; detail?: string }
      setTestResult(json)
    } catch {
      setTestResult({ success: false, detail: 'Erro de rede' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveQuota(userId: string, aiEnabled: boolean) {
    const edit = quotaEdits[userId]
    if (!edit) return
    setSavingQuota((prev) => ({ ...prev, [userId]: true }))
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/ai/users/${userId}/quota`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiEnabled,
          monthlyTokens: edit.monthlyTokens,
          resetMonthly: edit.resetMonthly,
          accumulating: edit.accumulating,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ variant: 'success', title: 'Cota atualizada.' })
      fetchData()
    } catch {
      toast({ variant: 'error', title: 'Erro ao atualizar cota.' })
    } finally {
      setSavingQuota((prev) => ({ ...prev, [userId]: false }))
    }
  }

  function getModels(): string[] {
    if (providerName === 'Anthropic') return ANTHROPIC_MODELS
    if (providerName === 'OpenAI') return OPENAI_MODELS
    return [model]
  }

  const maxTokens = data?.usage.byUser.reduce((m, u) => Math.max(m, u.tokensUsed), 0) ?? 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>IA &amp; Cotas</h1>
        <p className={styles.subtitle}>Configuração de provedor de IA e gerenciamento de cotas por usuário</p>
      </div>

      {/* Provider Config */}
      <section className={styles.section} aria-labelledby="provider-title">
        <h2 className={styles.sectionTitle} id="provider-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Provedor de IA
          {data?.provider && (
            <Badge variant={data.provider.enabled ? 'success' : 'default'}>
              {data.provider.enabled ? 'Ativo' : 'Inativo'}
            </Badge>
          )}
        </h2>

        <div className={styles.providerForm}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="provider-name">Provedor</label>
            <select
              id="provider-name"
              className={styles.select}
              value={providerName}
              onChange={(e) => {
                setProviderName(e.target.value)
                const models = e.target.value === 'Anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS
                setModel(models[0])
              }}
            >
              {PROVIDER_NAMES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-model">Modelo</label>
            {providerName === 'Compatible' ? (
              <input
                id="ai-model"
                className={styles.input}
                type="text"
                placeholder="Ex: mistral-7b"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            ) : (
              <select
                id="ai-model"
                className={styles.select}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {getModels().map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="api-key">
              API Key{data?.provider ? ' (deixe em branco para manter)' : ' *'}
            </label>
            <input
              id="api-key"
              className={styles.input}
              type="password"
              placeholder={data?.provider ? `Atual: ${data.provider.apiKeyMasked}` : 'sk-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="new-password"
            />
            <p className={styles.hint}>Armazenada com criptografia AES-256-GCM. Nunca exibida em respostas.</p>
          </div>

          {providerName === 'Compatible' && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="base-url">Base URL</label>
              <input
                id="base-url"
                className={styles.input}
                type="url"
                placeholder="https://api.exemplo.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          )}

          <div className={styles.formGroupFull}>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Habilitar integração de IA</span>
              <label className={styles.toggle} aria-label="Habilitar IA">
                <input
                  type="checkbox"
                  checked={providerEnabled}
                  onChange={(e) => setProviderEnabled(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>
          </div>

          <div className={styles.providerActions}>
            <button className={styles.saveBtn} onClick={handleSaveProvider} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>
            <button
              className={styles.testBtn}
              onClick={handleTestConnection}
              disabled={testing || !data?.provider}
              title={!data?.provider ? 'Salve um provedor primeiro' : undefined}
            >
              {testing ? 'Testando…' : 'Testar conexão'}
            </button>
            {testResult && (
              <span className={`${styles.testStatus} ${testResult.success ? styles.testOk : styles.testErr}`}>
                {testResult.success ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Conectado
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    {testResult.detail ?? 'Falha'}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Usage Overview */}
      <section className={styles.section} aria-labelledby="usage-title">
        <h2 className={styles.sectionTitle} id="usage-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Uso Global — {data?.usage.month ?? '…'}
        </h2>

        {loading ? (
          <div className={styles.skeleton}>
            {[1, 2].map((i) => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : (
          <>
            <div className={styles.overviewGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>{formatTokens(data?.usage.totalTokens ?? 0)}</div>
                <div className={styles.metricLabel}>Tokens este mês</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  ${data?.usage.estimatedUsd.toFixed(4) ?? '0.0000'}
                </div>
                <div className={styles.metricLabel}>Custo estimado (USD)</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {data?.usage.byUser.filter((u) => u.tokensUsed > 0).length ?? 0}
                </div>
                <div className={styles.metricLabel}>Usuários ativos</div>
              </div>
            </div>

            {data && data.usage.byUser.length > 0 && (
              <div className={styles.barChart} aria-label="Uso de tokens por usuário">
                {data.usage.byUser
                  .filter((u) => u.tokensUsed > 0)
                  .slice(0, 10)
                  .map((u) => (
                    <div key={u.userId} className={styles.barRow}>
                      <span className={styles.barLabel} title={u.userName}>{u.userName}</span>
                      <div className={styles.barTrack} role="presentation">
                        <div
                          className={styles.barFill}
                          style={{ width: `${Math.round((u.tokensUsed / maxTokens) * 100)}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{formatTokens(u.tokensUsed)}</span>
                    </div>
                  ))}
              </div>
            )}

            {data && data.usage.byUser.every((u) => u.tokensUsed === 0) && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
                Nenhum uso registrado este mês.
              </p>
            )}
          </>
        )}
      </section>

      {/* User Quota Table */}
      <section className={styles.section} aria-labelledby="quota-title">
        <h2 className={styles.sectionTitle} id="quota-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Cotas por Usuário
        </h2>

        {loading ? (
          <div className={styles.skeleton}>
            {[1, 2, 3].map((i) => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : !data || data.quotas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Nenhum usuário ativo encontrado.
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>IA Ativa</th>
                  <th>Uso do mês</th>
                  <th>Cota mensal (tokens)</th>
                  <th>Reset mensal</th>
                  <th>Acumular</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.quotas.map((q) => {
                  const edit = quotaEdits[q.userId] ?? {
                    monthlyTokens: q.monthlyTokens,
                    resetMonthly: q.resetMonthly,
                    accumulating: q.accumulating,
                  }
                  const pctColor =
                    q.pct >= 90
                      ? styles.progressRed
                      : q.pct >= 70
                      ? styles.progressYellow
                      : styles.progressGreen

                  return (
                    <tr key={q.userId}>
                      <td className={styles.userCell}>
                        <div className={styles.userName}>{q.userName}</div>
                        <div className={styles.userEmail}>{q.userEmail}</div>
                      </td>
                      <td>
                        <label className={styles.toggle} aria-label={`Habilitar IA para ${q.userName}`}>
                          <input
                            type="checkbox"
                            checked={q.aiEnabled}
                            onChange={(e) => handleSaveQuota(q.userId, e.target.checked)}
                            disabled={savingQuota[q.userId]}
                          />
                          <span className={styles.slider} />
                        </label>
                      </td>
                      <td>
                        <div className={styles.progressWrap}>
                          <div className={styles.progressTrack}>
                            <div
                              className={`${styles.progressFill} ${pctColor}`}
                              style={{ width: `${Math.min(100, q.pct)}%` }}
                            />
                          </div>
                          <div className={styles.progressLabel}>
                            {formatTokens(q.tokensUsed)} / {formatTokens(q.monthlyTokens)} ({q.pct}%)
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <input
                            type="number"
                            className={styles.quotaInput}
                            min={1000}
                            max={10_000_000}
                            step={1000}
                            value={edit.monthlyTokens}
                            onChange={(e) =>
                              setQuotaEdits((prev) => ({
                                ...prev,
                                [q.userId]: { ...edit, monthlyTokens: Number(e.target.value) },
                              }))
                            }
                            aria-label="Tokens mensais"
                          />
                          <div className={styles.articlePreview}>{tokensToArticles(edit.monthlyTokens)}</div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.checkboxRow}>
                          <input
                            type="checkbox"
                            id={`reset-${q.userId}`}
                            checked={edit.resetMonthly}
                            onChange={(e) =>
                              setQuotaEdits((prev) => ({
                                ...prev,
                                [q.userId]: { ...edit, resetMonthly: e.target.checked },
                              }))
                            }
                          />
                          <label htmlFor={`reset-${q.userId}`} className={styles.label}>Sim</label>
                        </div>
                      </td>
                      <td>
                        <div className={styles.checkboxRow}>
                          <input
                            type="checkbox"
                            id={`accum-${q.userId}`}
                            checked={edit.accumulating}
                            onChange={(e) =>
                              setQuotaEdits((prev) => ({
                                ...prev,
                                [q.userId]: { ...edit, accumulating: e.target.checked },
                              }))
                            }
                          />
                          <label htmlFor={`accum-${q.userId}`} className={styles.label}>Sim</label>
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionCell}>
                          <button
                            className={styles.applyBtn}
                            onClick={() => handleSaveQuota(q.userId, q.aiEnabled)}
                            disabled={savingQuota[q.userId]}
                          >
                            {savingQuota[q.userId] ? 'Salvando…' : 'Aplicar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trends shortcut */}
      <section className={styles.section} aria-labelledby="trends-title">
        <h2 className={styles.sectionTitle} id="trends-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Análise de Tendências
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 var(--space-4) 0' }}>
          Use IA para identificar tópicos em crescimento, declínio e lacunas de conteúdo no seu blog.
        </p>
        <Link
          href="/admin/ai-quotas/trends"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Ir para Tendências
        </Link>
      </section>
    </div>
  )
}
