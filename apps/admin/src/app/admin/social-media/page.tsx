'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components'
import styles from './page.module.css'

interface NetworkBase {
  profileUrl: string
  autoShare: boolean
}

interface TwitterConfig extends NetworkBase {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
}

interface LinkedInConfig extends NetworkBase {
  accessToken: string
  personUrn: string
}

interface FacebookConfig extends NetworkBase {
  pageId: string
  pageAccessToken: string
}

interface SocialMediaSettings {
  github: NetworkBase
  instagram: NetworkBase
  linkedin: LinkedInConfig
  facebook: FacebookConfig
  twitter: TwitterConfig
}

const DEFAULT_SETTINGS: SocialMediaSettings = {
  github: { profileUrl: '', autoShare: false },
  instagram: { profileUrl: '', autoShare: false },
  linkedin: { profileUrl: '', autoShare: false, accessToken: '', personUrn: '' },
  facebook: { profileUrl: '', autoShare: false, pageId: '', pageAccessToken: '' },
  twitter: { profileUrl: '', autoShare: false, apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' },
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

type ConnectionStatus = 'unknown' | 'connected' | 'error'

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return <span className={`${styles.statusBadge} ${styles.statusConnected}`}>Connected</span>
  }
  if (status === 'error') {
    return <span className={`${styles.statusBadge} ${styles.statusError}`}>Not connected</span>
  }
  return <span className={`${styles.statusBadge} ${styles.statusUnknown}`}>Not configured</span>
}

interface NetworkCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  profileUrl: string
  onProfileUrlChange: (v: string) => void
  autoShare: boolean
  onAutoShareChange: (v: boolean) => void
  hasApiSupport: boolean
  connectionStatus: ConnectionStatus
  onTest?: () => Promise<void>
  testing?: boolean
  children?: React.ReactNode
}

