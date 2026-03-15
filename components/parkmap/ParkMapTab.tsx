'use client'

import { useRef, useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { Btn } from '@/components/ui'
import { cn } from '@/lib/utils'

export function ParkMapTab() {
  const { state, updateFieldMap, updateFieldName, addField } = useApp()
  const canvasRef   = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const dragRef     = useRef<{ fieldId: number; ox: number; oy: number } | null>(null)

  function onMouseDown(e: React.MouseEvent, fieldId: number) {
    e.preventDefault()
    const field = state.fields.find(f => f.id === fieldId)
    if (!field) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragRef.current = { fieldId, ox: e.clientX - field.map_x, oy: e.clientY - field.map_y }
    setSelected(fieldId)
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const field = state.fields.find(f => f.id === dragRef.current!.fieldId)
      if (!field) return
      const x = Math.max(0, Math.min(rect.width - field.map_w, e.clientX - rect.left - (dragRef.current.ox - field.map_x)))
      const y = Math.max(0, Math.min(rect.height - field.map_h, e.clientY - rect.top - (dragRef.current.oy - field.map_y)))
      updateFieldMap(field.id, Math.round(x), Math.round(y))
    }
    function onMouseUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [state.fields, updateFieldMap])

  async function handleRename(fieldId: number) {
    const field = state.fields.find(f => f.id === fieldId)
    const name = prompt('Field name:', field?.name ?? '')
    if (name && name.trim()) await updateFieldName(fieldId, name.trim())
  }

  async function handleAddField() {
    const name = prompt('New field name (e.g. Field 7 or Field 1A):')
    if (!name?.trim()) return
    const num = name.trim().replace(/[^0-9A-Za-z]/g, '')
    await addField(name.trim(), num)
  }

  // Get game on each field for overlay
  const fieldGameMap: Record<number, string> = {}
  state.games.filter(g => ['Live','Starting','Halftime'].includes(g.status)).forEach(g => {
    fieldGameMap[g.field_id] = `${g.home_team?.name ?? '?'} vs ${g.away_team?.name ?? '?'}`
  })

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase">PARK FIELD MAP</span>
        <Btn size="sm" variant="primary" onClick={handleAddField}>+ ADD FIELD</Btn>
        {selected && (
          <Btn size="sm" variant="ghost" onClick={() => setSelected(null)}>DESELECT</Btn>
        )}
        <span className="font-cond text-[10px] text-muted ml-2">
          DRAG TO REPOSITION · CLICK TO SELECT · DOUBLE-CLICK TO RENAME
        </span>
      </div>

      <div
        ref={canvasRef}
        className="relative rounded-lg overflow-hidden select-none"
        style={{
          background: 'linear-gradient(135deg, #0a1f0a 0%, #061406 100%)',
          height: 520,
          border: '1px solid #2a4080',
        }}
      >
        {/* Grid lines (subtle) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.08 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={520} stroke="#7bb8ff" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={800} y2={i * 40} stroke="#7bb8ff" strokeWidth={0.5} />
          ))}
        </svg>

        {/* Fields */}
        {state.fields.map(field => {
          const isSelected = selected === field.id
          const activeGame = fieldGameMap[field.id]
          return (
            <div
              key={field.id}
              style={{
                position: 'absolute',
                left: field.map_x,
                top: field.map_y,
                width: field.map_w,
                height: field.map_h,
                cursor: 'move',
              }}
              className={cn(
                'rounded-md border-2 flex flex-col items-center justify-center',
                'transition-[border-color] duration-150',
                isSelected
                  ? 'border-blue-400 bg-green-900/50'
                  : activeGame
                    ? 'border-green-500/70 bg-green-900/40'
                    : 'border-blue-400/40 bg-green-900/30',
              )}
              onMouseDown={e => onMouseDown(e, field.id)}
              onDoubleClick={() => handleRename(field.id)}
              onClick={() => setSelected(isSelected ? null : field.id)}
            >
              <div className="font-cond text-2xl font-black text-white/30 leading-none">
                {field.number}
              </div>
              <div className="font-cond font-black text-[12px] text-white text-center px-1">
                {field.name}
              </div>
              {activeGame && (
                <div className="font-cond text-[9px] text-green-300 text-center px-1 mt-0.5 truncate w-full text-center">
                  {activeGame}
                </div>
              )}
              {isSelected && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400" />
              )}
            </div>
          )
        })}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-[10px] font-cond font-bold">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border-2 border-green-500/70 bg-green-900/40" />
            <span className="text-muted">ACTIVE GAME</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border-2 border-blue-400/40 bg-green-900/30" />
            <span className="text-muted">AVAILABLE</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border-2 border-blue-400" />
            <span className="text-muted">SELECTED</span>
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-3 bg-surface-card border border-border rounded-md p-3 flex items-center gap-4 text-[12px]">
          <span className="font-cond font-black text-white">
            {state.fields.find(f => f.id === selected)?.name}
          </span>
          <span className="text-muted font-cond">
            Position: ({state.fields.find(f => f.id === selected)?.map_x}, {state.fields.find(f => f.id === selected)?.map_y})
          </span>
          <Btn size="sm" variant="ghost" onClick={() => handleRename(selected)}>RENAME</Btn>
        </div>
      )}
    </div>
  )
}
