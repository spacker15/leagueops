'use client'

import { useState, useEffect, useRef } from 'react'
import { useApp } from '@/lib/store'
import { Modal, Btn, FormField, Select, Textarea } from '@/components/ui'
import toast from 'react-hot-toast'
import type { Game } from '@/types'

// ─── Props ────────────────────────────────────────────────────

interface ScheduleChangeRequestModalProps {
  open: boolean
  onClose: () => void
  preSelectedGameId?: number
  teamId: number
  teamGames: Game[]
}

// ─── Component ────────────────────────────────────────────────

export function ScheduleChangeRequestModal({
  open,
  onClose,
  preSelectedGameId,
  teamId,
  teamGames,
}: ScheduleChangeRequestModalProps) {
  const { eventId } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)

  // ── State (all hooks before early returns per CLAUDE.md) ──
  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(
    preSelectedGameId ? new Set([preSelectedGameId]) : new Set()
  )
  const [requestType, setRequestType] = useState<'reschedule' | 'cancel'>('reschedule')
  const [reasonCategory, setReasonCategory] = useState('')
  const [reasonDetails, setReasonDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset state when modal opens or preSelectedGameId changes
  useEffect(() => {
    if (open) {
      setSelectedGameIds(preSelectedGameId ? new Set([preSelectedGameId]) : new Set())
      setRequestType('reschedule')
      setReasonCategory('')
      setReasonDetails('')
      setSubmitting(false)
      // Focus management: focus container when modal opens
      setTimeout(() => containerRef.current?.focus(), 50)
    }
  }, [open, preSelectedGameId])

  // Escape key closes modal
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Filter to only future games
  const now = new Date().toISOString()
  const futureGames = teamGames.filter((g) => g.scheduled_time > now || g.status === 'Scheduled' || g.status === 'Starting')

  function toggleGame(gameId: number) {
    setSelectedGameIds((prev) => {
      const next = new Set(prev)
      if (next.has(gameId)) {
        next.delete(gameId)
      } else {
        next.add(gameId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/schedule-change-requests?event_id=${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          request_type: requestType,
          reason_category: reasonCategory,
          reason_details: reasonDetails || null,
          game_ids: Array.from(selectedGameIds),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Request submitted.')
      onClose()
    } catch {
      toast.error('Could not submit request. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Schedule Change"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Discard Request
          </Btn>
          <Btn
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedGameIds.size === 0 || !reasonCategory || submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Btn>
        </>
      }
    >
      <div ref={containerRef} tabIndex={-1} className="outline-none space-y-4">
        {/* AFFECTED GAMES section */}
        <div>
          <span className="font-cond text-[10px] font-black tracking-[.12em] uppercase text-muted block mb-2">
            AFFECTED GAMES
          </span>
          <div className="max-h-[200px] overflow-y-auto border border-[#1e3060] rounded-lg">
            {futureGames.length === 0 ? (
              <div className="flex items-center justify-center py-6 font-cond text-[12px] text-muted">
                No upcoming games.
              </div>
            ) : (
              futureGames.map((game) => {
                const isPreSelected = game.id === preSelectedGameId
                const isChecked = selectedGameIds.has(game.id)
                const opponent =
                  game.home_team_id === teamId
                    ? game.away_team?.name ?? `Team #${game.away_team_id}`
                    : game.home_team?.name ?? `Team #${game.home_team_id}`

                return (
                  <label
                    key={game.id}
                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#1e3060] last:border-0 cursor-pointer hover:bg-white/5 transition-colors ${
                      isPreSelected ? 'bg-[#0a1a3a]' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleGame(game.id)}
                      className="accent-[#0B3D91] flex-shrink-0"
                      aria-label={`Select game: ${game.scheduled_time} vs ${opponent}`}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-[12px] text-muted whitespace-nowrap">
                        {game.scheduled_time}
                      </span>
                      {game.field?.name && (
                        <span className="text-[12px] text-muted truncate">
                          {game.field.name}
                        </span>
                      )}
                      <span className="text-[12px] text-white font-black truncate">
                        vs {opponent}
                      </span>
                      {game.division && (
                        <span className="text-[10px] text-muted flex-shrink-0">
                          {game.division}
                        </span>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* Request type toggle */}
        <div>
          <span className="font-cond text-[10px] font-black tracking-[.12em] uppercase text-muted block mb-2">
            What do you need?
          </span>
          <div className="flex gap-2" role="group">
            <Btn
              variant={requestType === 'reschedule' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRequestType('reschedule')}
              aria-pressed={requestType === 'reschedule'}
            >
              Reschedule
            </Btn>
            <Btn
              variant={requestType === 'cancel' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRequestType('cancel')}
              aria-pressed={requestType === 'cancel'}
            >
              Cancel Game
            </Btn>
          </div>
        </div>

        {/* Reason category */}
        <FormField label="Reason">
          <Select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className="bg-[#040e24]"
          >
            <option value="">Select a reason...</option>
            <option value="Coach conflict">Coach conflict</option>
            <option value="Team conflict">Team conflict</option>
            <option value="Weather concern">Weather concern</option>
            <option value="Venue issue">Venue issue</option>
            <option value="Other">Other</option>
          </Select>
        </FormField>

        {/* Additional details */}
        <FormField label="Additional Details (Optional)">
          <Textarea
            placeholder="Describe the conflict or issue..."
            value={reasonDetails}
            onChange={(e) => setReasonDetails(e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  )
}
