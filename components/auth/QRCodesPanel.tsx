'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/supabase/client'
import { useApp } from '@/lib/store'
import { Btn, SectionHeader } from '@/components/ui'
import toast from 'react-hot-toast'
import { QrCode, Download, RefreshCw, Printer } from 'lucide-react'

interface QRToken {
  id: number
  token: string
  player_id: number
  player?: {
    id: number
    name: string
    number: number | null
    team?: { name: string; division: string }
  }
}

export function QRCodesPanel() {
  const { state } = useApp()
  const [tokens, setTokens]     = useState<QRToken[]>([])
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const [baseUrl, setBaseUrl]   = useState('')

  useEffect(() => {
    setBaseUrl(window.location.origin)
    loadTokens()
  }, [])

  async function loadTokens() {
    const sb = createClient()
    setLoading(true)
    const { data } = await sb
      .from('player_qr_tokens')
      .select(`
        id, token, player_id,
        player:players(id, name, number,
          team:teams(name, division)
        )
      `)
      .eq('event_id', 1)
      .order('player_id')
    setTokens((data as QRToken[]) ?? [])
    setLoading(false)
  }

  async function generateAllTokens() {
    setGenerating(true)
    const sb = createClient()
    // Insert tokens for any players missing them
    const { data: players } = await sb
      .from('players')
      .select('id, team:teams!inner(event_id)')
      .eq('teams.event_id', 1)

    if (players) {
      for (const p of players) {
        await sb.from('player_qr_tokens').upsert(
          { player_id: p.id, event_id: 1 },
          { onConflict: 'player_id,event_id' }
        )
      }
    }
    await loadTokens()
    toast.success(`QR tokens generated for ${players?.length ?? 0} players`)
    setGenerating(false)
  }

  function getCheckinUrl(token: string): string {
    return `${baseUrl}/checkin/${token}`
  }

  function copyUrl(token: string) {
    navigator.clipboard.writeText(getCheckinUrl(token))
    toast.success('Check-in URL copied')
  }

  async function printQRSheet(teamId?: number) {
    const filtered = teamId
      ? tokens.filter(t => t.player?.team?.name === state.teams.find(t2 => t2.id === teamId)?.name)
      : tokens

    // Open a print window with QR codes
    const win = window.open('', '_blank')
    if (!win) return

    const qrItems = filtered.map(t => `
      <div class="qr-card">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getCheckinUrl(t.token))}" alt="QR" />
        <div class="name">${t.player?.name ?? 'Unknown'}</div>
        <div class="team">${t.player?.team?.name ?? ''} · ${t.player?.team?.division ?? ''}</div>
        ${t.player?.number ? `<div class="num">#${t.player.number}</div>` : ''}
      </div>
    `).join('')

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LeagueOps QR Check-In Cards</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 16px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .qr-card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; }
          .qr-card img { width: 140px; height: 140px; }
          .name { font-weight: bold; font-size: 13px; margin-top: 8px; }
          .team { font-size: 11px; color: #666; margin-top: 2px; }
          .num { font-size: 12px; color: #333; margin-top: 2px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>LeagueOps Player Check-In QR Codes — Knights Lacrosse Summer Invitational 2025</h1>
        <div class="grid">${qrItems}</div>
      </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  const filtered = teamFilter
    ? tokens.filter(t => String(state.teams.find(t2 => t2.name === t.player?.team?.name)?.id) === teamFilter)
    : tokens

  return (
    <div>
      <SectionHeader>QR CODE CHECK-IN</SectionHeader>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          className="bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[12px] font-bold outline-none focus:border-blue-400"
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
        >
          <option value="">All Teams ({tokens.length} players)</option>
          {state.teams.map(t => {
            const count = tokens.filter(tok => tok.player?.team?.name === t.name).length
            return <option key={t.id} value={t.id}>{t.name} ({count})</option>
          })}
        </select>

        <Btn variant="primary" size="sm" onClick={generateAllTokens} disabled={generating}>
          <RefreshCw size={11} className={`inline mr-1 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'GENERATING...' : 'GENERATE ALL QR CODES'}
        </Btn>

        <Btn variant="ghost" size="sm" onClick={() => printQRSheet(teamFilter ? Number(teamFilter) : undefined)}>
          <Printer size={11} className="inline mr-1" />
          PRINT QR SHEET
        </Btn>

        <span className="font-cond text-[11px] text-muted ml-auto">
          {filtered.length} codes · Scan to check in
        </span>
      </div>

      {/* Info banner */}
      <div className="bg-blue-900/15 border border-blue-800/40 rounded-lg p-3 mb-4 text-[11px] font-cond">
        <div className="font-bold text-blue-300 mb-1">HOW QR CHECK-IN WORKS</div>
        <div className="text-muted leading-relaxed">
          Each player gets a unique QR code. Print and distribute before the tournament.
          Players scan their code with any phone camera → lands on their check-in page →
          tap to check in for their game. No app download required.
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted font-cond">LOADING QR CODES...</div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12">
          <QrCode size={40} className="mx-auto text-muted mb-3" />
          <div className="font-cond font-bold text-muted">NO QR CODES GENERATED YET</div>
          <div className="font-cond text-[11px] text-muted mt-1">Click GENERATE ALL QR CODES to create them</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-surface-card border border-border rounded-lg p-3 text-center">
              {/* QR code image via free API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getCheckinUrl(t.token))}`}
                alt={`QR for ${t.player?.name}`}
                className="w-36 h-36 mx-auto mb-2 rounded"
              />
              <div className="font-cond font-black text-[13px] text-white leading-tight">{t.player?.name ?? 'Unknown'}</div>
              <div className="font-cond text-[10px] text-blue-300">{t.player?.team?.name}</div>
              <div className="font-cond text-[10px] text-muted">{t.player?.team?.division}</div>
              {t.player?.number && (
                <div className="font-cond text-[10px] text-muted">#{t.player.number}</div>
              )}
              <button
                onClick={() => copyUrl(t.token)}
                className="mt-2 w-full font-cond text-[9px] font-bold tracking-wide px-2 py-1 rounded bg-navy hover:bg-navy-light text-white transition-colors"
              >
                COPY LINK
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
