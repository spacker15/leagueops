'use client'

import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react'
import type {
  Event,
  EventDate,
  Field,
  Team,
  Player,
  Game,
  Referee,
  Volunteer,
  Incident,
  MedicalIncident,
  WeatherAlert,
  OpsLogEntry,
  LogType,
  GameStatus,
  ScheduleChangeRequest,
} from '@/types'
import * as db from '@/lib/db'
import { createClient } from '@/supabase/client'

// eventId is now dynamic — passed via AppProvider props

interface State {
  event: Event | null
  eventDates: EventDate[]
  currentDateIdx: number
  fields: Field[]
  teams: Team[]
  games: Game[]
  referees: Referee[]
  volunteers: Volunteer[]
  incidents: Incident[]
  medicalIncidents: MedicalIncident[]
  weatherAlerts: WeatherAlert[]
  opsLog: OpsLogEntry[]
  lightningActive: boolean
  lightningSecondsLeft: number
  loading: boolean
  scheduleChangeRequests: ScheduleChangeRequest[]
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'INIT'; payload: Partial<State> }
  | { type: 'SET_DATE'; payload: number }
  | { type: 'SET_GAMES'; payload: Game[] }
  | { type: 'UPDATE_GAME'; payload: Game }
  | { type: 'ADD_GAME'; payload: Game }
  | { type: 'SET_REFEREES'; payload: Referee[] }
  | { type: 'UPDATE_REF'; payload: Referee }
  | { type: 'SET_VOLUNTEERS'; payload: Volunteer[] }
  | { type: 'UPDATE_VOL'; payload: Volunteer }
  | { type: 'SET_INCIDENTS'; payload: Incident[] }
  | { type: 'ADD_INCIDENT'; payload: Incident }
  | { type: 'SET_MEDICAL'; payload: MedicalIncident[] }
  | { type: 'ADD_MEDICAL'; payload: MedicalIncident }
  | { type: 'UPDATE_MEDICAL'; payload: MedicalIncident }
  | { type: 'SET_WEATHER'; payload: WeatherAlert[] }
  | { type: 'ADD_WEATHER'; payload: WeatherAlert }
  | { type: 'SET_OPS_LOG'; payload: OpsLogEntry[] }
  | { type: 'ADD_OPS_LOG'; payload: OpsLogEntry }
  | { type: 'SET_LIGHTNING'; payload: { active: boolean; seconds?: number } }
  | { type: 'TICK_LIGHTNING' }
  | { type: 'UPDATE_FIELD'; payload: Field }
  | { type: 'ADD_FIELD'; payload: Field }
  | { type: 'DELETE_FIELD'; payload: number }
  | { type: 'SET_SCHEDULE_CHANGE_REQUESTS'; payload: ScheduleChangeRequest[] }
  | { type: 'ADD_SCHEDULE_CHANGE_REQUEST'; payload: ScheduleChangeRequest }
  | { type: 'UPDATE_SCHEDULE_CHANGE_REQUEST'; payload: ScheduleChangeRequest }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'INIT':
      return { ...state, ...action.payload, loading: false }
    case 'SET_DATE':
      return { ...state, currentDateIdx: action.payload }
    case 'SET_GAMES':
      return { ...state, games: action.payload }
    case 'UPDATE_GAME':
      return {
        ...state,
        games: state.games.map((g) => (g.id === action.payload.id ? action.payload : g)),
      }
    case 'ADD_GAME':
      return { ...state, games: [...state.games, action.payload] }
    case 'SET_REFEREES':
      return { ...state, referees: action.payload }
    case 'UPDATE_REF':
      return {
        ...state,
        referees: state.referees.map((r) => (r.id === action.payload.id ? action.payload : r)),
      }
    case 'SET_VOLUNTEERS':
      return { ...state, volunteers: action.payload }
    case 'UPDATE_VOL':
      return {
        ...state,
        volunteers: state.volunteers.map((v) => (v.id === action.payload.id ? action.payload : v)),
      }
    case 'SET_INCIDENTS':
      return { ...state, incidents: action.payload }
    case 'ADD_INCIDENT':
      return { ...state, incidents: [action.payload, ...state.incidents] }
    case 'SET_MEDICAL':
      return { ...state, medicalIncidents: action.payload }
    case 'ADD_MEDICAL':
      return { ...state, medicalIncidents: [action.payload, ...state.medicalIncidents] }
    case 'UPDATE_MEDICAL':
      return {
        ...state,
        medicalIncidents: state.medicalIncidents.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      }
    case 'SET_WEATHER':
      return { ...state, weatherAlerts: action.payload }
    case 'ADD_WEATHER':
      return { ...state, weatherAlerts: [action.payload, ...state.weatherAlerts] }
    case 'SET_OPS_LOG':
      return { ...state, opsLog: action.payload }
    case 'ADD_OPS_LOG':
      return { ...state, opsLog: [action.payload, ...state.opsLog].slice(0, 100) }
    case 'SET_LIGHTNING':
      return {
        ...state,
        lightningActive: action.payload.active,
        lightningSecondsLeft: action.payload.seconds ?? state.lightningSecondsLeft,
      }
    case 'TICK_LIGHTNING':
      return {
        ...state,
        lightningSecondsLeft: Math.max(0, state.lightningSecondsLeft - 1),
      }
    case 'UPDATE_FIELD':
      return {
        ...state,
        fields: state.fields.map((f) => (f.id === action.payload.id ? action.payload : f)),
      }
    case 'ADD_FIELD':
      return { ...state, fields: [...state.fields, action.payload] }
    case 'DELETE_FIELD':
      return { ...state, fields: state.fields.filter((f) => f.id !== action.payload) }
    case 'SET_SCHEDULE_CHANGE_REQUESTS':
      return { ...state, scheduleChangeRequests: action.payload }
    case 'ADD_SCHEDULE_CHANGE_REQUEST':
      return { ...state, scheduleChangeRequests: [action.payload, ...state.scheduleChangeRequests] }
    case 'UPDATE_SCHEDULE_CHANGE_REQUEST':
      return {
        ...state,
        scheduleChangeRequests: state.scheduleChangeRequests.map((r) =>
          r.id === action.payload.id ? action.payload : r
        ),
      }
    default:
      return state
  }
}

