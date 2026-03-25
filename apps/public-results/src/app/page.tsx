import { getPublicEvents } from '@/lib/data'
import type { PublicEvent } from '@/lib/data'
import { EventSearchFilter } from '@/components/EventSearchFilter'

export const revalidate = 60 // ISR — revalidate every 60 seconds

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
        <h1 className="font-cond text-[10px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase mb-1">
          All Events
        </h1>
        <p className="font-cond text-[12px] text-[#5a6e9a]">
          Select an event to view standings, results, and scores.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 border border-[#1a2d50] rounded-xl bg-[#081428]">
          <div className="font-cond text-[12px] font-bold tracking-[.18em] text-[#5a6e9a] uppercase">
            No events available
          </div>
        </div>
      ) : (
        <EventSearchFilter events={events} />
      )}
    </div>
  )
}
