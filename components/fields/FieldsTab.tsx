'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X, Layout } from 'lucide-react'
import * as db from '@/lib/db'
import { createClient } from '@/supabase/client'
import type { Complex } from '@/types'

const inp =
  'bg-[#081428] border border-[#1a2d50] text-white px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 transition-colors w-full'

interface EditState {
  name: string
  number: string
  divisions: string[]
  complex_id: number | null
}

interface DivOption {
  name: string
  color: string
}

export function FieldsTab() {
  const { state, addField, updateFieldDetails, deleteField } = useApp()

  // Add form state
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [newDivisions, setNewDivisions] = useState<string[]>([])
  const [newComplexId, setNewComplexId] = useState<number | ''>('')
  const [adding, setAdding] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<number | null>(null)
  const [editVals, setEditVals] = useState<EditState>({
    name: '',
    number: '',
    divisions: [],
    complex_id: null,
  })

  // Complexes and divisions
  const [complexes, setComplexes] = useState<Complex[]>([])
  const [divOptions, setDivOptions] = useState<DivOption[]>([])
  // field_id -> division names
  const [fieldDivMap, setFieldDivMap] = useState<Record<number, string[]>>({})

  useEffect(() => {
    if (state.event?.id) {
      db.getComplexes(state.event.id).then((data) => setComplexes(data as Complex[]))
      loadDivOptions()
      loadFieldDivisions()
    }
  }, [state.event?.id])

  async function loadDivOptions() {
    const sb = createClient()
    const { data } = await sb
      .from('registration_divisions')
      .select('name, color')
      .eq('event_id', state.event?.id)
      .eq('is_active', true)
      .order('sort_order')
    setDivOptions((data as DivOption[]) ?? [])
  }

  async function loadFieldDivisions() {
    const sb = createClient()
    const { data } = await sb
      .from('field_divisions')
      .select('field_id, division_name')
      .eq('event_id', state.event?.id)
    const map: Record<number, string[]> = {}
    for (const row of (data ?? []) as any[]) {
      if (!map[row.field_id]) map[row.field_id] = []
      map[row.field_id].push(row.division_name)
    }
    setFieldDivMap(map)
  }

  async function saveFieldDivisions(fieldId: number, divNames: string[]) {
    const sb = createClient()
    // Delete existing
    await sb.from('field_divisions').delete().eq('field_id', fieldId)
    // Insert new
    if (divNames.length > 0) {
      await sb.from('field_divisions').insert(
        divNames.map((d) => ({ field_id: fieldId, division_name: d, event_id: state.event?.id }))
      )
    }
    setFieldDivMap((prev) => ({ ...prev, [fieldId]: divNames }))
  }

  function getDivColor(name: string): string {
    return divOptions.find((d) => d.name === name)?.color ?? '#0B3D91'
  }

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error('Field name required')
      return
    }
    setAdding(true)
    await addField(newName.trim(), newNumber.trim(), newDivisions.join(', '), newComplexId || undefined)
    // Save field-division assignments after field is created
    // The new field will be in state after addField refreshes
    if (newDivisions.length > 0) {
      // Small delay to let state update with the new field
      setTimeout(async () => {
        const sb = createClient()
        const { data: latestFields } = await sb
          .from('fields')
          .select('id')
          .eq('event_id', state.event?.id)
          .eq('name', newName.trim())
          .order('id', { ascending: false })
          .limit(1)
        if (latestFields?.[0]) {
          await saveFieldDivisions(latestFields[0].id, newDivisions)
        }
        loadFieldDivisions()
      }, 300)
    }
    setNewName('')
    setNewNumber('')
    setNewDivisions([])
    setNewComplexId('')
    toast.success('Field added')
    setAdding(false)
  }

  function startEdit(field: {
    id: number
    name: string
    number: string
    division?: string
    complex_id?: number | null
  }) {
    setEditId(field.id)
    setEditVals({
      name: field.name,
      number: field.number,
      divisions: fieldDivMap[field.id] ?? (field.division ? [field.division] : []),
      complex_id: field.complex_id ?? null,
    })
  }

  async function saveEdit() {
    if (!editId) return
    if (!editVals.name.trim()) {
      toast.error('Field name required')
      return
    }
    await updateFieldDetails(editId, {
      name: editVals.name.trim(),
      number: editVals.number.trim(),
      division: editVals.divisions.join(', '),
      complex_id: editVals.complex_id,
    })
    await saveFieldDivisions(editId, editVals.divisions)
    toast.success('Saved')
    setEditId(null)
  }

  async function handleDelete(fieldId: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteField(fieldId)
    toast.success('Field removed')
  }

  function toggleDiv(list: string[], div: string): string[] {
    return list.includes(div) ? list.filter((d) => d !== div) : [...list, div]
  }

  const fields = [...state.fields].sort((a, b) => {
    const na = parseInt(a.number) || 0,
      nb = parseInt(b.number) || 0
    return na !== nb ? na - nb : a.name.localeCompare(b.name)
  })

  const complexName = (id?: number | null) => complexes.find((c) => c.id === id)?.name ?? null

  // Division chips renderer
  function DivChips({ divs }: { divs: string[] }) {
    if (divs.length === 0) return <span className="font-cond text-[11px] text-muted/40">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {divs.map((d) => (
          <span
            key={d}
            className="font-cond text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: getDivColor(d) + '30', color: getDivColor(d), border: `1px solid ${getDivColor(d)}40` }}
          >
            {d}
          </span>
        ))}
      </div>
    )
  }

  // Division multi-select checkboxes
  function DivSelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
    if (divOptions.length === 0) return <span className="text-[10px] text-muted font-cond">No divisions configured</span>
    return (
      <div className="flex flex-wrap gap-1.5">
        {divOptions.map((d) => {
          const active = selected.includes(d.name)
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => onChange(toggleDiv(selected, d.name))}
              className={cn(
                'font-cond text-[10px] font-bold px-2 py-1 rounded border transition-colors',
                active ? 'text-white' : 'text-muted border-[#1a2d50] hover:text-white'
              )}
              style={active ? { backgroundColor: d.color + '30', borderColor: d.color, color: d.color } : undefined}
            >
              {d.name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Layout size={16} className="text-muted" />
          <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">
            Fields
          </span>
          <span className="font-cond text-[11px] text-muted">
            — {fields.length} field{fields.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-4 mb-5">
        <div className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase mb-3">
          Add Field
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="w-20">
            <label className="font-cond text-[10px] text-muted block mb-1"># Number</label>
            <input
              className={inp}
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="1"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="font-cond text-[10px] text-muted block mb-1">Name *</label>
            <input
              className={inp}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Field 1 – North"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
          </div>
          {complexes.length > 0 && (
            <div className="w-40">
              <label className="font-cond text-[10px] text-muted block mb-1">Complex</label>
              <select
                className={inp}
                value={newComplexId}
                onChange={(e) => setNewComplexId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">No complex</option>
                {complexes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 font-cond font-black text-[11px] tracking-[.1em] px-4 py-1.5 rounded-lg bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50 whitespace-nowrap h-[34px]"
          >
            <Plus size={12} /> ADD
          </button>
        </div>
        {divOptions.length > 0 && (
          <div className="mt-3">
            <label className="font-cond text-[10px] text-muted block mb-1.5">Divisions (select which divisions can play on this field)</label>
            <DivSelect selected={newDivisions} onChange={setNewDivisions} />
          </div>
        )}
      </div>

      {/* Fields table */}
      {fields.length === 0 ? (
        <div className="text-center py-16 text-muted font-cond text-[13px]">
          No fields yet — add your first field above
        </div>
      ) : (
        <div className="bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a2d50]">
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5 w-16">
                  #
                </th>
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5">
                  Name
                </th>
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5">
                  Divisions
                </th>
                {complexes.length > 0 && (
                  <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5 w-40">
                    Complex
                  </th>
                )}
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr
                  key={field.id}
                  className={cn(
                    'border-b border-[#0d1a2e] last:border-0 group',
                    editId === field.id
                      ? 'bg-[#0a1e35]'
                      : i % 2 === 0
                        ? 'bg-transparent'
                        : 'bg-white/[0.015]'
                  )}
                >
                  {editId === field.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          className={cn(inp, 'w-14')}
                          value={editVals.number}
                          onChange={(e) => setEditVals((v) => ({ ...v, number: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inp}
                          value={editVals.name}
                          autoFocus
                          onChange={(e) => setEditVals((v) => ({ ...v, name: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <DivSelect
                          selected={editVals.divisions}
                          onChange={(v) => setEditVals((prev) => ({ ...prev, divisions: v }))}
                        />
                      </td>
                      {complexes.length > 0 && (
                        <td className="px-3 py-2">
                          <select
                            className={inp}
                            value={editVals.complex_id ?? ''}
                            onChange={(e) =>
                              setEditVals((v) => ({
                                ...v,
                                complex_id: e.target.value ? Number(e.target.value) : null,
                              }))
                            }
                          >
                            <option value="">No complex</option>
                            {complexes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            className="w-7 h-7 flex items-center justify-center rounded bg-green-700 hover:bg-green-600 text-white"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-[#1a2d50] hover:bg-[#1a3060] text-muted hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-cond font-black text-[18px] text-white/20">
                          {field.number || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ background: field.map_color ?? '#1a6b1a' }}
                          />
                          <span className="font-cond font-bold text-[13px] text-white">
                            {field.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DivChips divs={fieldDivMap[field.id] ?? (field.division ? [field.division] : [])} />
                      </td>
                      {complexes.length > 0 && (
                        <td className="px-4 py-3">
                          {complexName(field.complex_id) ? (
                            <span className="font-cond text-[11px] font-bold px-2 py-0.5 rounded bg-[#1a2d50] text-green-300">
                              {complexName(field.complex_id)}
                            </span>
                          ) : (
                            <span className="font-cond text-[11px] text-muted/40">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(field)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a2d50] text-muted hover:text-white transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(field.id, field.name)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red/20 text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 font-cond text-[10px] text-muted">
        Assign divisions to fields to control which games can be scheduled on each field.
        Fields with no divisions assigned will accept any division.
      </div>
    </div>
  )
}
