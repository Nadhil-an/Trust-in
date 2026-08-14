import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { accountsApi, managerApi } from "../../api"
import { StatusBadge, AmountDisplay, LoadingState, EmptyState, PageHeader, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function MoneyRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [actionData, setActionData] = useState({ remarks:"", amount_approved:"", rejection_reason:"", hold_reason:"" })
  const [acting, setActing] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try { const res = await accountsApi.moneyRequests(); setRequests(res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener("request-update", h)
    return () => window.removeEventListener("request-update", h)
  }, [])

  const handleAction = async () => {
    setActing(true)
    try {
      await managerApi.requests.action(actionModal.req.id, actionModal.action, actionData)
      toast.success(`Request ${actionModal.action}d.`)
      setActionModal(null)
      setActionData({ remarks:"", amount_approved:"", rejection_reason:"", hold_reason:"" })
      load()
    } catch (err) { toast.error(err.response?.data?.error || "Action failed") } finally { setActing(false) }
  }

  return (
    <div>
      <PageHeader title="Money Requests" subtitle="Review and approve pending assessment requests" />
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Request No</th><th>Purpose</th><th>Amount</th><th>Requested By</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.length === 0 ? <tr><td colSpan={7}><EmptyState icon="💰" title="No pending requests" /></td></tr>
                  : requests.map(r => (
                  <tr key={r.id}>
                    <td className="td-mono" style={{cursor:"pointer"}} onClick={() => navigate(`/manager/requests/${r.id}`)}>{r.request_number}</td>
                    <td>{r.purpose}</td>
                    <td><AmountDisplay amount={r.amount_requested} /></td>
                    <td>{r.requested_by_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{fontSize:12,color:"var(--gray-500)"}}>{r.created_at ? format(new Date(r.created_at),"dd MMM yy") : "-"}</td>
                    <td>
                      <div style={{display:"flex",gap:4}}>
                        {r.status === "SUBMITTED" && <button className="btn btn-sm btn-primary" onClick={() => setActionModal({req:r,action:"review"})}>Review</button>}
                        {r.status === "UNDER_REVIEW" && <>
                          <button className="btn btn-sm btn-success" onClick={() => setActionModal({req:r,action:"approve"})}>✓ Approve</button>
                          <button className="btn btn-sm btn-warning" onClick={() => setActionModal({req:r,action:"hold"})}>Hold</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setActionModal({req:r,action:"reject"})}>✕ Reject</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionModal && (
        <Modal isOpen={true} onClose={() => setActionModal(null)}
          title={`${actionModal.action.toUpperCase()}: ${actionModal.req.request_number}`}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
            <button className={`btn ${actionModal.action==="approve"?"btn-success":actionModal.action==="reject"?"btn-danger":"btn-primary"}`}
              onClick={handleAction} disabled={acting}>{acting?"Processing...":"Confirm"}</button>
          </>}>
          {actionModal.action === "approve" && (
            <div className="form-group"><label className="form-label">Approved Amount (₹)</label>
              <input className="form-control" type="number" value={actionData.amount_approved}
                placeholder={actionModal.req.amount_requested}
                onChange={e => setActionData(d=>({...d,amount_approved:e.target.value}))} /></div>
          )}
          {actionModal.action === "hold" && (
            <div className="form-group"><label className="form-label required">Hold Reason</label>
              <textarea className="form-control" rows={3} value={actionData.hold_reason}
                onChange={e => setActionData(d=>({...d,hold_reason:e.target.value}))} /></div>
          )}
          {actionModal.action === "reject" && (
            <div className="form-group"><label className="form-label required">Rejection Reason</label>
              <textarea className="form-control" rows={3} value={actionData.rejection_reason}
                onChange={e => setActionData(d=>({...d,rejection_reason:e.target.value}))} /></div>
          )}
          <div className="form-group"><label className="form-label">Remarks</label>
            <textarea className="form-control" rows={2} value={actionData.remarks}
              onChange={e => setActionData(d=>({...d,remarks:e.target.value}))} /></div>
        </Modal>
      )}
    </div>
  )
}
