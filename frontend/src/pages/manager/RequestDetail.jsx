import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { managerApi } from "../../api"
import { useAuthStore } from "../../store/authStore"
import { StatusBadge, AmountDisplay, LoadingState, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [req, setReq] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [actionData, setActionData] = useState({ remarks:"", amount_approved:"", rejection_reason:"", hold_reason:"" })
  const [acting, setActing] = useState(false)

  const load = async () => {
    try {
      const [rRes, hRes] = await Promise.all([managerApi.requests.get(id), managerApi.requests.history(id)])
      setReq(rRes.data); setHistory(hRes.data)
    } catch (_) { toast.error("Failed to load request") } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const handleAction = async () => {
    setActing(true)
    try {
      await managerApi.requests.action(id, actionModal, actionData)
      toast.success(`Request ${actionModal}d.`)
      setActionModal(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || "Action failed") } finally { setActing(false) }
  }

  const handleActionDirect = async (actionStr) => {
    setActing(true)
    try {
      await managerApi.requests.action(id, actionStr, {})
      toast.success(`Action ${actionStr} successful.`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || "Action failed") } finally { setActing(false) }
  }

  if (loading) return <LoadingState />
  if (!req) return <div>Request not found.</div>

  const isAccountant = user?.role === "ACCOUNTANT" || user?.role === "ADMIN"
  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN"

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>{req.request_number}</h2>
          <p>{req.purpose}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
          {isManager && req.status === "SUBMITTED" && (
            <button className="btn btn-primary" onClick={() => handleActionDirect("assign_fao")}>Assign FAO</button>
          )}
          {isManager && (req.status === "UNDER_REVIEW" || req.status === "SUBMITTED" || req.status === "WITH_ACO" || req.status === "WITH_GEO") && <>
            <button className="btn btn-success" onClick={() => setActionModal("approve")}>✓ Approve</button>
            <button className="btn btn-warning" onClick={() => setActionModal("hold")}>⏸ Hold</button>
            <button className="btn btn-danger" onClick={() => setActionModal("reject")}>✕ Reject</button>
          </>}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <div>
          <div className="data-card">
            <div className="data-card-header"><div className="data-card-title">Request Details</div><StatusBadge status={req.status} /></div>
            <div style={{padding:20}}>
              <div className="detail-grid">
                {[["Request No", req.request_number],["Type", req.request_type],["Category", req.category],
                  ["Priority", req.priority],["Purpose", req.purpose],["Required Date", req.required_date || "-"],
                  ["Beneficiary", req.beneficiary_name || "-"],["Contact", req.beneficiary_contact || "-"],
                ].map(([l,v]) => (
                  <div className="detail-field" key={l}><label>{l}</label><span>{v}</span></div>
                ))}
              </div>
              {req.description && <div style={{marginTop:12}}><label style={{fontSize:12,color:"var(--gray-500)"}}>Description</label><p style={{fontSize:13,marginTop:4}}>{req.description}</p></div>}
            </div>
          </div>

          <div className="data-card" style={{marginTop:16}}>
            <div className="data-card-header"><div className="data-card-title">Financial Information</div></div>
            <div style={{padding:20}}>
              <div className="detail-grid">
                <div className="detail-field"><label>Amount Requested</label><span className="amount amount-debit">{formatINR(req.amount_requested)}</span></div>
                <div className="detail-field"><label>Amount Approved</label><span className="amount amount-neutral">{req.amount_approved ? formatINR(req.amount_approved) : "—"}</span></div>
                <div className="detail-field"><label>Amount Disbursed</label><span className="amount amount-debit">{req.amount_disbursed ? formatINR(req.amount_disbursed) : "—"}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="data-card">
            <div className="data-card-header"><div className="data-card-title">Status Timeline</div></div>
            <div style={{padding:16}}>
              <ul className="timeline">
                {history.map((h, i) => (
                  <li key={h.id} className="timeline-item">
                    <div className="timeline-dot">✓</div>
                    <div className="timeline-content">
                      <div className="timeline-status">{h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}</div>
                      <div className="timeline-meta">{h.changed_by_name} · {h.timestamp ? format(new Date(h.timestamp),"dd MMM yy, HH:mm") : ""}</div>
                      {h.remarks && <div className="timeline-remark">"{h.remarks}"</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {actionModal && (
        <Modal isOpen={true} onClose={() => setActionModal(null)} title={`${actionModal} Request: ${req.request_number}`}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
            <button className={`btn ${["reject","cancel"].includes(actionModal) ? "btn-danger" : actionModal==="approve" ? "btn-success" : "btn-primary"}`}
              onClick={handleAction} disabled={acting}>{acting ? "Processing..." : "Confirm"}</button>
          </>}>
          {actionModal === "approve" && (
            <div className="form-group">
              <label className="form-label">Approved Amount (₹)</label>
              <input className="form-control" type="number" value={actionData.amount_approved}
                placeholder={req.amount_requested} onChange={e => setActionData(d => ({...d, amount_approved:e.target.value}))} />
            </div>
          )}
          {actionModal === "hold" && (
            <div className="form-group">
              <label className="form-label required">Hold Reason</label>
              <textarea className="form-control" rows={3} value={actionData.hold_reason}
                onChange={e => setActionData(d => ({...d, hold_reason:e.target.value}))} />
            </div>
          )}
          {actionModal === "reject" && (
            <div className="form-group">
              <label className="form-label required">Rejection Reason</label>
              <textarea className="form-control" rows={3} value={actionData.rejection_reason}
                onChange={e => setActionData(d => ({...d, rejection_reason:e.target.value}))} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea className="form-control" rows={2} value={actionData.remarks}
              onChange={e => setActionData(d => ({...d, remarks:e.target.value}))} />
          </div>
        </Modal>
      )}
    </div>
  )
}
