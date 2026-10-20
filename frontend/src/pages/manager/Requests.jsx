import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { managerApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { StatusBadge, AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { isValidPhone, isPositiveNumber } from '../../utils/validators'

const CATEGORIES = ['MEDICAL','EDUCATION','FOOD','CHARITY','TRANSPORT','OFFICE','UTILITIES','MAINTENANCE','PURCHASE','OTHER']
const PRIORITIES = ['LOW','NORMAL','HIGH','URGENT']
const STATUSES = ['SUBMITTED','APPROVED','REJECTED']

export function RequestForm({ onClose, onSaved, initial = null }) {
  const getTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const buildFormValues = (data) => {
    if (!data) {
      return {
        beneficiary_name: '',
        category: 'OTHER',
        amount_requested: '',
        priority: 'NORMAL',
        beneficiary_phone: '',
        date: getTodayStr(),
        purpose: '',
        description: '',
        manager_remarks: '',
      }
    }
    return {
      beneficiary_name: data.beneficiary_name || '',
      category: data.category || 'OTHER',
      amount_requested: data.amount_requested !== null && data.amount_requested !== undefined ? String(data.amount_requested) : '',
      priority: data.priority || 'NORMAL',
      beneficiary_phone: data.beneficiary_phone || '',
      date: data.created_at ? data.created_at.split('T')[0] : (data.required_date ? String(data.required_date).split('T')[0] : getTodayStr()),
      purpose: data.purpose || '',
      description: data.description || '',
      manager_remarks: data.manager_remarks || '',
    }
  }

  const [form, setForm] = useState(() => buildFormValues(initial))
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm(buildFormValues(initial))
    }
  }, [initial])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.beneficiary_name || !form.beneficiary_name.trim()) {
      return toast.error("Beneficiary name is required");
    }
    if (form.beneficiary_phone && !isValidPhone(form.beneficiary_phone)) {
      return toast.error("Enter a valid 10-digit phone number");
    }
    if (!isPositiveNumber(form.amount_requested)) {
      return toast.error("Amount must be a positive number");
    }
    
    if (saving) return;
    setSaving(true)
    try {
      const fd = new FormData()
      const payload = {
        ...form,
        purpose: form.purpose?.trim() || `${form.category} assistance for ${form.beneficiary_name?.trim() || 'Beneficiary'}`,
        required_date: form.date,
        created_at: form.date,
        date: form.date,
      }
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') fd.append(k, v)
      })
      if (file) fd.append('document', file)

      if (initial) {
        await managerApi.requests.update(initial.id, fd)
        toast.success('Request updated.')
      } else {
        await managerApi.requests.create(fd)
        toast.success('Request created.')
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Save Error:', err.response?.data);
      const data = err.response?.data;
      let msg = 'Save failed.';
      if (data) {
        if (data.detail) msg = data.detail;
        else if (typeof data === 'object') {
          msg = Object.values(data).flat().join(' | ');
        }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label required">Beneficiary Name</label>
          <input
            className="form-control"
            required
            placeholder="Enter beneficiary full name"
            value={form.beneficiary_name}
            onChange={e => setForm(f => ({ ...f, beneficiary_name: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label required">Category</label>
          <select
            className="form-control"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">Amount Requested (₹)</label>
          <input
            className="form-control"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="0.00"
            value={form.amount_requested}
            onChange={e => setForm(f => ({ ...f, amount_requested: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select
            className="form-control"
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Beneficiary Contact</label>
          <input
            className="form-control"
            placeholder="10-digit mobile number"
            value={form.beneficiary_phone}
            onChange={e => setForm(f => ({ ...f, beneficiary_phone: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label required">Date</label>
          <input
            className="form-control"
            type="date"
            required
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Purpose</label>
        <input
          className="form-control"
          placeholder="Purpose / Reason for assistance"
          value={form.purpose}
          onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          rows={3}
          placeholder="Additional details..."
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Remarks</label>
        <textarea
          className="form-control"
          rows={2}
          placeholder="Manager remarks (optional)"
          value={form.manager_remarks}
          onChange={e => setForm(f => ({ ...f, manager_remarks: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Supporting Document</label>
        {initial?.document && (
          <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>
            Current file: <a href={initial.document} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View existing document</a>
          </div>
        )}
        <input className="form-control" type="file" onChange={e => setFile(e.target.files[0])} />
      </div>
      <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : (initial ? 'Update Request' : 'Create Request')}
        </button>
      </div>
    </form>
  )
}

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => sessionStorage.getItem('req_search') || '')
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('req_statusFilter') || '')
  const [roleFilter, setRoleFilter] = useState(() => sessionStorage.getItem('req_roleFilter') || '')
  const [dateFilter, setDateFilter] = useState(() => {
    const saved = sessionStorage.getItem('req_dateFilter')
    return saved !== null ? saved : ''
  })
  const [totalPendingCount, setTotalPendingCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)

  useEffect(() => {
    sessionStorage.setItem('req_search', search)
    sessionStorage.setItem('req_statusFilter', statusFilter)
    sessionStorage.setItem('req_roleFilter', roleFilter)
    sessionStorage.setItem('req_dateFilter', dateFilter)
  }, [search, statusFilter, roleFilter, dateFilter])
  const [actionModal, setActionModal] = useState(null) // { req, action }
  const [actionRemarks, setActionRemarks] = useState('')
  const [actionAmount, setActionAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleView = (id) => {
    if (location.pathname.includes('/entry/')) {
      navigate(`/slt/entry/assessment/${id}`)
    } else {
      navigate(`/slt/mgr/requests/${id}`)
    }
  }
  const { user } = useAuthStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await managerApi.requests.list({ search, status: statusFilter, requested_by_role: roleFilter, date: dateFilter })
      setRequests(res.data.results || res.data)
      setTotalPendingCount(res.data.all_time_pending || 0)
    } catch (_) { toast.error('Failed to load requests') }
    finally { setLoading(false) }
  }, [search, statusFilter, roleFilter, dateFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('request-update', handler)
    return () => window.removeEventListener('request-update', handler)
  }, [load])

  const handleEdit = async (r) => {
    setEditingRequest(r)
    try {
      const res = await managerApi.requests.get(r.id)
      if (res?.data) {
        setEditingRequest(res.data)
      }
    } catch (_) {}
  }

  const handleAction = async () => {
    if (!actionModal) return
    setActionLoading(true)
    try {
      if (actionModal.action === 'cancel') {
        await managerApi.requests.delete(actionModal.req.id)
        toast.success(\Assessment \ deleted permanently.\)
        window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      } else {
        const payload = { remarks: actionRemarks }
        if (actionModal.action === 'approve' || actionModal.action === 'approve_partial') {
          if (!actionAmount || isNaN(parseFloat(actionAmount)) || parseFloat(actionAmount) <= 0) {
            toast.error('Please enter a valid approved amount.')
            setActionLoading(false)
            return
          }
          payload.amount_approved = parseFloat(actionAmount)
        }
        await managerApi.requests.action(actionModal.req.id, actionModal.action, payload)
        toast.success(\Request \d successfully.\)
      }
      setActionModal(null)
      setActionRemarks('')
      setActionAmount('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Action failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const isDataEntrySection = location.pathname.includes('/entry/') || user?.role === 'DATA_ENTRY'
  const canDataEntryEdit = (r) => {
    return isDataEntrySection && user?.role === 'DATA_ENTRY' && r.requested_by_role === 'STAFF'
  }
  const canSubmit = (req) => user?.role === 'MANAGER' && req.status === 'DRAFT'
  const canCancel = (req) => ['MANAGER', 'ADMIN'].includes(user?.role) && ['DRAFT', 'SUBMITTED', 'ON_HOLD'].includes(req.status)
  const canForwardToFAO = (req) => user?.role === 'DATA_ENTRY' && req.status === 'SUBMITTED'
  const canManagerApprove = (req) => ['MANAGER', 'ADMIN'].includes(user?.role) && ['UNDER_REVIEW', 'WITH_GEO', 'WITH_ACO', 'SUBMITTED'].includes(req.status)
  const canManagerReject = (req) => ['MANAGER', 'ADMIN'].includes(user?.role) && ['UNDER_REVIEW', 'SUBMITTED', 'WITH_GEO', 'WITH_ACO', 'WITH_FAO', 'ON_HOLD'].includes(req.status)

  return (
    <div>
      <PageHeader title="Assessment Requests" subtitle="Manage money and assistance requests">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="badge badge-yellow" style={{ fontSize: 13, padding: '6px 14px' }}>
            Total Pending: {totalPendingCount}
          </span>
          {['MANAGER','ADMIN','DATA_ENTRY'].includes(user?.role) && (
            <button className="btn btn-primary" id="create-request-btn" onClick={() => setShowModal(true)}>
              + New Request
            </button>
          )}
        </div>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <input type="date" className="form-control" style={{ width: 140 }} 
            value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <select className="filter-select" value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Applications</option>
            <option value="STAFF">Staff Submitted</option>
          </select>
          <select className="filter-select" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </FilterBar>

        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Beneficiary</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="📋" title="No requests found" /></td></tr>
                ) : requests.map(r => (
                  <tr key={r.id}>
                    <td className="td-mono" style={{ cursor: 'pointer' }}
                      onClick={() => handleView(r.id)}>
                      {r.request_number}
                    </td>
                    <td>
                      <div style={{fontWeight: 600, color: 'var(--gray-800)'}}>{r.beneficiary_name || '-'}</div>
                      {r.purpose && <div style={{fontSize: 12, color: 'var(--gray-500)', marginTop: 2}}>{r.purpose}</div>}
                    </td>
                    <td><span className="badge badge-blue">{r.category}</span></td>
                    <td><AmountDisplay amount={r.amount_requested} /></td>
                    <td>
                      <span className={`badge ${r.priority === 'URGENT' ? 'badge-red' : r.priority === 'HIGH' ? 'badge-yellow' : 'badge-gray'}`}>
                        {r.priority}
                      </span>
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {r.created_at ? format(new Date(r.created_at), 'dd MMM yy') : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => handleView(r.id)}>View</button>
                        {(isDataEntrySection ? canDataEntryEdit(r) : ['MANAGER','ADMIN'].includes(user?.role)) && (
                          <button className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(r)}>Edit</button>
                        )}
                        {canForwardToFAO(r) && (
                          <button className="btn btn-sm" style={{ background: '#7C3AED', color: 'white' }}
                            onClick={() => setActionModal({ req: r, action: 'forward_to_fao' })}>
                            Forward to FAO
                          </button>
                        )}
                        {canManagerApprove(r) && (
                          <button className="btn btn-sm btn-success"
                            onClick={() => { setActionAmount(''); setActionModal({ req: r, action: 'approve' }) }}>
                            ✓ Approve
                          </button>
                        )}
                        {canManagerReject(r) && (
                          <button className="btn btn-sm btn-danger"
                            onClick={() => setActionModal({ req: r, action: 'reject' })}>
                            ✗ Reject
                          </button>
                        )}
                        {canSubmit(r) && (
                          <button className="btn btn-sm btn-primary"
                            onClick={() => setActionModal({ req: r, action: 'submit' })}>Submit</button>
                        )}
                        {canCancel(r) && (
                          <button className="btn btn-sm btn-danger"
                            onClick={() => setActionModal({ req: r, action: 'cancel' })}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Assessment Request" size="modal-lg">
        <RequestForm onClose={() => setShowModal(false)} onSaved={load} />
      </Modal>

      {/* Edit Modal for Data Entry */}
      {editingRequest && (
        <Modal isOpen={true} onClose={() => setEditingRequest(null)} title={`Edit Assessment Request: ${editingRequest.request_number}`} size="modal-lg">
          <RequestForm key={editingRequest.id + (editingRequest.updated_at || '')} onClose={() => setEditingRequest(null)} onSaved={load} initial={editingRequest} />
        </Modal>
      )}

      {/* Action / Delete Confirm Modal */}
      {actionModal && (
        actionModal.action === 'cancel' ? (
          <Modal isOpen={true} onClose={() => !actionLoading && setActionModal(null)}
            title="Delete Assessment Request"
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setActionModal(null)} disabled={actionLoading}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleAction} disabled={actionLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {actionLoading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </>
            }>
            <div style={{ padding: '8px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  !
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
                    Are you ready to delete this assessment?
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-600)' }}>
                    This will <strong style={{ color: '#DC2626' }}>permanently delete</strong> request <strong style={{ color: 'var(--gray-900)' }}>{actionModal.req.request_number}</strong>. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div style={{
                background: 'var(--gray-50)',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: 'var(--gray-700)',
                border: '1px solid var(--gray-200)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Request No:</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--gray-900)' }}>{actionModal.req.request_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Beneficiary:</span>
                  <span style={{ fontWeight: 600 }}>{actionModal.req.beneficiary_name || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Category:</span>
                  <span className="badge badge-blue">{actionModal.req.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--gray-500)' }}>Amount:</span>
                  <strong style={{ color: 'var(--gray-900)' }}>
                    {formatINR ? formatINR(actionModal.req.amount_requested) : `₹${actionModal.req.amount_requested || 0}`}
                  </strong>
                </div>
              </div>
            </div>
          </Modal>
        ) : (
          <Modal isOpen={true} onClose={() => setActionModal(null)}
            title={`${actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)} Request`}
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
                <button className="btn btn-primary"
                  onClick={handleAction} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </>
            }>
            <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--gray-600)' }}>
              Request: <strong>{actionModal.req.request_number}</strong> &ndash; {actionModal.req.purpose}
            </p>
            {(actionModal.action === 'approve' || actionModal.action === 'approve_partial') && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Amount Approved (₹) <span style={{ color: 'red' }}>*</span></label>
                <input className="form-control" type="number" min="1" step="0.01"
                  placeholder="Enter the approved amount"
                  value={actionAmount}
                  onChange={e => setActionAmount(e.target.value)}
                  autoFocus />
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                  Requested amount: <strong>₹{Number(actionModal.req.amount_requested || 0).toLocaleString('en-IN')}</strong>. Once approved, this request will move to the Accountant for disbursement.
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={3}
                placeholder="Add remarks (optional)"
                value={actionRemarks}
                onChange={e => setActionRemarks(e.target.value)} />
            </div>
          </Modal>
        )
      )}
    </div>
  )
}
