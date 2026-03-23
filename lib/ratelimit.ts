import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const engineRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '60 s'),
  prefix: 'leagueops:engine',
  analytics: true,
})

export const publicRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: 'leagueops:public',
  analytics: true,
})
