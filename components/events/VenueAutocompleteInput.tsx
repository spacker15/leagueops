'use client'

import { useState, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VenuePrediction {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

interface VenueAutocompleteInputProps {
  value: string
  onLocationChange: (text: string) => void
  onVenueSelect: (venue: {
    name: string
    address: string
    lat: number
    lng: number
    place_id: string
  }) => void
  selectedPlaceId?: string | null
  className?: string
}

export function VenueAutocompleteInput({
  value,
  onLocationChange,
  onVenueSelect,
  selectedPlaceId,
  className,
}: VenueAutocompleteInputProps) {
  const [venueQuery, setVenueQuery] = useState('')
  const [venuePredictions, setVenuePredictions] = useState<VenuePrediction[]>([])
  const [venueSearching, setVenueSearching] = useState(false)
  const [showVenueDropdown, setShowVenueDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchVenue = useCallback(
    (text: string) => {
      setVenueQuery(text)
      onLocationChange(text)

      if (text.length < 3) {
        setVenuePredictions([])
        setShowVenueDropdown(false)
        return
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setVenueSearching(true)
        try {
          const res = await fetch(`/api/maps/autocomplete?q=${encodeURIComponent(text)}`)
          const data = await res.json()
          setVenuePredictions(data.predictions ?? [])
          setShowVenueDropdown(true)
        } catch {
          setVenuePredictions([])
        }
        setVenueSearching(false)
      }, 300)
    },
    [onLocationChange]
  )

  const handleSelect = useCallback(
    async (placeId: string) => {
      setShowVenueDropdown(false)
      setVenueSearching(true)
      try {
        const res = await fetch(`/api/maps/details?place_id=${encodeURIComponent(placeId)}`)
        const data = await res.json()
        if (data.name) {
          setVenueQuery(data.name + (data.address ? ' -- ' + data.address : ''))
          onVenueSelect({
            name: data.name,
            address: data.address || '',
            lat: data.lat,
            lng: data.lng,
            place_id: placeId,
          })
        }
      } catch {
        // Silently fail -- component does not depend on toast
      }
      setVenueSearching(false)
    },
    [onVenueSelect]
  )

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a6e9a] pointer-events-none"
        />
        <input
          className={cn(
            'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors',
            'pl-9'
          )}
          value={venueQuery || value}
          onChange={(e) => searchVenue(e.target.value)}
          onFocus={() => venuePredictions.length > 0 && setShowVenueDropdown(true)}
          onBlur={() => setTimeout(() => setShowVenueDropdown(false), 200)}
          placeholder="Search venue or enter address"
        />
        {venueSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6e9a] text-[10px] font-cond">
            Searching...
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showVenueDropdown && venuePredictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden shadow-xl">
          {venuePredictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-[#0d1a2e] transition-colors border-b border-[#1a2d50] last:border-0"
              onMouseDown={() => handleSelect(p.place_id)}
            >
              <div className="font-cond text-[12px] font-bold text-white">{p.main_text}</div>
              <div className="font-cond text-[10px] text-[#5a6e9a]">{p.secondary_text}</div>
            </button>
          ))}
        </div>
      )}

      {/* Venue saved chip */}
      {selectedPlaceId && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-[#22c55e] bg-[#052e14] rounded-full px-2 py-1 font-cond">
            Venue saved
          </span>
        </div>
      )}
    </div>
  )
}
