// pages/data-entry/MembershipEntry.jsx — Membership fee payment recording
import React, { useState, useCallback, useEffect } from 'react'
import { accountsApi, coreApi, hrApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const MEMBERSHIP_TYPES = ['MONTHLY', 'ANNUAL', 'LIFETIME', 'ASSOCIATE', 'HONORARY', 'STUDENT']

const EMPTY_FORM = {
  source: 'MEMBERSHIP',
  staff_id: '',
  voucher_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '100',
  donor_name: '',       // member name
  phone: '',
  purpose: 'MONTHLY',   // membership type
  payment_method: 'CASH',
  account_type: 'CASH',
  reference_number: '',
  remarks: '',
}

export default function MembershipEntry() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [users, setUsers]     = useState([])
  const [voucherLoading, setVoucherLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountsApi.income.list({ search, source: 'MEMBERSHIP' })
      setItems(res.data.results || res.data)
    } catch { toast.error('Failed to load membership entries') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      setUsers(res.data.results || res.data || [])
    }).catch(() => {})
  }, [])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // When staff is selected, fetch their current voucher number
  const handleStaffChange = async (staffId) => {
    setF('staff_id', staffId)
    setF('voucher_id', '')
    if (!staffId) return
    setVoucherLoading(true)
    try {
      const res = await hrApi.vouchers.get(staffId)
      setF('voucher_id', String(res.data.current_voucher))
    } catch { /* silently ignore */ }
    finally { setVoucherLoading(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid fee amount')
    if (form.phone && form.phone.length !== 10) return toast.error('Enter a valid 10-digit phone number')
    setSaving(true)
    try {
      const fd = new FormData()
      const payload = { ...form, reference_number: form.voucher_id || form.reference_number }
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      if (form.phone) fd.append('donor_phone', form.phone)
      await accountsApi.income.create(fd)
      toast.success(form.phone ? 'Membership fee recorded & WhatsApp e-receipt sent!' : 'Membership fee recorded!')

      // Increment voucher for this staff member
      if (form.staff_id) {
        try {
          const res = await hrApi.vouchers.increment(form.staff_id)
          const nextVoucher = String(res.data.current_voucher)
          setForm(f => ({ ...EMPTY_FORM, staff_id: f.staff_id, date: f.date, voucher_id: nextVoucher }))
        } catch {
          setShowModal(false)
          setForm(EMPTY_FORM)
        }
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
      <PageHeader title="🪪 Membership Entry" subtitle="Record membership fee payments">
        <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px' }}>Total Collected: {formatINR(total)}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Record Fee</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Member Name</th><th>Phone</th>
                <th>Membership Type</th><th>Payment</th><th>Voucher No.</th><th>Amount</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon="🪪" title="No membership entries" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                      <td style={{ fontWeight: 600 }}>{i.donor_name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{i.phone || '—'}</td>
                      <td><span className="badge badge-green" style={{ fontSize: 10 }}>{i.purpose || 'ANNUAL'}</span></td>
                      <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{i.payment_method}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#10B981' }}>{formatINR(i.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Membership Fee" size="modal-md">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>

          {/* Voucher ID Banner */}
          <div style={{
            background: 'linear-gradient(90deg, #059669, #10B981)',
            borderRadius: 12, padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>🎫</span>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Voucher ID</div>
                {voucherLoading ? (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Loading...</div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={form.voucher_id}
                    onChange={e => setF('voucher_id', e.target.value)}
                    style={{
                      fontSize: 26, fontWeight: 900, color: 'white', background: 'transparent',
                      border: 'none', outline: 'none', width: 120, padding: 0,
                    }}
                    placeholder="—"
                  />
                )}
              </div>
            </div>
            {form.staff_id && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Staff Member</div>
                <div style={{ fontWeight: 700, color: 'white' }}>
                  {users.find(u => u.id === form.staff_id)?.full_name || '—'}
                </div>
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Staff Member</label>
              <select className="form-control" value={form.staff_id} onChange={e => handleStaffChange(e.target.value)}>
                <option value="">Select Staff...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 1' }}>
              <label className="form-label required">Membership Type</label>
              <select className="form-control" value={form.purpose} onChange={e => {
                setF('purpose', e.target.value)
                if (e.target.value === 'MONTHLY') setF('amount', '100')
              }}>
                {MEMBERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Date</label>
              <input className="form-control" type="date" required value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label required">Fee Amount (₹)</label>
              <input className="form-control" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label required">Member Name</label>
              <input className="form-control" required value={form.donor_name} onChange={e => setF('donor_name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.phone} onChange={e => setF('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit number" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-control" value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}>
                {['CASH','CHEQUE','BANK_TRANSFER','ONLINE','UPI'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Membership Fee'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
