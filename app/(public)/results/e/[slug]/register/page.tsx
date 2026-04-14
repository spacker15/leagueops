import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublicEventBySlug } from '@/lib/public-results/data'

export const revalidate = 30

interface Props {
  params: { slug: string }
}

export default async function RegisterPage({ params }: Props) {
  const event = await getPublicEventBySlug(params.slug)
  if (!event) notFound()

  return (
    <div className="max-w-md mx-auto text-center py-20">
      {/* Event header */}
      {event.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logo_url}
          alt={event.name}
          className="w-16 h-16 object-contain rounded mx-auto mb-4"
        />
      )}
      <h1 className="font-cond text-[24px] font-black text-white mb-2">{event.name}</h1>
      {event.location && (
        <div className="font-cond text-[13px] text-[#5a6e9a] mb-6">{event.location}</div>
      )}

      {/* Coming soon message */}
      <div className="border border-[#1a2d50] bg-[#081428] rounded-xl p-8 mb-6">
        <div className="font-cond text-[14px] font-black text-white mb-2">
          Registration Coming Soon
        </div>
        <div className="text-[12px] text-[#5a6e9a] leading-relaxed">
          Online registration for this event is not yet available. Check back soon or contact the
          event organizer for details.
        </div>
      </div>

      {/* Link back to public event page */}
      <Link
        href={`/results/e/${params.slug}`}
        className="font-cond text-[11px] font-bold tracking-[.1em] uppercase text-[#5a6e9a] hover:text-white transition-colors"
      >
        View Event Details
      </Link>
    </div>
  )
}
