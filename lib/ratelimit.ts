import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// If Upstash Redis env vars aren't set, use a no-op rate limiter
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const noopLimiter = {
  limit: async (_id: string) => ({
    success: true,
    limit: 999,
    remaining: 999,
    reset: Date.now() + 60000,
    pending: Promise.resolve(),
  }),
}

function makeEngine() {
  if (!hasRedis) return null
  return Redis.fromEnv()
}

const redis = makeEngine()

export const engineRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(10, '60 s'),
      prefix: 'leagueops:engine',
      analytics: true,
    })
  : (noopLimiter as unknown as Ratelimit)

export const publicRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'leagueops:public',
      analytics: true,
    })
  : (noopLimiter as unknown as Ratelimit)
