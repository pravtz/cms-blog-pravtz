'use client'

import { useEffect } from 'react'

import { getAdminApiBaseUrl } from '@/lib/adminApiBaseUrl'

export default function ClarityScript() {
  useEffect(() => {
    let cancelled = false

    async function init() {
      const adminUrl = getAdminApiBaseUrl()
      try {
        // Fetch Clarity config (public endpoint, short cache)
        const configRes = await fetch(`${adminUrl}/api/blog/clarity-config`, {
          cache: 'no-store',
        })
        if (!configRes.ok) return
        const config = (await configRes.json()) as { enabled: boolean; projectId: string }
        if (!config.enabled || !config.projectId) return

        // Only load Clarity for non-logged-in visitors
        const sessionRes = await fetch(`${adminUrl}/api/auth/session`, {
          credentials: 'include',
        })
        const session = sessionRes.ok
          ? ((await sessionRes.json()) as { user?: unknown })
          : {}
        if (session.user) return

        if (cancelled) return

        // Inject Clarity queue shim then async script tag
        const win = window as unknown as Record<string, unknown>
        if (!win['clarity']) {
          const fn = (...args: unknown[]) => {
            ((fn as unknown as { q: unknown[] }).q =
              (fn as unknown as { q: unknown[] }).q || []).push(args)
          }
          ;(fn as unknown as { q: unknown[] }).q = []
          win['clarity'] = fn
        }

        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.clarity.ms/tag/${config.projectId}`
        document.head.appendChild(script)
      } catch {
        // analytics must never break the page
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
