// pages/data-entry/PurchaseEntry.jsx — Purchase/procurement
import React, { useState, useCallback, useEffect } from 'react'
import { accountsApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import PaymentMethodSelector from '../../components/PaymentMethodSelector'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  category: 'PURCHASE',
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  payee: '',
  purpose: '',
  payment_method: 'CASH',
  account_type: 'CASH',
  reference_number: '',
  remarks: '',
}

export default function PurchaseEntry() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountsApi.expenses.list({ search, category: 'PURCHASE', page, page_size: 10 })
      setItems(res.data.results || res.data)
      if (res.data.count !== undefined) {
        setTotalCount(res.data.count)
        setTotalPages(Math.ceil(res.data.count / 10))
        setTotalAmount(res.data.total_amount || 0)
      } else {
        const dataList = res.data.results || res.data
        setTotalCount(dataList.length)
        setTotalPages(1)
        setTotalAmount(dataList.reduce((s, i) => s + parseFloat(i.amount || 0), 0))
      }
    } catch { toast.error('Failed to load purchase entries') }
    finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { setPage(1) }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount')
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      await accountsApi.expenses.create(fd)
      toast.success('Purchase entry recorded!')
      setShowModal(false)
      setForm(EMPTY_FORM)
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
      <PageHeader title="🛒 Purchase Entry" subtitle="Record Trust purchases and expenditures">
        <span className="badge badge-red" style={{ fontSize: 13, padding: '6px 14px', background: '#fee2e2', color: '#991b1b' }}>Total: {formatINR(totalAmount)}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Purchase</button>
      </PageHeader>

      <div className="data-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <FilterBar search={search} onSearch={setSearch} />
        </div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><tr>
                <th style={{ background: '#f8fafc' }}>Date</th>
                <th style={{ background: '#f8fafc' }}>Vendor / Supplier</th>
                <th style={{ background: '#f8fafc' }}>Item / Description</th>
                <th style={{ background: '#f8fafc' }}>Payment</th>
                <th style={{ background: '#f8fafc' }}>Bill / Invoice No.</th>
                <th style={{ background: '#f8fafc' }}>Amount</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon="🛒" title="No purchase entries yet" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                      <td style={{ fontWeight: 600 }}>{i.payee || '—'}</td>
                      <td style={{ maxWidth: 200 }}>{i.purpose || '—'}</td>
                      <td><span className="badge badge-yellow" style={{ fontSize: 10 }}>{i.payment_method}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#D97706' }}>{formatINR(i.amount)}</td>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Purchase Entry" size="modal-md">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label required">Date</label>
              <input className="form-control" type="date" required value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label required">Amount (₹)</label>
              <input className="form-control" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label required">Vendor / Supplier</label>
              <input className="form-control" required value={form.payee} onChange={e => setF('payee', e.target.value)} placeholder="Supplier name" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <PaymentMethodSelector 
                value={form.payment_method} 
                onChange={v => setF('payment_method', v)} 
                options={['CASH','CHEQUE','BANK_TRANSFER','ONLINE','UPI']}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Item / Description</label>
              <input className="form-control" required value={form.purpose} onChange={e => setF('purpose', e.target.value)} placeholder="e.g. 100 pcs Stationery from XYZ Store" />
            </div>
            <div className="form-group">
              <label className="form-label">Bill / Invoice No.</label>
              <input className="form-control" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="INV-0001" />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
