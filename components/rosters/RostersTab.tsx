'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn } from '@/components/ui'
import * as db from '@/lib/db'
import toast from 'react-hot-toast'
import type { RosterRow } from '@/types'
import { Upload, Download, CheckCircle } from 'lucide-react'

// Column definitions matching Hammerhead/NFYLL format
const ROSTER_COLUMNS = [
  { key: 'usa_lacrosse_number', label: 'USA Lacrosse Number', width: 'w-32' },
  { key: 'firstname', label: 'Firstname', width: 'w-28' },
  { key: 'lastname', label: 'Lastname', width: 'w-28' },
  { key: 'birthdate', label: 'Birthdate', width: 'w-28' },
  { key: 'zipcode', label: 'Zipcode', width: 'w-20' },
  { key: 'email', label: 'Email', width: 'w-48' },
  { key: 'div', label: 'Div', width: 'w-24' },
  { key: 'team', label: 'Team', width: 'w-28' },
  { key: 'association', label: 'Association', width: 'w-32' },
  { key: 'type', label: 'Player or Coach', width: 'w-28' },
]

interface ParsedRosterRow {
  usa_lacrosse_number: string
  firstname: string
  lastname: string
  birthdate: string
  zipcode: string
  email: string
  div: string
  team: string
  association: string
  type: string
}

