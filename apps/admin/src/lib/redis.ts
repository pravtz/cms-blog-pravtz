import Redis from 'ioredis'

let client: Redis | null = null
let connectionFailed = false

export function getRedis(): Redis | null {
  if (connectionFailed) return null
  if (client) return client

  const url = process.env.REDIS_URL
  if (!url) return null

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    })

    client.on('error', () => {
      connectionFailed = true
      client = null
    })

    return client
  } catch {
    connectionFailed = true
    return null
  }
}
