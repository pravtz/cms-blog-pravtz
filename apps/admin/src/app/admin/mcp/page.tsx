'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import { useToast } from '@/components'

interface McpApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  revoked: number
  created_at: string
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'Z')
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function McpPage() {
  const { toast } = useToast()
  const [keys, setKeys] = useState<McpApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ key: string; name: string } | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mcp', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to load keys')
      const data = await res.json()
      setKeys(data.keys ?? [])
    } catch {
      toast({ variant: 'error', title: 'Failed to load MCP API keys.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newKeyName.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'error', title: data.error ?? 'Failed to create key.' })
        return
      }
      setCreatedKey({ key: data.key, name: data.name })
      setNewKeyName('')
      fetchKeys()
    } catch {
      toast({ variant: 'error', title: 'Failed to create key.' })
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? Any agent using it will lose access immediately.')) return
    setRevoking(id)
    try {
      const res = await fetch(`/api/admin/mcp?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'error', title: data.error ?? 'Failed to revoke key.' })
        return
      }
      toast({ variant: 'success', title: 'API key revoked.' })
      fetchKeys()
    } catch {
      toast({ variant: 'error', title: 'Failed to revoke key.' })
    } finally {
      setRevoking(null)
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: 'error', title: 'Failed to copy to clipboard.' })
    }
  }

  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>MCP Integration</h1>
          <p className={styles.subtitle}>
            Model Context Protocol — let AI agents interact with this CMS programmatically.
          </p>
        </div>
      </div>

      {/* Architecture overview */}
      <section className={styles.section} aria-labelledby="arch-heading">
        <h2 id="arch-heading" className={styles.sectionTitle}>How it works</h2>
        <div className={styles.archDiagram} role="img" aria-label="MCP architecture diagram">
          <div className={styles.archBox}>
            <span className={styles.archIcon}>🤖</span>
            <span>AI Agent</span>
            <small>(Claude, GPT-4…)</small>
          </div>
          <div className={styles.archArrow} aria-hidden="true">
            <span>stdio / MCP</span>
            <svg width="40" height="16" viewBox="0 0 40 16" fill="none" aria-hidden="true">
              <path d="M0 8h36M28 2l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.archBox}>
            <span className={styles.archIcon}>⚙️</span>
            <span>MCP Server</span>
            <small>@nexus/mcp-server</small>
          </div>
          <div className={styles.archArrow} aria-hidden="true">
            <span>HTTP + API key</span>
            <svg width="40" height="16" viewBox="0 0 40 16" fill="none" aria-hidden="true">
              <path d="M0 8h36M28 2l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.archBox}>
            <span className={styles.archIcon}>🗄️</span>
            <span>Nexus CMS</span>
            <small>/api/mcp</small>
          </div>
        </div>

        <div className={styles.toolList}>
          <h3 className={styles.toolListTitle}>Supported Tools</h3>
          <div className={styles.toolGrid}>
            {[
              { name: 'list_posts', desc: 'List posts with filters (status, category, tag, language)' },
              { name: 'get_post', desc: 'Get full content and metadata of a post by slug' },
              { name: 'create_post', desc: 'Create a new draft post' },
              { name: 'update_post', desc: 'Update title, content, excerpt, visibility of a post' },
              { name: 'publish_post', desc: 'Publish a draft or scheduled post immediately' },
              { name: 'list_categories', desc: 'List all categories with post counts' },
              { name: 'list_tags', desc: 'List all tags sorted by post count' },
              { name: 'search_posts', desc: 'Full-text search across title, excerpt, and content' },
            ].map((tool) => (
              <div key={tool.name} className={styles.toolCard}>
                <code className={styles.toolName}>{tool.name}</code>
                <span className={styles.toolDesc}>{tool.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Key Management */}
      <section className={styles.section} aria-labelledby="keys-heading">
        <h2 id="keys-heading" className={styles.sectionTitle}>API Keys</h2>
        <p className={styles.sectionHint}>
          Keys are stored as SHA-256 hashes. The raw key is shown only once at creation.
        </p>

        {/* Create key form */}
        <form className={styles.createForm} onSubmit={handleCreate} aria-label="Create new MCP API key">
          <label htmlFor="key-name" className={styles.srOnly}>Key name</label>
          <input
            id="key-name"
            type="text"
            className={styles.nameInput}
            placeholder="Key name (e.g. Claude Desktop)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            maxLength={80}
            disabled={creating}
            required
            aria-required="true"
          />
          <button type="submit" className={styles.createBtn} disabled={creating || !newKeyName.trim()}>
            {creating ? 'Creating…' : '+ Create Key'}
          </button>
        </form>

        {/* Newly created key reveal */}
        {createdKey && (
          <div className={styles.newKeyBanner} role="alert" aria-live="assertive">
            <strong>Key created: {createdKey.name}</strong>
            <p className={styles.newKeyWarning}>
              Copy this key now — it will never be shown again.
            </p>
            <div className={styles.keyReveal}>
              <code className={styles.keyValue}>{createdKey.key}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copyKey(createdKey.key)}
                aria-label="Copy API key to clipboard"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={() => setCreatedKey(null)}
            >
              I&apos;ve saved the key — dismiss
            </button>
          </div>
        )}

        {/* Key table */}
        {loading ? (
          <div className={styles.skeleton} aria-label="Loading API keys" />
        ) : keys.length === 0 ? (
          <div className={styles.empty}>No API keys yet. Create one above to get started.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="MCP API keys">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Key prefix</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last used</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td><code className={styles.prefix}>{key.key_prefix}</code></td>
                    <td>{formatDate(key.created_at)}</td>
                    <td>{formatDate(key.last_used_at)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.revokeBtn}
                        onClick={() => handleRevoke(key.id)}
                        disabled={revoking === key.id}
                        aria-label={`Revoke key ${key.name}`}
                      >
                        {revoking === key.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Setup instructions */}
      <section className={styles.section} aria-labelledby="setup-heading">
        <h2 id="setup-heading" className={styles.sectionTitle}>Setup Instructions</h2>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">1</span>
            <div>
              <strong>Create an API key</strong> using the form above. Copy and save it securely.
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">2</span>
            <div>
              <strong>Build the MCP server</strong> from the repository:
              <pre className={styles.codeBlock}>{`cd packages/mcp-server\nnpm install\nnpm run build`}</pre>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">3</span>
            <div>
              <strong>Add to your MCP client</strong> (e.g. Claude Desktop <code>claude_desktop_config.json</code>):
              <pre className={styles.codeBlock}>{`{
  "mcpServers": {
    "nexus-cms": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "NEXUS_URL": "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'}",
        "NEXUS_MCP_KEY": "mcp_your_key_here"
      }
    }
  }
}`}</pre>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">4</span>
            <div>
              <strong>Direct HTTP access</strong> — you can also call the MCP endpoint directly:
              <pre className={styles.codeBlock}>{`curl -X POST /api/mcp \\
  -H "Authorization: Bearer mcp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"list_posts","params":{"status":"published"}}'`}</pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
