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
    .select('id, name, slug, location, logo_url, start_date, end_date, status')
    .eq('slug', params.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!event) notFound()

  // For now, treat all active events as open for registration
  const isOpen = event.status === 'active'

  // If registration is open, redirect to main app registration page
  if (isOpen) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
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
          <h1 className="font-cond text-[24px] font-black text-white mb-2">{event.name}</h1>
          <div className="border border-[#1a2d50] bg-[#081428] rounded-xl p-8 mb-6">
            <div className="font-cond text-[14px] font-black text-white mb-3">
              Registration is Open
            </div>
            <a
              href={`${appUrl}/register?event_id=${event.id}`}
              className="inline-block bg-[#0B3D91] hover:bg-blue-700 text-white font-cond font-bold tracking-wide uppercase text-[13px] px-6 py-2.5 rounded-lg transition-colors"
            >
              Register Now
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Registration is closed — show closed page
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
        <h1 className="font-cond text-[24px] font-black text-white mb-2">{event.name}</h1>
        {event.location && (
          <div className="font-cond text-[13px] text-[#5a6e9a] mb-6">{event.location}</div>
        )}

        <div className="border border-[#1a2d50] bg-[#081428] rounded-xl p-8 mb-6">
          <div className="font-cond text-[14px] font-black text-white mb-2">
            Registration Closed
          </div>
          <div className="text-[12px] text-[#5a6e9a] leading-relaxed">
            Registration is currently closed. Contact the event organizer for details.
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
