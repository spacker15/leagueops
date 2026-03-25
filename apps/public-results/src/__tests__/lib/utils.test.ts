import { describe, it, expect } from 'vitest'
import { groupBy } from '@/lib/utils'

describe('groupBy', () => {
  it('groups items by key function', () => {
    const items = [
      { name: 'a', type: 'x' },
      { name: 'b', type: 'y' },
      { name: 'c', type: 'x' },
    ]
    const result = groupBy(items, (i) => i.type)
    expect(Object.keys(result)).toEqual(['x', 'y'])
    expect(result['x']).toHaveLength(2)
    expect(result['y']).toHaveLength(1)
  })

  it('returns empty object for empty array', () => {
    const result = groupBy([], (i: string) => i)
    expect(result).toEqual({})
  })

  it('handles single-item groups', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = groupBy(items, (i) => String(i.id))
    expect(Object.keys(result)).toHaveLength(3)
  })
})
