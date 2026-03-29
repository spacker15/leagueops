'use client'

import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface PickerDate {
  id: number
  date: string
  label: string | null
  day_number?: number | null
}

interface Props {
  dates: PickerDate[]
  selectedId: number | null // null = ALL
  onChange: (id: number | null) => void
  showAll?: boolean
  className?: string
}

/** Compute 1-based week number relative to the first date in the set */
function weekNum(dateStr: string, firstDateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const f = new Date(firstDateStr + 'T00:00:00')
  return Math.floor((d.getTime() - f.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}

export function EventDatePicker({ dates, selectedId, onChange, showAll = true, className }: Props) {
  if (dates.length === 0) return null

  const firstDate = dates[0].date
  const multiWeek = dates.length > 1 && weekNum(dates[dates.length - 1].date, firstDate) > 1

  return (
    <div
      className={cn(
        'flex gap-2 flex-wrap',
        // On mobile: horizontal scroll instead of wrap
        'max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 max-sm:gap-1.5',
        className
      )}
    >
      {showAll && (
        <button
          onClick={() => onChange(null)}
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-lg border font-cond font-black tracking-widest transition-colors',
            // Responsive sizing
            'text-[11px] px-3 py-2 sm:text-[12px] sm:px-4 sm:py-2.5 lg:text-[13px] lg:px-5 lg:py-3',
            selectedId === null
              ? 'bg-navy border-blue-400 text-white'
              : 'border-border text-muted hover:text-white hover:border-border/80'
          )}
        >
          ALL
        </button>
      )}

      {dates.map((d) => {
        const wk = weekNum(d.date, firstDate)
        const dayOfWeek = format(new Date(d.date + 'T00:00:00'), 'EEE')
        const monthDay = format(new Date(d.date + 'T00:00:00'), 'M/d')
        const isSelected = selectedId === d.id

        return (
          <button
            key={d.id}
            onClick={() => onChange(d.id)}
            className={cn(
              'flex-shrink-0 flex flex-col items-center justify-center rounded-lg border transition-colors',
              // Responsive sizing
              'min-w-[56px] px-2.5 py-1.5 sm:min-w-[70px] sm:px-3 sm:py-2 lg:min-w-[84px] lg:px-4 lg:py-2.5',
              isSelected
                ? 'bg-red border-red text-white'
                : 'border-border text-muted hover:text-white hover:border-border/80'
            )}
          >
            {/* Week number row */}
            <span
              className={cn(
                'font-cond font-black leading-none',
                // Responsive
                'text-[9px] tracking-[.12em] sm:text-[10px] lg:text-[11px]',
                isSelected ? 'text-red-200' : 'text-muted'
              )}
            >
              {multiWeek ? `WK ${wk}` : (d.label ?? `D${d.day_number ?? 1}`)}
            </span>
            {/* Day + date row */}
            <span
              className={cn(
                'font-cond font-black leading-tight mt-0.5',
                'text-[12px] sm:text-[14px] lg:text-[15px]',
                isSelected ? 'text-white' : 'text-white'
              )}
            >
              {dayOfWeek}
            </span>
            <span
              className={cn(
                'font-mono leading-none',
                'text-[10px] sm:text-[11px] lg:text-[12px]',
                isSelected ? 'text-red-100' : 'text-muted'
              )}
            >
              {monthDay}
            </span>
          </button>
        )
      })}
    </div>
  )
}
