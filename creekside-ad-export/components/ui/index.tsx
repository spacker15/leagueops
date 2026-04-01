'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { STATUS_CLASS, ELIGIBILITY_CLASS, BGCHECK_CLASS, initials } from '@/lib/utils'
import type { GameStatus, EligibilityStatus, BgCheckStatus } from '@/types'

// ── Status Badges ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: GameStatus }) {
  return <span className={STATUS_CLASS[status]}>{status}</span>
}

export function EligBadge({ status }: { status: EligibilityStatus }) {
  return (
    <span className={ELIGIBILITY_CLASS[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function BgCheckBadge({ status }: { status: BgCheckStatus }) {
  return (
    <span className={BGCHECK_CLASS[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Btn ───────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'danger' | 'success' | 'ghost' | 'outline'
type BtnSize = 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-navy hover:bg-navy-light text-white',
  danger: 'bg-red hover:bg-red-dark text-white',
  success: 'bg-green-700 hover:bg-green-600 text-white',
  ghost: 'text-muted hover:text-white bg-transparent',
  outline: 'border border-border text-muted hover:text-white bg-transparent hover:border-[#2a4070]',
}

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-1.5 text-[12px]',
  lg: 'px-5 py-2 text-[13px]',
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
}

export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        'font-cond font-bold tracking-wide rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Form Primitives ───────────────────────────────────────────────────────────

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-cond font-black tracking-widest uppercase text-[11px] text-muted block">
        {label}
      </label>
      {children}
    </div>
  )
}

const INPUT_BASE =
  'bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors w-full placeholder:text-muted/50'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_BASE, props.className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors w-full',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'bg-[#040e24] border border-[#1e3060] text-white px-2.5 py-1.5 rounded-lg text-[12px] outline-none focus:border-blue-400/60 transition-colors w-full resize-none placeholder:text-muted/50',
        className
      )}
      {...props}
    />
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className={cn('bg-surface-card border border-border rounded-xl', className)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-b border-border pb-2 mb-3', className)}>
      <span className="font-cond font-black tracking-widest uppercase text-[11px] text-muted">
        {children}
      </span>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-cond font-black tracking-widest uppercase text-[13px] text-white">
            {title}
          </span>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors p-0.5 rounded"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_VARIANT: Record<string, string> = {
  blue: 'bg-navy/40 text-blue-300 border-navy/60',
  red: 'bg-red/30 text-red-300 border-red/40',
  green: 'bg-green-900/40 text-green-400 border-green-800/50',
  purple: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
}

export function Avatar({
  name,
  variant = 'blue',
}: {
  name: string
  variant?: 'blue' | 'red' | 'green' | 'purple'
}) {
  return (
    <div
      className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center border font-cond font-black text-[11px] shrink-0',
        AVATAR_VARIANT[variant] ?? AVATAR_VARIANT.blue
      )}
    >
      {initials(name)}
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────

const PILL_VARIANT: Record<string, string> = {
  blue: 'bg-blue-950/60 text-blue-300 border border-blue-800/40',
  green: 'bg-green-950/60 text-green-400 border border-green-800/40',
  red: 'bg-red-950/60 text-red-400 border border-red-800/40',
  yellow: 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/40',
  gray: 'bg-[#111520] text-[#64748b] border border-[#1e2d40]',
}

export function Pill({
  children,
  variant,
}: {
  children: React.ReactNode
  variant: 'blue' | 'green' | 'red' | 'yellow' | 'gray'
}) {
  return (
    <span
      className={cn(
        'font-cond font-black tracking-wide text-[10px] uppercase px-2 py-0.5 rounded-full',
        PILL_VARIANT[variant]
      )}
    >
      {children}
    </span>
  )
}

// ── CoverageBar ───────────────────────────────────────────────────────────────

export function CoverageBar({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  const barColor = pct >= 100 ? 'bg-green-600' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-600'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-cond font-black tracking-widest uppercase text-[10px] text-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] text-white">
          {value}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#0d1f3c] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