export function RostersTab() {
  const { state } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ filename: string; rows: ParsedRosterRow[] } | null>(null)
  const [teamId, setTeamId] = useState<number | null>(null)
  const [teamPlayers, setTeamPlayers] = useState<any[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [committed, setCommitted] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function processFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseRoster(text, file.name)
      if (rows.length === 0) {
        toast.error('No valid rows found. Check file format.')
        return
      }
      setPending({ filename: file.name, rows })
      setCommitted(false)
    }
    reader.readAsText(file)
  }

  function parseRoster(text: string, filename: string): ParsedRosterRow[] {
    const lines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return []

    // Detect if first row is a header
    const firstRow = lines[0].split(',').map((c) => c.trim().toLowerCase())
    const hasHeader = firstRow.some(
      (c) =>
        c.includes('name') || c.includes('first') || c.includes('lacrosse') || c.includes('team')
    )
    const dataLines = hasHeader ? lines.slice(1) : lines

    return dataLines
      .map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        // Support both full NFYLL format (10 cols) and simple format (2-4 cols)
        if (cols.length >= 10) {
          return {
            usa_lacrosse_number: cols[0] ?? '',
            firstname: cols[1] ?? '',
            lastname: cols[2] ?? '',
            birthdate: cols[3] ?? '',
            zipcode: cols[4] ?? '',
            email: cols[5] ?? '',
            div: cols[6] ?? '',
            team: cols[7] ?? '',
            association: cols[8] ?? '',
            type: cols[9] ?? 'Player',
          }
        } else {
          // Simple format: Team, Name[, Number, Position]
          return {
            usa_lacrosse_number: '',
            firstname: (cols[1] ?? '').split(' ')[0],
            lastname: (cols[1] ?? '').split(' ').slice(1).join(' '),
            birthdate: '',
            zipcode: '',
            email: '',
            div: '',
            team: cols[0] ?? '',
            association: '',
            type: 'Player',
          }
        }
      })
      .filter((r) => r.firstname && r.lastname)
  }

  async function commitRoster() {
    if (!pending) return
    let added = 0
    const inserts: any[] = []

    for (const row of pending.rows) {
      const team = state.teams.find(
        (t) =>
          t.name.toLowerCase() === row.team.toLowerCase() ||
          t.name.toLowerCase().includes(row.team.toLowerCase())
      )
      if (!team) continue
      inserts.push({
        team_id: team.id,
        name: `${row.firstname} ${row.lastname}`.trim(),
        number: null,
        position: row.type === 'Coach' ? 'Coach' : null,
        usa_lacrosse_number: row.usa_lacrosse_number || null,
      })
      added++
    }

    if (inserts.length > 0) {
      try {
        const count = await db.insertPlayers(inserts)
        toast.success(`✓ ${count} players/coaches imported`)
        setCommitted(true)
      } catch (err: any) {
        toast.error(`Error: ${err.message}`)
        return
      }
    } else {
      toast.error('No matching teams found. Check team names match exactly.')
      return
    }

    if (teamId) loadTeamPlayers(teamId)
  }

  async function loadTeamPlayers(id: number) {
    setLoadingTeam(true)
    setTeamId(id)
    const players = await db.getPlayersByTeam(id)
    setTeamPlayers(players)
    setLoadingTeam(false)
  }

  function downloadTemplate() {
    // Download the pre-built template from the public folder
    const link = document.createElement('a')
    link.href = '/roster-template.xlsx'
    link.download = 'LeagueOps_Roster_Template.xlsx'
    link.click()
  }

  function downloadCSVTemplate() {
    const header =
      'USA Lacrosse Number,Firstname,Lastname,Birthdate,Zipcode,Email,Div,Team,association,Player or Coach'
    const sample = [
      '12345678,John,Smith,01/15/2010,32034,parent@email.com,14U Boys,Team Name,Association Name,Player',
      '12345679,Jane,Doe,03/22/2011,32034,parent2@email.com,14U Boys,Team Name,Association Name,Player',
      ',Coach,Name,,,coach@email.com,14U Boys,Team Name,Association Name,Coach',
    ]
    const csv = [header, ...sample].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'LeagueOps_Roster_Template.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV template downloaded')
  }

  return (
    <div>
      <SectionHeader>ROSTER MANAGEMENT</SectionHeader>
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT: Upload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
              Upload Roster (CSV / XLSX)
            </span>
            <div className="flex gap-2">
              <button
                onClick={downloadCSVTemplate}
                className="flex items-center gap-1 font-cond text-[10px] font-bold tracking-wide text-blue-300 bg-navy/40 border border-border rounded px-2 py-1 hover:bg-navy transition-colors"
              >
                <Download size={10} />
                CSV TEMPLATE
              </button>
            </div>
          </div>

          {/* Format guide */}
          <div className="bg-surface-card border border-border rounded-md p-3 mb-3">
            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
              ACCEPTED FORMATS
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="font-cond text-[10px] font-bold text-blue-300 mb-0.5">
                  NFYLL / Full Format (10 columns)
                </div>
                <div className="font-mono text-[9px] text-muted bg-black/30 px-2 py-1 rounded">
                  USA Lacrosse #, Firstname, Lastname, Birthdate, Zipcode, Email, Div, Team,
                  Association, Player or Coach
                </div>
              </div>
              <div>
                <div className="font-cond text-[10px] font-bold text-blue-300 mb-0.5">
                  Simple Format (2–4 columns)
                </div>
                <div className="font-mono text-[9px] text-muted bg-black/30 px-2 py-1 rounded">
                  Team, Player Name [, Number, Position]
                </div>
              </div>
            </div>
          </div>

          {!pending ? (
            <div
              className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-white/5 transition-all"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 text-muted" size={28} />
              <div className="font-cond font-bold text-muted text-sm tracking-wide">
                DROP CSV FILE HERE
              </div>
              <div className="font-cond text-[10px] text-muted/60 mt-1">or click to browse</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) processFile(f)
                }}
              />
            </div>
          ) : (
            <div className="bg-surface-card border border-border rounded-md overflow-hidden">
              <div
                className={`px-3 py-2 flex justify-between items-center border-b border-border ${committed ? 'bg-green-900/20' : 'bg-navy/60'}`}
              >
                <div className="flex items-center gap-2">
                  {committed && <CheckCircle size={14} className="text-green-400" />}
                  <span className="font-cond font-black text-[12px] tracking-wide text-white">
                    {committed ? 'COMMITTED' : 'PREVIEW — PENDING COMMIT'}
                  </span>
                </div>
                <span className="font-cond text-[10px] text-muted">{pending.filename}</span>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="text-[10px] border-collapse" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-navy/80 sticky top-0">
                      {ROSTER_COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          className="font-cond font-black tracking-widest text-muted px-2 py-1.5 text-left whitespace-nowrap border-b border-border"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.rows.slice(0, 25).map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/30 ${i % 2 === 0 ? '' : 'bg-white/5'}`}
                      >
                        <td className="font-mono px-2 py-1 text-muted">
                          {r.usa_lacrosse_number || '—'}
                        </td>
                        <td className="px-2 py-1 font-bold text-white">{r.firstname}</td>
                        <td className="px-2 py-1 font-bold text-white">{r.lastname}</td>
                        <td className="font-mono px-2 py-1 text-muted">{r.birthdate || '—'}</td>
                        <td className="font-mono px-2 py-1 text-muted">{r.zipcode || '—'}</td>
                        <td className="px-2 py-1 text-muted truncate max-w-[120px]">
                          {r.email || '—'}
                        </td>
                        <td className="px-2 py-1">
                          {r.div && (
                            <span className="font-cond font-bold text-blue-300">{r.div}</span>
                          )}
                        </td>
                        <td className="font-cond font-bold text-blue-300 px-2 py-1">
                          {r.team || '—'}
                        </td>
                        <td className="px-2 py-1 text-muted">{r.association || '—'}</td>
                        <td className="px-2 py-1">
                          <span
                            className={`font-cond font-bold text-[9px] px-1.5 py-0.5 rounded ${r.type === 'Coach' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-blue-900/30 text-blue-300'}`}
                          >
                            {r.type || 'Player'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {pending.rows.length > 25 && (
                      <tr>
                        <td colSpan={10} className="text-center text-muted text-[10px] py-2">
                          …and {pending.rows.length - 25} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!committed && (
                <div className="flex gap-2 p-3 border-t border-border">
                  <Btn
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setPending(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    CANCEL
                  </Btn>
                  <Btn variant="success" size="sm" onClick={commitRoster}>
                    ✓ OK — COMMIT {pending.rows.length} RECORDS
                  </Btn>
                </div>
              )}
              {committed && (
                <div className="flex gap-2 p-3 border-t border-border">
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPending(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    UPLOAD ANOTHER
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Team viewer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
              View Team Roster
            </span>
            {teamId && teamPlayers.length > 0 && (
              <button
                onClick={() => {
                  const lines = [
                    'USA Lacrosse Number,Firstname,Lastname,Birthdate,Zipcode,Email,Div,Team,association,Player or Coach',
                  ]
                  const team = state.teams.find((t) => t.id === teamId)
                  teamPlayers.forEach((p) => {
                    lines.push(
                      `,,${p.name},,,,${team?.division ?? ''},${team?.name ?? ''},,${p.position === 'Coach' ? 'Coach' : 'Player'}`
                    )
                  })
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${team?.name ?? 'roster'}_roster.csv`
                  link.click()
                  URL.revokeObjectURL(url)
                  toast.success('Roster exported')
                }}
                className="flex items-center gap-1 font-cond text-[10px] font-bold tracking-wide text-blue-300 bg-navy/40 border border-border rounded px-2 py-1 hover:bg-navy transition-colors"
              >
                <Download size={10} />
                EXPORT CSV
              </button>
            )}
          </div>

          <select
            className="w-full bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[13px] font-bold outline-none focus:border-blue-400 mb-3"
            value={teamId ?? ''}
            onChange={(e) =>
              e.target.value ? loadTeamPlayers(Number(e.target.value)) : setTeamId(null)
            }
          >
            <option value="">Select team…</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.division})
              </option>
            ))}
          </select>

          {loadingTeam && <div className="text-center py-8 text-muted font-cond">LOADING…</div>}

          {!loadingTeam && teamId && (
            <div>
              {/* Team summary */}
              <div className="bg-surface-card border border-border rounded-md p-3 mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-cond font-black text-[14px] text-white">
                      {state.teams.find((t) => t.id === teamId)?.name}
                    </div>
                    <div className="font-cond text-[11px] text-muted">
                      {state.teams.find((t) => t.id === teamId)?.division} ·{' '}
                      {state.teams.find((t) => t.id === teamId)?.association ?? ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-bold text-green-400">
                      {teamPlayers.filter((p) => p.position !== 'Coach').length}
                    </div>
                    <div className="font-cond text-[9px] text-muted uppercase">Players</div>
                  </div>
                </div>
              </div>

              {/* Player/Coach table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-navy">
                    {['#', 'NAME', 'POSITION', 'TYPE'].map((h) => (
                      <th
                        key={h}
                        className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-1.5 text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Coaches first */}
                  {teamPlayers
                    .filter((p) => p.position === 'Coach')
                    .map((p) => (
                      <tr key={p.id} className="border-b border-border/40 bg-yellow-900/10">
                        <td className="font-mono text-[11px] text-muted px-3 py-1.5">—</td>
                        <td className="font-cond font-bold text-[12px] text-yellow-300 px-3 py-1.5">
                          {p.name}
                        </td>
                        <td className="text-[11px] text-muted px-3 py-1.5">—</td>
                        <td className="px-3 py-1.5">
                          <span className="font-cond text-[9px] font-bold bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded">
                            COACH
                          </span>
                        </td>
                      </tr>
                    ))}
                  {/* Players */}
                  {teamPlayers
                    .filter((p) => p.position !== 'Coach')
                    .map((p, i) => (
                      <tr
                        key={p.id}
                        className={`border-b border-border/40 ${i % 2 === 0 ? '' : 'bg-white/5'}`}
                      >
                        <td className="font-mono text-[11px] text-muted px-3 py-1.5">
                          {p.number ?? '—'}
                        </td>
                        <td className="font-cond font-bold text-[12px] px-3 py-1.5">{p.name}</td>
                        <td className="text-[11px] text-muted px-3 py-1.5">{p.position ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className="font-cond text-[9px] font-bold bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">
                            PLAYER
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
