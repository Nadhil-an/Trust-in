import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PaymentAdvances() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [payoutDate, setPayoutDate] = useState("")
  const [hrRemarks, setHrRemarks] = useState("")
  const [actionType, setActionType] = useState("approve")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search }
      if (statusFilter) params.status = statusFilter
      const res = await hrApi.paymentAdvances.list(params)
      setItems(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load payment advance requests")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleAction = async (action) => {
    if (action === 'approve' && !payoutDate) {
      toast.error("Please enter the scheduled disbursement date for this staff member")
      return
    }
    setSubmitting(true)
    try {
      await hrApi.paymentAdvances.action(selected.id, {
        action,
        payout_date: payoutDate || null,
        hr_remarks: hrRemarks,
      })
      toast.success(`Advance request ${action}d successfully`)
      setShowModal(false)
      load()
    } catch (_) {
      toast.error("Failed to update payment advance request")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING': return 'badge-yellow'
      case 'APPROVED': return 'badge-blue'
      case 'DISBURSED': return 'badge-green'
      case 'REJECTED': return 'badge-gray'
      default: return 'badge-gray'
    }
  }

  return (
    <div>
      <PageHeader title="Salary Payment Advances" subtitle="Manage staff salary advance requests and schedule disbursement dates">
        <select 
          className="form-control" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px', marginLeft: 'auto' }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DISBURSED">Disbursed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </PageHeader>
      
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} placeholder="Search advance requests by ID or staff name..." />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Staff Member</th>
                  <th>Amount</th>
                  <th>Staff Requested Date</th>
                  <th>HR Scheduled Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="💵" title="No advance requests found" /></td></tr>
                ) : items.map(req => (
                  <tr key={req.id}>
                    <td className="td-mono">{req.request_id}</td>
                    <td><strong>{req.employee_name || req.requested_by_name}</strong></td>
                    <td style={{ color: '#16a34a', fontWeight: 700 }}>₹{parseFloat(req.amount).toLocaleString('en-IN')}</td>
                    <td>{req.needed_by_date ? format(new Date(req.needed_by_date), "dd MMM yyyy") : '-'}</td>
                    <td>
                      {req.payout_date ? (
                        <span className="badge badge-blue">{format(new Date(req.payout_date), "dd MMM yyyy")}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>Not Set</span>
                      )}
                    </td>
                    <td><span className={`badge ${getStatusBadge(req.status)}`}>{req.status}</span></td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => {
                        setSelected(req)
                        setPayoutDate(req.payout_date || req.needed_by_date || "")
                        setHrRemarks(req.hr_remarks || "")
                        setShowModal(true)
                      }}>
                        Manage Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selected && (
        <Modal isOpen={true} onClose={() => setShowModal(false)} title={`Payment Advance ${selected.request_id}`} size="modal-md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            {selected.status === 'PENDING' && (
              <>
                <button className="btn btn-danger" disabled={submitting} onClick={() => handleAction('reject')}>Reject</button>
                <button className="btn btn-primary" disabled={submitting} onClick={() => handleAction('approve')}>Approve Request</button>
              </>
            )}
            {selected.status === 'APPROVED' && (
              <button className="btn btn-success" disabled={submitting} onClick={() => handleAction('disburse')}>Mark Disbursed / Paid</button>
            )}
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>STAFF MEMBER</span>
                <span className={`badge ${getStatusBadge(selected.status)}`}>{selected.status}</span>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>{selected.employee_name}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '6px' }}>
                ₹{parseFloat(selected.amount).toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Staff Request Date (When Needed)</span>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                📅 {selected.needed_by_date ? format(new Date(selected.needed_by_date), "EEEE, dd MMMM yyyy") : 'Not specified'}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Reason Provided by Staff</span>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '10px', borderRadius: '6px', marginTop: '4px', border: '1px solid #e5e7eb', fontSize: '13px' }}>
                {selected.reason}
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                HR Disbursement Date (When company will give it to staff member) *
              </label>
              <input 
                type="date"
                className="form-control"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                required
              />
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Specify the exact date HR/Cashier will disburse this salary advance to {selected.employee_name}.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>HR Remarks / Notes</label>
              <textarea 
                className="form-control" 
                rows={2} 
                placeholder="Enter remarks for staff member..." 
                value={hrRemarks}
                onChange={(e) => setHrRemarks(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
