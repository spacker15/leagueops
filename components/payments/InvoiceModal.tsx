'use client'

import { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { createClient } from '@/supabase/client'
import type { TeamPayment, RegistrationFee } from '@/types'

export interface InvoiceSettings {
  payable_to: string | null
  mail_address: string | null
}

export interface InvoiceData {
  event: {
    name: string
    logo_url?: string | null
    location?: string | null
    start_date?: string | null
    end_date?: string | null
  }
  program: {
    name: string
    contact_name?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    logo_url?: string | null
  }
  payments: TeamPayment[]
  fees: RegistrationFee[]
  gameCounts: Record<number, number>
  invoiceSettings: InvoiceSettings
}

interface Props {
  data: InvoiceData
  onClose: () => void
}

function fmt(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function fmtDate(s: string | null | undefined) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InvoiceModal({ data, onClose }: Props) {
  const { event, program, payments, fees, gameCounts, invoiceSettings } = data
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const feeByDiv: Record<string, RegistrationFee> = {}
  for (const f of fees) feeByDiv[f.division] = f

  const rows = payments.map((p) => {
    const gamesPlayed = p.team_id ? gameCounts[p.team_id] || 0 : 0
    const feeConfig = feeByDiv[p.division]
    const gamesIncluded = feeConfig ? Number(feeConfig.games_included) || 0 : 0
    const extraGames = gamesIncluded > 0 ? Math.max(0, gamesPlayed - gamesIncluded) : 0
    const perGame = feeConfig
      ? (Number(feeConfig.extra_game_ref_fee) || 0) +
        (Number(feeConfig.extra_game_assigner_fee) || 0)
      : 0
    const extraFee = extraGames * perGame
    const totalDue = Number(p.amount_due) + extraFee
    const paid = Number(p.amount_paid)
    const balance = totalDue - paid
    return { p, gamesPlayed, extraGames, extraFee, totalDue, paid, balance }
  })

  const grandTotal = rows.reduce((s, r) => s + r.totalDue, 0)
  const grandPaid = rows.reduce((s, r) => s + r.paid, 0)
  const grandBalance = grandTotal - grandPaid

  const dateRange =
    event.start_date && event.end_date
      ? `${fmtDate(event.start_date)} – ${fmtDate(event.end_date)}`
      : event.start_date
        ? fmtDate(event.start_date)
        : ''

  return (
    <>
      {/* Print-only CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body > * { visibility: hidden !important; }
          .invoice-printable,
          .invoice-printable * { visibility: visible !important; }
          .invoice-printable {
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            color: black !important;
            z-index: 99999 !important;
            padding: 32px !important;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
          }
          .no-print { display: none !important; }
        }
      `,
        }}
      />

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 overflow-y-auto py-8">
        <div className="w-full max-w-3xl mx-4">
          {/* Action bar — hidden on print */}
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="font-cond text-[11px] font-black tracking-wider text-muted uppercase">
              Invoice Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 font-cond text-[11px] font-black tracking-wider px-4 py-2 rounded-lg bg-navy hover:bg-navy/80 text-white transition-colors"
              >
                <Printer size={13} /> PRINT / SAVE PDF
              </button>
              <button
                onClick={onClose}
                className="text-muted hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Invoice document */}
          <div
            className="invoice-printable bg-white text-black rounded-xl overflow-hidden shadow-2xl"
            style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
          >
            {/* Header */}
            <div style={{ background: '#081428', color: 'white', padding: '24px 32px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {event.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.logo_url}
                      alt="League logo"
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: 'contain',
                        borderRadius: 8,
                        background: 'white',
                        padding: 4,
                      }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {event.name}
                    </div>
                    {event.location && (
                      <div style={{ fontSize: 12, color: '#5a6e9a', marginTop: 2 }}>
                        {event.location}
                      </div>
                    )}
                    {dateRange && (
                      <div style={{ fontSize: 12, color: '#5a6e9a', marginTop: 1 }}>
                        {dateRange}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      letterSpacing: '0.1em',
                      color: '#D62828',
                    }}
                  >
                    INVOICE
                  </div>
                  <div style={{ fontSize: 11, color: '#5a6e9a', marginTop: 4 }}>
                    {invoiceNumber}
                  </div>
                  <div style={{ fontSize: 11, color: '#5a6e9a', marginTop: 2 }}>{today}</div>
                </div>
              </div>
            </div>

            {/* Bill To / Pay To */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {/* Bill To */}
              <div style={{ padding: '20px 32px', borderRight: '1px solid #e5e7eb' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Bill To
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  {program.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={program.logo_url}
                      alt=""
                      style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4 }}
                    />
                  )}
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{program.name}</div>
                </div>
                {program.contact_name && (
                  <div style={{ fontSize: 12, color: '#374151' }}>{program.contact_name}</div>
                )}
                {program.contact_email && (
                  <div style={{ fontSize: 12, color: '#374151' }}>{program.contact_email}</div>
                )}
                {program.contact_phone && (
                  <div style={{ fontSize: 12, color: '#374151' }}>{program.contact_phone}</div>
                )}
              </div>

              {/* Pay To */}
              <div style={{ padding: '20px 32px' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Make Check Payable To
                </div>
                {invoiceSettings.payable_to ? (
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                    {invoiceSettings.payable_to}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#9ca3af',
                      fontStyle: 'italic',
                      marginBottom: 10,
                    }}
                  >
                    (Not configured — set in League Settings)
                  </div>
                )}
                {invoiceSettings.mail_address && (
                  <>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        marginBottom: 6,
                      }}
                    >
                      Mail Check To
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-line' }}>
                      {invoiceSettings.mail_address}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Line items table */}
            <div style={{ padding: '0 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    {[
                      'Team',
                      'Division',
                      'Reg Fee',
                      'Games',
                      'Extra Games',
                      'Extra Fee',
                      'Total Due',
                      'Paid',
                      'Balance',
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 12px',
                          textAlign: h === 'Team' || h === 'Division' ? 'left' : 'right',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, gamesPlayed, extraGames, extraFee, totalDue, paid, balance }) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#111' }}>
                        {p.team_name}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#374151' }}>{p.division}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#111' }}>
                        {fmt(Number(p.amount_due))}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#6b7280' }}>
                        {gamesPlayed}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          color: extraGames > 0 ? '#ea580c' : '#9ca3af',
                        }}
                      >
                        {extraGames > 0 ? `+${extraGames}` : '—'}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          color: extraFee > 0 ? '#ea580c' : '#9ca3af',
                        }}
                      >
                        {extraFee > 0 ? fmt(extraFee) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#111',
                        }}
                      >
                        {fmt(totalDue)}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#16a34a' }}>
                        {fmt(paid)}
                      </td>
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: balance > 0 ? '#ca8a04' : '#16a34a',
                        }}
                      >
                        {fmt(balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                    <td
                      colSpan={6}
                      style={{
                        padding: '12px 12px',
                        textAlign: 'right',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        padding: '12px 12px',
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 900,
                        color: '#111',
                      }}
                    >
                      {fmt(grandTotal)}
                    </td>
                    <td
                      style={{
                        padding: '12px 12px',
                        textAlign: 'right',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#16a34a',
                      }}
                    >
                      {fmt(grandPaid)}
                    </td>
                    <td
                      style={{
                        padding: '12px 12px',
                        textAlign: 'right',
                        fontSize: 14,
                        fontWeight: 900,
                        color: grandBalance > 0 ? '#ca8a04' : '#16a34a',
                      }}
                    >
                      {fmt(grandBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 32px',
                borderTop: '1px solid #e5e7eb',
                background: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Generated by LeagueOps · {today}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                Balance Due:{' '}
                <span style={{ color: grandBalance > 0 ? '#ca8a04' : '#16a34a', fontSize: 16 }}>
                  {fmt(grandBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Hook: load invoice data for a program ──────────────────────────────────
export async function loadInvoiceData(
  eventId: number,
  programName: string,
  payments: TeamPayment[],
  fees: RegistrationFee[],
  gameCounts: Record<number, number>
): Promise<InvoiceData> {
  const sb = createClient()

  const [{ data: evData }, { data: progData }] = await Promise.all([
    sb
      .from('events')
      .select(
        'name, logo_url, location, start_date, end_date, invoice_payable_to, invoice_mail_address'
      )
      .eq('id', eventId)
      .single(),
    sb
      .from('programs')
      .select('name, contact_name, contact_email, contact_phone, logo_url')
      .eq('event_id', eventId)
      .eq('name', programName)
      .single(),
  ])

  return {
    event: evData ?? { name: '' },
    program: progData ?? { name: programName },
    payments,
    fees,
    gameCounts,
    invoiceSettings: {
      payable_to: (evData as any)?.invoice_payable_to ?? null,
      mail_address: (evData as any)?.invoice_mail_address ?? null,
    },
  }
}
