import React, { useState, useEffect, useCallback, useRef } from 'react'
import { accountsApi } from '../../api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const INR = (n) =>
  '₹' + Math.abs(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const SH = {
  th: {
    background: '#1a2a4a', color: '#fff', padding: '8px 10px',
    fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: '.5px',
  },
  thL: {
    background: '#1a2a4a', color: '#fff', padding: '8px 10px',
    fontSize: 11, fontWeight: 700, textAlign: 'left', letterSpacing: '.5px',
  },
  td: {
    padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb',
    textAlign: 'center', color: '#374151',
  },
  tdL: {
    padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb',
    textAlign: 'left', color: '#374151',
  },
  tdR: {
    padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb',
    textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums',
  },
}

export default function DaySheet() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountsApi.daySheet({ date })
      setData(res.data)
    } catch (e) {
      toast.error('Failed to load Day Sheet')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
        <head>
          <title>Day Sheet — ${data?.date || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #333; padding: 5px 8px; }
            th { background: #1a2a4a; color: white; }
            .no-print { display: none; }
          </style>
        </head>
        <body>${content}</body>
      </html>`)
    win.document.close()
    win.print()
  }

  const handleExport = () => {
    if (!data) return
    const rows = []
    rows.push(['DAY SHEET — ' + data.date])
    rows.push([])
    rows.push(['DEBIT', '', '', '', 'CREDIT', '', ''])
    rows.push(['SL', 'Particular', 'Amount (₹)', 'SC', 'SL', 'Particular', 'Amount (₹)', 'SC'])
    const maxLen = Math.max(data.debit_rows.length, data.credit_rows.length)
    for (let i = 0; i < maxLen; i++) {
      const d = data.debit_rows[i]
      const c = data.credit_rows[i]
      rows.push([
        d ? i + 1 : '', d ? d.particular : '', d ? d.amount : '', d ? d.sc : '',
        c ? i + 1 : '', c ? c.particular : '', c ? c.amount : '', c ? c.sc : '',
      ])
    }
    rows.push(['', 'Total', data.total_debit, '', '', 'Total', data.total_credit, ''])
    rows.push([])
    rows.push(['BY HAND AND BANK CLOSING'])
    rows.push(['Cash In Hand', data.physical_cash, 'CASH'])
    rows.push(['Bank Balance', data.physical_bank, 'BANK'])
    rows.push(['Total (By Hand & Bank)', data.physical_cash + data.physical_bank])
    rows.push(['Reading Calculation Total', data.sheet_closing])
    rows.push(['Difference', data.closing_diff])

    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DaySheet_${data.date}.csv`
    a.click()
  }

  // Ensure equal rows for side-by-side rendering
  const maxRows = data ? Math.max(data.debit_rows.length, data.credit_rows.length, 12) : 12
  const debits = data ? [...data.debit_rows, ...Array(Math.max(0, maxRows - data.debit_rows.length)).fill(null)] : Array(12).fill(null)
  const credits = data ? [...data.credit_rows, ...Array(Math.max(0, maxRows - data.credit_rows.length)).fill(null)] : Array(12).fill(null)

  const diff = data?.difference ?? 0
  const closingDiff = data?.closing_diff ?? 0

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2a4a' }}>📒 Day Sheet</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>📅</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1a2a4a', background: 'transparent' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={btnStyle('#f3f4f6', '#374151')}>↺ Reset</button>
          <button onClick={handlePrint} style={btnStyle('#f3f4f6', '#374151')}>🖨 Print</button>
          <button onClick={handleExport} style={btnStyle('#f3f4f6', '#374151')}>⬇ Export Excel</button>
          <button style={btnStyle('#1a2a4a', 'white')}>💾 Save</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Loading Day Sheet…</div>
      ) : !data ? null : (
        <>
          {/* ── Summary strip ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <SummaryPill label="Total Debit" value={INR(data.total_debit)} color="#1a2a4a" />
            <SummaryPill label="Total Credit" value={INR(data.total_credit)} color="#16a34a" />
            <SummaryPill label="Difference" value={(diff < 0 ? '-' : '') + INR(diff)} color={diff < 0 ? '#dc2626' : '#374151'} />
            <SummaryPill label="Reading/Sheet Closing" value={INR(data.sheet_closing)} color="#374151" />
          </div>

          {/* ── Main Day Sheet table ── */}
          <div ref={printRef} style={{ border: '2px solid #1a2a4a', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
            {/* Title row */}
            <div style={{ background: '#eef2f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '2px solid #1a2a4a' }}>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, color: '#1a2a4a', flex: 1, textAlign: 'center' }}>DAY SHEET</div>
              <div style={{ flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1a2a4a' }}>{data.date}</div>
            </div>

            {/* Column headers: DEBIT | CREDIT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #1a2a4a' }}>
              <div style={{ background: '#dbeafe', textAlign: 'center', fontWeight: 800, fontSize: 13, padding: '8px', borderRight: '2px solid #1a2a4a', color: '#1e40af', letterSpacing: 2 }}>DEBIT</div>
              <div style={{ background: '#dcfce7', textAlign: 'center', fontWeight: 800, fontSize: 13, padding: '8px', color: '#166534', letterSpacing: 2 }}>CREDIT</div>
            </div>

            {/* Sub-headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #1a2a4a' }}>
              {/* Debit headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px', borderRight: '2px solid #1a2a4a' }}>
                <div style={SH.th}>SL</div>
                <div style={SH.thL}>Particular</div>
                <div style={SH.th}>Amount (₹)</div>
                <div style={SH.th}>SC</div>
              </div>
              {/* Credit headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px' }}>
                <div style={SH.th}>SL</div>
                <div style={SH.thL}>Particular</div>
                <div style={SH.th}>Amount (₹)</div>
                <div style={SH.th}>SC</div>
              </div>
            </div>

            {/* Data rows */}
            {debits.map((d, i) => {
              const c = credits[i]
              const even = i % 2 === 0
              const bg = even ? '#fff' : '#f9fafb'
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e5e7eb', background: bg }}>
                  {/* Debit row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px', borderRight: '2px solid #c7d2fe' }}>
                    <div style={{ ...SH.td, color: '#9ca3af' }}>{d ? i + 1 : ''}</div>
                    <div style={{ ...SH.tdL, fontWeight: d ? 500 : 400, color: '#111827' }}>{d?.particular || ''}</div>
                    <div style={{ ...SH.tdR, fontWeight: d ? 600 : 400, color: '#1a2a4a' }}>{d ? d.amount.toLocaleString('en-IN') : ''}</div>
                    <div style={{ ...SH.td, fontWeight: 600, color: d?.sc === 'BANK' ? '#2563eb' : '#16a34a', fontSize: 10 }}>{d?.sc || ''}</div>
                  </div>
                  {/* Credit row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px' }}>
                    <div style={{ ...SH.td, color: '#9ca3af' }}>{c ? i + 1 : ''}</div>
                    <div style={{ ...SH.tdL, fontWeight: c ? 500 : 400, color: '#111827' }}>{c?.particular || ''}</div>
                    <div style={{ ...SH.tdR, fontWeight: c ? 600 : 400, color: '#dc2626' }}>{c ? c.amount.toLocaleString('en-IN') : ''}</div>
                    <div style={{ ...SH.td, fontWeight: 600, color: c?.sc === 'BANK' ? '#2563eb' : '#16a34a', fontSize: 10 }}>{c?.sc || ''}</div>
                  </div>
                </div>
              )
            })}

            {/* Total row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#1a2a4a' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px', borderRight: '2px solid #4b6cb7' }}>
                <div style={{ gridColumn: '1/3', padding: '10px', color: '#fff', fontWeight: 800, fontSize: 13, textAlign: 'right' }}>Total</div>
                <div style={{ padding: '10px', color: '#fbbf24', fontWeight: 800, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{data.total_debit.toLocaleString('en-IN')}</div>
                <div />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 110px 70px' }}>
                <div style={{ gridColumn: '1/3', padding: '10px', color: '#fff', fontWeight: 800, fontSize: 13, textAlign: 'right' }}>Total</div>
                <div style={{ padding: '10px', color: '#86efac', fontWeight: 800, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{data.total_credit.toLocaleString('en-IN')}</div>
                <div />
              </div>
            </div>
          </div>

          {/* ── Bottom closing section ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* By Hand & Bank Closing */}
            <div style={{ border: '1px solid #fbbf24', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', padding: '10px 16px', textAlign: 'center', fontWeight: 800, fontSize: 12, color: '#92400e', letterSpacing: 1 }}>
                BY HAND AND BANK CLOSING
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <ClosingRow label="Cash In Hand" value={INR(data.physical_cash)} badge="CASH" badgeColor="#16a34a" />
                  <ClosingRow label="Bank Balance" value={INR(data.physical_bank)} badge="BANK" badgeColor="#2563eb" />
                  <ClosingRow label="Total (By Hand & Bank)" value={INR(data.physical_cash + data.physical_bank)} bold />
                  <ClosingRow label="Reading Calculation Total" value={INR(data.sheet_closing)} />
                  <ClosingRow
                    label="Difference"
                    value={(closingDiff < 0 ? '-' : '') + INR(closingDiff)}
                    bold
                    valueColor={closingDiff === 0 ? '#16a34a' : '#dc2626'}
                  />
                </tbody>
              </table>
              {!data.has_closing && (
                <div style={{ padding: '8px 16px', fontSize: 11, color: '#b45309', background: '#fef3c7', borderTop: '1px solid #fde68a' }}>
                  ⚠ No Day Book closing recorded for this date. Record closing to populate physical cash/bank.
                </div>
              )}
            </div>

            {/* Reading / Sheet Closing */}
            <div style={{ border: '1px solid #93c5fd', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#eff6ff', borderBottom: '1px solid #93c5fd', padding: '10px 16px', textAlign: 'center', fontWeight: 800, fontSize: 12, color: '#1e40af', letterSpacing: 1 }}>
                READING / SHEET CLOSING
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <ClosingRow label="Reading / Sheet Closing Total" value={INR(data.sheet_closing)} bold valueColor="#1e40af" />
                  <ClosingRow label="Total Debit" value={INR(data.total_debit)} />
                  <ClosingRow label="Total Credit" value={INR(data.total_credit)} />
                  <ClosingRow
                    label="Net Difference"
                    value={(diff < 0 ? '-' : '+') + INR(diff)}
                    bold
                    valueColor={diff === 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#374151'}
                  />
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryPill({ label, value, color }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.05)', minWidth: 160,
    }}>
      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
    </div>
  )
}

function ClosingRow({ label, value, bold, badge, badgeColor, valueColor }) {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: bold ? 700 : 400, color: '#374151' }}>{label}</td>
      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: valueColor || '#111', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </td>
      {badge && (
        <td style={{ padding: '9px 10px', width: 55 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: badgeColor, background: badgeColor + '18', padding: '2px 6px', borderRadius: 4 }}>{badge}</span>
        </td>
      )}
    </tr>
  )
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: '1px solid #d1d5db', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  }
}
