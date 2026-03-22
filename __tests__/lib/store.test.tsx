'use client'

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, test, beforeEach, expect } from 'vitest'
import { AppProvider, useApp } from '@/lib/store'

// ---------------------------------------------------------------------------
// Mock @/lib/db -- all functions return empty arrays / null so loadAll
// succeeds without a real database connection.
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', () => ({
  getEvent: vi.fn((_eventId: number) => Promise.resolve(null)),
  getEventDates: vi.fn((_eventId: number) => Promise.resolve([])),
  getFields: vi.fn((_eventId: number) => Promise.resolve([])),
  getTeams: vi.fn((_eventId: number) => Promise.resolve([])),
  getReferees: vi.fn((_eventId: number) => Promise.resolve([])),
  getVolunteers: vi.fn((_eventId: number) => Promise.resolve([])),
  getIncidents: vi.fn((_eventId: number) => Promise.resolve([])),
  getMedicalIncidents: vi.fn((_eventId: number) => Promise.resolve([])),
  getWeatherAlerts: vi.fn((_eventId: number) => Promise.resolve([])),
  getOpsLog: vi.fn((_eventId: number) => Promise.resolve([])),
  getGamesByDate: vi.fn((_eventId: number, _dateId: number) => Promise.resolve([])),
  addOpsLog: vi.fn(() => Promise.resolve(null)),
}))

// ---------------------------------------------------------------------------
// Mock @/supabase/client -- return a mock Supabase client with channel/on/
// subscribe/removeChannel stubs.
// ---------------------------------------------------------------------------
const mockSubscribe = vi.fn()
const mockOn = vi.fn()
const mockRemoveChannel = vi.fn()
const mockChannel = vi.fn()

// Each call to channel() returns a new object that records the channel name
// and has chainable .on() and .subscribe() methods.
mockChannel.mockImplementation((channelName: string) => {
  const channelObj = {
    _name: channelName,
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  // Track the latest channel for assertions
  mockLatestChannel = channelObj
  return channelObj
})

let mockLatestChannel: { _name: string; on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } | null =
  null

vi.mock('@/supabase/client', () => ({
  createClient: vi.fn(() => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  })),
}))

// ---------------------------------------------------------------------------
// Test helper: renders AppProvider and exposes the eventId from useApp()
// ---------------------------------------------------------------------------
function TestConsumer() {
  const { eventId } = useApp()
  return <div data-testid="event-id">{eventId}</div>
}

function renderWithProvider(eventId?: number) {
  return render(
    <AppProvider eventId={eventId}>
      <TestConsumer />
    </AppProvider>
  )
}

// ---------------------------------------------------------------------------
// Get the db mock module for assertions
// ---------------------------------------------------------------------------
async function getDbMock() {
  const db = await import('@/lib/db')
  return db
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppProvider store behaviors (SEC-04 / SEC-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLatestChannel = null

    // Re-implement mockChannel after clearAllMocks resets it
    mockChannel.mockImplementation((channelName: string) => {
      const channelObj = {
        _name: channelName,
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }
      mockLatestChannel = channelObj
      return channelObj
    })
  })

  // -------------------------------------------------------------------------
  // SEC-04: loadAll re-fires when eventId changes
  //
  // EXPECTED FAIL: Plan 03 fixes this by adding eventId to the loadAll
  // useEffect dependency array.
  // -------------------------------------------------------------------------
  test.fails(
    'SEC-04: loadAll re-fires when eventId changes from 1 to 2',
    async () => {
      const db = await getDbMock()
      const getEvent = db.getEvent as ReturnType<typeof vi.fn>

      const { rerender } = renderWithProvider(1)

      await waitFor(() => {
        expect(getEvent).toHaveBeenCalledWith(1)
      })

      const callCountAfterFirstRender = getEvent.mock.calls.length

      // Rerender with a different eventId
      rerender(
        <AppProvider eventId={2}>
          <TestConsumer />
        </AppProvider>
      )

      await waitFor(() => {
        // loadAll must have fired again with eventId=2
        expect(getEvent).toHaveBeenCalledWith(2)
        expect(getEvent.mock.calls.length).toBeGreaterThan(callCountAfterFirstRender)
      })
    },
    // EXPECTED FAIL: Plan 03 fixes this
    undefined
  )

  // -------------------------------------------------------------------------
  // SEC-05: realtime subscription includes event_id filter
  //
  // EXPECTED FAIL: Plan 03 fixes this by adding a `filter` property to each
  // `.on('postgres_changes', ...)` call so only rows for the current event
  // are received over the realtime channel.
  // -------------------------------------------------------------------------
  test.fails(
    'SEC-05: realtime subscription includes event_id=eq.1 filter on postgres_changes',
    async () => {
      renderWithProvider(1)

      await waitFor(() => {
        expect(mockLatestChannel).not.toBeNull()
      })

      // At least one .on() call must include filter: 'event_id=eq.1'
      const onCalls = mockLatestChannel!.on.mock.calls
      expect(onCalls.length).toBeGreaterThan(0)

      const hasFilter = onCalls.some(
        (callArgs: unknown[]) =>
          callArgs[1] != null &&
          typeof callArgs[1] === 'object' &&
          (callArgs[1] as Record<string, unknown>)['filter'] === 'event_id=eq.1'
      )

      expect(hasFilter).toBe(true)
    },
    // EXPECTED FAIL: Plan 03 fixes this
    undefined
  )

  // -------------------------------------------------------------------------
  // SEC-05: realtime channel torn down on eventId change
  //
  // EXPECTED FAIL: Plan 03 fixes this by adding eventId to the realtime
  // useEffect dependency array so the channel is rebuilt when the event changes.
  // -------------------------------------------------------------------------
  test.fails(
    'SEC-05: realtime channel is torn down and rebuilt when eventId changes',
    async () => {
      const { rerender } = renderWithProvider(1)

      await waitFor(() => {
        expect(mockChannel).toHaveBeenCalledWith('leagueops-realtime')
      })

      const channelCallCountAfterFirst = mockChannel.mock.calls.length

      // Rerender with a different eventId
      rerender(
        <AppProvider eventId={2}>
          <TestConsumer />
        </AppProvider>
      )

      await waitFor(() => {
        // removeChannel must have been called to tear down the old subscription
        expect(mockRemoveChannel).toHaveBeenCalled()
        // A new channel must have been created for eventId=2
        expect(mockChannel.mock.calls.length).toBeGreaterThan(channelCallCountAfterFirst)
      })
    },
    // EXPECTED FAIL: Plan 03 fixes this
    undefined
  )

  // -------------------------------------------------------------------------
  // SEC-04: null guard -- loadAll does not fire when eventId is undefined
  //
  // EXPECTED FAIL: Plan 03 fixes this by adding a guard so loadAll only runs
  // when a valid eventId is provided. Currently the store defaults eventId=1
  // so there is no guard against undefined.
  // -------------------------------------------------------------------------
  test.fails(
    'SEC-04: null guard -- loadAll does not call getEvent when eventId is undefined',
    async () => {
      const db = await getDbMock()
      const getEvent = db.getEvent as ReturnType<typeof vi.fn>

      renderWithProvider(undefined)

      // Wait a tick to allow any useEffect to run
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Expected behavior: getEvent should NOT be called when no eventId is provided.
      // Currently FAILS because the store defaults eventId=1 and calls getEvent(1).
      expect(getEvent).not.toHaveBeenCalled()
    },
    // EXPECTED FAIL: Plan 03 fixes this
    undefined
  )
})
