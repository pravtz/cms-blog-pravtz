import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from './rate-limit'

/**
 * Extract the real client IP from common proxy headers.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

/**
 * Build the standard security + CORS headers for all v1 API responses.
 */
export function buildV1Headers(
  rateLimit: { limit: number; remaining: number; reset: number },
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    // Security
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    // CORS
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Rate limiting
    'X-RateLimit-Limit': String(rateLimit.limit),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.reset),
    ...extra,
  }
}

/**
 * Run rate limiting and return a 429 response if exceeded,
 * or null + headers if allowed.
 */
export async function applyRateLimit(
  request: NextRequest
): Promise<{ headers: Record<string, string>; error: NextResponse | null }> {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip)
  const headers = buildV1Headers(rl)

  if (!rl.allowed) {
    return {
      headers,
      error: NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded. Try again in 60 seconds.' },
        { status: 429, headers }
      ),
    }
  }

  return { headers, error: null }
}

/**
 * Handle OPTIONS preflight for CORS.
 */
export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
