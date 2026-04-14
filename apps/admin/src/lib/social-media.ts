/**
 * Social Media Service
 * Posts content to configured social networks when a post is published.
 * Supports: X/Twitter (OAuth 1.0a), LinkedIn (OAuth 2.0), Facebook (Graph API)
 * GitHub and Instagram store profile URLs only (no auto-share API).
 */

import { getSetting } from './db'
import crypto from 'crypto'

export interface SocialNetworkConfig {
  profileUrl?: string
  autoShare?: boolean
}

export interface TwitterConfig extends SocialNetworkConfig {
  apiKey?: string
  apiSecret?: string
  accessToken?: string
  accessTokenSecret?: string
}

export interface LinkedInConfig extends SocialNetworkConfig {
  accessToken?: string
  personUrn?: string
}

export interface FacebookConfig extends SocialNetworkConfig {
  pageId?: string
  pageAccessToken?: string
}

export interface SocialMediaSettings {
  github: SocialNetworkConfig
  instagram: SocialNetworkConfig
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

export function getSocialMediaSettings(): SocialMediaSettings {
  try {
    const raw = getSetting('social_media_config')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SocialMediaSettings>
      return {
        github: { ...DEFAULT_SETTINGS.github, ...parsed.github },
        instagram: { ...DEFAULT_SETTINGS.instagram, ...parsed.instagram },
        linkedin: { ...DEFAULT_SETTINGS.linkedin, ...parsed.linkedin },
        facebook: { ...DEFAULT_SETTINGS.facebook, ...parsed.facebook },
        twitter: { ...DEFAULT_SETTINGS.twitter, ...parsed.twitter },
      }
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS }
}

// --- X/Twitter OAuth 1.0a ---

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function buildOAuth1Header(
  method: string,
  url: string,
  config: Required<Pick<TwitterConfig, 'apiKey' | 'apiSecret' | 'accessToken' | 'accessTokenSecret'>>,
  bodyParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  }

  // Collect all params (oauth + body) and sort
  const allParams = { ...oauthParams, ...bodyParams }
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&')

  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessTokenSecret)}`
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64')

  oauthParams['oauth_signature'] = signature

  const headerValue = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${headerValue}`
}

async function postToTwitter(config: TwitterConfig, text: string): Promise<void> {
  if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessTokenSecret) {
    throw new Error('Twitter credentials not fully configured')
  }

  const url = 'https://api.twitter.com/2/tweets'
  const body = JSON.stringify({ text })

  const authHeader = buildOAuth1Header(
    'POST',
    url,
    {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessTokenSecret: config.accessTokenSecret,
    }
  )

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Twitter API error ${response.status}: ${detail}`)
  }
}

// --- LinkedIn Share API ---

async function postToLinkedIn(config: LinkedInConfig, text: string, link: string): Promise<void> {
  if (!config.accessToken || !config.personUrn) {
    throw new Error('LinkedIn credentials not fully configured')
  }

  const body = {
    author: config.personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'ARTICLE',
        media: [
          {
            status: 'READY',
            originalUrl: link,
          },
        ],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`LinkedIn API error ${response.status}: ${detail}`)
  }
}

// --- Facebook Graph API ---

async function postToFacebook(config: FacebookConfig, text: string, link: string): Promise<void> {
  if (!config.pageId || !config.pageAccessToken) {
    throw new Error('Facebook credentials not fully configured')
  }

  const params = new URLSearchParams({
    message: text,
    link,
    access_token: config.pageAccessToken,
  })

  const response = await fetch(`https://graph.facebook.com/v19.0/${config.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Facebook API error ${response.status}: ${detail}`)
  }
}

// --- Connection tests ---

export async function testTwitterConnection(config: TwitterConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessTokenSecret) {
      return { ok: false, message: 'Missing credentials. Fill in all four fields.' }
    }
    // Verify credentials endpoint
    const url = 'https://api.twitter.com/2/users/me'
    const authHeader = buildOAuth1Header('GET', url, {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessTokenSecret: config.accessTokenSecret,
    })
    const res = await fetch(url, { headers: { Authorization: authHeader } })
    if (res.ok) {
      const data = await res.json() as { data?: { username?: string } }
      return { ok: true, message: `Connected as @${data.data?.username ?? 'unknown'}` }
    }
    return { ok: false, message: `API returned ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

export async function testLinkedInConnection(config: LinkedInConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (!config.accessToken || !config.personUrn) {
      return { ok: false, message: 'Missing access token or Person URN.' }
    }
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    })
    if (res.ok) {
      const data = await res.json() as { name?: string; email?: string }
      return { ok: true, message: `Connected as ${data.name ?? data.email ?? 'unknown'}` }
    }
    return { ok: false, message: `API returned ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

export async function testFacebookConnection(config: FacebookConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (!config.pageId || !config.pageAccessToken) {
      return { ok: false, message: 'Missing Page ID or Page Access Token.' }
    }
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.pageId}?fields=name&access_token=${encodeURIComponent(config.pageAccessToken)}`
    )
    if (res.ok) {
      const data = await res.json() as { name?: string }
      return { ok: true, message: `Connected to page: ${data.name ?? config.pageId}` }
    }
    return { ok: false, message: `API returned ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

// --- Auto-share on publish ---

export interface AutoShareContext {
  postTitle: string
  postSlug: string
  blogUrl: string
  excerpt?: string | null
}

export async function autoShareOnPublish(ctx: AutoShareContext): Promise<void> {
  const settings = getSocialMediaSettings()
  const postUrl = `${ctx.blogUrl}/blog/${ctx.postSlug}`
  const text = ctx.excerpt
    ? `${ctx.postTitle}\n\n${ctx.excerpt}\n\n${postUrl}`
    : `${ctx.postTitle}\n\n${postUrl}`
  // Trim to safe length for Twitter (280 chars max)
  const twitterText = text.length > 270 ? text.slice(0, 267) + '...' : text

  const tasks: Promise<void>[] = []

  if (settings.twitter.autoShare) {
    tasks.push(
      postToTwitter(settings.twitter, twitterText).catch((err) =>
        console.error('[social-media] Twitter auto-share error:', err)
      )
    )
  }

  if (settings.linkedin.autoShare) {
    tasks.push(
      postToLinkedIn(settings.linkedin, text, postUrl).catch((err) =>
        console.error('[social-media] LinkedIn auto-share error:', err)
      )
    )
  }

  if (settings.facebook.autoShare) {
    tasks.push(
      postToFacebook(settings.facebook, text, postUrl).catch((err) =>
        console.error('[social-media] Facebook auto-share error:', err)
      )
    )
  }

  await Promise.allSettled(tasks)
}