function NetworkCard({
  title,
  subtitle,
  icon,
  profileUrl,
  onProfileUrlChange,
  autoShare,
  onAutoShareChange,
  hasApiSupport,
  connectionStatus,
  onTest,
  testing,
  children,
}: NetworkCardProps) {
  return (
    <div className={styles.networkCard}>
      <div className={styles.networkHeader}>
        <div className={styles.networkIcon}>{icon}</div>
        <div className={styles.networkInfo}>
          <span className={styles.networkName}>{title}</span>
          <span className={styles.networkSubtitle}>{subtitle}</span>
        </div>
        <StatusBadge status={connectionStatus} />
      </div>

      <div className={styles.networkBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`profile-${title}`}>
            Profile URL
          </label>
          <input
            id={`profile-${title}`}
            type="url"
            className={styles.fieldInput}
            value={profileUrl}
            onChange={(e) => onProfileUrlChange(e.target.value)}
            placeholder={`https://${title.toLowerCase()}.com/yourprofile`}
          />
        </div>

        {children}

        {hasApiSupport && (
          <div className={styles.autoShareRow}>
            <label className={styles.autoShareLabel}>
              <span className={styles.autoShareText}>
                <strong>Auto-share on publish</strong>
                <span className={styles.autoShareHint}>
                  Automatically post to {title} when a new post is published
                </span>
              </span>
              <label className={styles.toggle} aria-label={`Auto-share to ${title}`}>
                <input
                  type="checkbox"
                  checked={autoShare}
                  onChange={(e) => onAutoShareChange(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </label>

            {onTest && (
              <button
                type="button"
                className={styles.testBtn}
                onClick={onTest}
                disabled={testing}
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SocialMediaPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SocialMediaSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingNetwork, setTestingNetwork] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({
    twitter: 'unknown',
    linkedin: 'unknown',
    facebook: 'unknown',
  })

  const fetchSettings = useCallback(async () => {
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/social-media', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json() as { settings: SocialMediaSettings }
        setSettings((prev) => ({ ...prev, ...data.settings }))

        // Infer initial connection status from existing credentials
        const s = data.settings
        setConnectionStatus({
          twitter: s.twitter.apiKey ? 'connected' : 'unknown',
          linkedin: s.linkedin.accessToken ? 'connected' : 'unknown',
          facebook: s.facebook.pageId ? 'connected' : 'unknown',
        })
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/social-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ variant: 'success', title: 'Social media settings saved.' })
      } else {
        const data = await res.json() as { error?: string }
        toast({ variant: 'error', title: data.error ?? 'Failed to save settings.' })
      }
    } catch {
      toast({ variant: 'error', title: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (network: 'twitter' | 'linkedin' | 'facebook') => {
    setTestingNetwork(network)
    // Save first so the API has the latest credentials
    try {
      const token = getAccessToken()
      await fetch('/api/admin/social-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      })
    } catch {
      // ignore save error before test
    }

    try {
      const token = getAccessToken()
      const res = await fetch('/api/admin/social-media/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ network }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (res.ok) {
        toast({ variant: 'success', title: data.message ?? 'Connection successful.' })
        setConnectionStatus((s) => ({ ...s, [network]: 'connected' }))
      } else {
        toast({ variant: 'error', title: data.error ?? 'Connection test failed.' })
        setConnectionStatus((s) => ({ ...s, [network]: 'error' }))
      }
    } catch {
      toast({ variant: 'error', title: 'Network error during test.' })
      setConnectionStatus((s) => ({ ...s, [network]: 'error' }))
    } finally {
      setTestingNetwork(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 style={{ fontSize: 'var(--text-h1)', marginBottom: 'var(--space-2)' }}>
        Redes Sociais
      </h1>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-8)' }}>
        Configure your social media profiles and enable auto-sharing when posts are published.
        Networks with API integration support automatic posting; others display profile links only.
      </p>

      <div className={styles.networkList}>
        {/* GitHub — profile URL only */}
        <NetworkCard
          title="GitHub"
          subtitle="Profile URL only"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          }
          profileUrl={settings.github.profileUrl}
          onProfileUrlChange={(v) => setSettings((s) => ({ ...s, github: { ...s.github, profileUrl: v } }))}
          autoShare={settings.github.autoShare}
          onAutoShareChange={(v) => setSettings((s) => ({ ...s, github: { ...s.github, autoShare: v } }))}
          hasApiSupport={false}
          connectionStatus="unknown"
        />

        {/* Instagram — profile URL only */}
        <NetworkCard
          title="Instagram"
          subtitle="Profile URL — auto-share requires Instagram Business API"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
          }
          profileUrl={settings.instagram.profileUrl}
          onProfileUrlChange={(v) => setSettings((s) => ({ ...s, instagram: { ...s.instagram, profileUrl: v } }))}
          autoShare={settings.instagram.autoShare}
          onAutoShareChange={(v) => setSettings((s) => ({ ...s, instagram: { ...s.instagram, autoShare: v } }))}
          hasApiSupport={false}
          connectionStatus="unknown"
        />

        {/* X / Twitter */}
        <NetworkCard
          title="X / Twitter"
          subtitle="OAuth 1.0a — posts as tweet on publish"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          }
          profileUrl={settings.twitter.profileUrl}
          onProfileUrlChange={(v) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, profileUrl: v } }))}
          autoShare={settings.twitter.autoShare}
          onAutoShareChange={(v) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, autoShare: v } }))}
          hasApiSupport={true}
          connectionStatus={connectionStatus.twitter as ConnectionStatus}
          onTest={() => testConnection('twitter')}
          testing={testingNetwork === 'twitter'}
        >
          <div className={styles.credentialsGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="twitter-api-key">API Key</label>
              <input
                id="twitter-api-key"
                type="password"
                className={styles.fieldInput}
                value={settings.twitter.apiKey}
                onChange={(e) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, apiKey: e.target.value } }))}
                placeholder="API Key"
                autoComplete="off"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="twitter-api-secret">API Secret</label>
              <input
                id="twitter-api-secret"
                type="password"
                className={styles.fieldInput}
                value={settings.twitter.apiSecret}
                onChange={(e) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, apiSecret: e.target.value } }))}
                placeholder="API Secret (masked)"
                autoComplete="off"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="twitter-access-token">Access Token</label>
              <input
                id="twitter-access-token"
                type="password"
                className={styles.fieldInput}
                value={settings.twitter.accessToken}
                onChange={(e) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, accessToken: e.target.value } }))}
                placeholder="Access Token"
                autoComplete="off"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="twitter-access-secret">Access Token Secret</label>
              <input
                id="twitter-access-secret"
                type="password"
                className={styles.fieldInput}
                value={settings.twitter.accessTokenSecret}
                onChange={(e) => setSettings((s) => ({ ...s, twitter: { ...s.twitter, accessTokenSecret: e.target.value } }))}
                placeholder="Access Token Secret (masked)"
                autoComplete="off"
              />
            </div>
          </div>
          <p className={styles.helpText}>
            Get credentials from{' '}
            <span className={styles.helpLink}>developer.twitter.com</span> → Your app → Keys and Tokens.
            Requires{' '}
            <strong>Read and Write</strong> app permissions with OAuth 1.0a User Context.
          </p>
        </NetworkCard>

        {/* LinkedIn */}
        <NetworkCard
          title="LinkedIn"
          subtitle="Share API — posts to your profile or page"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          }
          profileUrl={settings.linkedin.profileUrl}
          onProfileUrlChange={(v) => setSettings((s) => ({ ...s, linkedin: { ...s.linkedin, profileUrl: v } }))}
          autoShare={settings.linkedin.autoShare}
          onAutoShareChange={(v) => setSettings((s) => ({ ...s, linkedin: { ...s.linkedin, autoShare: v } }))}
          hasApiSupport={true}
          connectionStatus={connectionStatus.linkedin as ConnectionStatus}
          onTest={() => testConnection('linkedin')}
          testing={testingNetwork === 'linkedin'}
        >
          <div className={styles.credentialsGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="linkedin-access-token">Access Token</label>
              <input
                id="linkedin-access-token"
                type="password"
                className={styles.fieldInput}
                value={settings.linkedin.accessToken}
                onChange={(e) => setSettings((s) => ({ ...s, linkedin: { ...s.linkedin, accessToken: e.target.value } }))}
                placeholder="OAuth 2.0 Access Token (masked)"
                autoComplete="off"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="linkedin-person-urn">Person / Organization URN</label>
              <input
                id="linkedin-person-urn"
                type="text"
                className={styles.fieldInput}
                value={settings.linkedin.personUrn}
                onChange={(e) => setSettings((s) => ({ ...s, linkedin: { ...s.linkedin, personUrn: e.target.value } }))}
                placeholder="urn:li:person:XXXXXXXX"
              />
            </div>
          </div>
          <p className={styles.helpText}>
            Use the LinkedIn Developer Portal to create an app and generate an access token with{' '}
            <strong>w_member_social</strong> scope. Your Person URN is returned by the{' '}
            <code>/v2/userinfo</code> endpoint.
          </p>
        </NetworkCard>

        {/* Facebook */}
        <NetworkCard
          title="Facebook"
          subtitle="Graph API — posts to your Facebook Page"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          }
          profileUrl={settings.facebook.profileUrl}
          onProfileUrlChange={(v) => setSettings((s) => ({ ...s, facebook: { ...s.facebook, profileUrl: v } }))}
          autoShare={settings.facebook.autoShare}
          onAutoShareChange={(v) => setSettings((s) => ({ ...s, facebook: { ...s.facebook, autoShare: v } }))}
          hasApiSupport={true}
          connectionStatus={connectionStatus.facebook as ConnectionStatus}
          onTest={() => testConnection('facebook')}
          testing={testingNetwork === 'facebook'}
        >
          <div className={styles.credentialsGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="facebook-page-id">Page ID</label>
              <input
                id="facebook-page-id"
                type="text"
                className={styles.fieldInput}
                value={settings.facebook.pageId}
                onChange={(e) => setSettings((s) => ({ ...s, facebook: { ...s.facebook, pageId: e.target.value } }))}
                placeholder="123456789012345"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="facebook-page-access-token">Page Access Token</label>
              <input
                id="facebook-page-access-token"
                type="password"
                className={styles.fieldInput}
                value={settings.facebook.pageAccessToken}
                onChange={(e) => setSettings((s) => ({ ...s, facebook: { ...s.facebook, pageAccessToken: e.target.value } }))}
                placeholder="Page Access Token (masked)"
                autoComplete="off"
              />
            </div>
          </div>
          <p className={styles.helpText}>
            Create a Facebook App at <span className={styles.helpLink}>developers.facebook.com</span>, add
            the <strong>pages_manage_posts</strong> permission, and generate a Page Access Token via
            Graph API Explorer. The Page ID is visible in your Page&apos;s About section.
          </p>
        </NetworkCard>
      </div>

      <button
        type="button"
        className={styles.saveBtn}
        onClick={saveSettings}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save social media settings'}
      </button>
    </div>
  )
}
