'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.css'
import { Badge } from '@/components'

export const dynamic = 'force-dynamic'

// --- Types ---
interface TimeSeriesPoint { date: string; views: number; unique_visitors: number }
interface TopPost {
  id: string; title: string; slug: string; views: number
  category_name: string | null; like_count: number; comment_count: number; engagement_rate: number
}
interface TrafficSource { source: string; views: number; percentage: number }
interface NewsletterPoint { date: string; new_subscribers: number }
interface SeoPost { id: string; title: string; slug: string; views: number; seo_score: number }
interface Summary {
  totalViews: number; totalLikes: number; totalComments: number
  overallEngagementRate: number; totalActiveSubscribers: number
  periodViews: number; periodUniqueVisitors: number
}
interface MetricsData {
  period: string; startDate: string; endDate: string
  timeSeries: TimeSeriesPoint[]
  topPosts: TopPost[]
  trafficSources: TrafficSource[]
  newsletterGrowth: NewsletterPoint[]
  totalActiveSubscribers: number
  seoScores: SeoPost[]
  summary: Summary
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '3m', label: '3 months' },
  { value: '12m', label: '12 months' },
  { value: 'custom', label: 'Custom' },
]

type ChartRow = { date: string } & Record<string, number | string>

// --- SVG Line Chart ---
function LineChart({
  data,
  keys,
  colors,
  height = 160,
}: {
  data: ChartRow[]
  keys: string[]
  colors: string[]
  height?: number
}) {
  const width = 100
  const padTop = 8
  const padBottom = 24
  const padLeft = 0
  const padRight = 0
  const chartH = height - padTop - padBottom
  const n = data.length

  if (n === 0) return <div className={styles.chartEmpty}>No data for this period</div>

  const allValues = data.flatMap((d) => keys.map((k) => Number(d[k])))
  const maxVal = Math.max(...allValues, 1)

  const points = (key: string) =>
    data.map((d, i) => {
      const x = padLeft + (i / Math.max(n - 1, 1)) * (width - padLeft - padRight)
      const y = padTop + chartH - (Number(d[key]) / maxVal) * chartH
      return `${x},${y}`
    })

  const areaPath = (key: string) => {
    const pts = points(key).map((p) => p.split(',').map(Number))
    const lineCoords = pts.map(([x, y]) => `${x},${y}`).join(' L')
    const first = pts[0]
    const last = pts[pts.length - 1]
    return `M${first[0]},${padTop + chartH} L${lineCoords} L${last[0]},${padTop + chartH} Z`
  }

  // X-axis labels: first and last date, and middle
  const labelIndices = n > 6 ? [0, Math.floor((n - 1) / 2), n - 1] : Array.from({ length: n }, (_, i) => i)
  const xLabel = (i: number) => padLeft + (i / Math.max(n - 1, 1)) * (width - padLeft - padRight)

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={styles.svgChart}
      role="img"
      aria-label="Line chart"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padLeft}
          y1={padTop + chartH * (1 - frac)}
          x2={width - padRight}
          y2={padTop + chartH * (1 - frac)}
          stroke="var(--border)"
          strokeWidth="0.3"
          strokeDasharray="2 2"
        />
      ))}

      {/* Area fills */}
      {keys.map((key, ki) => (
        <path key={`area-${key}`} d={areaPath(key)} fill={colors[ki]} fillOpacity="0.1" />
      ))}

      {/* Lines */}
      {keys.map((key, ki) => (
        <polyline
          key={`line-${key}`}
          points={points(key).join(' ')}
          fill="none"
          stroke={colors[ki]}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* X-axis labels */}
      {labelIndices.map((i) => (
        <text
          key={`xlabel-${i}`}
          x={xLabel(i)}
          y={height - 4}
          textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          fontSize="4"
          fill="var(--text-muted)"
        >
          {(data[i]?.date as string ?? '').slice(5)}
        </text>
      ))}
    </svg>
  )
}

// --- Bar Chart (horizontal for traffic sources) ---
function HorizontalBarChart({ data }: { data: TrafficSource[] }) {
  if (data.every((d) => d.views === 0)) {
    return <div className={styles.chartEmpty}>No traffic data for this period</div>
  }
  const SOURCE_COLORS: Record<string, string> = {
    organic: 'var(--accent)',
    direct: '#22c55e',
    referral: '#f59e0b',
    social: '#ec4899',
  }
  return (
    <div className={styles.barChartList}>
      {data.map((s) => (
        <div key={s.source} className={styles.barChartRow}>
          <div className={styles.barChartLabel}>{s.source.charAt(0).toUpperCase() + s.source.slice(1)}</div>
          <div className={styles.barChartTrack}>
            <div
              className={styles.barChartFill}
              style={{ width: `${s.percentage}%`, background: SOURCE_COLORS[s.source] ?? 'var(--accent)' }}
            />
          </div>
          <div className={styles.barChartValue}>{s.views.toLocaleString()} ({s.percentage}%)</div>
        </div>
      ))}
    </div>
  )
}

// --- SEO Score Bar ---
function SeoScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className={styles.seoScoreBar}>
      <div className={styles.seoScoreFill} style={{ width: `${score}%`, background: color }} />
    </div>
  )
}

