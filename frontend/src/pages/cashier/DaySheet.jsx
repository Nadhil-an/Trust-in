import React, { useState, useEffect, useCallback, useRef } from 'react'
import { accountsApi, cashierApi } from '../../api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const INR = (n) =>
  '₹' + Math.abs(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const SH = {
  th: {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
    textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px'
  },
  thL: {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
    textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.5px'
  },
  thR: {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
    textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.5px'
  },
  td: {
    padding: '8px', fontSize: 13, color: 'var(--gray-600)',
    textAlign: 'center', borderBottom: '1px solid var(--gray-100)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  tdL: {
    padding: '8px', fontSize: 13, color: 'var(--gray-800)',
    textAlign: 'left', borderBottom: '1px solid var(--gray-100)',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start'
  },
  tdR: {
    padding: '8px', fontSize: 13, color: 'var(--gray-900)',
    textAlign: 'right', borderBottom: '1px solid var(--gray-100)',
    fontVariantNumeric: 'tabular-nums', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end'
  },
}

export default function DaySheet() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  const [debits, setDebits] = useState([])
  const [credits, setCredits] = useState([])
  const [closing, setClosing] = useState({ cashInHand: '', bankBalance: '', sheetClosing: '' })


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

  useEffect(() => {
    if (!data) return

    const savedDebits = data.debit_rows || []
    const savedCredits = data.credit_rows || []
    const maxRows = Math.max(savedDebits.length, savedCredits.length, 9)

    // Build debit rows — always from server data
    const dRows = savedDebits.map(r => ({ ...r, amount: r.amount != null ? r.amount : '' }))
    while (dRows.length < maxRows) dRows.push({ particular: '', amount: '', sc: 'CASH' })

    // Enforce fixed labels for the first 6 system rows
    if (dRows.length >= 6) {
      if (!dRows[0].particular) dRows[0].particular = 'OB CASH'
      if (!dRows[1].particular) dRows[1].particular = 'OB BANK'
      if (!dRows[2].particular) dRows[2].particular = 'DONATION'
      if (!dRows[3].particular) dRows[3].particular = 'BY CASH'
      if (!dRows[4].particular) dRows[4].particular = 'BY BANK'
      if (!dRows[5].particular) dRows[5].particular = 'TOTAL'
    }
    setDebits(dRows)

    // Build credit rows — always from server data
    const cRows = savedCredits.map(r => ({ ...r, amount: r.amount != null ? r.amount : '' }))
    while (cRows.length < maxRows) cRows.push({ particular: '', amount: '', sc: 'CASH' })
    setCredits(cRows)

    // Restore closing balances
    setClosing({
      cashInHand: data.physical_cash != null ? data.physical_cash : '',
      bankBalance: data.physical_bank != null ? data.physical_bank : '',
      sheetClosing: data.sheet_closing != null ? data.sheet_closing : ''
    })
  }, [data])


  const handlePrint = () => {
    const win = window.open('', '_blank')
    const formatAmt = (amt) => amt ? Number(amt).toLocaleString('en-IN') : ''
    
    let tableHtml = ''
    const maxLen = Math.max(debits.length, credits.length)
    for (let i = 0; i < maxLen; i++) {
      const d = debits[i] || {}
      const c = credits[i] || {}
      if (!d.particular && !d.amount && !c.particular && !c.amount && i >= 6) continue

      tableHtml += `
        <tr>
          <td>${d.particular || ''}</td>
          <td class="right">${formatAmt(d.amount)}</td>
          <td class="center">${d.sc || ''}</td>
          
          <td>${c.particular || ''}</td>
          <td class="right">${formatAmt(c.amount)}</td>
          <td class="center">${c.sc || ''}</td>
        </tr>
      `
    }

    win.document.write(`
      <html>
        <head>
          <title>Day Sheet — ${date}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 30px; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 0; }
            @media print { 
              body { margin: 15mm; } 
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
            }
            .print-header { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #0369a1; }
            .print-header img { max-height: 80px; margin-bottom: 12px; object-fit: contain; }
            .print-header h1 { color: #0369a1; margin: 0 0 5px 0; font-size: 24px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 800; }
            .print-header h2 { color: #333; margin: 0 0 5px 0; font-size: 16px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
            .print-header p { color: #555; margin: 0; font-size: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; }
            th { background-color: #f8f9fa; font-weight: bold; text-transform: uppercase; font-size: 11px; color: #555; }
            .header-debit { background-color: #e0f2fe; color: #0369a1; text-align: center; font-size: 14px; font-weight: bold; }
            .header-credit { background-color: #dcfce7; color: #15803d; text-align: center; font-size: 14px; font-weight: bold; }
            .center { text-align: center; }
            .right { text-align: right; font-variant-numeric: tabular-nums; }
            .bold { font-weight: bold; }
            .total-row td { background-color: #f1f5f9; font-weight: bold; font-size: 13px; }
            .summary-table { width: 50%; float: left; margin-bottom: 20px; }
            .summary-table th { background: #f8f9fa; text-align: left; }
            .clearfix::after { content: ""; clear: both; display: table; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img src="${window.location.origin}/logo-full.png" alt="Sree Lakshmi Trust Logo" onerror="this.onerror=null; this.src='${window.location.origin}/logo-only.png';" />
            <h1>Sree Lakshmi Trust</h1>
            <h2>Day Sheet</h2>
            <p>Date: ${format(new Date(date), 'dd-MM-yyyy')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th colspan="3" class="header-debit">DEBIT</th>
                <th colspan="3" class="header-credit">CREDIT</th>
              </tr>
              <tr>
                <th width="35%">Particular</th>
                <th width="10%">Amount (₹)</th>
                <th width="5%">SC</th>
                <th width="35%">Particular</th>
                <th width="10%">Amount (₹)</th>
                <th width="5%">SC</th>
              </tr>
            </thead>
            <tbody>
              ${tableHtml}
              <tr class="total-row">
                <td class="right">TOTAL DEBIT</td>
                <td class="right" style="color: #0369a1;">${formatAmt(totalDebit)}</td>
                <td></td>
                <td class="right">TOTAL CREDIT</td>
                <td class="right" style="color: #15803d;">${formatAmt(totalCredit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="clearfix">
            <div class="summary-table" style="padding-right: 15px; box-sizing: border-box;">
              <table>
                <thead>
                  <tr>
                    <th colspan="2" style="background: #fef9c3; color: #a16207;">BY HAND AND BANK CLOSING</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Cash In Hand (CASH)</td><td class="right">${formatAmt(closing.cashInHand)}</td></tr>
                  <tr><td>Bank Balance (BANK)</td><td class="right">${formatAmt(closing.bankBalance)}</td></tr>
                  <tr class="bold"><td>Total (By Hand & Bank)</td><td class="right">${formatAmt(totalHandBank)}</td></tr>
                  <tr><td>Reading Calculation Total</td><td class="right">${formatAmt(sheetClosing)}</td></tr>
                  <tr class="bold"><td>Difference</td><td class="right" style="color: ${closingDiff < 0 ? '#dc2626' : (closingDiff > 0 ? '#16a34a' : 'inherit')}">${(closingDiff < 0 ? '-' : '') + formatAmt(Math.abs(closingDiff))}</td></tr>
                </tbody>
              </table>
            </div>

            <div class="summary-table" style="padding-left: 15px; box-sizing: border-box;">
              <table>
                <thead>
                  <tr>
                    <th colspan="2" style="background: #e0f2fe; color: #0369a1;">READING / SHEET CLOSING</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="bold"><td>Reading / Sheet Closing Total</td><td class="right" style="color: #0369a1;">${formatAmt(sheetClosing)}</td></tr>
                  <tr><td>Total Debit</td><td class="right">${formatAmt(totalDebit)}</td></tr>
                  <tr><td>Total Credit</td><td class="right">${formatAmt(totalCredit)}</td></tr>
                  <tr class="bold"><td>Net Difference</td><td class="right" style="color: ${diff < 0 ? '#dc2626' : (diff > 0 ? '#16a34a' : 'inherit')}">${(diff < 0 ? '-' : '+') + formatAmt(Math.abs(diff))}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </body>
      </html>`)
    win.document.close()
    setTimeout(() => {
      win.print()
      win.close()
    }, 250)
  }

  const handleSave = async () => {
    try {
      await cashierApi.cashClosing.create({
        date,
        physical_cash: closing.cashInHand || 0,
        physical_bank: closing.bankBalance || 0,
        debit_rows: debits,
        credit_rows: credits
      })
      toast.success("Closing balances saved successfully!")
      load()
    } catch (e) {
      toast.error('Failed to save data')
    }
  }

  const updateRow = (type, index, field, value) => {
    if (type === 'debit') {
      const newRows = [...debits]
      newRows[index] = { ...newRows[index], [field]: value }
      setDebits(newRows)
    } else {
      const newRows = [...credits]
      newRows[index] = { ...newRows[index], [field]: value }
      setCredits(newRows)
    }
  }

  const handleEnter = (e, prefix, currentIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      for (let j = currentIndex + 1; j < debits.length; j++) {
        const el = document.getElementById(`${prefix}-${j}`)
        if (el) {
          el.focus()
          break
        }
      }
    }
  }

  const addRow = () => {
    setDebits([...debits, { particular: '', amount: '', sc: 'CASH' }])
    setCredits([...credits, { particular: '', amount: '', sc: 'CASH' }])
  }

  const removeRow = (index) => {
    setDebits(debits.filter((_, i) => i !== index))
    setCredits(credits.filter((_, i) => i !== index))
  }

  const totalDebit = debits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const totalCredit = credits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const diff = totalDebit - totalCredit
  const totalHandBank = (Number(closing.cashInHand) || 0) + (Number(closing.bankBalance) || 0)
  const sheetClosing = Number(closing.sheetClosing) || 0
  const closingDiff = totalHandBank - sheetClosing

  const handleExport = () => {
    if (!data) return
    const rows = []
    rows.push(['DAY SHEET — ' + date])
    rows.push([])
    rows.push(['DEBIT', '', '', '', 'CREDIT', '', ''])
    rows.push(['SL', 'Particular', 'Amount (₹)', 'SC', 'SL', 'Particular', 'Amount (₹)', 'SC'])
    const maxLen = Math.max(debits.length, credits.length)
    for (let i = 0; i < maxLen; i++) {
      const d = debits[i]
      const c = credits[i]
      rows.push([
        i + 1, d ? d.particular : '', d ? d.amount : '', d ? d.sc : '',
        i + 1, c ? c.particular : '', c ? c.amount : '', c ? c.sc : '',
      ])
    }
    rows.push(['', 'Total', totalDebit, '', '', 'Total', totalCredit, ''])
    rows.push([])
    rows.push(['BY HAND AND BANK CLOSING'])
    rows.push(['Cash In Hand', closing.cashInHand, 'CASH'])
    rows.push(['Bank Balance', closing.bankBalance, 'BANK'])
    rows.push(['Total (By Hand & Bank)', totalHandBank])
    rows.push(['Reading Calculation Total', closing.sheetClosing])
    rows.push(['Difference', closingDiff])

    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DaySheet_${date}.csv`
    a.click()
  }

  return (
    <div style={{ fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top bar ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header-left">
          <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>DAY SHEET — {format(new Date(date), 'dd-MM-yyyy')}</h2>
          <p>View and manage daily transactions</p>
        </div>
        <div className="page-header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '7px 12px', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: 14 }}>📅</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', background: 'transparent' }}
            />
          </div>
          <button onClick={load} className="btn btn-secondary">↺ Refresh</button>
          <button onClick={handlePrint} className="btn btn-secondary">🖨 Print</button>
          <button onClick={handleExport} className="btn btn-secondary">⬇ Export Excel</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ marginBottom: 16 }}></div>
          <p>Loading Day Sheet...</p>
        </div>
      ) : !data ? null : (
        <>
          {/* ── Summary strip ── */}
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <StatCard label="Total Debit" value={INR(totalDebit)} type="info" />
            <StatCard label="Total Credit" value={INR(totalCredit)} type="success" />
            <StatCard label="Difference" value={(diff < 0 ? '-' : '') + INR(diff)} type={diff < 0 ? "danger" : ""} />
            <StatCard label="Reading/Sheet Closing" value={INR(sheetClosing)} type="" />
          </div>

          {/* ── Main Day Sheet table ── */}
          <div className="data-card" ref={printRef} style={{ marginBottom: 0 }}>
            {/* Column headers: DEBIT | CREDIT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--gray-200)' }}>
              <div style={{ background: 'var(--info-light)', color: 'var(--info)', textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '12px', borderRight: '1px solid var(--gray-200)', letterSpacing: '1px' }}>DEBIT</div>
              <div style={{ background: 'var(--success-light)', color: 'var(--success)', textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '12px', letterSpacing: '1px' }}>CREDIT</div>
            </div>

            {/* Sub-headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
              {/* Debit headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px', borderRight: '1px solid var(--gray-200)' }}>
                <div style={SH.th}>SL</div>
                <div style={SH.thL}>Particular</div>
                <div style={SH.thR}>Amount (₹)</div>
                <div style={SH.th}>SC</div>
              </div>
              {/* Credit headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px' }}>
                <div style={SH.th}>SL</div>
                <div style={SH.thL}>Particular</div>
                <div style={SH.thR}>Amount (₹)</div>
                <div style={SH.th}>SC</div>
              </div>
            </div>

            {/* Data rows */}
            {debits.map((d, i) => {
              const c = credits[i]
              const bg = i % 2 === 0 ? 'var(--white)' : 'var(--gray-50)'
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: bg }}>
                  {/* Debit row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px', borderRight: '1px solid var(--gray-200)' }}>
                    <div style={{ ...SH.td, color: 'var(--gray-400)' }}></div>
                    <div style={{ ...SH.tdL }}>
                      {d.particular === 'DONATION' || d.particular === 'TOTAL' ? (
                        <TableInput 
                          value={d.particular} 
                          highlighted 
                          readOnly 
                          align={d.particular === 'TOTAL' ? 'right' : 'left'} 
                          onChange={() => {}} 
                        />
                      ) : (
                        <TableInput 
                          id={`debit-particular-${i}`}
                          value={d.particular} 
                          onChange={val => updateRow('debit', i, 'particular', val)} 
                          onKeyDown={e => handleEnter(e, 'debit-particular', i)}
                          placeholder="Particular" 
                        />
                      )}
                    </div>
                    <div style={{ ...SH.tdR, color: 'var(--info)' }}>
                      {d.particular === 'TOTAL' ? (
                        <TableInput 
                          value={((Number(debits[3]?.amount) || 0) + (Number(debits[4]?.amount) || 0)).toString()} 
                          align="right" 
                          highlighted 
                          readOnly 
                          onChange={() => {}} 
                        />
                      ) : d.particular !== 'DONATION' && (
                        <TableInput 
                          id={`debit-amount-${i}`}
                          type="number" align="right" 
                          value={d.amount} 
                          onChange={val => updateRow('debit', i, 'amount', val)} 
                          onKeyDown={e => handleEnter(e, 'debit-amount', i)}
                          placeholder="0" 
                        />
                      )}
                    </div>
                    <div style={{ ...SH.td, padding: '4px' }}>
                      <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {d.particular !== 'DONATION' && d.particular !== 'TOTAL' && (
                          <select 
                            value={d.sc} 
                            onChange={e => updateRow('debit', i, 'sc', e.target.value)}
                            style={{
                              background: d.sc === 'BANK' ? 'var(--primary-100)' : 'var(--success-light)',
                              color: d.sc === 'BANK' ? 'var(--primary-700)' : 'var(--success)',
                              border: 'none', borderRadius: '12px', padding: '4px', fontSize: 10, fontWeight: 700,
                              outline: 'none', cursor: 'pointer', flex: 1, textAlign: 'center'
                            }}
                          >
                            <option value="CASH">CASH</option>
                            <option value="BANK">BANK</option>
                          </select>
                        )}
                        {i >= 6 && (
                          <button 
                            onClick={() => removeRow(i)}
                            title="Delete row"
                            style={{
                              background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '4px',
                              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: '14px', padding: 0, flexShrink: 0
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Credit row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px' }}>
                    <div style={{ ...SH.td, color: 'var(--gray-400)' }}></div>
                    <div style={{ ...SH.tdL }}>
                      {c.particular === 'DONATION' || c.particular === 'TOTAL' ? (
                        <TableInput 
                          value={c.particular} 
                          highlighted 
                          readOnly 
                          align={c.particular === 'TOTAL' ? 'right' : 'left'} 
                          onChange={() => {}} 
                        />
                      ) : (
                        <TableInput 
                          id={`credit-particular-${i}`}
                          value={c.particular} 
                          onChange={val => updateRow('credit', i, 'particular', val)} 
                          onKeyDown={e => handleEnter(e, 'credit-particular', i)}
                          placeholder="Particular" 
                        />
                      )}
                    </div>
                    <div style={{ ...SH.tdR, color: 'var(--success)' }}>
                      {c.particular === 'TOTAL' ? (
                        <TableInput 
                          value={((Number(credits[3]?.amount) || 0) + (Number(credits[4]?.amount) || 0)).toString()} 
                          align="right" 
                          highlighted 
                          readOnly 
                          onChange={() => {}} 
                        />
                      ) : c.particular !== 'DONATION' && (
                        <TableInput 
                          id={`credit-amount-${i}`}
                          type="number" align="right" 
                          value={c.amount} 
                          onChange={val => updateRow('credit', i, 'amount', val)} 
                          onKeyDown={e => handleEnter(e, 'credit-amount', i)}
                          placeholder="0" 
                        />
                      )}
                    </div>
                    <div style={{ ...SH.td, padding: '4px' }}>
                      <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {c.particular !== 'DONATION' && c.particular !== 'TOTAL' && (
                          <select 
                            value={c.sc} 
                            onChange={e => updateRow('credit', i, 'sc', e.target.value)}
                            style={{
                              background: c.sc === 'BANK' ? 'var(--primary-100)' : 'var(--success-light)',
                              color: c.sc === 'BANK' ? 'var(--primary-700)' : 'var(--success)',
                              border: 'none', borderRadius: '12px', padding: '4px', fontSize: 10, fontWeight: 700,
                              outline: 'none', cursor: 'pointer', flex: 1, textAlign: 'center'
                            }}
                          >
                            <option value="CASH">CASH</option>
                            <option value="BANK">BANK</option>
                          </select>
                        )}
                        {i >= 6 && (
                          <button 
                            onClick={() => removeRow(i)}
                            title="Delete row"
                            style={{
                              background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '4px',
                              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: '14px', padding: 0, flexShrink: 0
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Add Row Button */}
            <div style={{ padding: '12px', display: 'flex', justifyContent: 'center', background: 'var(--white)', borderTop: '1px solid var(--gray-200)' }}>
              <button 
                onClick={addRow}
                style={{
                  background: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px dashed var(--primary-300)',
                  padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-100)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-50)'}
              >
                <span style={{ fontSize: '16px' }}>+</span> Add Row
              </button>
            </div>

            {/* Total row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--gray-100)', borderTop: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px', borderRight: '1px solid var(--gray-200)' }}>
                <div style={{ gridColumn: '1/3', padding: '14px 16px', color: 'var(--gray-700)', fontWeight: 700, fontSize: 13, textAlign: 'right', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Debit</div>
                <div style={{ padding: '14px 12px', color: 'var(--info)', fontWeight: 800, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{totalDebit.toLocaleString('en-IN')}</div>
                <div />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px' }}>
                <div style={{ gridColumn: '1/3', padding: '14px 16px', color: 'var(--gray-700)', fontWeight: 700, fontSize: 13, textAlign: 'right', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Credit</div>
                <div style={{ padding: '14px 12px', color: 'var(--success)', fontWeight: 800, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{totalCredit.toLocaleString('en-IN')}</div>
                <div />
              </div>
            </div>
          </div>

          {/* ── Bottom closing section ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* By Hand & Bank Closing */}
            <div className="data-card" style={{ marginBottom: 0 }}>
              <div className="data-card-header" style={{ background: 'var(--warning-light)', borderBottomColor: 'var(--warning-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', letterSpacing: '0.5px' }}>BY HAND AND BANK CLOSING</h4>
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <ClosingRow 
                      label="Cash In Hand" 
                      value={closing.cashInHand} 
                      isEditable
                      onValueChange={val => setClosing({ ...closing, cashInHand: val })}
                      badge="CASH" badgeClass="badge-green" 
                    />
                    <ClosingRow 
                      label="Bank Balance" 
                      value={closing.bankBalance} 
                      isEditable
                      onValueChange={val => setClosing({ ...closing, bankBalance: val })}
                      badge="BANK" badgeClass="badge-blue" 
                    />
                    <ClosingRow label="Total (By Hand & Bank)" value={INR(totalHandBank)} bold />
                    <ClosingRow 
                      label="Reading Calculation Total" 
                      value={closing.sheetClosing}
                      isEditable
                      onValueChange={val => setClosing({ ...closing, sheetClosing: val })}
                    />
                    <ClosingRow
                      label="Difference"
                      value={(closingDiff < 0 ? '-' : '') + INR(closingDiff)}
                      bold
                      valueColor={closingDiff === 0 ? 'var(--success)' : 'var(--danger)'}
                    />
                  </tbody>
                </table>
              </div>
              {!data.has_closing && (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--warning)', background: 'var(--warning-light)', borderTop: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠</span> No Day Book closing recorded for this date.
                </div>
              )}
            </div>

            {/* Reading / Sheet Closing */}
            <div className="data-card" style={{ marginBottom: 0 }}>
              <div className="data-card-header" style={{ background: 'var(--info-light)', borderBottomColor: 'var(--info-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', letterSpacing: '0.5px' }}>READING / SHEET CLOSING</h4>
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <ClosingRow label="Reading / Sheet Closing Total" value={INR(sheetClosing)} bold valueColor="var(--info)" />
                    <ClosingRow label="Total Debit" value={INR(totalDebit)} />
                    <ClosingRow label="Total Credit" value={INR(totalCredit)} />
                    <ClosingRow
                      label="Net Difference"
                      value={(diff < 0 ? '-' : '+') + INR(diff)}
                      bold
                      valueColor={diff === 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--gray-800)'}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, type }) {
  return (
    <div className={`stat-card ${type || ''}`}>
      <div className="stat-card-header" style={{ marginBottom: 8 }}>
        <span className="stat-card-label" style={{ fontSize: 11 }}>{label}</span>
      </div>
      <div className="stat-card-value" style={{ fontSize: 22 }}>{value}</div>
    </div>
  )
}

function ClosingRow({ label, value, bold, badge, badgeClass, valueColor, isEditable, onValueChange }) {
  return (
    <tr>
      <td style={{ fontWeight: bold ? 600 : 500, color: bold ? 'var(--gray-900)' : 'var(--gray-700)', padding: '12px 16px' }}>{label}</td>
      <td style={{ fontWeight: 600, color: valueColor || 'var(--gray-900)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, padding: '12px 16px' }}>
        {isEditable ? (
          <input 
            type="number" 
            value={value} 
            onChange={e => onValueChange(e.target.value)}
            onWheel={e => e.target.blur()}
            style={{ 
              width: '100%', maxWidth: '120px', textAlign: 'right', 
              padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--gray-300)',
              outline: 'none', fontSize: 14, fontWeight: 600, color: 'inherit'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary-400)'}
            onBlur={e => e.target.style.borderColor = 'var(--gray-300)'}
          />
        ) : (
          value
        )}
      </td>
      {badge && (
        <td style={{ width: '80px', textAlign: 'right', padding: '12px 16px' }}>
          <span className={`badge ${badgeClass}`}>{badge}</span>
        </td>
      )}
      {!badge && <td style={{ width: '80px', padding: '12px 16px' }}></td>}
    </tr>
  )
}

function TableInput({ id, value, onChange, type = "text", align = "left", placeholder = "", highlighted = false, onKeyDown, readOnly = false }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onWheel={e => e.target.blur()}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: '100%',
        padding: '6px 8px',
        textAlign: align,
        fontSize: '13px',
        fontWeight: highlighted ? '800' : 'inherit',
        color: highlighted ? 'var(--primary-700)' : 'inherit',
        background: focused && !readOnly ? 'white' : (highlighted ? 'var(--primary-50)' : 'transparent'),
        border: `1px solid ${focused && !readOnly ? 'var(--primary-400)' : 'transparent'}`,
        borderRadius: '6px',
        outline: 'none',
        boxShadow: focused && !readOnly ? '0 0 0 3px rgba(30,77,183,.1)' : 'none',
        textTransform: highlighted ? 'uppercase' : 'none',
        letterSpacing: highlighted ? '0.5px' : 'normal',
        transition: 'all 0.2s',
        cursor: readOnly ? 'default' : 'text'
      }}
      onFocus={() => !readOnly && setFocused(true)}
      onBlur={() => !readOnly && setFocused(false)}
    />
  )
}
