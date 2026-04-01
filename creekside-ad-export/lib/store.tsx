'use client'

import { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import * as db from '@/lib/db'
import type { School, Sport, Team, Coach, Player, Game, Volunteer, Incident } from '@/types'

interface State {
  school: School | null
  sports: Sport[]
  teams: Team[]
  coaches: Coach[]
  games: Game[]
  volunteers: Volunteer[]
  incidents: Incident[]
  loading: boolean
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SCHOOL'; payload: School | null }
  | { type: 'SET_SPORTS'; payload: Sport[] }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'SET_COACHES'; payload: Coach[] }
  | { type: 'SET_GAMES'; payload: Game[] }
  | { type: 'SET_VOLUNTEERS'; payload: Volunteer[] }
  | { type: 'SET_INCIDENTS'; payload: Incident[] }
  | { type: 'UPDATE_GAME'; payload: { id: number; props: Partial<Game> } }
  | { type: 'ADD_INCIDENT'; payload: Incident }

const initial: State = {
  school: null,
  sports: [],
  teams: [],
  coaches: [],
  games: [],
  volunteers: [],
  incidents: [],
  loading: true,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_SCHOOL':
      return { ...state, school: action.payload }
    case 'SET_SPORTS':
      return { ...state, sports: action.payload }
    case 'SET_TEAMS':
      return { ...state, teams: action.payload }
    case 'SET_COACHES':
      return { ...state, coaches: action.payload }
    case 'SET_GAMES':
      return { ...state, games: action.payload }
    case 'SET_VOLUNTEERS':
      return { ...state, volunteers: action.payload }
    case 'SET_INCIDENTS':
      return { ...state, incidents: action.payload }
    case 'UPDATE_GAME':
      return {
        ...state,
        games: state.games.map((g) =>
          g.id === action.payload.id ? { ...g, ...action.payload.props } : g
        ),
      }
    case 'ADD_INCIDENT':
      return { ...state, incidents: [action.payload, ...state.incidents] }
    default:
      return state
  }
}

interface Ctx extends State {
  schoolId: number
  refreshGames: () => Promise<void>
  refreshIncidents: () => Promise<void>
  updateGameScore: (gameId: number, home: number, away: number) => Promise<void>
  updateGameStatus: (gameId: number, status: Game['status']) => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({
  schoolId,
  children,
}: {
  schoolId: number
  children: React.ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, initial)

  const refreshGames = useCallback(async () => {
    const games = await db.getGames(schoolId)
    dispatch({ type: 'SET_GAMES', payload: games })
  }, [schoolId])

  const refreshIncidents = useCallback(async () => {
    const incidents = await db.getIncidents(schoolId)
    dispatch({ type: 'SET_INCIDENTS', payload: incidents })
  }, [schoolId])

  useEffect(() => {
    async function loadAll() {
      dispatch({ type: 'SET_LOADING', payload: true })
      const [school, sports, teams, coaches, games, volunteers, incidents] = await Promise.all([
        db.getSchool(schoolId),
        db.getSports(schoolId),
        db.getTeams(schoolId),
        db.getCoaches(schoolId),
        db.getGames(schoolId),
        db.getVolunteers(schoolId),
        db.getIncidents(schoolId),
      ])
      dispatch({ type: 'SET_SCHOOL', payload: school })
      dispatch({ type: 'SET_SPORTS', payload: sports })
      dispatch({ type: 'SET_TEAMS', payload: teams })
      dispatch({ type: 'SET_COACHES', payload: coaches })
      dispatch({ type: 'SET_GAMES', payload: games })
      dispatch({ type: 'SET_VOLUNTEERS', payload: volunteers })
      dispatch({ type: 'SET_INCIDENTS', payload: incidents })
      dispatch({ type: 'SET_LOADING', payload: false })
    }
    loadAll()
  }, [schoolId])

  // Real-time
  useEffect(() => {
    const sb = createClient()
    const filter = `school_id=eq.${schoolId}`
    const sub = sb
      .channel('creekside-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter }, () =>
        refreshGames()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter }, () =>
        refreshIncidents()
      )
      .subscribe()
    return () => {
      sb.removeChannel(sub)
    }
  }, [schoolId, refreshGames, refreshIncidents])

  const updateGameScore = useCallback(async (gameId: number, home: number, away: number) => {
    dispatch({
      type: 'UPDATE_GAME',
      payload: { id: gameId, props: { home_score: home, away_score: away } },
    })
    await db.updateGame(gameId, { home_score: home, away_score: away })
  }, [])

  const updateGameStatus = useCallback(async (gameId: number, status: Game['status']) => {
    dispatch({ type: 'UPDATE_GAME', payload: { id: gameId, props: { status } } })
    await db.updateGame(gameId, { status })
  }, [])

  return (
    <AppCtx.Provider
      value={{
        ...state,
        schoolId,
        refreshGames,
        refreshIncidents,
        updateGameScore,
        updateGameStatus,
      }}
    >
      {children}
    </AppCtx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
