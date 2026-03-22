import Link from 'next/link'
import { getPublicEvents } from '@/lib/data'
import type { PublicEvent } from '@/lib/data'

export const revalidate = 60 // ISR — revalidate every 60 seconds

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

export default async function HomePage() {
  let events: PublicEvent[] = []
  try {
    events = await getPublicEvents()
  } catch {
    // Supabase not configured — show placeholder
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cond text-[11px] font-black tracking-[.18em] text-[#5a6e9a] uppercase mb-1">
          All Events
        </h1>
        <p className="font-cond text-[13px] text-[#5a6e9a]">
          Select an event to view standings, results, and scores.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
          <div className="font-cond text-[11px] font-black tracking-[.18em] text-[#5a6e9a] uppercase">
            No events available
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: PublicEvent }) {
  return (
    <Link
      href={`/e/${event.slug}`}
      className="block bg-[#081428] border border-[#1a2d50] rounded-xl p-4 hover:border-[#0B3D91] transition-colors group"
    >
      {event.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logo_url}
          alt={event.name}
          className="w-12 h-12 object-contain rounded mb-3"
        />
      )}
      <div className="font-cond text-[15px] font-black text-white group-hover:text-blue-300 transition-colors">
        {event.name}
      </div>
      <div className="font-cond text-[12px] text-[#5a6e9a] mt-0.5">{event.location}</div>
      <div className="font-cond text-[11px] font-bold tracking-[.08em] text-[#5a6e9a] mt-2">
        {formatDateRange(event.start_date, event.end_date)}
      </div>
    </Link>
  )
}
