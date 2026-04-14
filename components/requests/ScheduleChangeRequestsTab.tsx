'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { SectionHeader } from '@/components/ui'
import { RequestCard } from '@/components/requests/RequestCard'
import type { ScheduleChangeRequest } from '@/types'

export function ScheduleChangeRequestsTab() {
  const { state, eventId } = useApp()
  const { isAdmin } = useAuth()

  const requests: ScheduleChangeRequest[] = state.scheduleChangeRequests ?? []

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const underReviewRequests = requests.filter((r) => r.status === 'under_review')
  const completedRequests = requests.filter((r) =>
    ['approved', 'denied', 'partially_complete', 'completed', 'rescheduled'].includes(r.status)
  )

  const [completedCollapsed, setCompletedCollapsed] = useState(completedRequests.length > 5)

  if (!eventId) return null
  if (!isAdmin) return null

  const visibleCompleted = completedCollapsed ? completedRequests.slice(0, 5) : completedRequests

  if (requests.length === 0) {
    return (
      <div className="tab-content">
        <div className="min-h-[120px] flex items-center justify-center">
          <span className="font-cond text-[13px] text-muted">No schedule change requests yet.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      {/* Pending section */}
      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <SectionHeader>PENDING</SectionHeader>
          {pendingRequests.map((r) => (
            <RequestCard key={r.id} request={r} eventId={eventId} />
          ))}
        </div>
      )}

      {/* Under review section */}
      {underReviewRequests.length > 0 && (
        <div className="mb-6">
          <SectionHeader>UNDER REVIEW</SectionHeader>
          {underReviewRequests.map((r) => (
            <RequestCard key={r.id} request={r} eventId={eventId} />
          ))}
        </div>
      )}

      {/* Completed / Denied section */}
      {completedRequests.length > 0 && (
        <div className="mb-6">
          <SectionHeader>COMPLETED / DENIED</SectionHeader>
          {visibleCompleted.map((r) => (
            <RequestCard key={r.id} request={r} eventId={eventId} />
          ))}
          {completedCollapsed && completedRequests.length > 5 && (
            <button
              onClick={() => setCompletedCollapsed(false)}
              className="font-cond text-[12px] text-muted hover:text-white transition-colors mt-1"
            >
              Show {completedRequests.length - 5} more
            </button>
          )}
        </div>
      )}

      {/* Empty sections message when all are empty */}
      {pendingRequests.length === 0 &&
        underReviewRequests.length === 0 &&
        completedRequests.length === 0 && (
          <div className="min-h-[120px] flex items-center justify-center">
            <span className="font-cond text-[13px] text-muted">
              No schedule change requests yet.
            </span>
          </div>
        )}
    </div>
  )
}
