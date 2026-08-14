import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { StatusBadge, AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { isValidPhone, isPositiveNumber } from '../../utils/validators'

const CATEGORIES = ['MEDICAL','EDUCATION','FOOD','CHARITY','TRANSPORT','OFFICE','UTILITIES','MAINTENANCE','PURCHASE','OTHER']
const PRIORITIES = ['LOW','NORMAL','HIGH','URGENT']
const STATUSES = ['DRAFT','SUBMITTED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','CASHIER_PENDING','DISBURSED','COMPLETED','CANCELLED']

function RequestForm({ onClose, onSaved, initial = null }) {
  const [form, setForm] = useState(initial || {
    request_type: '', category: 'OTHER', priority: 'NORMAL',
    purpose: '', description: '', amount_requested: '',
    required_date: '', beneficiary_name: '', beneficiary_phone: '',
    manager_remarks: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.beneficiary_phone && !isValidPhone(form.beneficiary_phone)) return toast.error("Enter a valid 10-digit phone number");
    if (!isPositiveNumber(form.amount_requested)) return toast.error("Amount must be a positive number");
    
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
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
      console.log('Save Error:', err.response?.data);
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
          <label className="form-label required">Request Type</label>
          <input className="form-control" value={form.request_type} required
            onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label required">Category</label>
          <select className="form-control" value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">Amount Requested (₹)</label>
          <input className="form-control" type="number" min="1" step="0.01" required
            value={form.amount_requested}
            onChange={e => setForm(f => ({ ...f, amount_requested: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-control" value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">Purpose</label>
          <input className="form-control" required value={form.purpose}
            onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Required Date</label>
          <input className="form-control" type="date" value={form.required_date}
            onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Beneficiary Name</label>
          <input className="form-control" value={form.beneficiary_name}
            onChange={e => setForm(f => ({ ...f, beneficiary_name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Beneficiary Contact</label>
          <input className="form-control" value={form.beneficiary_phone}
            onChange={e => setForm(f => ({ ...f, beneficiary_phone: e.target.value }))} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Remarks</label>
        <textarea className="form-control" rows={2} value={form.manager_remarks}
          onChange={e => setForm(f => ({ ...f, manager_remarks: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Supporting Document</label>
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [actionModal, setActionModal] = useState(null) // { req, action }
  const [actionRemarks, setActionRemarks] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await managerApi.requests.list({ search, status: statusFilter })
      setRequests(res.data.results || res.data)
    } catch (_) { toast.error('Failed to load requests') }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('request-update', handler)
    return () => window.removeEventListener('request-update', handler)
  }, [load])

  const handleAction = async () => {
    if (!actionModal) return
    setActionLoading(true)
    try {
      await managerApi.requests.action(actionModal.req.id, actionModal.action, {
        remarks: actionRemarks,
      })
      toast.success(`Request ${actionModal.action}d successfully.`)
      setActionModal(null)
      setActionRemarks('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const canSubmit = (req) => user?.role === 'MANAGER' && req.status === 'DRAFT'
  const canCancel = (req) => user?.role === 'MANAGER' && ['DRAFT', 'SUBMITTED', 'ON_HOLD'].includes(req.status)

  return (
    <div>
      <PageHeader title="Assessment Requests" subtitle="Manage money and assistance requests">
        {['MANAGER','ADMIN'].includes(user?.role) && (
          <button className="btn btn-primary" id="create-request-btn" onClick={() => setShowModal(true)}>
            + New Request
          </button>
        )}
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
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
                  <th>Purpose</th>
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
                      onClick={() => navigate(`/manager/requests/${r.id}`)}>
                      {r.request_number}
                    </td>
                    <td>{r.purpose}</td>
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
                          onClick={() => navigate(`/manager/requests/${r.id}`)}>View</button>
                        {canSubmit(r) && (
                          <button className="btn btn-sm btn-primary"
                            onClick={() => setActionModal({ req: r, action: 'submit' })}>Submit</button>
                        )}
                        {canCancel(r) && (
                          <button className="btn btn-sm btn-danger"
                            onClick={() => setActionModal({ req: r, action: 'cancel' })}>Cancel</button>
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

      {/* Action Confirm Modal */}
      {actionModal && (
        <Modal isOpen={true} onClose={() => setActionModal(null)}
          title={`${actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)} Request`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
              <button className={`btn ${actionModal.action === 'cancel' || actionModal.action === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleAction} disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </>
          }>
          <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--gray-600)' }}>
            Request: <strong>{actionModal.req.request_number}</strong> — {actionModal.req.purpose}
          </p>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea className="form-control" rows={3}
              placeholder="Add remarks (optional)"
              value={actionRemarks}
              onChange={e => setActionRemarks(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}
