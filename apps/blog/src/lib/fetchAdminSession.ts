/**
 * Resolve admin user + access token for blog-origin requests.
 * Cookie-based session only works same-site; for dev (blog :3900 / admin :3901)
 * we fall back to accessToken in localStorage (same keys as admin login).
 */

import { getAdminApiBaseUrl } from '@/lib/adminApiBaseUrl'

export interface AdminSessionUser {
  id: string
  name: string
  email: string
  role: string
}

export async function fetchAdminSession(): Promise<{
  user: AdminSessionUser
  accessToken: string
} | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const adminUrl = getAdminApiBaseUrl()

  // Prefer Bearer + /me: credentialed cross-origin /session does not send SameSite=Strict cookies
  // and can stall the browser; localStorage is the supported split-origin path.
  const token = localStorage.getItem('accessToken')
  if (token) {
    try {
      const res = await fetch(`${adminUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { user?: AdminSessionUser }
        if (data.user) {
          return { user: data.user, accessToken: token }
        }
      }
    } catch {
      /* ignore */
    }
  }

  let adminSameOrigin = false
  try {
    adminSameOrigin = new URL(adminUrl).origin === window.location.origin
  } catch {
    adminSameOrigin = false
  }
  if (!adminSameOrigin) {
    return null
  }

  try {
    const res = await fetch(`${adminUrl}/api/auth/session`, {
      credentials: 'include',
    })
    if (res.ok) {
      const data = (await res.json()) as {
        user?: AdminSessionUser
        accessToken?: string
      }
      if (data.user && data.accessToken) {
        return { user: data.user, accessToken: data.accessToken }
      }
    }
  } catch {
    /* ignore */
  }

  return null
}
