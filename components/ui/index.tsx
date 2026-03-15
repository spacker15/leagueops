'use client'

import { cn } from '@/lib/utils'
import type { GameStatus } from '@/types'
import { X } from 'lucide-react'
import React from 'react'

// ---- Badge ----
const STATUS_CLASS: Record<GameStatus, string> = {
  Scheduled: 'badge-scheduled',
  Starting:  'badge-starting',
  Live:      'badge-live',
  Halftime:  'badge-halftime',
  Final:     'badge-final',
  Delayed:   'badge-delayed',
}

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className={cn(
      'inline-block font-cond text-[10px] font-black tracking-widest px-2 py-0.5 rounded-sm',
      STATUS_CLASS[status]
    )}>
      {status.toUpperCase()}
    </span>
  )
}

// ---- Button ----
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}
export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  const variantCls = {
    primary: 'bg-navy hover:bg-navy-light text-white',
    danger:  'bg-red hover:bg-red-dark text-white',
    success: 'bg-green-700 hover:bg-green-600 text-white',
    ghost:   'bg-surface-card border border-border text-white hover:border-blue-400',
    outline: 'bg-transparent border border-border text-muted hover:text-white hover:border-blue-400',
  }[variant]

  const sizeCls = {
    sm: 'text-[11px] px-2.5 py-1',
    md: 'text-[13px] px-4 py-1.5',
    lg: 'text-[14px] px-6 py-2',
  }[size]

  return (
    <button
      className={cn(
        'font-cond font-bold tracking-widest uppercase rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        variantCls, sizeCls, className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ---- FormField ----
export function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">{label}</label>
      {children}
    </div>
  )
}

// ---- Input / Select / Textarea ----
const inputBase = 'bg-surface-card border border-border text-white px-2.5 py-1.5 rounded text-[13px] outline-none focus:border-blue-400 transition-colors font-sans'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, props.className)} {...props} />
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'cursor-pointer', props.className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'resize-y min-h-[70px]', props.className)} {...props} />
}

// ---- Card ----
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface-card border border-border rounded-md', className)}>
      {children}
    </div>
  )
}

// ---- SectionHeader ----
export function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('font-cond text-[11px] font-bold tracking-widest text-muted uppercase border-b border-border pb-1 mb-2', className)}>
      {children}
    </div>
  )
}

// ---- Modal ----
export function Modal({
  open, onClose, title, children, footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-panel border border-border rounded-lg w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="bg-navy-dark flex justify-between items-center px-4 py-3 border-b border-border rounded-t-lg">
          <span className="font-cond text-[15px] font-black tracking-wide">{title}</span>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ---- CoverageBar ----
export function CoverageBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const color = pct >= 90 ? '#22c55e' : pct >= 60 ? '#facc15' : '#f87171'
  const textColor = pct >= 90 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="font-cond text-[10px] font-bold tracking-wider text-muted">{label}</span>
        <span className={cn('font-mono text-[11px]', textColor)}>{value}/{total}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded overflow-hidden">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ---- Avatar ----
export function Avatar({ name, variant = 'blue' }: { name: string; variant?: 'blue' | 'red' | 'green' }) {
  const init = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const cls = {
    blue:  'bg-blue-900/40 text-blue-300',
    red:   'bg-red-900/30 text-red-400',
    green: 'bg-green-900/30 text-green-400',
  }[variant]
  return (
    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center font-cond text-sm font-black flex-shrink-0', cls)}>
      {init}
    </div>
  )
}

// ---- Pill ----
export function Pill({ children, variant = 'blue' }: { children: React.ReactNode; variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' }) {
  const cls = {
    blue:   'bg-blue-900/30 text-blue-300',
    green:  'bg-green-900/30 text-green-400',
    red:    'bg-red-900/30 text-red-400',
    yellow: 'bg-yellow-900/30 text-yellow-400',
    gray:   'bg-gray-700/50 text-gray-400',
  }[variant]
  return (
    <span className={cn('font-cond text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full', cls)}>
      {children}
    </span>
  )
}
