import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a chainable Supabase query mock.
 * - Default result is { data: [], error: null } (array query result)
 * - .single() resolves with { data: null, error: null } by default
 *
 * Override by providing a result object:
 *   makeChain({ data: [{ id: 1 }], error: null })
 *   makeChain({ data: null, error: { message: 'not found' } })
 */
export function makeChain(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const resolved = { data: result.data ?? [], error: result.error ?? null }
  const singleResolved = {
    data: Array.isArray(resolved.data) ? (resolved.data[0] ?? null) : resolved.data,
    error: resolved.error,
  }

  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    gte: () => chain,
    lte: () => chain,
    gt: () => chain,
    lt: () => chain,
    is: () => chain,
    not: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    // .single() returns single-row shape
    single: () => Promise.resolve(singleResolved),
    // Awaiting the chain directly (array query) resolves with array shape
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
  }
  return chain
}

/**
 * Creates a mock SupabaseClient.
 * Pass a default chain result; override per test with mockReturnValueOnce:
 *
 *   mockSb.from.mockReturnValueOnce(makeChain({ data: [{ id: 1 }], error: null }))
 */
export function makeMockSb(
  defaultResult: { data?: unknown; error?: unknown } = { data: [], error: null }
) {
  return {
    from: vi.fn(() => makeChain(defaultResult)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  } as unknown as SupabaseClient
}
