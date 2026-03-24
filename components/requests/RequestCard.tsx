'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { Card, Btn, FormField, Textarea, Pill } from '@/components/ui'
import type { ScheduleChangeRequest, ScheduleChangeRequestGame } from '@/types'

export interface SlotSuggestion {
  eventDateId: number
  dateLabel: string
  fieldId: number
  fieldName: string
  scheduledTime: string
  homeTeamAvailable: boolean
  awayTeamAvailable: boolean
  score: number
}

interface RequestCardProps {
  request: ScheduleChangeRequest
  eventId: number
}

export function RequestCard({ request, eventId }: RequestCardProps) {
  const [expandedAction, setExpandedAction] = useState<'none' | 'deny' | 'approve'>('none')
  const [denyNotes, setDenyNotes] = useState('')
  const [selectedSlots, setSelectedSlots] = useState<Record<number, SlotSuggestion | null>>({})
  const [slotSuggestions, setSlotSuggestions] = useState<Record<number, SlotSuggestion[]>>({})
  const [loadingSlots, setLoadingSlots] = useState<Record<number, boolean>>({})
  const [slotErrors, setSlotErrors] = useState<Record<number, boolean>>({})
  const [processing, setProcessing] = useState(false)
  const [activeGameId, setActiveGameId] = useState<number | null>(null)

  const handleStatusChange = async (newStatus: string, notes?: string) => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/schedule-change-requests/${request.id}?event_id=${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_notes: notes || null }),
      })
      if (!res.ok) throw new Error('Failed')
      if (newStatus === 'under_review') {
        toast.success('Your request is under review.')
      } else if (newStatus === 'denied') {
        toast.success('Request denied.')
      } else if (newStatus === 'approved' && request.request_type === 'cancel') {
        toast.success('Game cancelled. Affected teams have been notified.')
      }
    } catch {
      toast.error('Could not process this request. Try again.')
    } finally {
      setProcessing(false)
      setExpandedAction('none')
    }
  }

  const handleDeny = async () => {
    await handleStatusChange('denied', denyNotes)
    setDenyNotes('')
  }

  const loadSlots = async (requestGame: ScheduleChangeRequestGame) => {
    const gameId = requestGame.game_id
    setActiveGameId(requestGame.id)
    if (slotSuggestions[requestGame.id]) return // already loaded

    setLoadingSlots((prev) => ({ ...prev, [requestGame.id]: true }))
    setSlotErrors((prev) => ({ ...prev, [requestGame.id]: false }))
    try {
      const res = await fetch(
        `/api/schedule-change-requests/${request.id}/slots?game_id=${gameId}&event_id=${eventId}`
      )
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSlotSuggestions((prev) => ({ ...prev, [requestGame.id]: data.slots ?? [] }))
    } catch {
      setSlotErrors((prev) => ({ ...prev, [requestGame.id]: true }))
    } finally {
      setLoadingSlots((prev) => ({ ...prev, [requestGame.id]: false }))
    }
  }

  const handleReschedule = async (requestGame: ScheduleChangeRequestGame) => {
    const slot = selectedSlots[requestGame.id]
    if (!slot) return

    setProcessing(true)
    try {
      const res = await fetch(
        `/api/schedule-change-requests/${request.id}/reschedule?event_id=${eventId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: requestGame.game_id,
            request_game_id: requestGame.id,
            new_field_id: slot.fieldId,
            new_scheduled_time: slot.scheduledTime,
          }),
        }
      )
      if (!res.ok) throw new Error('Failed')
      toast.success('Game rescheduled. Affected teams have been notified.')
      setActiveGameId(null)
    } catch {
      toast.error('Could not process this request. Try again.')
    } finally {
      setProcessing(false)
    }
  }

  const getAvailabilityPill = (available: boolean, isHomeTeam: boolean) => {
    const label = isHomeTeam ? 'Home' : 'Away'
    if (available === true) return <Pill variant="green">{label}: Available</Pill>
    if (available === false) return <Pill variant="red">{label}: Conflict</Pill>
    return <Pill variant="yellow">{label}: Partial</Pill>
  }

  const isPending = request.status === 'pending'
  const isUnderReview = request.status === 'under_review'
  const showActions = isPending || isUnderReview

  const teamName = request.team?.name ?? `Team #${request.team_id}`

  return (
    <Card className="p-4 mb-3">
      {/* Header row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-cond text-[15px] font-black text-white">{teamName}</span>
          <Pill variant={request.request_type === 'reschedule' ? 'blue' : 'red'}>
            {request.request_type === 'reschedule' ? 'Reschedule' : 'Cancel'}
          </Pill>
          <span className={`badge-request-${request.status}`}>{request.status.replace('_', ' ')}</span>
        </div>
        <span className="font-mono text-[10px] text-muted flex-shrink-0 ml-2">
          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Games sub-list */}
      {request.games && request.games.length > 0 && (
        <div className="border border-[#1a2d50] rounded-lg mb-3">
          {request.games.map((rg, idx) => (
            <div
              key={rg.id}
              className={`flex gap-3 items-center py-1.5 px-3 border-b border-[#1a2d50] last:border-0 ${idx === 0 ? '' : ''}`}
            >
              {rg.game && (
                <>
                  {(rg.game as any).event_date?.date && (
                    <span className="font-mono text-[12px] text-muted">
                      {new Date((rg.game as any).event_date.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className="font-mono text-[12px] text-muted">
                    {rg.game.scheduled_time}
                  </span>
                  {rg.game.field && (
                    <span className="text-[12px] text-muted">{rg.game.field.name}</span>
                  )}
                  {rg.game.home_team && rg.game.away_team && (
                    <span className="text-[12px] text-white">
                      {rg.game.home_team.name} vs {rg.game.away_team.name}
                    </span>
                  )}
                </>
              )}
              <span className={`badge-request-${rg.status} ml-auto`}>{rg.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reason row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill variant="gray">{request.reason_category}</Pill>
        {request.reason_details && (
          <span className="text-[12px] text-muted">{request.reason_details}</span>
        )}
      </div>

      {/* Admin notes row */}
      {request.admin_notes && (
        <div className="mb-2">
          <span className="text-[12px] text-muted italic">Admin: {request.admin_notes}</span>
        </div>
      )}

      {/* Action row */}
      {showActions && expandedAction === 'none' && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {isPending && (
            <Btn
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('under_review')}
              disabled={processing}
            >
              Mark Under Review
            </Btn>
          )}
          <Btn
            variant="primary"
            size="sm"
            onClick={() => setExpandedAction('approve')}
            disabled={processing}
            aria-label={`Approve request from ${teamName}`}
          >
            Approve Request
          </Btn>
          <Btn
            variant="danger"
            size="sm"
            onClick={() => setExpandedAction('deny')}
            disabled={processing}
            aria-label={`Deny request from ${teamName}`}
          >
            Deny Request
          </Btn>
        </div>
      )}

      {/* Deny expansion */}
      {expandedAction === 'deny' && (
        <div className="mt-3 transition-all duration-150 ease-out">
          <FormField label="Denial reason (optional)">
            <Textarea
              placeholder="Explain why the request was denied..."
              value={denyNotes}
              onChange={(e) => setDenyNotes(e.target.value)}
            />
          </FormField>
          <div className="flex items-center gap-2 mt-2">
            <Btn variant="danger" size="sm" onClick={handleDeny} disabled={processing}>
              Confirm Deny
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setExpandedAction('none')}
              disabled={processing}
            >
              Go Back
            </Btn>
          </div>
        </div>
      )}

      {/* Approve expansion */}
      {expandedAction === 'approve' && (
        <div className="mt-3 transition-all duration-150 ease-out">
          {request.request_type === 'cancel' ? (
            // Cancel confirmation
            <div>
              <p className="text-[12px] text-muted mb-2">
                Cancel this game? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={() => handleStatusChange('approved')}
                  disabled={processing}
                >
                  Yes, Cancel Game
                </Btn>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedAction('none')}
                  disabled={processing}
                >
                  Go Back
                </Btn>
              </div>
            </div>
          ) : (
            // Reschedule slot selection
            <div>
              {request.games?.map((rg) => {
                const isActive = activeGameId === rg.id
                const selected = selectedSlots[rg.id]
                const suggestions = slotSuggestions[rg.id] ?? []
                const isLoading = loadingSlots[rg.id]
                const hasError = slotErrors[rg.id]

                return (
                  <div key={rg.id} className="mb-3">
                    {/* Game row */}
                    <div className="flex items-center gap-2 mb-2">
                      {rg.game && (
                        <span className="text-[12px] text-muted">
                          {(rg.game as any).event_date?.date
                            ? new Date((rg.game as any).event_date.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' '
                            : ''}
                          {rg.game.scheduled_time}
                          {rg.game.field && ` · ${rg.game.field.name}`}
                        </span>
                      )}
                      {!isActive && (
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={() => loadSlots(rg)}
                          className="ml-auto"
                        >
                          Select Slot
                        </Btn>
                      )}
                    </div>

                    {/* Slot suggestion panel */}
                    {isActive && (
                      <div className="bg-[#0a1a3a] border border-[#1e3060] rounded-lg p-3 mt-2">
                        {isLoading && (
                          <p className="font-cond text-[12px] text-muted animate-pulse">
                            Finding available slots...
                          </p>
                        )}

                        {hasError && !isLoading && (
                          <div>
                            <p className="font-cond text-[12px] text-muted mb-2">
                              Could not load slot suggestions. Try again.
                            </p>
                            <Btn
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSlotErrors((prev) => ({ ...prev, [rg.id]: false }))
                                setSlotSuggestions((prev) => {
                                  const updated = { ...prev }
                                  delete updated[rg.id]
                                  return updated
                                })
                                loadSlots(rg)
                              }}
                            >
                              Retry
                            </Btn>
                          </div>
                        )}

                        {!isLoading && !hasError && suggestions.length === 0 && (
                          <p className="font-cond text-[12px] text-muted">
                            No available slots found. Manual rescheduling required.
                          </p>
                        )}

                        {!isLoading && !hasError && suggestions.length > 0 && (
                          <div
                            role="radiogroup"
                            aria-label="Available time slots"
                          >
                            {suggestions.slice(0, 5).map((slot, i) => {
                              const isSelected = selected?.scheduledTime === slot.scheduledTime && selected?.fieldId === slot.fieldId
                              return (
                                <div
                                  key={i}
                                  role="radio"
                                  aria-checked={isSelected}
                                  aria-label={`${format(new Date(slot.scheduledTime), 'MMM d')} ${format(new Date(slot.scheduledTime), 'h:mm a')} at ${slot.fieldName}`}
                                  tabIndex={0}
                                  onClick={() => setSelectedSlots((prev) => ({ ...prev, [rg.id]: slot }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      setSelectedSlots((prev) => ({ ...prev, [rg.id]: slot }))
                                    }
                                  }}
                                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1a2d50] last:border-0 cursor-pointer hover:bg-[#0d2040] rounded transition-colors duration-150 ${
                                    isSelected ? 'bg-[#0B3D91]/20 border border-[#0B3D91]/40' : ''
                                  }`}
                                >
                                  <div className="flex flex-col flex-1">
                                    <span className="font-mono text-[12px] text-white">
                                      {format(new Date(slot.scheduledTime), 'MMM d, yyyy')} {format(new Date(slot.scheduledTime), 'h:mm a')}
                                    </span>
                                    <span className="text-[12px] text-muted">{slot.fieldName}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {getAvailabilityPill(slot.homeTeamAvailable, true)}
                                    {getAvailabilityPill(slot.awayTeamAvailable, false)}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {selected && (
                          <div className="flex items-center gap-2 mt-3">
                            <Btn
                              variant="primary"
                              size="sm"
                              onClick={() => handleReschedule(rg)}
                              disabled={processing}
                            >
                              Confirm Reschedule
                            </Btn>
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActiveGameId(null)
                                setExpandedAction('none')
                              }}
                              disabled={processing}
                            >
                              Go Back
                            </Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Go back if no active game panel */}
              {activeGameId === null && (
                <div className="flex items-center gap-2 mt-2">
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedAction('none')}
                    disabled={processing}
                  >
                    Go Back
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
