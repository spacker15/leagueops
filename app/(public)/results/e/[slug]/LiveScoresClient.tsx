'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/public-results/supabase'
import { ConnectionErrorBanner } from '@/components/public-results/ConnectionErrorBanner'
import type { PublicGame } from '@/lib/public-results/data'

interface LiveScoresContextValue {
  liveGames: PublicGame[]
  flashingIds: Set<number>
  liveGameIds: Set<number>
  liveScores: Map<number, { home_score: number; away_score: number }>
}

const LiveScoresContext = createContext<LiveScoresContextValue>({
  liveGames: [],
  flashingIds: new Set(),
  liveGameIds: new Set(),
  liveScores: new Map(),
})

export function useLiveScores() {
  return useContext(LiveScoresContext)
}

interface Props {
  initialGames: PublicGame[]
  eventId: number
  children: React.ReactNode
}

export function LiveScoresClient({ initialGames, eventId, children }: Props) {
  const [liveGames, setLiveGames] = useState<PublicGame[]>(initialGames)
  const [connectionError, setConnectionError] = useState(false)
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set())
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())

  const triggerFlash = useCallback((gameId: number) => {
    setFlashingIds((prev) => new Set(prev).add(gameId))
    const existing = timeoutRefs.current.get(gameId)
    if (existing) clearTimeout(existing)
    const timeout = setTimeout(() => {
      setFlashingIds((prev) => {
        const next = new Set(prev)
        next.delete(gameId)
        return next
      })
      timeoutRefs.current.delete(gameId)
    }, 650)
    timeoutRefs.current.set(gameId, timeout)
  }, [])

  useEffect(() => {
    let subscriptionFailed = false
    const connectionTimer = setTimeout(() => {
      subscriptionFailed = true
      setConnectionError(true)
    }, 5000)

    const channel = supabase
      .channel(`live-scores-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          const gameId = updated.id as number
          const status = updated.status as string
          const homeScore = updated.home_score as number
          const awayScore = updated.away_score as number

          setLiveGames((prev) => {
            const idx = prev.findIndex((g) => g.id === gameId)
            if (status === 'Live' || status === 'Halftime') {
              if (idx >= 0) {
                const old = prev[idx]
                if (old.home_score !== homeScore || old.away_score !== awayScore) {
                  triggerFlash(gameId)
                }
                const next = [...prev]
                next[idx] = { ...old, home_score: homeScore, away_score: awayScore, status }
                return next
              }
              return [
                ...prev,
                {
                  id: gameId,
                  home_score: homeScore,
                  away_score: awayScore,
                  status,
                  division: (updated.division as string) ?? '',
                  scheduled_time: (updated.scheduled_time as string) ?? '',
                  home_team: null,
                  away_team: null,
                  field: null,
                  event_date: null,
                },
              ]
            } else {
              return prev.filter((g) => g.id !== gameId)
            }
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(connectionTimer)
          if (!subscriptionFailed) {
            setConnectionError(false)
          }
        }
      })

    return () => {
      clearTimeout(connectionTimer)
      supabase.removeChannel(channel)
      timeoutRefs.current.forEach((t) => clearTimeout(t))
      timeoutRefs.current.clear()
    }
  }, [eventId, triggerFlash])

  const liveGameIds = new Set(liveGames.map((g) => g.id))
  const liveScores = new Map(
    liveGames.map((g) => [g.id, { home_score: g.home_score, away_score: g.away_score }])
  )

  return (
    <LiveScoresContext.Provider value={{ liveGames, flashingIds, liveGameIds, liveScores }}>
      <div aria-live="polite">
        {connectionError && <ConnectionErrorBanner />}
        {children}
      </div>
    </LiveScoresContext.Provider>
  )
}
