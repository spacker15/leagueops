'use client'

import { useState, useRef } from 'react'
import { useApp } from '@/lib/store'
import { SectionHeader, Btn } from '@/components/ui'
import { parseRosterCSV } from '@/lib/utils'
import * as db from '@/lib/db'
import toast from 'react-hot-toast'
import type { RosterRow } from '@/types'
import { Upload } from 'lucide-react'

export function RostersTab() {
  const { state } = useApp()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ filename: string; rows: RosterRow[] } | null>(null)
  const [teamId, setTeamId]   = useState<number | null>(null)
  const [teamPlayers, setTeamPlayers] = useState<any[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function processFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseRosterCSV(text)
      if (rows.length === 0) { toast.error('No valid rows found. Expected: Team,Name[,Number,Position]'); return }
      setPending({ filename: file.name, rows })
    }
    reader.readAsText(file)
  }

  async function commitRoster() {
    if (!pending) return
    let added = 0
    const inserts = []
    for (const row of pending.rows) {
      const team = state.teams.find(t => t.name.toLowerCase() === row.team.toLowerCase())
      if (!team) continue
      inserts.push({
        team_id: team.id,
        name: row.name,
        number: row.number ? parseInt(row.number) : null,
        position: row.position || null,
      })
      added++
    }
    if (inserts.length > 0) {
      try {
        const count = await db.insertPlayers(inserts)
        toast.success(`✓ Roster committed — ${count} players imported`)
        added = count
      } catch (err: any) {
        toast.error(`Error: ${err.message}`)
        return
      }
    }
    if (teamId) loadTeamPlayers(teamId)
    setPending(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function loadTeamPlayers(id: number) {
    setLoadingTeam(true)
    setTeamId(id)
    const players = await db.getPlayersByTeam(id)
    setTeamPlayers(players)
    setLoadingTeam(false)
  }

  const exampleCSV = `Creeks,Megan Packer,8,Attack\nCreeks,Ashton Packer,12,Midfield\nRiptide,Jordan Reyes,5,Attack`

  return (
    <div>
      <SectionHeader>ROSTER MANAGEMENT</SectionHeader>
      <div className="grid grid-cols-2 gap-4">

        {/* Upload side */}
        <div>
          <div className="text-[11px] text-muted font-cond font-bold mb-2 tracking-wide uppercase">
            Upload CSV / XLSX Roster
          </div>

          {!pending ? (
            <div
              className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-white/5 transition-all"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 text-muted" size={32} />
              <div className="font-cond font-bold text-muted text-sm tracking-wide">
                DROP CSV FILE HERE
              </div>
              <div className="font-cond text-[10px] text-muted/60 mt-1">or click to browse</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="bg-surface-card border border-border rounded-md overflow-hidden">
              <div className="bg-navy px-3 py-2 flex justify-between items-center">
                <span className="font-cond font-black text-[12px] tracking-wide text-yellow-400">
                  PREVIEW — PENDING COMMIT
                </span>
                <span className="font-cond text-[10px] text-muted">{pending.filename}</span>
              </div>
              <div className="p-3">
                <div className="text-[11px] text-muted font-cond mb-2">
                  {pending.rows.length} rows detected
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-navy/60">
                        {['TEAM','PLAYER','#','POSITION'].map(h => (
                          <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-2 py-1 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pending.rows.slice(0, 30).map((r, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-white/5">
                          <td className="font-cond font-bold text-blue-300 px-2 py-1">{r.team}</td>
                          <td className="px-2 py-1">{r.name}</td>
                          <td className="font-mono text-muted px-2 py-1">{r.number || '—'}</td>
                          <td className="text-muted px-2 py-1">{r.position || '—'}</td>
                        </tr>
                      ))}
                      {pending.rows.length > 30 && (
                        <tr><td colSpan={4} className="text-center text-muted text-[10px] py-2">…and {pending.rows.length - 30} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-3">
                  <Btn variant="danger" size="sm" onClick={() => { setPending(null); if (fileRef.current) fileRef.current.value = '' }}>
                    CANCEL
                  </Btn>
                  <Btn variant="success" size="sm" onClick={commitRoster}>
                    ✓ OK — COMMIT ROSTER
                  </Btn>
                </div>
              </div>
            </div>
          )}

          {/* CSV format guide */}
          <div className="mt-4 bg-surface-card border border-border rounded-md p-3">
            <div className="font-cond text-[10px] font-black tracking-widest text-muted uppercase mb-2">
              Supported CSV Format
            </div>
            <div className="font-mono text-[10px] text-green-300 whitespace-pre bg-black/30 p-2 rounded">
              {exampleCSV}
            </div>
            <div className="font-cond text-[10px] text-muted mt-2">
              Columns: Team, Player Name [, Number, Position]
            </div>
          </div>
        </div>

        {/* Team viewer */}
        <div>
          <div className="text-[11px] text-muted font-cond font-bold mb-2 tracking-wide uppercase">
            View Team Roster
          </div>
          <select
            className="w-full bg-surface-card border border-border text-white px-3 py-2 rounded font-cond text-[13px] font-bold outline-none focus:border-blue-400 mb-3"
            value={teamId ?? ''}
            onChange={e => e.target.value ? loadTeamPlayers(Number(e.target.value)) : setTeamId(null)}
          >
            <option value="">Select team…</option>
            {state.teams.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.division})</option>
            ))}
          </select>

          {loadingTeam && <div className="text-center py-8 text-muted font-cond">LOADING…</div>}

          {!loadingTeam && teamId && (
            <div>
              <div className="font-cond text-[11px] font-bold text-green-400 mb-2 tracking-wide">
                {teamPlayers.length} PLAYERS ON ROSTER
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-navy">
                    {['#','PLAYER','POSITION'].map(h => (
                      <th key={h} className="font-cond text-[10px] font-black tracking-widest text-muted px-3 py-1.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamPlayers.map(p => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-white/5">
                      <td className="font-mono text-[11px] text-muted px-3 py-1.5">{p.number ?? '—'}</td>
                      <td className="font-cond font-bold text-[12px] px-3 py-1.5">{p.name}</td>
                      <td className="text-[11px] text-muted px-3 py-1.5">{p.position ?? '—'}</td>
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
