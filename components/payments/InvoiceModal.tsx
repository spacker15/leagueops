'use client'

import { useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import type { TeamPayment, RegistrationFee, PaymentEntry } from '@/types'

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
}

interface Props {
  data: InvoiceData
  onClose: () => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function InvoiceModal({ data, onClose }: Props) {
  const [entries, setEntries] = useState<Record<number, PaymentEntry[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEntries() {
      const results: Record<number, PaymentEntry[]> = {}
      await Promise.all(
        data.payments.map(async (p) => {
          try {
            const res = await fetch(`/api/payment-entries?team_payment_id=${p.id}`)
            if (res.ok) results[p.id] = await res.json()
          } catch {
            // non-critical
          }
        })
      )
      setEntries(results)
      setLoading(false)
    }
    loadEntries()
  }, [data.payments])

  const rows = data.payments.map((p) => {
    const gamesPlayed = p.team_id ? data.gameCounts[p.team_id] || 0 : 0
    const feeConfig = data.fees.find((f) => f.division === p.division)
    const gamesIncluded = feeConfig ? Number(feeConfig.games_included) || 0 : 0
    const extraGames = gamesIncluded > 0 ? Math.max(0, gamesPlayed - gamesIncluded) : 0
    const perGame = feeConfig
      ? (Number(feeConfig.extra_game_ref_fee) || 0) +
        (Number(feeConfig.extra_game_assigner_fee) || 0)
      : 0
    const extraFee = extraGames * perGame
    const totalDue = Number(p.amount_due) + extraFee
    return { ...p, gamesPlayed, gamesIncluded, extraGames, extraFee, totalDue }
  })

  const totRegFee = rows.reduce((s, r) => s + Number(r.amount_due), 0)
  const totExtraFee = rows.reduce((s, r) => s + r.extraFee, 0)
  const grandTotal = totRegFee + totExtraFee
  const totPaid = rows.reduce((s, r) => s + Number(r.amount_paid), 0)
  const balance = grandTotal - totPaid

