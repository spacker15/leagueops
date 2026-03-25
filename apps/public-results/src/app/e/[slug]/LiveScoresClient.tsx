'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ConnectionErrorBanner } from '@/components/ConnectionErrorBanner'
import type { PublicGame } from '@/lib/data'

interface Props {
  initialGames: PublicGame[]
  eventId: number
  children: (liveGames: PublicGame[], flashingIds: Set<number>) => React.ReactNode
}

export function LiveScoresClient({ initialGames, eventId, children }: Props) {
  const [liveGames, setLiveGames] = useState<PublicGame[]>(initialGames)
  const [connectionError, setConnectionError] = useState(false)
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set())
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())

  const triggerFlash = useCallback((gameId: number) => {
    setFlashingIds((prev) => new Set(prev).add(gameId))
    // Clear previous timeout for this game if exists
    const existing = timeoutRefs.current.get(gameId)
    if (existing) clearTimeout(existing)
    const timeout = setTimeout(() => {
      setFlashingIds((prev) => {
        const next = new Set(prev)
        next.delete(gameId)
        return next
      })
      timeoutRefs.current.delete(gameId)
    }, 650) // slightly longer than 600ms animation
    timeoutRefs.current.set(gameId, timeout)
  }, [])

  useEffect(() => {
    let subscriptionFailed = false
    const connectionTimer = setTimeout(() => {
      subscriptionFailed = true
      setConnectionError(true)
    }, 5000) // 5 second timeout per UI-SPEC

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
              // Check if score actually changed for flash
              if (idx >= 0) {
                const old = prev[idx]
                if (old.home_score !== homeScore || old.away_score !== awayScore) {
                  triggerFlash(gameId)
                }
                const next = [...prev]
                next[idx] = { ...old, home_score: homeScore, away_score: awayScore, status }
                return next
              }
              // New live game — add to list (Realtime only gives flat row, not joins)
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
              // Game finished or status changed to non-live — remove from live list
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
      // Clean up flash timeouts
      timeoutRefs.current.forEach((t) => clearTimeout(t))
      timeoutRefs.current.clear()
    }
  }, [eventId, triggerFlash])

  return (
    <div aria-live="polite">
      {connectionError && <ConnectionErrorBanner />}
      {children(liveGames, flashingIds)}
    </div>
  )
}
