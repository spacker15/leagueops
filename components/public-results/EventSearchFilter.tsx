'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PublicEvent } from '@/lib/public-results/data'

interface Props {
  events: PublicEvent[]
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function EventCard({ event }: { event: PublicEvent }) {
  return (
    <Link
      href={`/results/e/${event.slug}`}
      className="block bg-[#081428] border border-[#1a2d50] rounded-xl p-4 hover:border-[#0B3D91] transition-colors group"
      aria-label={`View results for ${event.name}`}
    >
      {event.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logo_url}
          alt={event.name}
          className="w-12 h-12 object-contain rounded mb-3"
        />
      )}
      <div className="font-cond text-[14px] font-bold text-white group-hover:text-blue-300 transition-colors">
        {event.name}
      </div>
      <div className="font-cond text-[12px] text-[#5a6e9a] mt-0.5">{event.location}</div>
      <div className="font-cond text-[12px] font-bold tracking-[.08em] text-[#5a6e9a] mt-2">
        {formatDateRange(event.start_date, event.end_date)}
      </div>
    </Link>
  )
}

export function EventSearchFilter({ events }: Props) {
  const [query, setQuery] = useState('')

  const filtered = events.filter(
    (e) =>
      query === '' ||
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.location.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <div className="relative mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events or locations..."
          aria-label="Search events or locations"
          className="w-full sm:max-w-sm bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-2 text-white font-cond text-[12px] placeholder:text-[#5a6e9a] focus:border-[#0B3D91] focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a6e9a] hover:text-white transition-colors font-bold text-[14px] leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
          <div className="font-cond text-[12px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
            No events match your search.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </>
  )
}
