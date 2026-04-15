'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { Badge } from '@/components'
import { useToast } from '@/components'

interface Category {
  id: string
  name: string
}

interface TrendItem {
  topic: string
  score: number
  justification: string
  suggestedTitle?: string
}

interface TrendsReport {
  growing: TrendItem[]
  declining: TrendItem[]
  gaps: TrendItem[]
  tokensUsed: number
  monthlyLimit: number
  totalUsed: number
}

interface AiStatus {
  aiEnabled: boolean
  providerActive: boolean
  monthlyTokens: number
  tokensUsed: number
}

const TIME_WINDOWS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
]

function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 8 ? 'success' : score >= 5 ? 'warning' : 'default'
  return (
    <Badge variant={variant}>
      {score.toFixed(1)}
    </Badge>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function TrendsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [timeWindow, setTimeWindow] = useState(30)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<TrendsReport | null>(null)
  const [initLoading, setInitLoading] = useState(true)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchInit = useCallback(async () => {
    setInitLoading(true)
    const token = getToken()
    try {
      const [statusRes, catRes] = await Promise.all([
        fetch('/api/admin/ai/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (statusRes.ok) {
        setAiStatus(await statusRes.json() as AiStatus)
      }
      if (catRes.ok) {
        const catData = await catRes.json() as { categories: Category[] }
        setCategories(catData.categories ?? [])
      }
    } catch {
      toast({ variant: 'error', title: 'Erro ao carregar dados iniciais.' })
    } finally {
      setInitLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchInit()
  }, [fetchInit])

  async function handleAnalyze() {
    setLoading(true)
    setReport(null)
    const token = getToken()
    try {
      const payload: Record<string, unknown> = { timeWindow }
      if (categoryId) payload.categoryId = categoryId

      const res = await fetch('/api/admin/ai/trends', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Erro ao analisar tendências')
      }

      const data = await res.json() as TrendsReport
      setReport(data)
      toast({ variant: 'success', title: `Análise concluída. ${formatTokens(data.tokensUsed)} tokens usados.` })
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Erro ao analisar.' })
    } finally {
      setLoading(false)
    }
  }

  function handleCreatePost(title: string) {
    const encoded = encodeURIComponent(title)
    router.push(`/admin/posts/new?title=${encoded}`)
  }

  if (initLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {[1, 2, 3].map((i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    )
  }

  const aiBlocked = !aiStatus?.aiEnabled || !aiStatus?.providerActive

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin/ai-quotas" className={styles.breadcrumbLink}>IA &amp; Cotas</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Tendências</span>
        </div>
        <h1 className={styles.title}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Análise de Tendências
        </h1>
        <p className={styles.subtitle}>
          Identifique tópicos em crescimento, em declínio e lacunas de conteúdo com base nos seus posts.
        </p>
      </div>

      {aiBlocked && (
        <div className={styles.blocked} role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>IA não disponível.</strong>{' '}
            {!aiStatus?.providerActive
              ? 'Nenhum provedor de IA ativo. Configure em '
              : 'IA não habilitada para sua conta. Solicite ao proprietário em '}
            <Link href="/admin/ai-quotas" className={styles.blockedLink}>IA &amp; Cotas</Link>.
          </div>
        </div>
      )}

      {/* Controls */}
      <section className={styles.section} aria-labelledby="controls-title">
        <h2 className={styles.sectionTitle} id="controls-title">Parâmetros da Análise</h2>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="time-window">Janela de tempo</label>
            <div className={styles.segmented} role="group" aria-label="Janela de tempo">
              {TIME_WINDOWS.map((tw) => (
                <button
                  key={tw.value}
                  className={`${styles.segment} ${timeWindow === tw.value ? styles.segmentActive : ''}`}
                  onClick={() => setTimeWindow(tw.value)}
                  aria-pressed={timeWindow === tw.value}
                >
                  {tw.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="category-filter">Categoria</label>
            <select
              id="category-filter"
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            {report && aiStatus && (
              <div className={styles.tokenBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                {formatTokens(report.totalUsed)} / {formatTokens(report.monthlyLimit)} tokens usados
              </div>
            )}
          </div>
        </div>

        <button
          className={styles.analyzeBtn}
          onClick={handleAnalyze}
          disabled={loading || aiBlocked}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Analisando…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Analisar Tendências
            </>
          )}
        </button>
      </section>

      {/* Loading skeleton */}
      {loading && (
        <div className={styles.analyzingSkeleton} aria-live="polite" aria-label="Analisando tendências">
          <div className={styles.analyzingMsg}>
            <span className={styles.spinner} aria-hidden="true" />
            Consultando IA e analisando dados…
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonSection}>
              <div className={styles.skeletonTitle} />
              {[1, 2, 3].map((j) => <div key={j} className={styles.skeletonCard} />)}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <div className={styles.results} aria-live="polite">
          {/* Growing Topics */}
          <section className={styles.resultSection} aria-labelledby="growing-title">
            <h2 className={styles.resultSectionTitle} id="growing-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Tópicos em Crescimento
              <Badge variant="success">{report.growing.length}</Badge>
            </h2>
            <div className={styles.cardList}>
              {report.growing.map((item, i) => (
                <TrendCard
                  key={i}
                  item={item}
                  type="growing"
                  onCreatePost={handleCreatePost}
                />
              ))}
              {report.growing.length === 0 && (
                <p className={styles.emptyMsg}>Nenhum tópico em crescimento identificado.</p>
              )}
            </div>
          </section>

          {/* Declining Topics */}
          <section className={styles.resultSection} aria-labelledby="declining-title">
            <h2 className={styles.resultSectionTitle} id="declining-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
              Tópicos em Declínio
              <Badge variant="warning">{report.declining.length}</Badge>
            </h2>
            <div className={styles.cardList}>
              {report.declining.map((item, i) => (
                <TrendCard
                  key={i}
                  item={item}
                  type="declining"
                  onCreatePost={handleCreatePost}
                />
              ))}
              {report.declining.length === 0 && (
                <p className={styles.emptyMsg}>Nenhum tópico em declínio identificado.</p>
              )}
            </div>
          </section>

          {/* Content Gaps */}
          <section className={styles.resultSection} aria-labelledby="gaps-title">
            <h2 className={styles.resultSectionTitle} id="gaps-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Lacunas de Conteúdo
              <Badge variant="info">{report.gaps.length}</Badge>
            </h2>
            <div className={styles.cardList}>
              {report.gaps.map((item, i) => (
                <TrendCard
                  key={i}
                  item={item}
                  type="gap"
                  onCreatePost={handleCreatePost}
                />
              ))}
              {report.gaps.length === 0 && (
                <p className={styles.emptyMsg}>Nenhuma lacuna de conteúdo identificada.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {!report && !loading && (
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <p>Selecione os parâmetros e clique em <strong>Analisar Tendências</strong> para gerar o relatório.</p>
        </div>
      )}
    </div>
  )
}

function TrendCard({
  item,
  type,
  onCreatePost,
}: {
  item: TrendItem
  type: 'growing' | 'declining' | 'gap'
  onCreatePost: (title: string) => void
}) {
  const canCreate = (type === 'growing' || type === 'gap') && Boolean(item.suggestedTitle)

  return (
    <div className={styles.trendCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTopic}>{item.topic}</span>
        <ScoreBadge score={item.score} />
      </div>
      <p className={styles.cardJustification}>{item.justification}</p>
      {item.suggestedTitle && (
        <div className={styles.suggestedTitle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{item.suggestedTitle}</span>
        </div>
      )}
      {canCreate && (
        <button
          className={styles.createBtn}
          onClick={() => onCreatePost(item.suggestedTitle!)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Criar post sobre este tópico
        </button>
      )}
    </div>
  )
}
