import React, { useState, useEffect, useRef } from 'react'
import { accountsApi, coreApi } from '../../api'
import { PageHeader, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_DONATION = {
  donor_name: '',
  phone: '',
  place: '',
  amount: '',
  payment_method: 'CASH',
}

export default function DonationRegistry() {
  const [users, setUsers] = useState([])
  
  // Batch Context
  const [batch, setBatch] = useState({
    staff_id: '',
    bill_book_no: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_voucher: '',
    end_voucher: '',
    current_voucher: ''
  })

  // Individual Entry
  const [form, setForm] = useState(EMPTY_DONATION)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([]) // Session history
  
  const donorNameRef = useRef(null)

  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      let data = res.data.results || res.data || []
      data = data.filter(u => u.full_name?.toLowerCase() !== 'hr' && u.username?.toLowerCase() !== 'hr')
      setUsers(data)
    }).catch(err => console.error(err))
  }, [])
  
  // Update current_voucher automatically when start_voucher is typed
  useEffect(() => {
    if (batch.start_voucher && !batch.current_voucher) {
      setBatch(b => ({ ...b, current_voucher: b.start_voucher }))
    }
  }, [batch.start_voucher])

  const setB = (k, v) => setBatch(b => ({ ...b, [k]: v }))
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSaveAndNext = async () => {
    if (!batch.staff_id) return toast.error('Please select a Staff Member for the batch')
    if (!batch.current_voucher) return toast.error('Please enter a Starting Voucher No')
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    if (form.phone && form.phone.length !== 10) return toast.error('Enter a valid 10-digit phone number')
    
    if (batch.end_voucher && parseInt(batch.current_voucher) > parseInt(batch.end_voucher)) {
      return toast.error('Voucher limit exceeded for this bill book!')
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('source', 'DONATION')
      fd.append('staff_id', batch.staff_id)
      fd.append('date', batch.date)
      fd.append('reference_number', batch.current_voucher)
      fd.append('amount', form.amount)
      fd.append('payment_method', form.payment_method)
      if (form.donor_name) fd.append('donor_name', form.donor_name)
      if (form.phone) fd.append('donor_phone', form.phone)
      if (form.place) fd.append('place', form.place)
      if (batch.bill_book_no) fd.append('remarks', `Bill Book: ${batch.bill_book_no}`)

      const res = await accountsApi.income.create(fd)
      toast.success(`Saved Voucher: ${batch.current_voucher}`)
      
      // Add to top of history
      setHistory(prev => [res.data, ...prev])

      // Reset form and increment voucher
      setForm(EMPTY_DONATION)
      if (!isNaN(parseInt(batch.current_voucher))) {
        setBatch(b => ({ ...b, current_voucher: String(parseInt(b.current_voucher) + 1) }))
      }

      setTimeout(() => donorNameRef.current?.focus(), 50)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(EMPTY_DONATION)
    setTimeout(() => donorNameRef.current?.focus(), 50)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      const formNode = e.currentTarget
      const inputs = Array.from(formNode.querySelectorAll('input'))
      const index = inputs.indexOf(e.target)
      
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus()
      } else {
        handleSaveAndNext()
      }
    }
  }

  return (
    <div>
      <PageHeader title="📖 Donation Registry" subtitle="Fast bulk-entry system for ledger data" />

      <div className="data-card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Registry Entry</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Press ENTER to move to the next field, and save on the last field.</p>
          </div>
          
          {/* Top Right Batch Context */}
          <div style={{ 
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', 
            display: 'flex', flexWrap: 'wrap', gap: 16, maxWidth: 600
          }}>
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
              <input type="text" className="form-control" value={batch.bill_book_no} onChange={e => setB('bill_book_no', e.target.value)} placeholder="e.g. B-12" style={{ padding: '8px 12px', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Voucher Range *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" className="form-control" value={batch.start_voucher} onChange={e => {
                  setB('start_voucher', e.target.value)
                  setB('current_voucher', e.target.value)
                }} placeholder="Start" style={{ padding: '8px 12px', fontSize: 14, width: '100%' }} />
                <span style={{ color: '#94a3b8' }}>-</span>
                <input type="number" className="form-control" value={batch.end_voucher} onChange={e => setB('end_voucher', e.target.value)} placeholder="End" style={{ padding: '8px 12px', fontSize: 14, width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />

        {/* Data Entry Form */}
        <div className="form-grid-4" onKeyDown={handleKeyDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Name of Donator</label>
            <input ref={donorNameRef} className="form-control" value={form.donor_name} onChange={e => setF('donor_name', e.target.value)} placeholder="Name of Donator" style={{ padding: '10px 14px', fontSize: '14px' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Phone Number</label>
            <input className="form-control" value={form.phone} onChange={e => setF('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="Phone Number" style={{ padding: '10px 14px', fontSize: '14px' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Place</label>
            <input className="form-control" value={form.place} onChange={e => setF('place', e.target.value)} placeholder="Place" style={{ padding: '10px 14px', fontSize: '14px' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label required" style={{ color: '#dc2626', marginBottom: '8px' }}>Amount (₹)</label>
            <input className="form-control" type="number" min="1" required value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="Amount (₹)" style={{ padding: '10px 14px', fontSize: '14px', borderColor: '#fca5a5', fontWeight: 600 }} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['CASH', 'UPI', 'CHEQUE'].map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setF('payment_method', method)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: form.payment_method === method ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                  background: form.payment_method === method ? '#e0e7ff' : '#f8fafc',
                  color: form.payment_method === method ? '#4f46e5' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {method === 'UPI' ? 'GPAY / UPI' : method}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Session History */}
      {history.length > 0 && (
        <div className="data-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>Recent Entries (This Session)</h3>
            <span className="badge badge-green">Total: {formatINR(history.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0))}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Donator</th>
                  <th>Phone</th>
                  <th>Place</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td className="td-mono">{item.reference_number || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{item.donor_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{item.phone || '—'}</td>
                    <td style={{ fontSize: 12 }}>{item.place || '—'}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{item.payment_method}</span></td>
                    <td style={{ fontWeight: 700, color: '#ec4899' }}>{formatINR(item.amount)}</td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => toast('To edit an entry, please use the main Donation Entry page edit feature.')}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