  const allEntries = Object.entries(entries)
    .flatMap(([tpId, ents]) =>
      ents.map((e) => ({
        ...e,
        team_name: data.payments.find((p) => p.id === Number(tpId))?.team_name ?? '',
      }))
    )
    .sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime())

  const invoiceNumber = `INV-${data.event.name.replace(/\s+/g, '-').toUpperCase().slice(0, 8)}-${data.payments[0]?.id ?? '000'}`
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const dateRange =
    data.event.start_date && data.event.end_date
      ? `${fmtDate(data.event.start_date)} – ${fmtDate(data.event.end_date)}`
      : data.event.start_date
        ? fmtDate(data.event.start_date)
        : null

  return (
    <>
      {/* Print style: show only invoice content when printing */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > * { visibility: hidden !important; }
              .invoice-printable, .invoice-printable * { visibility: visible !important; }
              .invoice-printable { position: fixed; inset: 0; padding: 32px; background: white; z-index: 9999; }
              .no-print { display: none !important; }
            }
          `,
        }}
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <div className="absolute inset-0 no-print" onClick={onClose} aria-label="Close invoice" />

        {/* Modal shell */}
        <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Controls bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-100 border-b border-gray-200 flex-shrink-0 no-print">
            <span className="font-semibold text-gray-700 text-sm">Invoice Preview</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors"
              >
                <Printer size={14} />
                Print / Save PDF
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-gray-800 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable invoice body */}
          <div className="overflow-y-auto flex-1">
            {/* ─── Printable Invoice ─────────────────────────────── */}
            <div className="invoice-printable bg-white text-gray-900 p-10">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  {data.event.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.event.logo_url}
                      alt="Logo"
                      style={{ width: 72, height: 72, objectFit: 'contain' }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        color: '#0B3D91',
                        textTransform: 'uppercase',
                      }}
                    >
                      {data.event.name}
                    </div>
                    {data.event.location && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {data.event.location}
                      </div>
                    )}
                    {dateRange && <div style={{ fontSize: 12, color: '#6b7280' }}>{dateRange}</div>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      color: '#111827',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    INVOICE
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {invoiceNumber}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Date: {today}</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '2px solid #0B3D91', marginBottom: 24 }} />

              {/* Billed to */}
              <div className="flex gap-12 mb-8">
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Billed To
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {data.program.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.program.logo_url}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4 }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        {data.program.name}
                      </div>
                      {data.program.contact_name && (
                        <div style={{ fontSize: 12, color: '#4b5563' }}>
                          {data.program.contact_name}
                        </div>
                      )}
                      {data.program.contact_email && (
                        <div style={{ fontSize: 12, color: '#4b5563' }}>
                          {data.program.contact_email}
                        </div>
                      )}
                      {data.program.contact_phone && (
                        <div style={{ fontSize: 12, color: '#4b5563' }}>
                          {data.program.contact_phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Status
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      backgroundColor:
                        balance <= 0 ? '#d1fae5' : totPaid > 0 ? '#dbeafe' : '#fef3c7',
                      color: balance <= 0 ? '#065f46' : totPaid > 0 ? '#1e40af' : '#92400e',
                    }}
                  >
                    {balance <= 0
                      ? 'PAID IN FULL'
                      : totPaid > 0
                        ? 'PARTIAL PAYMENT'
                        : 'PAYMENT DUE'}
                  </div>
                </div>
              </div>

              {/* Teams table */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Registered Teams
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    {[
                      ['Team', 'left'],
                      ['Division', 'left'],
                      ['Reg Fee', 'right'],
                      ['Games', 'center'],
                      ['Extra Games', 'center'],
                      ['Extra Fee', 'right'],
                      ['Total Due', 'right'],
                    ].map(([label, align]) => (
                      <th
                        key={label}
                        style={{
                          padding: '6px 10px',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: '#374151',
                          textTransform: 'uppercase',
                          textAlign: align as 'left' | 'right' | 'center',
                          borderBottom: '1px solid #d1d5db',
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ backgroundColor: i % 2 === 1 ? '#f9fafb' : 'white' }}>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#111827',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {r.team_name}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 11,
                          color: '#374151',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {r.division}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          textAlign: 'right',
                          color: '#111827',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {fmt(Number(r.amount_due))}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 11,
                          textAlign: 'center',
                          color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {r.gamesPlayed}
                        {r.gamesIncluded > 0 && (
                          <span style={{ color: '#9ca3af' }}> / {r.gamesIncluded} incl.</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 11,
                          textAlign: 'center',
                          color: r.extraGames > 0 ? '#d97706' : '#9ca3af',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {r.extraGames > 0 ? `+${r.extraGames}` : '—'}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          textAlign: 'right',
                          color: r.extraFee > 0 ? '#d97706' : '#9ca3af',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {r.extraFee > 0 ? fmt(r.extraFee) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '7px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'right',
                          color: '#111827',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        {fmt(r.totalDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
                <div style={{ width: 280 }}>
                  {[
                    ['Registration Fees', fmt(totRegFee), false],
                    ...(totExtraFee > 0 ? [['Extra Game Fees', fmt(totExtraFee), false]] : []),
                    ['Total Due', fmt(grandTotal), true],
                    ['Amount Paid', `(${fmt(totPaid)})`, false],
                  ].map(([label, value, bold]) => (
                    <div
                      key={label as string}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        fontSize: bold ? 14 : 12,
                        fontWeight: bold ? 700 : 400,
                        color: bold ? '#111827' : '#4b5563',
                        borderTop: bold ? '1px solid #d1d5db' : 'none',
                        marginTop: bold ? 4 : 0,
                        paddingTop: bold ? 8 : 4,
                      }}
                    >
                      <span>{label as string}</span>
                      <span>{value as string}</span>
                    </div>
                  ))}
                  {/* Balance row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      marginTop: 4,
                      borderRadius: 6,
                      backgroundColor: balance <= 0 ? '#d1fae5' : '#fef3c7',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: balance <= 0 ? '#065f46' : '#92400e',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Balance Due
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: balance <= 0 ? '#065f46' : '#92400e',
                      }}
                    >
                      {balance <= 0 ? fmt(0) : fmt(balance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment history */}
              {!loading && allEntries.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Payment History
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        {['Date', 'Team', 'Method', 'Reference', 'Amount'].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              padding: '5px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              color: '#374151',
                              textTransform: 'uppercase',
                              textAlign: i === 4 ? 'right' : 'left',
                              borderBottom: '1px solid #d1d5db',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allEntries.map((e, i) => (
                        <tr
                          key={e.id}
                          style={{ backgroundColor: i % 2 === 1 ? '#f9fafb' : 'white' }}
                        >
                          <td
                            style={{
                              padding: '6px 10px',
                              fontSize: 11,
                              color: '#374151',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {new Date(e.paid_at).toLocaleDateString()}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              fontSize: 11,
                              color: '#374151',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {e.team_name}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              fontSize: 11,
                              color: '#374151',
                              textTransform: 'capitalize',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {(e.payment_method ?? '').replace('_', ' ')}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              fontSize: 11,
                              color: '#6b7280',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {e.reference_number ?? '—'}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              textAlign: 'right',
                              color: '#16a34a',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {fmt(Number(e.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Footer */}
              <div
                style={{
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: 16,
                  marginTop: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  Make checks payable to: <strong>{data.event.name}</strong>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>
                  Generated {today} · {invoiceNumber}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
