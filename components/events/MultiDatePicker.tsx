'use client'

import {
  eachDayOfInterval,
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachMonthOfInterval,
} from 'date-fns'

interface MultiDatePickerProps {
  startDate: string // event start_date ISO string
  endDate: string // event end_date ISO string
  selectedDates: string[] // array of ISO date strings currently selected
  onToggleDate: (date: string) => void // called when a day cell is clicked
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MultiDatePicker({
  startDate,
  endDate,
  selectedDates,
  onToggleDate,
}: MultiDatePickerProps) {
  if (!startDate || !endDate) return null

  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (end < start) return null

  // Get all months in range
  const months = eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) })

  return (
    <div className="space-y-6">
      {months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart)
        // Build the full 7-column grid for this month
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
        const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

        return (
          <div key={monthStart.toISOString()}>
            {/* Month header */}
            <div className="font-cond text-[18px] font-black text-white mb-3">
              {format(monthStart, 'MMMM yyyy')}
            </div>

            {/* Day name headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="text-[12px] text-[#5a6e9a] font-cond font-black tracking-[.12em] uppercase text-center py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {gridDays.map((day) => {
                const isInMonth = isSameMonth(day, monthStart)
                const isBeforeStart = day < start
                const isAfterEnd = day > end
                const isOutOfRange = isBeforeStart || isAfterEnd
                const isoStr = format(day, 'yyyy-MM-dd')
                const isSelected =
                  !isOutOfRange &&
                  selectedDates.some((d) => {
                    try {
                      return isSameDay(parseISO(d), day)
                    } catch {
                      return false
                    }
                  })

                if (!isInMonth || isOutOfRange) {
                  return (
                    <div
                      key={isoStr}
                      className="px-3 py-3 text-center font-cond text-[13px] text-[#2a3a5a] cursor-not-allowed"
                    >
                      {format(day, 'd')}
                    </div>
                  )
                }

                return (
                  <button
                    key={isoStr}
                    onClick={() => onToggleDate(isoStr)}
                    className={
                      isSelected
                        ? 'px-3 py-3 text-center font-cond text-[13px] bg-[#0B3D91] text-white rounded-lg'
                        : 'px-3 py-3 text-center font-cond text-[13px] text-white hover:bg-[#0a1a3a] rounded-lg cursor-pointer'
                    }
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
