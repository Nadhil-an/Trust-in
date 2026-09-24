import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { accountsApi, cashierApi } from '../../api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Modal } from '../../components/shared'
import PaymentMethodSelector from '../../components/PaymentMethodSelector'
import { isValidPhone, isPositiveNumber } from '../../utils/validators'

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

  // Helpers to persist extra rows (index >= 11) across F5 / browser refresh
  const getExtraDebitKey = (d) => `ds_extra_debit_${d}`
  const getExtraCreditKey = (d) => `ds_extra_credit_${d}`
  const loadExtraDebits = (d) => { try { return JSON.parse(localStorage.getItem(getExtraDebitKey(d)) || '[]') } catch { return [] } }
  const loadExtraCredits = (d) => { try { return JSON.parse(localStorage.getItem(getExtraCreditKey(d)) || '[]') } catch { return [] } }
  const saveExtraDebits = (d, rows) => localStorage.setItem(getExtraDebitKey(d), JSON.stringify(rows))
  const saveExtraCredits = (d, rows) => localStorage.setItem(getExtraCreditKey(d), JSON.stringify(rows))

  const [isDirty, setIsDirty] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved') // 'saved' | 'saving' | 'pending'

  // Auto-save: fires immediately on every change — no delay
  const autoSaveTimerRef = useRef(null)
  const handleSaveRef = useRef(null)
  const isSavingRef = useRef(false)

  const scheduleAutoSave = useCallback(() => {
    setAutoSaveStatus('saving')
    setIsDirty(true)
    // Cancel any pending save (in case a previous save is still in-flight, queue one more)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      if (handleSaveRef.current) {
        handleSaveRef.current(true, null, null, true)
      }
    }, 0)
  }, [])

  // Tab close interceptor
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }, [])

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ category:"", date:format(new Date(),"yyyy-MM-dd"), amount:"", payee:"", purpose:"", payment_method:"CASH", account_type:"CASH", expense_id:"", remarks:"" })
  const [expenseSaving, setExpenseSaving] = useState(false)

  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [incomeForm, setIncomeForm] = useState({ source:"", date:format(new Date(),"yyyy-MM-dd"), amount:"", donor_name:"", phone:"", address:"", purpose:"", payment_method:"CASH", account_type:"CASH", reference_number:"", remarks:"" })
  const [incomeSaving, setIncomeSaving] = useState(false)

  const [showSaveWarning, setShowSaveWarning] = useState(null) // 'expense' or 'income'

  const handleOpenExpense = () => {
    setShowSaveWarning('expense')
  }

  const proceedToModal = () => {
    if (showSaveWarning === 'expense') {
      setExpenseForm({ category:"", date:date, amount:"", payee:"", purpose:"", payment_method:"CASH", account_type:"CASH", expense_id: "", remarks:"" })
      setShowExpenseModal(true)
    } else if (showSaveWarning === 'income') {
      setIncomeForm({ source:"", date:date, amount:"", donor_name:"", phone:"", address:"", purpose:"", payment_method:"CASH", account_type:"CASH", reference_number:"", remarks:"" })
      setShowIncomeModal(true)
    }
    setShowSaveWarning(null)
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!isPositiveNumber(expenseForm.amount)) return toast.error("Amount must be a positive number");
    setExpenseSaving(true)
    try { 
      await accountsApi.expenses.create(expenseForm)
      toast.success("Expense recorded.")
      setShowExpenseModal(false); 
      load() 
    }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setExpenseSaving(false) }
  }

  const handleOpenIncome = () => {
    setShowSaveWarning('income')
  }

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    if (incomeForm.phone && !isValidPhone(incomeForm.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (!isPositiveNumber(incomeForm.amount)) return toast.error("Amount must be a positive number");
    setIncomeSaving(true)
    try { 
      const fd = new FormData();
      Object.entries(incomeForm).forEach(([k, v]) => { if (v !== '') fd.append(k, v) });
      await accountsApi.income.create(fd); 

      toast.success("Income recorded!"); 
      setShowIncomeModal(false); 
      setIsDirty(true); // force load/save re-calc if needed, or just let auto-save handle it
      load(false);
    }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setIncomeSaving(false) }
  }

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await accountsApi.daySheet({ date })
      setData(res.data)
    } catch (e) {
      toast.error('Failed to load Day Sheet')
    } finally {
      if (!isBackground) setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!data) return

    const savedDebits = data.debit_rows || []
    const savedCredits = data.credit_rows || []

    // Build debit rows — preserve incomes that come from backend
    const obCash = savedDebits.find(r => r.particular === 'OB CASH') || { particular: 'OB CASH', amount: '', sc: 'CASH' }
    const obBank = savedDebits.find(r => r.particular === 'OB BANK') || { particular: 'OB BANK', amount: '', sc: 'BANK' }

    // Income entries that came from the backend (have an `id`)
    const incomes = savedDebits.filter(r => r.particular !== 'OB CASH' && r.particular !== 'OB BANK')

    const fixedRows = [
      obCash,
      obBank,
      { particular: '', amount: '', sc: 'CASH' },
      { particular: '', amount: '', sc: 'CASH' },
      { particular: 'DONATION', amount: '', sc: 'CASH' },
      { particular: 'BY CASH', amount: (data.mobile_totals && data.mobile_totals.cash > 0) ? data.mobile_totals.cash : '', sc: 'CASH' },
      { particular: 'BY ONLINE', amount: (data.mobile_totals && data.mobile_totals.online > 0) ? data.mobile_totals.online : '', sc: 'BANK' },
      { particular: '', amount: '', sc: 'CASH' },
    ]

    const dRows = [...fixedRows, ...incomes].map(r => ({ ...r, amount: r.amount != null ? r.amount : '' }))
    while (dRows.length < 11) dRows.push({ particular: '', amount: '', sc: 'CASH' })

    // ── Clean stale localStorage extras ──────────────────────────────────────
    // Remove any cached "extra" rows that are actually auto-computed or
    // are now properly tracked by the backend (have an id).
    const AUTO_PARTICULARS = new Set(['BY CASH', 'BY ONLINE', 'DONATION', 'TOTAL DONATION', 'OB CASH', 'OB BANK'])
    const backendIncomeIds = new Set(incomes.filter(r => r.id).map(r => String(r.id)))
    const backendExpenseIds = new Set(savedCredits.filter(r => r.id).map(r => String(r.id)))
    const backendIncomeParticulars = new Set(incomes.map(r => (r.particular || '').trim().toUpperCase()).filter(Boolean))
    const backendExpenseParticulars = new Set(savedCredits.map(r => (r.particular || '').trim().toUpperCase()).filter(Boolean))

    const cleanExtras = (rows) => rows.filter(r => {
      const p = (r.particular || '').trim().toUpperCase()
      if (AUTO_PARTICULARS.has(p)) return false  // auto-computed, never cache
      if (r.id && (backendIncomeIds.has(String(r.id)) || backendExpenseIds.has(String(r.id)))) return false
      if (backendIncomeParticulars.has(p) || backendExpenseParticulars.has(p)) return false // match backend names
      return true
    })

    const rawDExtras = loadExtraDebits(date)
    const cleanDExtras = cleanExtras(rawDExtras)
    if (cleanDExtras.length !== rawDExtras.length) saveExtraDebits(date, cleanDExtras)  // purge stale
    const dExtras = cleanDExtras.map(r => ({ ...r, isExtra: true }))
    setDebits([...dRows, ...dExtras])

    const rawCExtras = loadExtraCredits(date)
    const cleanCExtras = cleanExtras(rawCExtras)
    if (cleanCExtras.length !== rawCExtras.length) saveExtraCredits(date, cleanCExtras)  // purge stale
    const cExtras = cleanCExtras.map(r => ({ ...r, isExtra: true }))

    // Build credit rows — always from server data
    const cRows = savedCredits.map(r => ({ ...r, amount: r.amount != null ? r.amount : '' }))
    while (cRows.length < 11) cRows.push({ particular: '', amount: '', sc: 'CASH' })
    setCredits([...cRows, ...cExtras])

    // Restore closing balances
    setClosing({
      cashInHand: data.has_closing ? (data.physical_cash != null ? data.physical_cash : '') : '',
      bankBalance: data.has_closing ? (data.physical_bank != null ? data.physical_bank : '') : '',
      sheetClosing: data.has_closing ? (data.sheet_closing != null ? data.sheet_closing : '') : ''
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
          ${i === 4 
            ? `<td colspan="3" class="bold" style="text-align: left; padding-left: 12px; color: #15803d; font-size: 14px; letter-spacing: 2px; background-color: #dcfce7;">DONATION</td>`
            : i === 7
            ? `<td class="bold right" style="color: #0369a1; padding-right: 12px;">TOTAL DONATION</td>
               <td class="bold right" style="color: #0369a1;">${formatAmt(Number(debits[5]?.amount || 0) + Number(debits[6]?.amount || 0))}</td>
               <td></td>`
            : `<td>${d.particular || ''}</td>
               <td class="right">${formatAmt(d.amount)}</td>
               <td class="center">${d.sc || ''}</td>`
          }
          
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
            .header-debit { background-color: #dcfce7; color: #15803d; text-align: center; font-size: 14px; font-weight: bold; }
            .header-credit { background-color: #e0f2fe; color: #0369a1; text-align: center; font-size: 14px; font-weight: bold; }
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
                <th colspan="3" class="header-debit">CREDIT</th>
                <th colspan="3" class="header-credit">DEBIT</th>
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
                <td class="right">TOTAL CREDIT</td>
                <td class="right" style="color: #15803d;">${formatAmt(totalCreditSum)}</td>
                <td></td>
                <td class="right">TOTAL DEBIT</td>
                <td class="right" style="color: #0369a1;">${formatAmt(totalDebitSum)}</td>
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
                  <tr><td>Total Credit</td><td class="right">${formatAmt(totalCreditSum)}</td></tr>
                  <tr><td>Total Debit</td><td class="right">${formatAmt(totalDebitSum)}</td></tr>
                  <tr class="bold"><td>Profit / Loss</td><td class="right" style="color: ${totalValue > 0 ? '#15803d' : (totalValue < 0 ? '#b91c1c' : 'inherit')}">${totalValue > 0 ? '+' + formatAmt(totalValue) + ' (Profit)' : (totalValue < 0 ? '-' + formatAmt(Math.abs(totalValue)) + ' (Loss)' : '0')}</td></tr>
                  <tr class="bold"><td>Shortage / Excess</td><td class="right" style="color: ${!hasAllClosingInputs ? '#6b7280' : (netDiff < 0 ? '#dc2626' : (netDiff > 0 ? '#16a34a' : 'inherit'))}">${!hasAllClosingInputs ? '—' : (netDiff > 0 ? '+' + formatAmt(netDiff) + ' (Excess)' : (netDiff < 0 ? '-' + formatAmt(Math.abs(netDiff)) + ' (Shortage)' : '0'))}</td></tr>
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

  const handleSave = async (isBackground = false, overrideDebits = null, overrideCredits = null, skipReload = false) => {
    try {
      const rawDebits = overrideDebits ?? debits
      const rawCredits = overrideCredits ?? credits

      // Only skip the truly auto-computed fixed rows.
      // Fixed rows: 2, 3 (blank padding), 4 (DONATION), 5 (BY CASH), 6 (BY ONLINE), 7 (total-donation)
      // We allow indices 0 (OB CASH) and 1 (OB BANK) so users can manually override them.
      const SKIP_INDICES = new Set([2, 3, 4, 5, 6, 7])
      const AUTO_PARTICULARS = new Set(['BY CASH', 'BY ONLINE', 'DONATION', 'TOTAL DONATION'])

      const payloadDebits = rawDebits
        .map((d, i) => ({ ...d, _origIdx: i }))
        .filter((d) => {
          // Always skip auto-computed header rows
          if (SKIP_INDICES.has(d._origIdx)) return false
          const p = (d.particular || '').trim().toUpperCase()
          if (AUTO_PARTICULARS.has(p)) return false
          // Keep rows even if they have an ID so they don't get deleted by the backend
          return true
        })
        .map(({ _origIdx, isExtra, ...d }) => d) // strip internal flags

      const payloadCredits = rawCredits
        .filter((c) => {
          // Keep rows even if they have an ID so they don't get deleted by the backend
          return true
        })
        .map(({ isExtra, ...c }) => c) // strip internal flags

      await cashierApi.cashClosing.create({
        date,
        physical_cash: closing.cashInHand || 0,
        physical_bank: closing.bankBalance || 0,
        debit_rows: payloadDebits,
        credit_rows: payloadCredits
      })
      
      setIsDirty(false)
      setAutoSaveStatus('saved')

      if (!isBackground) {
        toast.success("Closing balances saved successfully!")
        if (!skipReload) load(true)
      }
    } catch (e) {
      setAutoSaveStatus('pending')
      if (!isBackground) toast.error('Failed to save data')
    }
  }

  // Update the ref so the debounce timer always has the latest state closures
  useEffect(() => {
    handleSaveRef.current = handleSave;
  })

  const totalCreditSum = debits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const totalDebitSum = credits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const totalValue = totalCreditSum - totalDebitSum
  const totalHandBank = (Number(closing.cashInHand) || 0) + (Number(closing.bankBalance) || 0)
  const netDiff = totalHandBank - totalValue
  const hasAllClosingInputs = closing.cashInHand !== '' && closing.cashInHand != null && closing.bankBalance !== '' && closing.bankBalance != null
  const sheetClosing = Number(closing.sheetClosing) || 0
  const closingDiff = totalHandBank - sheetClosing

  const handleExport = () => {
    if (!data) return
    const rows = []
    rows.push(['DAY SHEET — ' + date])
    rows.push([])
    rows.push(['CREDIT', '', '', '', 'DEBIT', '', ''])
    rows.push(['SL', 'Particular', 'Amount (₹)', 'SC', 'SL', 'Particular', 'Amount (₹)', 'SC'])
    const maxLen = Math.max(debits.length, credits.length)
    for (let i = 0; i < maxLen; i++) {
      const d = debits[i]
      const c = credits[i]
      const creditRow = i === 4 
        ? [i + 1, 'DONATION', '', '']
        : i === 7
        ? [i + 1, 'TOTAL DONATION', Number(debits[5]?.amount || 0) + Number(debits[6]?.amount || 0), '']
        : [i + 1, d ? d.particular : '', d ? d.amount : '', d ? d.sc : '']

      rows.push([
        ...creditRow,
        i + 1, c ? c.particular : '', c ? c.amount : '', c ? c.sc : '',
      ])
    }
    rows.push(['', 'Total', totalCreditSum, '', '', 'Total', totalDebitSum, ''])
    rows.push([])
    rows.push(['BY HAND AND BANK CLOSING'])
    rows.push(['Cash In Hand', closing.cashInHand, 'CASH'])
    rows.push(['Bank Balance', closing.bankBalance, 'BANK'])
    rows.push(['Total (By Hand & Bank)', totalHandBank])

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
          <button onClick={handleOpenIncome} className="btn btn-secondary" style={{ color: 'var(--success)', fontWeight: 600 }}>+ Add Income</button>
          <button onClick={handleOpenExpense} className="btn btn-secondary" style={{ color: 'var(--danger)', fontWeight: 600 }}>+ Add Expense</button>
          <button onClick={load} className="btn btn-secondary">↺ Refresh</button>
          <button onClick={handlePrint} className="btn btn-secondary">🖨 Print</button>
          <button onClick={handleExport} className="btn btn-secondary">⬇ Export Excel</button>
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
            <StatCard label="Total Credit" value={INR(totalCreditSum)} type="success" />
            <StatCard label="Total Debit" value={INR(totalDebitSum)} type="danger" />
            <StatCard label="Profit / Loss" value={totalValue > 0 ? `+${INR(totalValue)} (Profit)` : (totalValue < 0 ? `-${INR(Math.abs(totalValue))} (Loss)` : INR(0))} type={totalValue > 0 ? "success" : (totalValue < 0 ? "danger" : "")} />
            <StatCard label="Shortage / Excess" value={!hasAllClosingInputs ? '—' : (netDiff > 0 ? `+${INR(netDiff)} (Excess)` : (netDiff < 0 ? `-${INR(Math.abs(netDiff))} (Shortage)` : INR(0)))} type={!hasAllClosingInputs ? "" : (netDiff > 0 ? "success" : (netDiff < 0 ? "danger" : ""))} />
          </div>

          {/* ── Main Day Sheet table ── */}
          <div className="data-card" ref={printRef} style={{ marginBottom: 0 }} onChange={() => setIsDirty(true)}>
            {/* Column headers: CREDIT | DEBIT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--gray-200)' }}>
              <div style={{ background: 'var(--success-light)', color: 'var(--success)', textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '12px', borderRight: '1px solid var(--gray-200)', letterSpacing: '1px' }}>CREDIT</div>
              <div style={{ background: 'var(--info-light)', color: 'var(--info)', textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '12px', letterSpacing: '1px' }}>DEBIT</div>
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

            {/* Data rows — rendered as two independent columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

              {/* ── CREDIT column (left) ── */}
              <div style={{ borderRight: '1px solid var(--gray-200)' }}>
                {debits.map((d, i) => {
                  const bg = i % 2 === 0 ? 'var(--white)' : 'var(--gray-50)'
                  const isFixed = !d.isExtra
                  return (
                    <div key={`d-${i}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 130px 90px', background: bg, minHeight: 42 }}>
                      {/* Delete / index cell */}
                      <div style={{ ...SH.td, color: 'var(--gray-400)', padding: '4px 2px' }}>
                        {/* Remove button disabled */}
                      </div>
                      {/* Content */}
                      {i === 4 ? (
                        <div style={{ gridColumn: '2 / 5', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '8px', fontWeight: 800, fontSize: 16, color: 'var(--success)', letterSpacing: '2px', borderBottom: '1px solid var(--gray-100)', background: 'var(--success-light)' }}>
                          DONATION
                        </div>
                      ) : i === 7 ? (
                        <>
                          <div style={{ ...SH.tdL, justifyContent: 'flex-end', paddingRight: '12px', background: 'var(--primary-50)' }}>
                            <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 12, letterSpacing: '0.5px' }}>TOTAL DONATION</span>
                          </div>
                          <div style={{ ...SH.tdR, background: 'var(--primary-50)' }}>
                            <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 15 }}>
                              {(Number(debits[5]?.amount || 0) + Number(debits[6]?.amount || 0)).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div style={{ ...SH.td, background: 'var(--primary-50)' }}></div>
                        </>
                      ) : (
                        <>
                          <div style={{ ...SH.tdL }}>
                            <TableInput
                              value={d.particular || ''}
                              onChange={() => {}}
                              readOnly={true}
                              highlighted={i === 5 || i === 6}
                              placeholder=""
                            />
                          </div>
                          <div style={{ ...SH.tdR }}>
                            <TableInput
                              type="number" align="right"
                              value={d.amount || ''}
                              onChange={() => {}}
                              readOnly={true}
                              placeholder=""
                            />
                          </div>
                          <div style={{ ...SH.td, padding: '4px' }}>
                            <div style={{ position: 'relative', width: '100%', opacity: 0.7 }}>
                              <select
                                value={d.sc || 'CASH'}
                                disabled={true}
                                onChange={() => {}}
                                style={{ background: d.sc === 'BANK' ? 'var(--primary-100)' : 'var(--success-light)', color: d.sc === 'BANK' ? 'var(--primary-700)' : 'var(--success)', border: 'none', borderRadius: '12px', padding: '4px 16px 4px 8px', fontSize: 10, fontWeight: 700, outline: 'none', cursor: 'default', appearance: 'none', width: '100%' }}
                              >
                                <option value="CASH">CASH</option>
                                <option value="BANK">BANK</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
                {/* Add Credit Row button removed */}
              </div>

              {/* ── DEBIT column (right) ── */}
              <div>
                {credits.map((c, i) => {
                  const bg = i % 2 === 0 ? 'var(--white)' : 'var(--gray-50)'
                  const isFixed = !c.isExtra
                  return (
                    <div key={`c-${i}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 130px 90px', background: bg, minHeight: 42 }}>
                      <div style={{ ...SH.td, color: 'var(--gray-400)', padding: '4px 2px' }}>
                        {/* No remove button */}
                      </div>
                      <div style={{ ...SH.tdL }}>
                        <TableInput
                          value={c.particular || ''}
                          onChange={() => {}}
                          readOnly={true}
                          placeholder=""
                        />
                      </div>
                      <div style={{ ...SH.tdR }}>
                        <TableInput
                          type="number" align="right"
                          value={c.amount || ''}
                          onChange={() => {}}
                          readOnly={true}
                          placeholder=""
                        />
                      </div>
                      <div style={{ ...SH.td, padding: '4px' }}>
                        <div style={{ position: 'relative', width: '100%', opacity: 0.7 }}>
                          <select
                            value={c.sc || 'CASH'}
                            disabled={true}
                            onChange={() => {}}
                            style={{ background: c.sc === 'BANK' ? 'var(--primary-100)' : 'var(--success-light)', color: c.sc === 'BANK' ? 'var(--primary-700)' : 'var(--success)', border: 'none', borderRadius: '12px', padding: '4px 16px 4px 8px', fontSize: 10, fontWeight: 700, outline: 'none', cursor: 'default', appearance: 'none', width: '100%' }}
                          >
                            <option value="CASH">CASH</option>
                            <option value="BANK">BANK</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {/* Add Debit Row button removed */}
              </div>

            </div>

            {/* Total row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--gray-100)', borderTop: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px', borderRight: '1px solid var(--gray-200)' }}>
                <div style={{ gridColumn: '1/3', padding: '14px 16px', color: 'var(--gray-700)', fontWeight: 700, fontSize: 13, textAlign: 'right', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Credit</div>
                <div style={{ padding: '14px 12px', color: 'var(--gray-900)', fontWeight: 800, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{totalCreditSum.toLocaleString('en-IN')}</div>
                <div />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 130px 90px' }}>
                <div style={{ gridColumn: '1/3', padding: '14px 16px', color: 'var(--gray-700)', fontWeight: 700, fontSize: 13, textAlign: 'right', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Debit</div>
                <div style={{ padding: '14px 12px', color: 'var(--gray-900)', fontWeight: 800, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{totalDebitSum.toLocaleString('en-IN')}</div>
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
                      onValueChange={val => { setClosing({ ...closing, cashInHand: val }); scheduleAutoSave() }}
                      badge="CASH" badgeClass="badge-green"
                    />
                    <ClosingRow
                      label="Bank Balance"
                      value={closing.bankBalance}
                      isEditable
                      onValueChange={val => { setClosing({ ...closing, bankBalance: val }); scheduleAutoSave() }}
                      badge="BANK" badgeClass="badge-blue"
                    />
                    <ClosingRow label="Total (By Hand & Bank)" value={INR(totalHandBank)} bold />
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
            <div className="data-card" style={{ marginBottom: 0 }} onChange={() => setIsDirty(true)}>
              <div className="data-card-header" style={{ background: 'var(--info-light)', borderBottomColor: 'var(--info-light)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', letterSpacing: '0.5px' }}>READING / SHEET CLOSING</h4>
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <ClosingRow label="Total Credit" value={INR(totalCreditSum)} />
                    <ClosingRow label="Total Debit" value={INR(totalDebitSum)} />
                    <ClosingRow label="Profit / Loss" value={totalValue > 0 ? `+${INR(totalValue)} (Profit)` : (totalValue < 0 ? `-${INR(Math.abs(totalValue))} (Loss)` : INR(0))} bold valueColor={totalValue > 0 ? 'var(--success)' : (totalValue < 0 ? 'var(--danger)' : 'var(--gray-900)')} />
                    <ClosingRow
                      label="Shortage / Excess"
                      value={!hasAllClosingInputs ? '—' : (netDiff > 0 ? `+${INR(netDiff)} (Excess)` : (netDiff < 0 ? `-${INR(Math.abs(netDiff))} (Shortage)` : INR(0)))}
                      bold
                      valueColor={!hasAllClosingInputs ? 'var(--gray-500)' : (netDiff === 0 ? 'var(--success)' : netDiff < 0 ? 'var(--danger)' : 'var(--success)')}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {showSaveWarning && (
        <Modal isOpen={true} onClose={() => setShowSaveWarning(null)} title="Day Book Auto-Saving" size="modal-md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowSaveWarning(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={proceedToModal}>Proceed</button>
            </>
          }
        >
          <div style={{ padding: '24px 20px', textAlign: 'center', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ marginBottom: '12px', color: '#b45309', fontWeight: 800 }}>Day Book is Auto-Saving</h3>
            <p style={{ color: '#92400e', lineHeight: '1.6', fontSize: 14 }}>
              The Day Book is auto-saving your work every 2 seconds. Wait for the status badge to show <strong>✔ Auto Saved</strong> before proceeding to avoid losing data in unsaved fields.
            </p>
          </div>
        </Modal>
      )}

      {showExpenseModal && (
        <Modal isOpen={true} onClose={()=>setShowExpenseModal(false)} title="Add Expense Record" size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowExpenseModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="ds-expense-form" type="submit" disabled={expenseSaving}>{expenseSaving?"Saving...":"Save"}</button></>}>
          <form id="ds-expense-form" onSubmit={handleSaveExpense}>
            <div className="form-grid-2">
              {[["date","Date","date"],["payee","Payee","text"],["amount","Amount (₹)","number"],["expense_id","Bill Number","text"]].map(([k,l,t])=>(
                <div className="form-group" key={k}><label className={`form-label${["date","payee","amount","expense_id"].includes(k)?" required":""}`}>{l}</label>
                  <input className="form-control" type={t} value={expenseForm[k]} required={["date","payee","amount"].includes(k)} onChange={e=>setExpenseForm(f=>({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="form-group"><label className="form-label">Category</label>
                <input className="form-control" type="text" value={expenseForm.category} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Office, Travel" /></div>
              <div className="form-group"><label className="form-label">Payment Method</label>
                <PaymentMethodSelector value={expenseForm.payment_method} onChange={v=>setExpenseForm(f=>({...f,payment_method:v,account_type:v==="CASH"?"CASH":"BANK"}))} options={["CASH","CHEQUE","NEFT","UPI","OTHER"]} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" rows={2} value={expenseForm.purpose} onChange={e=>setExpenseForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {showIncomeModal && (
        <Modal isOpen={true} onClose={()=>setShowIncomeModal(false)} title="Add Income Record" size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowIncomeModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="ds-income-form" type="submit" disabled={incomeSaving}>{incomeSaving?"Saving...":"Save"}</button></>}>
          <form id="ds-income-form" onSubmit={handleSaveIncome}>
            <div className="form-grid-2">
              {[["source","Income Source","text",null],
                ["date","Date","date",null],["amount","Amount (₹)","number",null],["donor_name","Donor/Payer Name","text",null],
                ["phone","Phone","text",null],["payment_method","Payment Method","select",["CASH","CHEQUE","DD","NEFT","RTGS","IMPS","UPI"]],
                ["account_type","Account Type","select",["CASH","BANK"]],["reference_number","Reference Number","text",null]].map(([k,l,t,opts])=>(
                <div className="form-group" key={k}>
                  <label className={`form-label ${["date","amount"].includes(k)?"required":""}`}>{l}</label>
                  {k === "payment_method" ? (
                    <PaymentMethodSelector 
                      value={incomeForm[k]} 
                      onChange={v=>setIncomeForm(f=>({...f,[k]:v,account_type:v==="CASH"?"CASH":"BANK"}))} 
                      options={opts} 
                    />
                  ) : t==="select" ? (
                    <select className="form-control" name={k} value={incomeForm[k]} onChange={e=>setIncomeForm(f=>({...f,[k]:e.target.value}))}>
                      {opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="form-control" type={t} name={k} value={incomeForm[k]} onChange={e=>setIncomeForm(f=>({...f,[k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value}))} required={["date","amount"].includes(k)} />
                  )}
                </div>
              ))}
              <div className="form-group"><label className="form-label">Address</label>
                <textarea className="form-control" name="address" rows={2} value={incomeForm.address} onChange={e=>setIncomeForm(f=>({...f,address:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" name="purpose" rows={2} value={incomeForm.purpose} onChange={e=>setIncomeForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
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
            onChange={e => {
              let val = e.target.value;
              if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                val = val.replace(/^0+/, '');
              }
              onValueChange(val);
            }}
            onWheel={e => e.target.blur()}
            style={{
              width: '100%', maxWidth: '120px', textAlign: 'right',
              padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--gray-300)',
              outline: 'none', fontSize: 14, fontWeight: 600, color: 'inherit'
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary-400)'; e.target.select(); }}
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

function TableInput({ id, value, onChange, type = "text", align = "left", placeholder = "", highlighted = false, onKeyDown, readOnly = false, onBlur }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => {
        let val = e.target.value;
        if (type === 'number' && val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
          val = val.replace(/^0+/, '');
        }
        onChange(val);
      }}
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
      onFocus={e => {
        if (!readOnly) {
          setFocused(true);
          e.target.select();
        }
      }}
      onBlur={(e) => {
        if (!readOnly) {
          setFocused(false);
          if (onBlur) onBlur(e);
        }
      }}
    />
  )
}
