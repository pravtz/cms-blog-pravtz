import { getRedis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp in seconds
}

const WINDOW_SECONDS = 60
const MAX_REQUESTS = 60

/**
 * Redis sliding window rate limiter.
 * Falls back to allowing all requests if Redis is unavailable.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = MAX_REQUESTS
  const reset = Math.floor(Date.now() / 1000) + WINDOW_SECONDS

  const redis = getRedis()
  if (!redis) {
    // No Redis — allow request but return conservative headers
    return { allowed: true, limit, remaining: limit, reset }
  }

  const key = `rate_limit:v1:${ip}`
  const now = Date.now()
  const windowStart = now - WINDOW_SECONDS * 1000

  try {
    // Connect if not already connected
    if (redis.status === 'wait') {
      await redis.connect()
    }

    const pipeline = redis.pipeline()
    // Remove entries older than window
    pipeline.zremrangebyscore(key, 0, windowStart)
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`)
    // Count requests in window
    pipeline.zcard(key)
    // Set key expiry
    pipeline.expire(key, WINDOW_SECONDS * 2)

    const results = await pipeline.exec()
    if (!results) {
      return { allowed: true, limit, remaining: limit, reset }
    }

    const count = results[2][1] as number
    const remaining = Math.max(0, limit - count)
    const allowed = count <= limit

    return { allowed, limit, remaining, reset }
  } catch {
    // Redis error — fail open
    return { allowed: true, limit, remaining: limit, reset }
  }
}