const initialState: State = {
  event: null,
  eventDates: [],
  currentDateIdx: 0,
  fields: [],
  teams: [],
  games: [],
  referees: [],
  volunteers: [],
  incidents: [],
  medicalIncidents: [],
  weatherAlerts: [],
  opsLog: [],
  lightningActive: false,
  lightningSecondsLeft: 1800,
  loading: true,
  scheduleChangeRequests: [],
}

interface ContextValue {
  state: State
  currentDate: EventDate | null
  todayGames: Game[]
  // actions
  changeDate: (idx: number) => void
  refreshGames: () => Promise<void>
  updateGameStatus: (gameId: number, status: GameStatus) => Promise<void>
  updateGameScore: (gameId: number, home: number, away: number) => Promise<void>
  addGame: (game: Parameters<typeof db.insertGame>[0]) => Promise<void>
  toggleRefCheckin: (refId: number) => Promise<void>
  toggleVolCheckin: (volId: number) => Promise<void>
  logIncident: (
    incident: Omit<Incident, 'id' | 'created_at' | 'field' | 'team' | 'game'>
  ) => Promise<void>
  dispatchTrainer: (incident: Omit<MedicalIncident, 'id' | 'created_at' | 'field'>) => Promise<void>
  updateMedicalStatus: (id: number, status: string) => Promise<void>
  triggerLightning: () => Promise<void>
  liftLightning: () => Promise<void>
  addLog: (message: string, type?: LogType) => Promise<void>
  updateFieldMap: (fieldId: number, x: number, y: number) => void
  updateFieldFull: (fieldId: number, props: Partial<import('@/types').Field>) => void
  updateFieldName: (fieldId: number, name: string) => Promise<void>
  updateFieldDetails: (
    fieldId: number,
    props: { name?: string; number?: string; division?: string; complex_id?: number | null }
  ) => Promise<void>
  addField: (name: string, number: string, division?: string, complexId?: number) => Promise<void>
  deleteField: (fieldId: number) => Promise<void>
  refreshRefs: () => Promise<void>
  refreshVols: () => Promise<void>
  eventId: number
}

const Ctx = createContext<ContextValue | null>(null)

