import { NextRequest, NextResponse } from 'next/server'
import { getPublicEventBySlug, getPublicGames, getPublicTeams } from '@/lib/public-results/data'

function parseTime(t: string): { h: number; m: number } | null {
  const match = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = parseInt(match[2])
  const ap = match[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m }
}

function toIcsDt(date: string, timeStr: string): string | null {
  const t = parseTime(timeStr)
  if (!t || !date) return null
  const [y, mo, d] = date.split('-')
  return `${y}${mo}${d}T${String(t.h).padStart(2, '0')}${String(t.m).padStart(2, '0')}00`
}

function addMinutes(dt: string, mins: number): string {
  const d = new Date(
    +dt.slice(0, 4),
    +dt.slice(4, 6) - 1,
    +dt.slice(6, 8),
    +dt.slice(9, 11),
    +dt.slice(11, 13)
  )
  d.setMinutes(d.getMinutes() + mins)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('') +
    'T' +
    [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      '00',
    ].join('')
}

function nowStamp(): string {
  const d = new Date()
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('') +
    'T' +
    [
      String(d.getUTCHours()).padStart(2, '0'),
      String(d.getUTCMinutes()).padStart(2, '0'),
      String(d.getUTCSeconds()).padStart(2, '0'),
    ].join('') +
    'Z'
}

function esc(s: string): string {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params
  const sp = req.nextUrl.searchParams
  const teamId = sp.get('team') ? parseInt(sp.get('team')!) : null
  const program = sp.get('program') ?? null

  try {
    const event = await getPublicEventBySlug(slug)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const [allGames, teams] = await Promise.all([
      getPublicGames(event.id),
      getPublicTeams(event.id),
    ])

    let games = allGames.filter(
      (g) => g.status !== 'Unscheduled' && g.event_date?.date && g.scheduled_time
    )

    let calLabel = event.name

    if (teamId) {
      games = games.filter((g) => g.home_team?.id === teamId || g.away_team?.id === teamId)
      const team = teams.find((t) => t.id === teamId)
      if (team) calLabel = `${team.name} · ${event.name}`
    } else if (program) {
      const programTeamIds = new Set(
        teams
          .filter((t) => {
            const p = Array.isArray(t.programs) ? t.programs[0] : t.programs
            return (p as { name?: string } | null)?.name === program
          })
          .map((t) => t.id)
      )
      games = games.filter(
        (g) =>
          (g.home_team?.id && programTeamIds.has(g.home_team.id)) ||
          (g.away_team?.id && programTeamIds.has(g.away_team.id))
      )
      calLabel = `${program} · ${event.name}`
    }

    const stamp = nowStamp()

    const vevents = games
      .map((g) => {
        const start = toIcsDt(g.event_date!.date, g.scheduled_time)
        if (!start) return null
        const end = addMinutes(start, 60)
        const home = g.home_team?.name ?? 'TBD'
        const away = g.away_team?.name ?? 'TBD'
        const summary = `${home} vs ${away}`
        const descParts = [
          `Division: ${g.division}`,
          g.field ? `Field: ${g.field.name}` : null,
          g.status !== 'Scheduled' ? `Status: ${g.status}` : null,
        ].filter(Boolean) as string[]

        return [
          'BEGIN:VEVENT',
          `UID:game-${g.id}@leagueops.app`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
          `SUMMARY:${esc(summary)}`,
          `DESCRIPTION:${esc(descParts.join('\n'))}`,
          event.location ? `LOCATION:${esc(event.location)}` : null,
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
      })
      .filter(Boolean)
      .join('\r\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LeagueOps//LeagueOps//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(calLabel)}`,
      `X-WR-CALDESC:${esc(event.name)} Schedule`,
      vevents,
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[ICS]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
