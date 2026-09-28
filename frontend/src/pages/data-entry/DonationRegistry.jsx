import React, { useState, useEffect, useRef, useMemo } from 'react'
import { accountsApi, coreApi } from '../../api'
import { PageHeader, formatINR, Modal, ConfirmModal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_DONATION = {
  reference_number: '',
  donor_name: '',
  phone: '',
  place: '',
  amount: '',
  payment_method: 'CASH',
}

export default function DonationRegistry() {
  const [users, setUsers] = useState([])
  
  // Batch Context
  const [batch, setBatch] = useState(() => {
    const saved = localStorage.getItem('donation_registry_batch')
    if (saved) return JSON.parse(saved)
    return {
      staff_id: '',
      bill_book_no: '',
      date: format(new Date(), 'yyyy-MM-dd')
    }
  })

  // Ledger state
  const [forms, setForms] = useState(() => {
    const saved = localStorage.getItem('donation_registry_forms')
    if (saved) return JSON.parse(saved)
    return [{ ...EMPTY_DONATION }]
  })
  
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  const fetchSessionHistory = async () => {
    if (!batch.staff_id || !batch.date) {
      setHistory([])
      return
    }
    try {
      const res = await accountsApi.income.list({
        created_by: batch.staff_id,
        date: batch.date,
        source: 'DONATION'
      })
      setHistory(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch history', err)
    }
  }

  useEffect(() => {
    fetchSessionHistory()
  }, [batch.staff_id, batch.date])

  const [showHistoryModal, setShowHistoryModal] = useState(sessionStorage.getItem('donation_registry_history_open') === 'true')

  useEffect(() => {
    sessionStorage.setItem('donation_registry_history_open', showHistoryModal)
  }, [showHistoryModal])

  const [historyFilters, setHistoryFilters] = useState({ staff_id: '', date: '', voucher: '', bill_book_no: '' })
  const prevHistoryFiltersRef = useRef(historyFilters)
  const skipNextFetchRef = useRef(false)
  const [historyData, setHistoryData] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const handleEditStart = (item) => {
    setEditingId(item.id)
    setEditData({
      reference_number: item.reference_number || '',
      bill_book_no: item.bill_book_no || '',
      date: item.date ? format(new Date(item.date), 'yyyy-MM-dd') : '',
      donor_name: item.donor_name || '',
      donor_phone: item.donor_phone || '',
      place: item.place || '',
      payment_method: item.payment_method || 'CASH',
      amount: item.amount || ''
    })
  }

  const handleEditSave = async (id) => {
    try {
      await accountsApi.income.update(id, editData)
      toast.success('Successfully updated record!')
      setEditingId(null)
      fetchHistory()
    } catch (err) {
      toast.error('Failed to update record')
    }
  }

  const handleDelete = async (id) => {
    try {
      await accountsApi.income.delete(id)
      toast.success('Successfully deleted record!')
      fetchHistory()
    } catch (err) {
      toast.error('Failed to delete record')
    }
  }

  const fetchHistory = async (filters) => {
    const activeFilters = filters || historyFilters
    setLoadingHistory(true)
    try {
      let data = []
      let newFilters = { ...activeFilters }
      let updateFilters = false

      if (activeFilters.voucher) {
        // Step 1: Global search for the voucher
        const searchRes = await accountsApi.income.list({ source: 'DONATION', search: activeFilters.voucher })
        const searchData = searchRes.data.results || searchRes.data || []
        
        if (searchData.length > 0) {
          const found = searchData[0]
          const foundDate = found.date ? format(new Date(found.date), 'yyyy-MM-dd') : ''
          
          if (String(found.created_by) !== String(activeFilters.staff_id) || 
              foundDate !== activeFilters.date || 
              (found.bill_book_no && found.bill_book_no !== activeFilters.bill_book_no)) {
             
             newFilters = {
                ...activeFilters,
                staff_id: String(found.created_by) || '',
                date: foundDate || activeFilters.date,
                bill_book_no: found.bill_book_no || activeFilters.bill_book_no
             }
             updateFilters = true
          }
          
          // Step 2: Fetch the full book based on what we found!
          const bookParams = { source: 'DONATION' }
          if (found.bill_book_no) {
             bookParams.bill_book_no = found.bill_book_no
          } else {
             bookParams.created_by = found.created_by
             if (foundDate) bookParams.date = foundDate
          }
          const bookRes = await accountsApi.income.list(bookParams)
          data = bookRes.data.results || bookRes.data || []
        }
      } else {
        const params = { source: 'DONATION' }
        if (activeFilters.bill_book_no) {
          params.bill_book_no = activeFilters.bill_book_no
        } else {
          if (activeFilters.staff_id) params.created_by = activeFilters.staff_id
          if (activeFilters.date) params.date = activeFilters.date
        }
        
        const res = await accountsApi.income.list(params)
        data = res.data.results || res.data || []
      }
      
      if (updateFilters) {
        setHistoryFilters(newFilters)
      }
      
      setHistoryData(data)
    } catch (err) {
      toast.error('Failed to load history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const openHistoryModal = (overrideDate) => {
    const targetDate = overrideDate || batch.date || ''
    const newFilters = { staff_id: '', date: targetDate, voucher: '', bill_book_no: '' }
    skipNextFetchRef.current = true  // prevent the historyFilters effect from double-fetching
    setHistoryFilters(newFilters)
    setShowHistoryModal(true)
    fetchHistory(newFilters)
  }

  useEffect(() => {
    if (showHistoryModal) {
      if (skipNextFetchRef.current) {
        skipNextFetchRef.current = false
        return
      }
      fetchHistory(historyFilters)
    }
  }, [historyFilters])

  useEffect(() => {
    localStorage.setItem('donation_registry_batch', JSON.stringify(batch))
  }, [batch])

  useEffect(() => {
    localStorage.setItem('donation_registry_forms', JSON.stringify(forms))
  }, [forms])

  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      let data = res.data.results || res.data || []
      data = data.filter(u => u.full_name?.toLowerCase() !== 'hr' && u.username?.toLowerCase() !== 'hr')
      setUsers(data)
    }).catch(err => console.error(err))
  }, [])

  const setB = (k, v) => setBatch(b => ({ ...b, [k]: v }))
  
  const updateForm = (index, k, v) => {
    setForms(prev => {
      const newForms = [...prev]
      newForms[index] = { ...newForms[index], [k]: v }
      return newForms
    })
  }

  const addRow = () => {
    if (forms.length >= 30) {
      toast.error('Maximum 30 entries allowed at a time.')
      return
    }
    const lastRow = forms[forms.length - 1]
    if (!lastRow.amount || parseFloat(lastRow.amount) <= 0) {
      toast.error('Please enter a valid amount before adding a new row.')
      return
    }
    
    const lastVoucher = lastRow.reference_number
    let nextVoucher = ''
    if (lastVoucher && !isNaN(parseInt(lastVoucher))) {
      nextVoucher = String(parseInt(lastVoucher) + 1)
    }
    setForms(prev => [...prev, { ...EMPTY_DONATION, reference_number: nextVoucher }])
  }

  const removeRow = (index) => {
    if (forms.length === 1) {
      setForms([{ ...EMPTY_DONATION }])
      return
    }
    setForms(prev => prev.filter((_, i) => i !== index))
  }

  // Handle Enter key navigation for the top batch fields
  const handleBatchKeyDown = (e) => {
    if (e.key === 'Enter' && ['INPUT', 'SELECT'].includes(e.target.tagName)) {
      e.preventDefault()
      const container = e.currentTarget
      const inputs = Array.from(container.querySelectorAll('input, select'))
      const index = inputs.indexOf(e.target)
      
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus()
      } else {
        // Move to the first input of the ledger
        const firstRow = document.getElementById('row-0')
        if (firstRow) {
          const firstInput = firstRow.querySelector('input')
          if (firstInput) firstInput.focus()
        }
      }
    }
  }

  // Handle Enter key navigation for ledger rows
  const handleRowKeyDown = (e, index) => {
    if (e.key === 'Enter' && ['INPUT', 'SELECT'].includes(e.target.tagName)) {
      e.preventDefault()
      
      // Amount validation check when pressing enter from the amount field
      if (e.target.type === 'number') {
        const currentAmount = forms[index].amount
        if (!currentAmount || parseFloat(currentAmount) <= 0) {
          toast.error('Please enter a valid amount before proceeding.')
          return
        }
      }

      const rowNode = e.currentTarget
      const inputs = Array.from(rowNode.querySelectorAll('input, select'))
      const inputIndex = inputs.indexOf(e.target)
      
      if (inputIndex > -1 && inputIndex < inputs.length - 1) {
        inputs[inputIndex + 1].focus()
      } else {
        // We are on the last input of the row (Payment Mode)
        if (index === forms.length - 1) {
          if (forms.length >= 30) {
            toast.error('Maximum 30 entries allowed at a time.')
            return
          }
          const currentRow = forms[index]
          if (!currentRow.amount || parseFloat(currentRow.amount) <= 0) {
            toast.error('Please enter a valid amount before continuing.')
            return
          }
          const lastVoucher = currentRow.reference_number
          let nextVoucher = ''
          if (lastVoucher && !isNaN(parseInt(lastVoucher))) {
            nextVoucher = String(parseInt(lastVoucher) + 1)
          }
          setForms(prev => [...prev, { ...EMPTY_DONATION, reference_number: nextVoucher }])
          setTimeout(() => {
            const nextRow = document.getElementById(`row-${index + 1}`)
            if (nextRow) {
              const firstInput = nextRow.querySelector('input')
              if (firstInput) firstInput.focus()
            }
          }, 50)
        } else {
           const nextRow = document.getElementById(`row-${index + 1}`)
            if (nextRow) {
              const firstInput = nextRow.querySelector('input')
              if (firstInput) firstInput.focus()
            }
        }
      }
    }
  }

  const handleSaveAll = async () => {
    if (!batch.staff_id) return toast.error('Please select a Staff Member for the batch')
    
    // Strip trailing empty forms
    let formList = [...forms]
    while (formList.length > 1) {
      const last = formList[formList.length - 1]
      if (!last.amount && !last.donor_name && !last.phone && !last.place) {
        formList.pop()
      } else {
        break
      }
    }

    // Validate all remaining forms
    for (let i = 0; i < formList.length; i++) {
       const f = formList[i]
       if (!f.amount || parseFloat(f.amount) <= 0) {
          return toast.error(`Row ${i + 1} is missing a valid amount.`)
       }
       if (!f.reference_number) {
          return toast.error(`Row ${i + 1} is missing a voucher number.`)
       }
       if (f.phone && f.phone.length !== 10) {
         return toast.error(`Row ${i + 1} has an invalid phone number.`)
       }
    }

    if (formList.length === 0) return toast.error('No valid entries to save')
    
    const vouchers = formList.map(f => f.reference_number)
    const duplicates = vouchers.filter((item, index) => vouchers.indexOf(item) !== index)
    if (duplicates.length > 0) {
      return toast.error(`Duplicate vouchers in your list: ${[...new Set(duplicates)].join(', ')}`)
    }

    setSaving(true)
    
    // Validate against database
    for (let i = 0; i < formList.length; i++) {
       try {
         const dupRes = await accountsApi.income.list({ reference_number: formList[i].reference_number, source: 'DONATION' })
         const dupData = dupRes.data.results || dupRes.data || []
         if (dupData.length > 0) {
           setSaving(false)
           return toast.error(`Voucher number ${formList[i].reference_number} already exists in the database!`)
         }
       } catch (err) {
         setSaving(false)
         return toast.error('Failed to validate voucher numbers with the server.')
       }
    }

    let processedCount = 0
    let successItems = []
    
    // Save sequentially to avoid bombarding and maintain physical voucher order
    for (let i = 0; i < formList.length; i++) {
      const form = formList[i]
      const currentVoucher = form.reference_number
      
      try {
        const fd = new FormData()
        fd.append('source', 'DONATION')
        fd.append('staff_id', batch.staff_id)
        fd.append('date', batch.date)
        fd.append('reference_number', currentVoucher)
        fd.append('amount', form.amount)
        fd.append('payment_method', form.payment_method)
        if (form.donor_name) fd.append('donor_name', form.donor_name)
        if (form.phone) fd.append('donor_phone', form.phone)
        if (form.place) fd.append('place', form.place)
        if (batch.bill_book_no) fd.append('bill_book_no', batch.bill_book_no)

        const res = await accountsApi.income.create(fd)
        successItems.push(res.data)
        processedCount++
      } catch (err) {
        toast.error(`Failed to save row ${i + 1}: ${err.response?.data?.message || err.message}`)
        break
      }
    }
    
    setSaving(false)
    if (processedCount > 0) {
      toast.success(`Successfully saved ${processedCount} entries!`)
      
      // Remove successfully processed forms
      const remainingForms = formList.slice(processedCount)
      if (remainingForms.length === 0) {
        setForms([{ ...EMPTY_DONATION }])
      } else {
        setForms(remainingForms)
      }
      
      // Clear batch fields
      setBatch({ staff_id: '', bill_book_no: '', date: '' })
      
      // Refresh the table with server data
      fetchSessionHistory()
      // Also refresh the history modal data if it's open
      if (showHistoryModal) {
        const currentFilters = { staff_id: '', date: batch.date || '', voucher: '', bill_book_no: '' }
        setHistoryFilters(currentFilters)
        fetchHistory(currentFilters)
      }
    }
  }

  const handleCancel = () => {
    if (!window.confirm('Are you sure you want to clear all current entries?')) return
    setForms([{ ...EMPTY_DONATION }])
    setBatch({ staff_id: '', bill_book_no: '', date: '' })
    const firstRow = document.getElementById('row-0')
    if (firstRow) {
      const firstInput = firstRow.querySelector('input')
      if (firstInput) firstInput.focus()
    }
  }

  const cashTotal = forms.reduce((sum, form) => sum + (form.payment_method === 'CASH' ? parseFloat(form.amount || 0) : 0), 0)
  const onlineTotal = forms.reduce((sum, form) => sum + (form.payment_method !== 'CASH' ? parseFloat(form.amount || 0) : 0), 0)
  const grandTotal = cashTotal + onlineTotal

  const historyCashTotal = historyData.reduce((sum, item) => sum + (item.payment_method === 'CASH' ? parseFloat(item.amount || 0) : 0), 0)
  const historyOnlineTotal = historyData.reduce((sum, item) => sum + (item.payment_method !== 'CASH' ? parseFloat(item.amount || 0) : 0), 0)
  const historyGrandTotal = historyCashTotal + historyOnlineTotal

  const staffSummary = useMemo(() => {
    if (historyFilters.staff_id) return null;
    const summary = {};
    historyData.forEach(item => {
      const staffId = item.created_by;
      if (!summary[staffId]) {
        summary[staffId] = {
          staff_id: staffId,
          cash: 0,
          online: 0,
          total: 0,
          count: 0
        };
      }
      const amount = parseFloat(item.amount || 0);
      summary[staffId].total += amount;
      if ((item.payment_method || '').toUpperCase() === 'CASH') {
        summary[staffId].cash += amount;
      } else {
        summary[staffId].online += amount;
      }
      summary[staffId].count += 1;
    });
    return Object.values(summary).sort((a, b) => b.total - a.total);
  }, [historyData, historyFilters.staff_id]);

  // Print-specific calculated details
  const printStaffName = historyFilters.staff_id ? (users.find(u => u.id == historyFilters.staff_id)?.full_name || '—') : 'All Staff';
  const printDate = historyFilters.date ? format(new Date(historyFilters.date + 'T00:00:00'), 'dd-MM-yyyy') : 'All Dates';
  const printBookNo = historyFilters.bill_book_no || 'All Books';
  
  let printStartNo = '—';
  let printEndNo = '—';
  if (historyData.length > 0) {
    const sorted = [...historyData].filter(i => !isNaN(parseInt(i.reference_number))).sort((a, b) => parseInt(a.reference_number) - parseInt(b.reference_number));
    if (sorted.length > 0) {
      printStartNo = sorted[0].reference_number;
      printEndNo = sorted[sorted.length - 1].reference_number;
    }
  }

  // --- Notebook Styles ---
  const ledgerStyles = `
    .ledger-input {
      width: 100%;
      border: 2px solid transparent;
      background: transparent;
      outline: none;
      font-size: 14px;
      color: #1e293b;
      padding: 8px 6px;
      transition: all 0.15s ease-in-out;
    }
    .ledger-input:focus {
      border: 2px solid #0f172a !important;
      background: #f8fafc;
      border-radius: 4px;
    }

    @media print {
      @page {
        size: portrait;
        margin: 0; /* Removes default browser headers/footers */
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Hide everything by default */
      body * {
        visibility: hidden;
      }
      
      /* Prevent padding from overflowing the 100% width page */
      *, *:before, *:after {
        box-sizing: border-box !important;
      }
      
      /* Reset Modal positioning to allow multi-page flow without clipping */
      .modal-overlay, .modal, .modal-body, .printable-modal, .printable-modal * {
        visibility: visible;
      }
      .modal-overlay {
        position: absolute !important;
        left: 0;
        top: 0;
        width: 100%;
        height: auto !important;
        min-height: 100%;
        background: white !important;
        padding: 0 !important;
        overflow: visible !important;
        align-items: flex-start !important;
      }
      .modal {
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        box-shadow: none !important;
        transform: none !important;
        height: auto !important;
      }
      
      .printable-modal {
        margin: 10mm auto;
        padding: 0;
        width: calc(100% - 20mm) !important;
        max-width: calc(100% - 20mm) !important;
      }
      .hide-print {
        display: none !important;
      }
      
      /* Header Design - Scaled Down */
      .print-header {
        display: flex !important;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0b5394;
        padding-bottom: 8px;
        margin-bottom: 16px;
      }
      .print-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .print-header-left img {
        height: 50px !important;
      }
      .print-header-title h1 {
        color: #0b5394;
        font-size: 20px;
        font-weight: 800;
        margin: 0;
        text-transform: uppercase;
      }
      .print-header-title h2 {
        color: #475569;
        font-size: 14px;
        font-weight: 500;
        margin: 4px 0 0 0;
      }
      
      .print-promotor-card {
        border: 1px solid #c3dafe;
        border-radius: 6px;
        width: 280px;
        overflow: hidden;
      }
      .print-promotor-card-header {
        background-color: #0b5394;
        color: white;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
      }
      .print-promotor-card-body {
        background-color: #f0f8ff;
        padding: 6px 10px;
        font-size: 11px;
        color: #0b5394;
        font-weight: 600;
      }
      .print-promotor-row {
        display: flex;
        margin-bottom: 4px;
      }
      .print-promotor-label {
        width: 110px;
        color: #475569;
      }
      .print-promotor-value {
        flex: 1;
        color: #0b5394;
        font-weight: 700;
      }

      /* Table Design */
      table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 11px;
        margin-bottom: 16px;
      }
      th, td { 
        border: 1px solid #c3dafe; 
        padding: 6px 4px; 
        text-align: center; 
      }
      th {
        background-color: #0b5394 !important;
        color: white !important;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10px;
      }

      tbody tr:nth-child(even) {
        background-color: #f0f8ff !important;
      }
      tbody tr:nth-child(odd) {
        background-color: #ffffff !important;
      }
      
      /* Footer Design */
      .print-totals-block {
        display: flex !important;
        background-color: #e6f2ff !important;
        border: 1px solid #c3dafe;
        border-radius: 6px;
        margin-top: 20px;
        margin-bottom: 0px;
        padding: 12px 16px;
        align-items: center;
        page-break-inside: avoid;
      }
      .print-totals-title {
        color: #0b5394;
        font-size: 16px;
        font-weight: 800;
        width: 120px;
        text-transform: uppercase;
      }
      .print-totals-stats {
        display: flex;
        flex: 1;
        justify-content: space-around;
      }
      .print-totals-stat {
        text-align: center;
        border-left: 1px solid #90cdf4;
        flex: 1;
      }
      .print-totals-stat:first-child {
        border-left: none;
      }
      .print-totals-label {
        color: #0b5394;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .print-totals-val {
        color: #0b5394;
        font-size: 14px;
        font-weight: 800;
      }
    }
    .print-only { display: none; }
    @media print {
      .print-only { display: block; }
      .print-header { display: flex; }
      .print-totals-block { display: flex; }
    }
  `

  return (
    <div className="hide-print-parent">
      <style>{ledgerStyles}</style>
      <PageHeader title="📖 Donation Registry" subtitle="Fast bulk-entry system for ledger data">
        <button className="btn btn-secondary" onClick={() => openHistoryModal()}>View Entered Details</button>
      </PageHeader>

      <div className="data-card" style={{ marginBottom: 24, padding: 24 }}>
        
        {/* Top Batch Context */}
        <div 
          onKeyDown={handleBatchKeyDown}
          style={{ 
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', 
            display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Staff Member *</label>
            <select className="form-control" value={batch.staff_id} onChange={e => setB('staff_id', e.target.value)} style={{ padding: '8px 12px', fontSize: 14 }}>
              <option value="">Select Staff...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 120px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date *</label>
            <input type="date" className="form-control" value={batch.date} onChange={e => setB('date', e.target.value)} style={{ padding: '8px 12px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 120px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Bill Book No</label>
            <input type="text" className="form-control" value={batch.bill_book_no} onChange={e => setB('bill_book_no', e.target.value)} style={{ padding: '8px 12px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Voucher Range *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="text" className="form-control" readOnly value={forms[0]?.reference_number || ''} style={{ padding: '8px 12px', fontSize: 14, width: '100%', background: '#f1f5f9' }} />
              <span style={{ color: '#94a3b8' }}>-</span>
              <input type="text" className="form-control" readOnly value={forms[forms.length - 1]?.reference_number || ''} style={{ padding: '8px 12px', fontSize: 14, width: '100%', background: '#f1f5f9' }} />
            </div>
          </div>
        </div>

        {/* Notebook Ledger Section */}
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                <th style={{ padding: '12px', textAlign: 'center', width: '40px', color: '#475569', fontSize: 12 }}>#</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '100px', color: '#475569', fontSize: 12 }}>Voucher</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '20%', color: '#475569', fontSize: 12 }}>Name of Donator</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '20%', color: '#475569', fontSize: 12 }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '20%', color: '#475569', fontSize: 12 }}>Place</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '120px', color: '#475569', fontSize: 12 }}>Amount (₹) *</th>
                <th style={{ padding: '12px', textAlign: 'left', width: '140px', color: '#475569', fontSize: 12 }}>Mode</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form, index) => {
                return (
                  <tr key={index} id={`row-${index}`} onKeyDown={(e) => handleRowKeyDown(e, index)} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '0 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12, borderRight: '1px solid #e2e8f0' }}>{index + 1}</td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                      <input className="ledger-input" style={{ fontWeight: 700, color: '#3b82f6' }} value={form.reference_number} onChange={e => updateForm(index, 'reference_number', e.target.value.replace(/\D/g, ''))} />
                    </td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                      <input className="ledger-input" value={form.donor_name} onChange={e => updateForm(index, 'donor_name', e.target.value)} />
                    </td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                      <input className="ledger-input" value={form.phone} onChange={e => updateForm(index, 'phone', e.target.value.replace(/\D/g,'').slice(0,10))} />
                    </td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0 }}>
                      <input className="ledger-input" value={form.place} onChange={e => updateForm(index, 'place', e.target.value)} />
                    </td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0, background: '#fff1f2' }}>
                      <input type="number" className="ledger-input" style={{ fontWeight: 700, color: '#e11d48' }} value={form.amount} onChange={e => updateForm(index, 'amount', e.target.value)} />
                    </td>
                    <td style={{ borderRight: '1px solid #e2e8f0', padding: 0, position: 'relative' }}>
                      <select className="ledger-input" style={{ cursor: 'pointer', appearance: 'none', paddingLeft: 12, paddingRight: 24 }} value={form.payment_method} onChange={e => updateForm(index, 'payment_method', e.target.value)}>
                        <option value="CASH">CASH</option>
                        <option value="UPI">GPAY / UPI</option>
                        <option value="CHEQUE">CHEQUE</option>
                      </select>
                      <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </td>
                    <td style={{ padding: '0 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {forms.length > 1 && (
                          <button onClick={() => removeRow(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, fontSize: 16 }} title="Remove Row">×</button>
                        )}
                        <button onClick={addRow} style={{ background: '#e0e7ff', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontWeight: 700 }} title="Add Row below">+</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {forms.length} / 30 rows used
          </span>
          <div style={{ marginRight: 'auto', marginLeft: 16, display: 'flex', gap: 16, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>By Cash: <strong style={{ color: '#059669', fontSize: 14 }}>{formatINR(cashTotal)}</strong></div>
            <div style={{ width: 1, background: '#cbd5e1' }}></div>
            <div style={{ fontSize: 13, color: '#475569' }}>Online: <strong style={{ color: '#2563eb', fontSize: 14 }}>{formatINR(onlineTotal)}</strong></div>
            <div style={{ width: 1, background: '#cbd5e1' }}></div>
            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>Total: <strong style={{ color: '#e11d48', fontSize: 15 }}>{formatINR(grandTotal)}</strong></div>
          </div>
          <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
            Clear All
          </button>
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving} style={{ padding: '10px 24px', fontSize: 15 }}>
            {saving ? 'Saving Entries...' : `Save ${forms.length} Entries`}
          </button>
        </div>
      </div>


      {/* History Modal */}
      <Modal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)} 
        title={<span className="hide-print">Donation Details History</span>} 
        size="modal-fullscreen" 
        overlayClass="modal-overlay-content flush hide-print-overlay"
        footer={
          <div style={{ display: 'flex', width: '100%' }} className="hide-print">
            <div style={{ display: 'flex', gap: 16, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 8, margin: '0 auto' }}>
              <div style={{ fontSize: 13, color: '#475569' }}>By Cash: <strong style={{ color: '#059669', fontSize: 14 }}>{formatINR(historyCashTotal)}</strong></div>
              <div style={{ width: 1, background: '#cbd5e1' }}></div>
              <div style={{ fontSize: 13, color: '#475569' }}>Online: <strong style={{ color: '#2563eb', fontSize: 14 }}>{formatINR(historyOnlineTotal)}</strong></div>
              <div style={{ width: 1, background: '#cbd5e1' }}></div>
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>Total: <strong style={{ color: '#e11d48', fontSize: 15 }}>{formatINR(historyGrandTotal)}</strong></div>
            </div>
          </div>
        }
      >
        <div className="printable-modal">
          <div className="print-header print-only">
            <div className="print-header-left">
              <img src="/logo-full.png" alt="SREE LAKSHMI TRUST" style={{ height: 50, objectFit: 'contain' }} />
              <div className="print-header-title">
                <h1>DONATION REGISTRY</h1>
                <h2>Donation Details Report</h2>
              </div>
            </div>
            
            <div className="print-promotor-card">
              <div className="print-promotor-card-header">Promotor Details</div>
              <div className="print-promotor-card-body">
                <div className="print-promotor-row">
                  <div className="print-promotor-label">Promotor Name</div>
                  <div>:</div>
                  <div className="print-promotor-value" style={{ marginLeft: 8 }}>{printStaffName}</div>
                </div>
                <div className="print-promotor-row">
                  <div className="print-promotor-label">Date</div>
                  <div>:</div>
                  <div className="print-promotor-value" style={{ marginLeft: 8 }}>{printDate}</div>
                </div>
                <div className="print-promotor-row">
                  <div className="print-promotor-label">Bill Book No.</div>
                  <div>:</div>
                  <div className="print-promotor-value" style={{ marginLeft: 8 }}>{printBookNo}</div>
                </div>
                <div className="print-promotor-row">
                  <div className="print-promotor-label">Starting No.</div>
                  <div>:</div>
                  <div className="print-promotor-value" style={{ marginLeft: 8 }}>{printStartNo}</div>
                </div>
                <div className="print-promotor-row">
                  <div className="print-promotor-label">Ending No.</div>
                  <div>:</div>
                  <div className="print-promotor-value" style={{ marginLeft: 8 }}>{printEndNo}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hide-print" style={{ display: 'flex', gap: 16, marginBottom: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Staff Member</label>
            <select className="form-control" value={historyFilters.staff_id} onChange={e => setHistoryFilters(prev => ({...prev, staff_id: e.target.value, bill_book_no: '', voucher: ''}))}>
              <option value="">All Staff</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Date</label>
            <input type="date" className="form-control" value={historyFilters.date} onChange={e => setHistoryFilters(prev => ({...prev, date: e.target.value, bill_book_no: '', voucher: ''}))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Book No.</label>
            <input type="text" className="form-control" placeholder="Search book..." value={historyFilters.bill_book_no} onChange={e => setHistoryFilters(prev => ({...prev, bill_book_no: e.target.value}))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Voucher No.</label>
            <input type="text" className="form-control" placeholder="Search voucher..." value={historyFilters.voucher} onChange={e => setHistoryFilters(prev => ({...prev, voucher: e.target.value}))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button 
              className="btn" 
              style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', height: '36px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => window.print()}
            >
              🖨️ Print / PDF
            </button>
          </div>
        </div>

        <div className="table-wrap" style={{ height: '100%', overflowY: 'auto' }}>
          {loadingHistory ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
          ) : !historyFilters.staff_id ? (
            <div style={{ paddingBottom: 40 }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>Staff Member</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px' }}>Transactions</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px' }}>Cash Amount (₹)</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px' }}>Online Amount (₹)</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#ec4899' }}>Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {staffSummary.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>No entries found for the selected filters.</td></tr>
                  ) : staffSummary.map(s => (
                    <tr 
                      key={s.staff_id}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}
                      onClick={() => setHistoryFilters(prev => ({...prev, staff_id: s.staff_id, bill_book_no: ''}))}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                    >
                      <td style={{ color: '#4F46E5', fontWeight: 700, padding: '12px 16px', fontSize: 15 }}>
                        {users.find(u => u.id === s.staff_id)?.full_name || 'Unknown Staff'}
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 4 }}>Click to view all {s.count} transactions ➔</div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600 }}>{s.count}</td>
                      <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600 }}>{formatINR(s.cash)}</td>
                      <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600 }}>{formatINR(s.online)}</td>
                      <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, color: '#ec4899', fontSize: 15 }}>{formatINR(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : historyData.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
              <button className="btn btn-secondary" style={{ marginBottom: 16, fontSize: 12, padding: '6px 12px' }} onClick={() => setHistoryFilters(prev => ({...prev, staff_id: ''}))}>
                ← Back to Staff Summary
              </button>
              <div>No details found for this staff member.</div>
            </div>
          ) : (
            <>
              <div className="hide-print" style={{ marginBottom: 16 }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setHistoryFilters(prev => ({...prev, staff_id: ''}))}
                  style={{ fontSize: 13, padding: '8px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span style={{ fontSize: 16 }}>←</span> Back to Staff Summary
                </button>
              </div>
              <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th className="print-only">Sl.<br/>No.</th>
                  <th>Voucher<br/>No.</th>
                  <th className="hide-print">Book<br/>No.</th>
                  <th className="hide-print">Date</th>
                  <th className="hide-print">Staff Member</th>
                  <th>Donor Name</th>
                  <th>Phone</th>
                  <th>Place</th>
                  <th>Mode</th>
                  <th style={{ paddingLeft: 16, paddingRight: 16, whiteSpace: 'nowrap' }}>Amount (₹)</th>
                  <th className="hide-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  return (
                  <tr key={item.id} style={historyFilters.voucher && (item.reference_number || '').includes(historyFilters.voucher) ? { backgroundColor: '#fef08a' } : {}}>
                    {isEditing ? (
                      <>
                        <td className="print-only"></td>
                        <td><input type="text" className="form-control" style={{ padding: '4px 8px', width: 80 }} value={editData.reference_number} onChange={e => setEditData({...editData, reference_number: e.target.value})} /></td>
                        <td className="hide-print"><input type="text" className="form-control" style={{ padding: '4px 8px', width: 60 }} value={editData.bill_book_no} onChange={e => setEditData({...editData, bill_book_no: e.target.value})} /></td>
                        <td className="hide-print"><input type="date" className="form-control" style={{ padding: '4px 8px', width: 110 }} value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} /></td>
                        <td className="hide-print" style={{ fontSize: 13, color: '#475569' }}>{users.find(u => u.id === item.created_by)?.full_name || '—'}</td>
                        <td><input type="text" className="form-control" style={{ padding: '4px 8px', width: 100 }} value={editData.donor_name} onChange={e => setEditData({...editData, donor_name: e.target.value})} /></td>
                        <td><input type="text" className="form-control" style={{ padding: '4px 8px', width: 100 }} value={editData.donor_phone} onChange={e => setEditData({...editData, donor_phone: e.target.value})} /></td>
                        <td><input type="text" className="form-control" style={{ padding: '4px 8px', width: 80 }} value={editData.place} onChange={e => setEditData({...editData, place: e.target.value})} /></td>
                        <td>
                          <select className="form-control" style={{ padding: '4px 8px' }} value={editData.payment_method} onChange={e => setEditData({...editData, payment_method: e.target.value})}>
                            <option value="CASH">CASH</option>
                            <option value="ONLINE">ONLINE</option>
                            <option value="BANK_TRANSFER">BANK</option>
                          </select>
                        </td>
                        <td><input type="number" className="form-control" style={{ padding: '4px 8px', width: 80 }} value={editData.amount} onChange={e => setEditData({...editData, amount: e.target.value})} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEditSave(item.id)}>Save</button>
                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="print-only" style={{ fontWeight: 600 }}>{idx + 1}</td>
                        <td className="td-mono">{item.reference_number || item.receipt_number || '—'}</td>
                        <td className="hide-print" style={{ fontSize: 12 }}>{item.bill_book_no || '—'}</td>
                        <td className="hide-print" style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{item.date ? format(new Date(item.date), 'dd-MM-yyyy') : '—'}</td>
                        <td className="hide-print" style={{ fontSize: 13, color: '#475569' }}>{users.find(u => u.id === item.created_by)?.full_name || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{item.donor_name || '—'}</td>
                        <td style={{ fontSize: 12 }}>{item.donor_phone || '—'}</td>
                        <td style={{ fontSize: 12 }}>{item.place || '—'}</td>
                        <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{item.payment_method}</span></td>
                        <td style={{ fontWeight: 700, color: '#ec4899', paddingLeft: 16, paddingRight: 16, whiteSpace: 'nowrap' }}>{formatINR(item.amount)}</td>
                        <td className="hide-print">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleEditStart(item)}>Edit</button>
                            <button className="btn" style={{ padding: '4px 8px', fontSize: 11, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => setDeleteConfirmId(item.id)}>Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )})}
              </tbody>
            </table>
            </>
          )}
        </div>

        {historyData.length > 0 && (
          <div className="print-totals-block print-only">
            <div className="print-totals-title">Total</div>
            <div className="print-totals-stats">
              <div className="print-totals-stat">
                <div className="print-totals-label">Cash Amount (₹)</div>
                <div className="print-totals-val">{historyCashTotal.toFixed(2)}</div>
              </div>
              <div className="print-totals-stat">
                <div className="print-totals-label">Online Amount (₹)</div>
                <div className="print-totals-val">{historyOnlineTotal.toFixed(2)}</div>
              </div>
              <div className="print-totals-stat">
                <div className="print-totals-label">Total Amount (₹)</div>
                <div className="print-totals-val">{historyGrandTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => handleDelete(deleteConfirmId)}
        title="Delete Record"
        message="Are you sure you want to delete this donation record? This action cannot be undone."
        confirmText="Delete"
        isDanger={true}
      />
    </div>
  )
}
