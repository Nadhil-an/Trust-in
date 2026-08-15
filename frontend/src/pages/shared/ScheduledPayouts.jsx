import React, { useState, useEffect, useCallback } from 'react'
import { managerApi, accountsApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR, StatusBadge } from '../../components/shared'
import { useAuthStore } from '../../store/authStore'
import { format, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  name: '',
  description: '',
  allocated_amount: '',
  issue_date: '',
  payment_date: '',
  status: 'PLANNED'
}

export default function ScheduledPayouts() {
  const { user } = useAuthStore()
  const isDataEntry = user?.role === 'DATA_ENTRY' || user?.role === 'MANAGER'
  const isAccountant = user?.role === 'ACCOUNTANT'
  
  const [payouts, setPayouts] = useState([])
  const [totalFunds, setTotalFunds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [markConfirmItem, setMarkConfirmItem] = useState(null)
  
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search }
      if (statusFilter) params.status = statusFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const [res, fundsRes] = await Promise.all([
        managerApi.scheduledPayouts.list(params),
        accountsApi.totalFunds()
      ])
      setPayouts(res.data.results || res.data)
      setTotalFunds(fundsRes.data.total || 0)
    } catch (err) {
      toast.error('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, startDate, endDate])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (form.id) {
        await managerApi.scheduledPayouts.update(form.id, form)
        toast.success('Payout updated successfully')
      } else {
        await managerApi.scheduledPayouts.create(form)
        toast.success('Payout created successfully')
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      toast.error('Failed to save payout')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmId) return
    try {
      await managerApi.scheduledPayouts.delete(deleteConfirmId)
      toast.success('Payout deleted successfully')
      setDeleteConfirmId(null)
      loadData()
    } catch {
      toast.error('Failed to delete payout')
    }
  }

  const openForm = (item = null) => {
    setForm(item || EMPTY_FORM)
    setShowModal(true)
  }

  const handleMarkPaid = async () => {
    if (!markConfirmItem) return
    try {
      await managerApi.scheduledPayouts.update(markConfirmItem.id, { ...markConfirmItem, status: 'COMPLETED' })
      toast.success('Payout marked as paid!')
      setMarkConfirmItem(null)
      loadData()
    } catch {
      toast.error('Failed to update payout')
    }
  }

  // Helper to check fund warnings
  const checkFundWarning = (payout) => {
    if (payout.status === 'COMPLETED' || payout.status === 'CANCELLED') return null
    
    const daysLeft = differenceInDays(new Date(payout.payment_date), new Date())
    
    // Check if payment date is within 15 days
    if (daysLeft >= 0 && daysLeft <= 15) {
      const needed = Number(payout.allocated_amount)
      if (needed > totalFunds) {
        return {
          warning: true,
          msg: `CRITICAL: Payment is due in ${daysLeft} days, but allocated funds (₹${needed}) exceed current total funds available (₹${totalFunds}).`
        }
      }
    }
    return null
  }

  return (
    <div className="page-container">
      <PageHeader 
        title="Scheduled Payouts" 
        subtitle="Manage upcoming financial commitments"
      >
        {isDataEntry && (
          <button className="btn btn-primary" onClick={() => openForm()}>
            + Add Payout
          </button>
        )}
      </PageHeader>

      <div className="data-card">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <FilterBar search={search} onSearch={setSearch} />
          </div>
          <select 
            className="form-control" 
            style={{ width: 'auto' }}
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 600 }}>FROM</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto' }} 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 600 }}>TO</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto' }} 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payout ID</th>
                  <th>Purpose</th>
                  <th>Allocated Amount</th>
                  <th>Issue Date</th>
                  <th>Payment Date</th>
                  <th>Status</th>
                  {(isDataEntry || isAccountant) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={(isDataEntry || isAccountant) ? 7 : 6}>
                      <EmptyState title="No scheduled payouts found" />
                    </td>
                  </tr>
                ) : payouts.map(item => {
                  const fundCheck = checkFundWarning(item)
                  return (
                    <React.Fragment key={item.id}>
                      <tr style={fundCheck ? { backgroundColor: 'var(--red-50)' } : {}}>
                        <td><strong>{item.payout_id}</strong></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          {item.description && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{item.description}</div>}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--blue-600)' }}>
                            {formatINR(item.allocated_amount)}
                          </span>
                        </td>
                        <td>
                          <div style={{ color: 'var(--gray-600)', fontSize: 13 }}>
                            {format(new Date(item.issue_date), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
                            {format(new Date(item.payment_date), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td><StatusBadge status={item.status} /></td>
                        {(isDataEntry || isAccountant) && (
                          <td>
                            <div className="action-btns" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              {isDataEntry && <button className="btn-icon" title="Edit" onClick={() => openForm(item)}>✏️</button>}
                              {isDataEntry && <button className="btn-icon delete" title="Delete" onClick={() => setDeleteConfirmId(item.id)}>🗑️</button>}
                              {isAccountant && item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                                <button 
                                  className="btn btn-success btn-sm" 
                                  onClick={() => setMarkConfirmItem(item)}
                                >
                                  ✅ Mark Paid
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {fundCheck && (
                        <tr style={{ backgroundColor: 'var(--red-50)' }}>
                          <td colSpan={(isDataEntry || isAccountant) ? 7 : 6} style={{ paddingTop: 0, paddingBottom: 16, borderTop: 'none' }}>
                            <div style={{ 
                              display: 'flex', gap: 8, alignItems: 'center', 
                              backgroundColor: 'white', border: '1px solid var(--red-200)', 
                              padding: '8px 12px', borderRadius: 6, color: 'var(--red-700)', fontSize: 12, fontWeight: 600 
                            }}>
                              <span>⚠️</span> {fundCheck.msg}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Payout' : 'New Payout'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Purpose / Name *</label>
            <input 
              type="text" 
              className="form-control" 
              required 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea 
              className="form-control" 
              rows="3" 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label>Allocated Amount (₹) *</label>
            <input 
              type="number" 
              step="0.01" 
              className="form-control" 
              required 
              value={form.allocated_amount} 
              onChange={e => setForm({...form, allocated_amount: e.target.value})} 
            />
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Decision / Issue Date *</label>
              <input 
                type="date" 
                className="form-control" 
                required 
                value={form.issue_date} 
                onChange={e => setForm({...form, issue_date: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label>Payment Due Date *</label>
              <input 
                type="date" 
                className="form-control" 
                required 
                value={form.payment_date} 
                onChange={e => setForm({...form, payment_date: e.target.value})} 
              />
            </div>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select 
              className="form-control" 
              value={form.status} 
              onChange={e => setForm({...form, status: e.target.value})}
            >
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="form-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Payout'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirm Delete"
      >
        <div style={{ padding: '10px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--gray-800)', marginBottom: '24px' }}>
            Are you sure you want to delete this payout? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete Payout</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!markConfirmItem}
        onClose={() => setMarkConfirmItem(null)}
        title="Confirm Payment"
      >
        <div style={{ padding: '10px 0' }}>
          <p style={{ fontSize: '14px', color: 'var(--gray-800)', marginBottom: '24px' }}>
            Are you sure you want to mark <strong>"{markConfirmItem?.name}"</strong> as paid?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setMarkConfirmItem(null)}>Cancel</button>
            <button className="btn btn-success" onClick={handleMarkPaid}>Mark as Paid</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
