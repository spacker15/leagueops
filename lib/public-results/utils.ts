/** Convert "9:00 AM" / "1:30 PM" style strings to minutes-since-midnight for sorting */
export function timeToMinutes(time: string | null | undefined): number {
  if (!time || time === 'TBD') return 99999
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return 99999
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + min
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}
