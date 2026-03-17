'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X, Layout } from 'lucide-react'

const inp = 'bg-[#081428] border border-[#1a2d50] text-white px-2.5 py-1.5 rounded text-[12px] outline-none focus:border-blue-400 transition-colors w-full'

interface EditState {
  name: string
  number: string
  division: string
}

export function FieldsTab() {
  const { state, addField, updateFieldDetails, deleteField } = useApp()

  // Add form state
  const [newName, setNewName]       = useState('')
  const [newNumber, setNewNumber]   = useState('')
  const [newDivision, setNewDivision] = useState('')
  const [adding, setAdding]         = useState(false)

  // Edit state — which row is being edited
  const [editId, setEditId]   = useState<number | null>(null)
  const [editVals, setEditVals] = useState<EditState>({ name: '', number: '', division: '' })

  const divisions = Array.from(new Set(state.teams.map((t: any) => t.division).filter(Boolean))).sort() as string[]

  async function handleAdd() {
    if (!newName.trim()) { toast.error('Field name required'); return }
    setAdding(true)
    await addField(newName.trim(), newNumber.trim(), newDivision.trim())
    setNewName(''); setNewNumber(''); setNewDivision('')
    toast.success('Field added')
    setAdding(false)
  }

  function startEdit(field: { id: number; name: string; number: string; division?: string }) {
    setEditId(field.id)
    setEditVals({ name: field.name, number: field.number, division: field.division ?? '' })
  }

  async function saveEdit() {
    if (!editId) return
    if (!editVals.name.trim()) { toast.error('Field name required'); return }
    await updateFieldDetails(editId, { name: editVals.name.trim(), number: editVals.number.trim(), division: editVals.division.trim() })
    toast.success('Saved')
    setEditId(null)
  }

  async function handleDelete(fieldId: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteField(fieldId)
    toast.success('Field removed')
  }

  const fields = [...state.fields].sort((a, b) => {
    const na = parseInt(a.number) || 0, nb = parseInt(b.number) || 0
    return na !== nb ? na - nb : a.name.localeCompare(b.name)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Layout size={16} className="text-muted" />
          <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">Fields</span>
          <span className="font-cond text-[11px] text-muted">— {fields.length} field{fields.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-4 mb-5">
        <div className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase mb-3">Add Field</div>
        <div className="flex gap-3 items-end">
          <div className="w-20">
            <label className="font-cond text-[10px] text-muted block mb-1"># Number</label>
            <input className={inp} value={newNumber} onChange={e => setNewNumber(e.target.value)}
              placeholder="1" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <div className="flex-1">
            <label className="font-cond text-[10px] text-muted block mb-1">Name *</label>
            <input className={inp} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Field 1 – North" onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
          </div>
          <div className="w-36">
            <label className="font-cond text-[10px] text-muted block mb-1">Division</label>
            <input className={inp} value={newDivision} onChange={e => setNewDivision(e.target.value)}
              placeholder={divisions[0] ?? 'e.g. U12'} list="div-list"
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <datalist id="div-list">
              {divisions.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          <button onClick={handleAdd} disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 font-cond font-black text-[11px] tracking-[.1em] px-4 py-1.5 rounded-lg bg-red hover:bg-red/80 text-white transition-colors disabled:opacity-50 whitespace-nowrap h-[34px]">
            <Plus size={12} /> ADD
          </button>
        </div>
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
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5 w-16">#</th>
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5">Name</th>
                <th className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase text-left px-4 py-2.5 w-40">Division</th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field.id}
                  className={cn('border-b border-[#0d1a2e] last:border-0 group',
                    editId === field.id ? 'bg-[#0a1e35]' : i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
                  )}>
                  {editId === field.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input className={cn(inp, 'w-14')} value={editVals.number}
                          onChange={e => setEditVals(v => ({ ...v, number: e.target.value }))} />
                      </td>
                      <td className="px-3 py-2">
                        <input className={inp} value={editVals.name} autoFocus
                          onChange={e => setEditVals(v => ({ ...v, name: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                      </td>
                      <td className="px-3 py-2">
                        <input className={inp} value={editVals.division}
                          onChange={e => setEditVals(v => ({ ...v, division: e.target.value }))}
                          placeholder="Division" list="div-list-edit"
                          onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                        <datalist id="div-list-edit">
                          {divisions.map(d => <option key={d} value={d} />)}
                        </datalist>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={saveEdit}
                            className="w-7 h-7 flex items-center justify-center rounded bg-green-700 hover:bg-green-600 text-white">
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-[#1a2d50] hover:bg-[#1a3060] text-muted hover:text-white">
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-cond font-black text-[18px] text-white/20">{field.number || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: field.map_color ?? '#1a6b1a' }} />
                          <span className="font-cond font-bold text-[13px] text-white">{field.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {field.division
                          ? <span className="font-cond text-[11px] font-bold px-2 py-0.5 rounded bg-[#1a2d50] text-blue-300">{field.division}</span>
                          : <span className="font-cond text-[11px] text-muted/40">—</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(field)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a2d50] text-muted hover:text-white transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(field.id, field.name)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red/20 text-muted hover:text-red-400 transition-colors">
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
        To position fields on the park map, use the <strong className="text-white/50">Park Map</strong> tab. Divisions set here are used to filter field assignments.
      </div>
    </div>
  )
}
