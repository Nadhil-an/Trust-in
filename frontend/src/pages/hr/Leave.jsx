import React, { useState, useEffect, useCallback } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
export default function LeavePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [approvalModal, setApprovalModal] = useState(null)
  const [reason, setReason] = useState("")
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.leave.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])

  const handleAction = async (id, action) => {
    setActing(true)
    try { await hrApi.leave.action(id,{action, reason}); toast.success(`Leave ${action}d.`); setApprovalModal(null); load() }
    catch (_) { toast.error("Action failed") } finally { setActing(false) }
  }

  return (
    <div>
      <PageHeader title="Leave Management" subtitle="Leave requests and approvals" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="📅" title="No leave requests" /></td></tr>
                  : items.map(l=>(<tr key={l.id}>
                    <td>{l.employee_name}</td>
                    <td><span className="badge badge-blue">{l.leave_type}</span></td>
                    <td>{l.from_date ? format(new Date(l.from_date),"dd MMM yyyy") : "-"}</td>
                    <td>{l.to_date ? format(new Date(l.to_date),"dd MMM yyyy") : "-"}</td>
                    <td>{l.total_days || "-"}</td>
                    <td><span className={`badge ${l.status==="APPROVED"?"badge-green":l.status==="REJECTED"?"badge-red":l.status==="PENDING"?"badge-yellow":"badge-gray"}`}>{l.status}</span></td>
                    <td>
                      {l.status==="PENDING" && <>
                        <button className="btn btn-sm btn-success" onClick={()=>{setApprovalModal({l,action:"approve"});setReason("")}}>✓ Approve</button>{" "}
                        <button className="btn btn-sm btn-danger" onClick={()=>{setApprovalModal({l,action:"reject"});setReason("")}}>✕ Reject</button>
                      </>}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {approvalModal && (
        <Modal isOpen={true} onClose={()=>setApprovalModal(null)} title={`${approvalModal.action} Leave Request`}
          footer={<><button className="btn btn-secondary" onClick={()=>setApprovalModal(null)}>Cancel</button>
            <button className={`btn ${approvalModal.action==="approve"?"btn-success":"btn-danger"}`}
              onClick={()=>handleAction(approvalModal.l.id, approvalModal.action)} disabled={acting}>{acting?"Processing...":"Confirm"}</button></>}>
          <p style={{fontSize:13,marginBottom:12}}>Employee: <strong>{approvalModal.l.employee_name}</strong></p>
          {approvalModal.action==="reject" && (
            <div className="form-group"><label className="form-label">Rejection Reason</label>
              <textarea className="form-control" rows={3} value={reason} onChange={e=>setReason(e.target.value)} /></div>
          )}
        </Modal>
      )}
    </div>
  )
}
