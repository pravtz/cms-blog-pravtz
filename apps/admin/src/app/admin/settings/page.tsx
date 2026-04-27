'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme, THEMES, ThemeName } from '@/lib/useTheme'
import { useToast } from '@/components'
import styles from './page.module.css'

type NotificationEvent =
  | 'new_pending_user'
  | 'new_comment'
  | 'suspicious_login'
  | 'post_published'
  | 'critical_system_error'

interface ChannelConfig {
  enabled: boolean
  webhookUrl?: string
  events: NotificationEvent[]
}

interface EmailChannelConfig {
  enabled: boolean
  events: NotificationEvent[]
}

interface NotificationSettings {
  teams: ChannelConfig
  slack: ChannelConfig
  discord: ChannelConfig
  email: EmailChannelConfig
}

const EVENT_LABELS: Record<NotificationEvent, string> = {
  new_pending_user: 'New pending user awaiting approval',
  new_comment: 'New comment on a post',
  suspicious_login: 'Suspicious login / brute-force blocked',
  post_published: 'Post published',
  critical_system_error: 'Critical system error',
}

const ALL_EVENTS: NotificationEvent[] = [
  'new_pending_user',
  'new_comment',
  'suspicious_login',
  'post_published',
  'critical_system_error',
]

const DEFAULT_SETTINGS: NotificationSettings = {
  teams: { enabled: false, webhookUrl: '', events: [] },
  slack: { enabled: false, webhookUrl: '', events: [] },
  discord: { enabled: false, webhookUrl: '', events: [] },
  email: { enabled: false, events: [] },
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

type WebhookChannel = 'teams' | 'slack' | 'discord'

interface ChannelCardProps {
  channel: WebhookChannel
  label: string
  icon: React.ReactNode
  config: ChannelConfig
  onChange: (config: ChannelConfig) => void
  onTest: (channel: string, webhookUrl?: string) => Promise<void>
  testing: boolean
}

function ChannelCard({ channel, label, icon, config, onChange, onTest, testing }: ChannelCardProps) {
  const toggleEvent = (event: NotificationEvent) => {
    const events = config.events.includes(event)
      ? config.events.filter((e) => e !== event)
      : [...config.events, event]
    onChange({ ...config, events })
  }

  return (
    <div className={styles.channelCard}>
      <div className={styles.channelHeader}>
        <div className={styles.channelIcon}>{icon}</div>
        <div className={styles.channelInfo}>
          <span className={styles.channelName}>{label}</span>
          <span className={styles.channelType}>Webhook</span>
        </div>
        <label className={styles.toggle} aria-label={`Enable ${label}`}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          <span className={styles.toggleSlider} />
        </label>
      </div>

      {config.enabled && (
        <div className={styles.channelBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor={`webhook-${channel}`}>
              Webhook URL
            </label>
            <div className={styles.webhookRow}>
              <input
                id={`webhook-${channel}`}
                type="url"
                className={styles.webhookInput}
                value={config.webhookUrl ?? ''}
                onChange={(e) => onChange({ ...config, webhookUrl: e.target.value })}
                placeholder={`https://...`}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.testBtn}
                onClick={() => onTest(channel, config.webhookUrl)}
                disabled={testing || !config.webhookUrl}
              >
                {testing ? 'Sending…' : 'Test'}
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Notify on events</span>
            <div className={styles.eventList}>
              {ALL_EVENTS.map((event) => (
                <label key={event} className={styles.eventItem}>
                  <input
                    type="checkbox"
                    checked={config.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span>{EVENT_LABELS[event]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface EmailCardProps {
  config: EmailChannelConfig
  onChange: (config: EmailChannelConfig) => void
  onTest: (channel: string) => Promise<void>
  testing: boolean
}

function EmailCard({ config, onChange, onTest, testing }: EmailCardProps) {
  const toggleEvent = (event: NotificationEvent) => {
    const events = config.events.includes(event)
      ? config.events.filter((e) => e !== event)
      : [...config.events, event]
    onChange({ ...config, events })
  }

  return (
    <div className={styles.channelCard}>
      <div className={styles.channelHeader}>
        <div className={styles.channelIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <div className={styles.channelInfo}>
          <span className={styles.channelName}>Email</span>
          <span className={styles.channelType}>Uses configured SMTP</span>
        </div>
        <label className={styles.toggle} aria-label="Enable Email notifications">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          <span className={styles.toggleSlider} />
        </label>
      </div>

      {config.enabled && (
        <div className={styles.channelBody}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Notify on events</span>
            <div className={styles.eventList}>
              {ALL_EVENTS.map((event) => (
                <label key={event} className={styles.eventItem}>
                  <input
                    type="checkbox"
                    checked={config.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span>{EVENT_LABELS[event]}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.testBtn}
            onClick={() => onTest('email')}
            disabled={testing}
            style={{ marginTop: 'var(--space-3)' }}
          >
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loadingNotif, setLoadingNotif] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)
  const [testingChannel, setTestingChannel] = useState<string | null>(null)

  const [clarityEnabled, setClarityEnabled] = useState(false)
  const [clarityProjectId, setClarityProjectId] = useState('')
  const [loadingClarity, setLoadingClarity] = useState(true)
  const [savingClarity, setSavingClarity] = useState(false)

  const fetchClaritySettings = useCallback(async () => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/clarity-settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setClarityEnabled(data.enabled)
        setClarityProjectId(data.projectId ?? '')
      }
    } catch {
      // silently fail
    } finally {
      setLoadingClarity(false)
    }
  }, [])

  useEffect(() => {
    fetchClaritySettings()
  }, [fetchClaritySettings])

  const saveClaritySettings = async () => {
    setSavingClarity(true)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/clarity-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled: clarityEnabled, projectId: clarityProjectId }),
      })
      if (res.ok) {
        toast({ variant: 'success', title: 'Analytics settings saved.' })
      } else {
        const data = await res.json()
        toast({ variant: 'error', title: data.error ?? 'Failed to save analytics settings.' })
      }
    } catch {
      toast({ variant: 'error', title: 'Network error. Please try again.' })
    } finally {
      setSavingClarity(false)
    }
  }

  const fetchNotifSettings = useCallback(async () => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/notification-settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setNotifSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch {
      // silently fail — defaults are fine
    } finally {
      setLoadingNotif(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifSettings()
  }, [fetchNotifSettings])

  const saveNotifSettings = async () => {
    setSavingNotif(true)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(notifSettings),
      })
      if (res.ok) {
        toast({ variant: 'success', title: 'Notification settings saved.' })
      } else {
        const data = await res.json()
        toast({ variant: 'error', title: data.error ?? 'Failed to save settings.' })
      }
    } catch {
      toast({ variant: 'error', title: 'Network error. Please try again.' })
    } finally {
      setSavingNotif(false)
    }
  }

  const testChannel = async (channel: string, webhookUrl?: string) => {
    setTestingChannel(channel)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/notification-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ channel, webhookUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ variant: 'success', title: data.message ?? 'Test sent successfully.' })
      } else {
        toast({ variant: 'error', title: data.error ?? 'Test failed.' })
      }
    } catch {
      toast({ variant: 'error', title: 'Network error during test.' })
    } finally {
      setTestingChannel(null)
    }
  }

  return (
    <div className={styles.page}>
      <h1 style={{ fontSize: 'var(--text-h1)', marginBottom: 'var(--space-8)' }}>Settings</h1>

      {/* Appearance */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <p className={styles.sectionDesc}>
          Choose a color theme for the admin panel. Your preference is saved locally.
        </p>

        <div className={styles.themeGrid} role="radiogroup" aria-label="Color theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className={`${styles.themeCard} ${theme === t.id ? styles.active : ''}`}
              onClick={() => setTheme(t.id as ThemeName)}
            >
              <div
                className={styles.themePreview}
                style={{ background: t.bg }}
                aria-hidden="true"
              >
                <span
                  className={styles.accentDot}
                  style={{ background: t.accent }}
                />
              </div>
              <div className={styles.themeLabel}>
                <span>{t.label}</span>
                {theme === t.id && (
                  <svg
                    className={styles.checkIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Analytics */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Analytics</h2>
        <p className={styles.sectionDesc}>
          Integrate Microsoft Clarity to track visitor behaviour on the public blog. Clarity is
          only loaded for non-logged-in visitors. Requires a free{' '}
          <a
            href="https://clarity.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            Microsoft Clarity
          </a>{' '}
          account and a Project ID.
        </p>

        {loadingClarity ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</p>
        ) : (
          <div className={styles.analyticsCard}>
            <div className={styles.analyticsHeader}>
              <div className={styles.analyticsIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
              </div>
              <div className={styles.analyticsInfo}>
                <span className={styles.analyticsName}>Microsoft Clarity</span>
                <span className={styles.analyticsSubtext}>Heatmaps &amp; session recordings</span>
              </div>
              <label className={styles.toggle} aria-label="Enable Microsoft Clarity">
                <input
                  type="checkbox"
                  checked={clarityEnabled}
                  onChange={(e) => setClarityEnabled(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            {clarityEnabled && (
              <div className={styles.analyticsBody}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="clarity-project-id">
                    Clarity Project ID
                  </label>
                  <input
                    id="clarity-project-id"
                    type="text"
                    className={styles.analyticsInput}
                    value={clarityProjectId}
                    onChange={(e) => setClarityProjectId(e.target.value)}
                    placeholder="e.g. abc123xyz"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Found in your Clarity dashboard → Settings → Overview.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.saveBtn}
          onClick={saveClaritySettings}
          disabled={savingClarity || loadingClarity}
        >
          {savingClarity ? 'Saving…' : 'Save analytics settings'}
        </button>
      </section>

      {/* Notification Integrations */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Notification Integrations</h2>
        <p className={styles.sectionDesc}>
          Configure external channels to receive notifications on key events. Enable each channel
          individually and select which events trigger notifications.
        </p>

        {loadingNotif ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading…
          </p>
        ) : (
          <>
            <div className={styles.channelList}>
              <ChannelCard
                channel="teams"
                label="Microsoft Teams"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.5 8h-1V7a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3v1H9.5A2.5 2.5 0 0 0 7 10.5v6A2.5 2.5 0 0 0 9.5 19h10a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 19.5 8zM13 7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1h-3V7zM5 13.5A1.5 1.5 0 0 1 3.5 12v-1A1.5 1.5 0 0 1 5 9.5h1V8H5a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3h1v-1.5H5z"/>
                  </svg>
                }
                config={notifSettings.teams}
                onChange={(cfg) => setNotifSettings((s) => ({ ...s, teams: cfg }))}
                onTest={testChannel}
                testing={testingChannel === 'teams'}
              />

              <ChannelCard
                channel="slack"
                label="Slack"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                }
                config={notifSettings.slack}
                onChange={(cfg) => setNotifSettings((s) => ({ ...s, slack: cfg }))}
                onTest={testChannel}
                testing={testingChannel === 'slack'}
              />

              <ChannelCard
                channel="discord"
                label="Discord"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                }
                config={notifSettings.discord}
                onChange={(cfg) => setNotifSettings((s) => ({ ...s, discord: cfg }))}
                onTest={testChannel}
                testing={testingChannel === 'discord'}
              />

              <EmailCard
                config={notifSettings.email}
                onChange={(cfg) => setNotifSettings((s) => ({ ...s, email: cfg }))}
                onTest={testChannel}
                testing={testingChannel === 'email'}
              />
            </div>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={saveNotifSettings}
              disabled={savingNotif}
            >
              {savingNotif ? 'Saving…' : 'Save notification settings'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