// --- Main Page ---
export default function MetricsPage() {
  const [period, setPeriod] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)

  const fetchMetrics = useCallback(() => {
    const token = localStorage.getItem('accessToken')
    let url = `/api/admin/metrics/detailed?period=${period}`
    if (period === 'custom' && customFrom && customTo) {
      url += `&from=${customFrom}&to=${customTo}`
    }
    setLoading(true)
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, customFrom, customTo])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const handleExport = async (channels: string[]) => {
    const token = localStorage.getItem('accessToken')
    setExporting(true)
    setExportResult(null)
    try {
      const res = await fetch('/api/admin/metrics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ period, channels }),
      })
      const json = await res.json() as { ok: boolean; results: Record<string, string> }
      if (json.ok) {
        const msgs = Object.entries(json.results).map(([ch, r]) => `${ch}: ${r}`).join(', ')
        setExportResult(`Export sent — ${msgs}`)
      } else {
        setExportResult('Export failed')
      }
    } catch {
      setExportResult('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Metrics</h1>
          <p className={styles.subtitle}>Detailed analytics and performance data</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.periodFilter}>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.periodBtn} ${period === opt.value ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className={styles.exportMenu}>
            <button
              className={styles.exportBtn}
              disabled={exporting}
              onClick={() => handleExport(['email'])}
            >
              {exporting ? 'Sending…' : 'Email Summary'}
            </button>
            <button
              className={styles.exportBtn}
              disabled={exporting}
              onClick={() => handleExport(['teams', 'slack', 'discord'])}
              title="Send to configured notification channels"
            >
              Notify Channels
            </button>
          </div>
        </div>
      </div>

      {period === 'custom' && (
        <div className={styles.customRange}>
          <label className={styles.customLabel}>From</label>
          <input type="date" className={styles.dateInput} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <label className={styles.customLabel}>To</label>
          <input type="date" className={styles.dateInput} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          <button className={styles.applyBtn} onClick={fetchMetrics}>Apply</button>
        </div>
      )}

      {exportResult && (
        <div className={styles.exportResult}>{exportResult}</div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading metrics…</div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Period Views</div>
              <div className={styles.summaryValue}>{data.summary.periodViews.toLocaleString()}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Unique Visitors</div>
              <div className={styles.summaryValue}>{data.summary.periodUniqueVisitors.toLocaleString()}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Likes</div>
              <div className={styles.summaryValue}>{data.summary.totalLikes.toLocaleString()}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Comments</div>
              <div className={styles.summaryValue}>{data.summary.totalComments.toLocaleString()}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Engagement Rate</div>
              <div className={styles.summaryValue}>{data.summary.overallEngagementRate}%</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Newsletter</div>
              <div className={styles.summaryValue}>{data.summary.totalActiveSubscribers.toLocaleString()}</div>
            </div>
          </div>

          {/* Time Series Chart */}
          <div className={styles.chartPanel}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Visitors &amp; Page Views</h2>
              <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: 'var(--accent)' }} />
                <span className={styles.legendLabel}>Page Views</span>
                <span className={styles.legendDot} style={{ background: '#22c55e' }} />
                <span className={styles.legendLabel}>Unique Visitors</span>
              </div>
            </div>
            <LineChart
              data={data.timeSeries as unknown as ChartRow[]}
              keys={['views', 'unique_visitors']}
              colors={['var(--accent)', '#22c55e']}
              height={180}
            />
          </div>

          <div className={styles.twoCol}>
            {/* Traffic Sources */}
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Traffic Sources</h2>
                <span className={styles.chartSub}>{data.startDate} – {data.endDate}</span>
              </div>
              <HorizontalBarChart data={data.trafficSources} />
            </div>

            {/* Newsletter Growth */}
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Newsletter Growth</h2>
                <span className={styles.chartSub}>{data.totalActiveSubscribers.toLocaleString()} active subscribers</span>
              </div>
              <LineChart
                data={data.newsletterGrowth as unknown as ChartRow[]}
                keys={['new_subscribers']}
                colors={['#f59e0b']}
                height={180}
              />
            </div>
          </div>

          {/* Top Posts Ranking */}
          <div className={styles.chartPanel}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Top Posts by Views</h2>
            </div>
            {data.topPosts.length === 0 ? (
              <p className={styles.chartEmpty}>No published posts yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table} aria-label="Top posts by engagement">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Title</th>
                      <th scope="col">Category</th>
                      <th scope="col">Views</th>
                      <th scope="col">Likes</th>
                      <th scope="col">Comments</th>
                      <th scope="col">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPosts.map((post, i) => (
                      <tr key={post.id}>
                        <td className={styles.rankCell}>{i + 1}</td>
                        <td>
                          <a href={`/admin/posts/${post.id}/edit`} className={styles.postLink}>
                            {post.title || '(Untitled)'}
                          </a>
                        </td>
                        <td>
                          {post.category_name ? (
                            <Badge variant="default" size="sm">{post.category_name}</Badge>
                          ) : (
                            <span className={styles.noCategory}>—</span>
                          )}
                        </td>
                        <td className={styles.numCell}>{post.views.toLocaleString()}</td>
                        <td className={styles.numCell}>{post.like_count.toLocaleString()}</td>
                        <td className={styles.numCell}>{post.comment_count.toLocaleString()}</td>
                        <td className={styles.numCell}>
                          <span className={styles.engagementRate}>{post.engagement_rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SEO Scores */}
          <div className={styles.chartPanel}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>SEO Score per Post</h2>
              <span className={styles.chartSub}>Based on SEO title, description, cover image, and excerpt</span>
            </div>
            {data.seoScores.length === 0 ? (
              <p className={styles.chartEmpty}>No published posts yet.</p>
            ) : (
              <div className={styles.seoList}>
                {data.seoScores.map((p) => (
                  <div key={p.id} className={styles.seoRow}>
                    <div className={styles.seoTitle}>
                      <a href={`/admin/posts/${p.id}/edit`} className={styles.postLink}>
                        {(p.title as string) || '(Untitled)'}
                      </a>
                    </div>
                    <div className={styles.seoScoreWrapper}>
                      <SeoScoreBar score={p.seo_score} />
                      <span className={styles.seoScoreNum}>{p.seo_score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.loading}>Failed to load metrics.</div>
      )}
    </div>
  )
}
