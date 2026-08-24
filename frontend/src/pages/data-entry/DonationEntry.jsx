// pages/data-entry/DonationEntry.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { accountsApi, coreApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  staff_id: '',
  bill_book_no: '',
  bill_book_start: '',
  bill_book_end: '',
  source: 'DONATION',
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  donor_name: '',
  phone: '',
  place: '',
  payment_method: 'CASH',
  account_type: 'CASH',
  reference_number: '',
  remarks: '',
}

export default function DonationEntry() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search, source: 'DONATION', date: filterDate }
      if (filterStaff) params.created_by = filterStaff
      const res = await accountsApi.income.list(params)
      setItems(res.data.results || res.data)
    } catch { toast.error('Failed to load donations') }
    finally { setLoading(false) }
  }, [search, filterDate, filterStaff])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      setUsers(res.data.results || res.data || [])
    }).catch(err => console.error(err))
  }, [])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    const addNext = e.nativeEvent.submitter?.value === 'saveAndNext'
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    if (form.phone && form.phone.length !== 10) return toast.error('Enter a valid 10-digit phone number')
    if (form.staff_id && !form.donor_name) return toast.error('Enter a donor name')
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (form.phone) fd.append('donor_phone', form.phone)
      await accountsApi.income.create(fd)
      toast.success(form.phone ? 'Donation recorded & WhatsApp e-receipt sent!' : 'Donation recorded!')
      
      // Auto-filter table to show this staff member's entries
      if (form.staff_id) {
        setFilterStaff(form.staff_id)
      }

      if (addNext) {
        setForm(f => ({ 
          ...EMPTY_FORM, 
          staff_id: f.staff_id, 
          date: f.date, 
          bill_book_no: f.bill_book_no, 
          bill_book_start: f.bill_book_start, 
          bill_book_end: f.bill_book_end 
        }))
        // Focus the first empty field, normally Donor Name
        document.getElementById('donor_name_input')?.focus()
      } else {
        setShowModal(false)
        setForm(EMPTY_FORM)
      }
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault()
      const form = e.target.form
      const index = Array.prototype.indexOf.call(form, e.target)
      if (form.elements[index + 1]) {
        form.elements[index + 1].focus()
      }
    }
  }

  const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0)

  return (
    <div>
      <PageHeader title="💝 Donation Entry" subtitle="Record donations from individuals and organisations">
        <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px' }}>Total: {formatINR(total)}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Record Donation</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>Staff:</span>
              <select 
                className="form-control" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={filterStaff}
                onChange={e => setFilterStaff(e.target.value)}
              >
                <option value="">All Staff</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>Date:</span>
              <input 
                type="date" 
                className="form-control" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
              />
              {filterDate && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setFilterDate('')}
                  title="Clear date filter"
                >✕</button>
              )}
            </div>
          </div>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Staff Member</th><th>Donor</th><th>Phone</th><th>Place</th>
                <th>Payment</th><th>Receipt No.</th><th>Amount</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon="💝" title="No donations recorded" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                      <td style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5' }}>{i.created_by_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{i.donor_name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{i.phone || '—'}</td>
                      <td style={{ maxWidth: 160, fontSize: 12 }}>{i.place || '—'}</td>
                      <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{i.payment_method}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#EC4899' }}>{formatINR(i.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Donation" size="modal-lg">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
          
          {/* Top Context Section */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#475569' }}>Batch Context (Optional)</h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Staff Member</label>
                <select className="form-control" value={form.staff_id} onChange={e => setF('staff_id', e.target.value)}>
                  <option value="">Select Staff...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e => setF('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Bill Book No.</label>
                <input className="form-control" value={form.bill_book_no} onChange={e => setF('bill_book_no', e.target.value)} placeholder="e.g. BB-12" />
              </div>
              <div className="form-group">
                <label className="form-label">Starting Receipt No.</label>
                <input className="form-control" value={form.bill_book_start} onChange={e => setF('bill_book_start', e.target.value)} placeholder="e.g. 56" />
              </div>
              <div className="form-group">
                <label className="form-label">Ending Receipt No.</label>
                <input className="form-control" value={form.bill_book_end} onChange={e => setF('bill_book_end', e.target.value)} placeholder="e.g. 67" />
              </div>
            </div>
          </div>

          {/* Individual Donation Section */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label required">Donor Name</label>
              <input id="donor_name_input" className="form-control" required value={form.donor_name} onChange={e => setF('donor_name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Place</label>
              <input className="form-control" value={form.place} onChange={e => setF('place', e.target.value)} placeholder="Donor's place or city..." />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.phone} onChange={e => setF('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit number" />
            </div>
            <div className="form-group">
              <label className="form-label required">Amount (₹)</label>
              <input className="form-control" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-control" value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}>
                {['CASH','CHEQUE','BANK_TRANSFER','ONLINE','UPI'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Receipt No.</label>
              <input className="form-control" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="RCP-0001" />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12, justifyContent: 'flex-end', gap: '12px' }}>
            <button type="submit" name="saveMode" value="saveAndNext" className="btn btn-secondary" disabled={saving} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
              {saving ? 'Saving...' : 'Save & Add Next'}
            </button>
            <button type="submit" name="saveMode" value="save" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Donation'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
