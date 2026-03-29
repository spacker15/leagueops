'use client'

import { useState } from 'react'
import Link from 'next/link'
import { groupBy } from '@/lib/utils'

interface Props {
  teams: { id: number; name: string; division: string; logo_url?: string | null }[]
  slug: string
  activeDay: number
  divFilter: string
}

export function TeamSearchInput({ teams, slug, activeDay, divFilter }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : teams

  const grouped = groupBy(filtered, (t) => t.division)
  const divisions = Object.keys(grouped).sort()

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-3">
        <input
          type="search"
          placeholder="Search teams..."
          aria-label="Search teams"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-2 text-white font-cond text-[12px] placeholder:text-[#5a6e9a] focus:border-[#0B3D91] focus:outline-none pr-8"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a6e9a] hover:text-white transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Team list grouped by division */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 font-cond text-[11px] text-[#5a6e9a] uppercase tracking-[.12em]">
          No teams match your search.
        </div>
      ) : (
        <div className="space-y-4">
          {divisions.map((div) => (
            <div key={div}>
              <div className="font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase mb-1">
                {div}
              </div>
              <div className="space-y-1">
                {grouped[div].map((team) => (
                  <Link
                    key={team.id}
                    href={`/e/${slug}?tab=schedule&view=team&team=${team.id}&day=${activeDay}&div=${divFilter}`}
                    className="bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-3 font-cond text-[14px] font-bold text-white hover:border-[#0B3D91] transition-colors flex items-center gap-2"
                  >
                    {team.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.logo_url}
                        alt=""
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                    )}
                    {team.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
