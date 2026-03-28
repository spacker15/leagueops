import { describe, it, expect } from 'vitest'

// Pure logic: QR URL construction (mirrors EventQRCode component logic)
function buildQrUrl(baseUrl: string, slug: string, teamId?: number): string {
  if (teamId) {
    return `${baseUrl}/e/${slug}?tab=schedule&view=team&team=${teamId}`
  }
  return `${baseUrl}/e/${slug}`
}

describe('QR URL construction', () => {
  const base = 'https://results.leagueops.app'

  it('builds event URL without team', () => {
    expect(buildQrUrl(base, 'summer-2026')).toBe('https://results.leagueops.app/e/summer-2026')
  })

  it('builds team-specific URL with tab and view params', () => {
    expect(buildQrUrl(base, 'summer-2026', 42)).toBe(
      'https://results.leagueops.app/e/summer-2026?tab=schedule&view=team&team=42'
    )
  })

  it('handles slugs with hyphens', () => {
    expect(buildQrUrl(base, 'my-cool-event-2026')).toBe(
      'https://results.leagueops.app/e/my-cool-event-2026'
    )
  })
})
