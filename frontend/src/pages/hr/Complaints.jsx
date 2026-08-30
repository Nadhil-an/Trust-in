import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function Complaints() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search }
      if (statusFilter) params.status = statusFilter
      const res = await hrApi.complaints.list(params)
      setItems(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load complaints")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleStatusChange = async (id, newStatus) => {
    try {
      await hrApi.complaints.update(id, { status: newStatus })
      toast.success(`Complaint marked as ${newStatus}`)
      load()
    } catch (_) {
      toast.error("Failed to update status")
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING': return 'badge-yellow'
      case 'IN_PROGRESS': return 'badge-blue'
      case 'RESOLVED': return 'badge-green'
      case 'REJECTED': return 'badge-gray'
      default: return 'badge-gray'
    }
  }

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Manage staff complaints">
        <select 
          className="form-control" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px', marginLeft: 'auto' }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </PageHeader>
      
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} placeholder="Search complaints..." />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Staff Name</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={6}><EmptyState icon="📝" title="No complaints found" /></td></tr>
                  : items.map(c => (
                  <tr key={c.id}>
                    <td className="td-mono">{c.complaint_id}</td>
                    <td>{format(new Date(c.created_at), "dd MMM yyyy")}</td>
                    <td>{c.employee_name || "Unknown"}</td>
                    <td>{c.title}</td>
                    <td><span className={`badge ${getStatusBadge(c.status)}`}>{c.status.replace('_', ' ')}</span></td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => setSelected(c) || setShowModal(true)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selected && (
        <Modal isOpen={true} onClose={() => setShowModal(false)} title={`Complaint ${selected.complaint_id}`} size="modal-md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
            {selected.status !== 'RESOLVED' && <button className="btn btn-primary" onClick={() => { handleStatusChange(selected.id, 'RESOLVED'); setShowModal(false); }}>Mark Resolved</button>}
          </>}>
          <div className="details-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Raised By</strong>
              <div>{selected.employee_name}</div>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Date</strong>
              <div>{format(new Date(selected.created_at), "dd MMM yyyy HH:mm")}</div>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Title</strong>
              <div>{selected.title}</div>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Description</strong>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '10px', borderRadius: '6px', marginTop: '4px' }}>
                {selected.description}
              </div>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Update Status</strong>
              <select className="form-control" value={selected.status} onChange={(e) => {
                handleStatusChange(selected.id, e.target.value);
                setSelected({ ...selected, status: e.target.value });
              }}>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
