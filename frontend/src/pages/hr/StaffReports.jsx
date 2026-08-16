import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function StaffReports() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search }
      if (statusFilter) params.status = statusFilter
      const res = await hrApi.staffReports.list(params)
      setItems(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load staff reports")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleUpdateStatus = async (id, newStatus) => {
    setSaving(true)
    try {
      await hrApi.staffReports.update(id, { status: newStatus, admin_notes: adminNotes })
      toast.success(`Report status updated to ${newStatus}`)
      setShowModal(false)
      load()
    } catch (_) {
      toast.error("Failed to update report")
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING': return 'badge-yellow'
      case 'UNDER_REVIEW': return 'badge-blue'
      case 'APPROVED': return 'badge-green'
      case 'REJECTED': return 'badge-gray'
      default: return 'badge-gray'
    }
  }

  return (
    <div>
      <PageHeader title="Staff Submitted Reports" subtitle="Review reports uploaded by staff members upon administration requests">
        <select 
          className="form-control" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px', marginLeft: 'auto' }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </PageHeader>
      
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} placeholder="Search reports by title or ID..." />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Submitted Date</th>
                  <th>Staff Member</th>
                  <th>Report Title</th>
                  <th>Status</th>
                  <th>Attachment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="📄" title="No staff reports found" /></td></tr>
                ) : items.map(r => (
                  <tr key={r.id}>
                    <td className="td-mono">{r.report_id}</td>
                    <td>{r.created_at ? format(new Date(r.created_at), "dd MMM yyyy") : r.report_date}</td>
                    <td><strong>{r.employee_name || r.submitted_by_name || "Staff Member"}</strong></td>
                    <td>{r.title}</td>
                    <td><span className={`badge ${getStatusBadge(r.status)}`}>{r.status.replace('_', ' ')}</span></td>
                    <td>
                      {r.file ? (
                        <a href={r.file} target="_blank" rel="noreferrer" className="btn btn-xs btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          📎 View File
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>No File</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setSelected(r); setAdminNotes(r.admin_notes || ""); setShowModal(true); }}>
                        Review
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
        <Modal isOpen={true} onClose={() => setShowModal(false)} title={`Report ${selected.report_id}`} size="modal-md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => handleUpdateStatus(selected.id, selected.status)}>Save Review</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Submitted By</span>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>{selected.employee_name}</div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Report Title</span>
              <div style={{ fontWeight: 600 }}>{selected.title}</div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Description / Content</span>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '12px', borderRadius: '8px', marginTop: '4px', border: '1px solid #e5e7eb' }}>
                {selected.description}
              </div>
            </div>
            {selected.file && (
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Attached Document</span>
                <a href={selected.file} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  📁 Download Attachment Document
                </a>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Review Status</label>
              <select className="form-control" value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>HR / Admin Notes</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="Enter feedback or comments for staff member..." 
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