export function AppProvider({
  children,
  eventId,
}: {
  children: React.ReactNode
  eventId?: number
}) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // ---- Initial load ----
  useEffect(() => {
    if (!eventId) return // D-01: null guard
    const eid = eventId // narrowed -- TS now knows eid is number inside closure
    async function loadAll() {
      dispatch({ type: 'SET_LOADING', payload: true })
      const [
        event,
        eventDates,
        fields,
        teams,
        referees,
        volunteers,
        incidents,
        medical,
        weather,
        opsLog,
        scheduleChangeRequests,
      ] = await Promise.all([
        db.getEvent(eid),
        db.getEventDates(eid),
        db.getFields(eid),
        db.getTeams(eid),
        db.getReferees(eid),
        db.getVolunteers(eid),
        db.getIncidents(eid),
        db.getMedicalIncidents(eid),
        db.getWeatherAlerts(eid),
        db.getOpsLog(eid),
        db.getScheduleChangeRequests(eid),
      ])
      dispatch({
        type: 'INIT',
        payload: {
          event,
          eventDates: eventDates ?? [],
          fields,
          teams,
          referees,
          volunteers,
          incidents,
          medicalIncidents: medical,
          weatherAlerts: weather,
          opsLog,
          scheduleChangeRequests,
        },
      })
    }
    loadAll()
  }, [eventId])

  // ---- Load games when date changes ----
  const currentDate = state.eventDates[state.currentDateIdx] ?? null

  // currentDateRef allows the realtime subscription to read the current date
  // without adding it to the realtime useEffect dep array (avoids reconnect storm)
  const currentDateRef = useRef(currentDate)
  useEffect(() => {
    currentDateRef.current = currentDate
  }, [currentDate])

  useEffect(() => {
    if (!currentDate || !eventId) return
    db.getGamesByDate(eventId, currentDate.id).then((games) =>
      dispatch({ type: 'SET_GAMES', payload: games })
    )
  }, [currentDate, eventId])

  // ---- Real-time subscriptions ----
  // Dep array is [eventId] ONLY -- currentDate is read from ref to avoid
  // reconnect storm on date tab switches (addresses review concern #3).
  useEffect(() => {
    if (!eventId) return // D-01: null guard
    const eid = eventId // narrowed -- TS now knows eid is number inside closure
    const sb = createClient()
    const filter = `event_id=eq.${eid}`
    const sub = sb
      .channel('leagueops-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ops_log', filter },
        (payload) => {
          dispatch({ type: 'ADD_OPS_LOG', payload: payload.new as OpsLogEntry })
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter }, () => {
        db.getIncidents(eid).then((d) => dispatch({ type: 'SET_INCIDENTS', payload: d }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter }, () => {
        const cd = currentDateRef.current // read from ref, not state
        if (cd) {
          db.getGamesByDate(eid, cd.id).then((d) => dispatch({ type: 'SET_GAMES', payload: d }))
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medical_incidents', filter },
        () => {
          db.getMedicalIncidents(eid).then((d) => dispatch({ type: 'SET_MEDICAL', payload: d }))
        }
      )
      .subscribe()

    const scrSub = sb
      .channel('schedule_change_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'schedule_change_requests',
          filter: `event_id=eq.${eid}`,
        },
        (payload) => {
          dispatch({
            type: 'ADD_SCHEDULE_CHANGE_REQUEST',
            payload: payload.new as ScheduleChangeRequest,
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schedule_change_requests',
          filter: `event_id=eq.${eid}`,
        },
        (payload) => {
          dispatch({
            type: 'UPDATE_SCHEDULE_CHANGE_REQUEST',
            payload: payload.new as ScheduleChangeRequest,
          })
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(sub)
      sb.removeChannel(scrSub)
    }
  }, [eventId]) // ONLY eventId -- currentDate read from ref

  // ---- Lightning timer ----
  useEffect(() => {
    if (!state.lightningActive) return
    const t = setInterval(() => dispatch({ type: 'TICK_LIGHTNING' }), 1000)
    return () => clearInterval(t)
  }, [state.lightningActive])

  // ---- Derived ----
  const todayGames = state.games

  // ---- Actions ----
  const addLog = useCallback(
    async (message: string, type: LogType = 'info') => {
      await db.addOpsLog(eventId!, message, type)
    },
    [eventId]
  )

  const changeDate = useCallback((idx: number) => {
    dispatch({ type: 'SET_DATE', payload: idx })
  }, [])

  const refreshGames = useCallback(async () => {
    if (!currentDate) return
    const games = await db.getGamesByDate(eventId!, currentDate.id)
    dispatch({ type: 'SET_GAMES', payload: games })
  }, [currentDate, eventId])

  const updateGameStatus = useCallback(
    async (gameId: number, status: GameStatus) => {
      await db.updateGameStatus(gameId, status)
      const updated = state.games.find((g) => g.id === gameId)
      if (updated) dispatch({ type: 'UPDATE_GAME', payload: { ...updated, status } })
      await addLog(`Game #${gameId} → ${status}`, 'info')
    },
    [state.games, addLog]
  )

  const updateGameScore = useCallback(
    async (gameId: number, home: number, away: number) => {
      await db.updateGameScore(gameId, home, away)
      const updated = state.games.find((g) => g.id === gameId)
      if (updated)
        dispatch({
          type: 'UPDATE_GAME',
          payload: { ...updated, home_score: home, away_score: away },
        })
    },
    [state.games]
  )

  const addGame = useCallback(
    async (game: Parameters<typeof db.insertGame>[0]) => {
      const created = await db.insertGame(game)
      if (created) {
        await refreshGames()
        await addLog(`Game added: Game #${created.id}`, 'ok')
      }
    },
    [refreshGames, addLog]
  )

  const toggleRefCheckin = useCallback(
    async (refId: number) => {
      const ref = state.referees.find((r) => r.id === refId)
      if (!ref) return
      const next = !ref.checked_in
      await db.toggleRefCheckin(refId, next)
      dispatch({ type: 'UPDATE_REF', payload: { ...ref, checked_in: next } })
      await addLog(`Ref ${next ? 'checked in' : 'checked out'}: ${ref.name}`, next ? 'ok' : 'info')
    },
    [state.referees, addLog]
  )

  const toggleVolCheckin = useCallback(
    async (volId: number) => {
      const vol = state.volunteers.find((v) => v.id === volId)
      if (!vol) return
      const next = !vol.checked_in
      await db.toggleVolCheckin(volId, next)
      dispatch({ type: 'UPDATE_VOL', payload: { ...vol, checked_in: next } })
      await addLog(
        `Volunteer ${next ? 'checked in' : 'checked out'}: ${vol.name} (${vol.role})`,
        next ? 'ok' : 'info'
      )
    },
    [state.volunteers, addLog]
  )

  const logIncident = useCallback(
    async (incident: Omit<Incident, 'id' | 'created_at' | 'field' | 'team' | 'game'>) => {
      const created = await db.insertIncident(incident)
      if (created) {
        dispatch({ type: 'ADD_INCIDENT', payload: created })
        const severity = ['Player Injury', 'Ejection'].includes(incident.type) ? 'alert' : 'warn'
        await addLog(
          `INCIDENT: ${incident.type} logged${incident.person_involved ? ` — ${incident.person_involved}` : ''}`,
          severity as LogType
        )
      }
    },
    [addLog]
  )

  const dispatchTrainer = useCallback(
    async (incident: Omit<MedicalIncident, 'id' | 'created_at' | 'field'>) => {
      const created = await db.insertMedicalIncident(incident)
      if (created) {
        dispatch({ type: 'ADD_MEDICAL', payload: created })
        await addLog(
          `Trainer dispatched: ${incident.trainer_name} → Field ${incident.field_id} (${incident.player_name})`,
          'alert'
        )
      }
    },
    [addLog]
  )

  const updateMedicalStatus = useCallback(
    async (id: number, status: string) => {
      await db.updateMedicalStatus(id, status)
      const m = state.medicalIncidents.find((x) => x.id === id)
      if (m)
        dispatch({
          type: 'UPDATE_MEDICAL',
          payload: { ...m, status: status as MedicalIncident['status'] },
        })
    },
    [state.medicalIncidents]
  )

  const triggerLightning = useCallback(async () => {
    dispatch({ type: 'SET_LIGHTNING', payload: { active: true, seconds: 1800 } })
    if (currentDate) await db.setAllGamesDelayed(eventId!, currentDate.id)
    await db.insertWeatherAlert({
      event_id: eventId!,
      alert_type: 'Lightning Delay',
      description: 'All fields suspended — 30-minute lightning hold initiated',
      is_active: true,
      lightning_delay_start: new Date().toISOString(),
      lightning_delay_end: null,
    })
    await addLog('⚡ LIGHTNING DELAY INITIATED — All fields suspended', 'alert')
    await refreshGames()
    const alerts = await db.getWeatherAlerts(eventId!)
    dispatch({ type: 'SET_WEATHER', payload: alerts })
  }, [currentDate, eventId, addLog, refreshGames])

  const liftLightning = useCallback(async () => {
    dispatch({ type: 'SET_LIGHTNING', payload: { active: false } })
    if (currentDate) await db.resumeAllDelayedGames(eventId!, currentDate.id)
    const alerts = state.weatherAlerts.filter(
      (a) => a.alert_type === 'Lightning Delay' && a.is_active
    )
    for (const alert of alerts) await db.resolveWeatherAlert(alert.id)
    await addLog('Lightning delay lifted — Fields resuming', 'ok')
    await refreshGames()
    const newAlerts = await db.getWeatherAlerts(eventId!)
    dispatch({ type: 'SET_WEATHER', payload: newAlerts })
  }, [currentDate, eventId, state.weatherAlerts, addLog, refreshGames])

  const updateFieldMap = useCallback(
    (fieldId: number, x: number, y: number) => {
      const field = state.fields.find((f) => f.id === fieldId)
      if (field) {
        dispatch({ type: 'UPDATE_FIELD', payload: { ...field, map_x: x, map_y: y } })
        db.updateFieldMap(fieldId, x, y)
      }
    },
    [state.fields]
  )

  const updateFieldFull = useCallback(
    (fieldId: number, props: Partial<import('@/types').Field>) => {
      const field = state.fields.find((f) => f.id === fieldId)
      if (field) {
        dispatch({ type: 'UPDATE_FIELD', payload: { ...field, ...props } })
        db.updateFieldFull(fieldId, props as any)
      }
    },
    [state.fields]
  )

  const updateFieldName = useCallback(
    async (fieldId: number, name: string) => {
      await db.updateFieldName(fieldId, name)
      const field = state.fields.find((f) => f.id === fieldId)
      if (field) dispatch({ type: 'UPDATE_FIELD', payload: { ...field, name } })
    },
    [state.fields]
  )

  const addField = useCallback(
    async (name: string, number: string, division = '', complexId?: number) => {
      const created = await db.insertField(eventId!, name, number, division, complexId)
      if (created) dispatch({ type: 'ADD_FIELD', payload: created })
    },
    [eventId]
  )

  const updateFieldDetails = useCallback(
    async (fieldId: number, props: { name?: string; number?: string; division?: string }) => {
      await db.updateFieldDetails(fieldId, props)
      const field = state.fields.find((f) => f.id === fieldId)
      if (field) dispatch({ type: 'UPDATE_FIELD', payload: { ...field, ...props } })
    },
    [state.fields]
  )

  const deleteField = useCallback(async (fieldId: number) => {
    await db.deleteField(fieldId)
    dispatch({ type: 'DELETE_FIELD', payload: fieldId })
  }, [])

  const refreshRefs = useCallback(async () => {
    if (!eventId) return
    const refs = await db.getReferees(eventId)
    dispatch({ type: 'SET_REFEREES', payload: refs })
  }, [eventId])

  const refreshVols = useCallback(async () => {
    if (!eventId) return
    const vols = await db.getVolunteers(eventId)
    dispatch({ type: 'SET_VOLUNTEERS', payload: vols })
  }, [eventId])

  return (
    <Ctx.Provider
      value={{
        state,
        currentDate,
        todayGames,
        changeDate,
        refreshGames,
        updateGameStatus,
        updateGameScore,
        addGame,
        toggleRefCheckin,
        toggleVolCheckin,
        logIncident,
        dispatchTrainer,
        updateMedicalStatus,
        triggerLightning,
        liftLightning,
        addLog,
        updateFieldMap,
        updateFieldFull,
        updateFieldName,
        updateFieldDetails,
        addField,
        deleteField,
        refreshRefs,
        refreshVols,
        eventId: eventId ?? 0,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
