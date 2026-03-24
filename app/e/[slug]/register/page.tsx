import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const revalidate = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  params: { slug: string }
}

export default async function RegisterPage({ params }: Props) {
  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, location, logo_url')
    .eq('slug', params.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!event) notFound()

  return (
    <div className="min-h-screen bg-[#060e1e] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {event.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.logo_url}
            alt={event.name}
            className="w-16 h-16 object-contain rounded mx-auto mb-4"
          />
        )}
        <h1 className="font-cond text-[24px] font-black text-white mb-2">
          {event.name}
        </h1>
        {event.location && (
          <div className="font-cond text-[13px] text-[#5a6e9a] mb-6">
            {event.location}
          </div>
        )}

        <div className="border border-[#1a2d50] bg-[#081428] rounded-xl p-8 mb-6">
          <div className="font-cond text-[14px] font-black text-white mb-2">
            Registration Coming Soon
          </div>
          <div className="text-[12px] text-[#5a6e9a] leading-relaxed">
            Online registration for this event is not yet available.
            Check back soon or contact the event organizer for details.
          </div>
        </div>

        <Link
          href={`/e/${params.slug}`}
          className="font-cond text-[11px] font-bold tracking-[.1em] uppercase text-[#5a6e9a] hover:text-white transition-colors"
        >
          View Event Details
        </Link>
      </div>
    </div>
  )
}
