// pages/data-entry/DonationEntry.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { accountsApi, coreApi, hrApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import PaymentMethodSelector from '../../components/PaymentMethodSelector'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  staff_id: '',
  voucher_id: '',
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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalCash, setTotalCash] = useState(0)
  const [totalOnline, setTotalOnline] = useState(0)
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [voucherLoading, setVoucherLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search, source: 'DONATION', date: filterDate, page, page_size: 10 }
      if (filterStaff) params.created_by = filterStaff
      const res = await accountsApi.income.list(params)
      setItems(res.data.results || res.data)
      if (res.data.count !== undefined) {
        setTotalCount(res.data.count)
        setTotalPages(Math.ceil(res.data.count / 10))
        setTotalAmount(res.data.total_amount || 0)
        setTotalCash(res.data.total_cash || 0)
        setTotalOnline(res.data.total_online || 0)
      } else {
        const dataList = res.data.results || res.data
        setTotalCount(dataList.length)
        setTotalPages(1)
        setTotalAmount(dataList.reduce((s, i) => s + parseFloat(i.amount || 0), 0))
        setTotalCash(dataList.filter(i => i.payment_method === 'CASH').reduce((s, i) => s + parseFloat(i.amount || 0), 0))
        setTotalOnline(dataList.filter(i => i.payment_method !== 'CASH').reduce((s, i) => s + parseFloat(i.amount || 0), 0))
      }
    } catch { toast.error('Failed to load donations') }
    finally { setLoading(false) }
  }, [search, filterDate, filterStaff, page])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, filterDate, filterStaff])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      let data = res.data.results || res.data || []
      data = data.filter(u => u.full_name?.toLowerCase() !== 'hr' && u.username?.toLowerCase() !== 'hr')
      setUsers(data)
    }).catch(err => console.error(err))
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
    const addNext = e.nativeEvent.submitter?.value === 'saveAndNext'
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    if (form.phone && form.phone.length !== 10) return toast.error('Enter a valid 10-digit phone number')
    if (form.staff_id && !form.donor_name) return toast.error('Enter a donor name')
    if (!form.staff_id && !form.voucher_id) return toast.error('Please enter a voucher ID or select NULL')
    setSaving(true)
    try {
      const fd = new FormData()
      // Map voucher_id → reference_number
      const payload = { ...form, reference_number: form.voucher_id || form.reference_number }
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v))
      if (form.phone) fd.append('donor_phone', form.phone)
      await accountsApi.income.create(fd)
      toast.success(form.phone ? 'Donation recorded & WhatsApp e-receipt sent!' : 'Donation recorded!')

      // Increment voucher for this staff member
      if (form.staff_id) {
        try {
          const res = await hrApi.vouchers.increment(form.staff_id)
          const nextVoucher = String(res.data.current_voucher)
          // Auto-filter table to show this staff member's entries
          setFilterStaff(form.staff_id)
          if (addNext) {
            setForm(f => ({
              ...EMPTY_FORM,
              staff_id: f.staff_id,
              date: f.date,
              voucher_id: nextVoucher,
            }))
            document.getElementById('donor_name_input')?.focus()
          } else {
            setShowModal(false)
            setForm(EMPTY_FORM)
          }
        } catch {
          if (addNext) {
            setForm(f => ({ ...EMPTY_FORM, staff_id: f.staff_id, date: f.date }))
          } else {
            setShowModal(false)
            setForm(EMPTY_FORM)
          }
        }
      } else {
        if (addNext) {
          setForm(f => ({ ...EMPTY_FORM, date: f.date }))
          document.getElementById('donor_name_input')?.focus()
        } else {
          setShowModal(false)
          setForm(EMPTY_FORM)
        }
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

  return (
    <div>
      <PageHeader title="💝 Donation Entry" subtitle="Record donations from individuals and organisations">
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px' }}>Cash: {formatINR(totalCash)}</span>
          <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>Online: {formatINR(totalOnline)}</span>
          <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>Total: {formatINR(totalAmount)}</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Record Donation</button>
      </PageHeader>

      <div className="data-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
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
        </div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><tr>
                <th style={{ background: '#f8fafc' }}>Date</th>
                <th style={{ background: '#f8fafc' }}>Staff Member</th>
                <th style={{ background: '#f8fafc' }}>Donor</th>
                <th style={{ background: '#f8fafc' }}>Phone</th>
                <th style={{ background: '#f8fafc' }}>Place</th>
                <th style={{ background: '#f8fafc' }}>Payment</th>
                <th style={{ background: '#f8fafc' }}>Voucher No.</th>
                <th style={{ background: '#f8fafc' }}>Amount</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon="💝" title="No donations recorded" /></td></tr>
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
        
        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Page <span style={{ fontWeight: 600, color: '#0f172a' }}>{page}</span> / <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalPages}</span> <span style={{ color: '#94a3b8' }}>({totalCount} entries)</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={page === totalPages} 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Donation" size="modal-lg">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>

          {/* Voucher ID Banner */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>🎫</span>
              <div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Voucher ID</div>
                {voucherLoading ? (
                  <div style={{ fontSize: 13, color: '#64748b' }}>Loading...</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="text"
                      value={form.voucher_id}
                      onChange={e => setF('voucher_id', e.target.value)}
                      style={{
                        fontSize: 24, fontWeight: 800, color: form.voucher_id === 'NULL' ? '#94a3b8' : '#0f172a', background: 'transparent',
                        border: 'none', outline: 'none', width: 120, padding: 0, textTransform: 'uppercase'
                      }}
                      placeholder="—"
                    />
                    {!form.staff_id && form.voucher_id !== 'NULL' && (
                      <button
                        type="button"
                        onClick={() => setF('voucher_id', 'NULL')}
                        style={{
                          background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6,
                          padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#64748b',
                          cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                        }}
                      >
                        Set NULL
                      </button>
                    )}
                    {!form.staff_id && form.voucher_id === 'NULL' && (
                      <button
                        type="button"
                        onClick={() => setF('voucher_id', '')}
                        style={{
                          background: 'transparent', border: 'none', padding: '4px', fontSize: 16,
                          cursor: 'pointer', color: '#ef4444'
                        }}
                        title="Clear NULL"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {form.staff_id && (
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Staff Member</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {users.find(u => u.id === form.staff_id)?.full_name || '—'}
                </div>
              </div>
            )}
          </div>

          {/* Top Context Section */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#475569' }}>Batch Context (Optional)</h4>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Staff Member</label>
                <select className="form-control" value={form.staff_id} onChange={e => handleStaffChange(e.target.value)}>
                  <option value="">Office Entry (Direct)</option>
                  <optgroup label="Field Staff">
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e => setF('date', e.target.value)} />
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
              <PaymentMethodSelector 
                value={form.payment_method} 
                onChange={v => setF('payment_method', v)} 
                options={['CASH','CHEQUE','BANK_TRANSFER','ONLINE','UPI']}
              />
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
