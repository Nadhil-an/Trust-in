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
  const [reportModal, setReportModal] = useState({ type: null, data: null, loading: false })

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

  const handleTimelineClick = async (type) => {
    setReportModal({ type, data: null, loading: true })
    try {
      let res;
      if (type === 'fao') res = await managerApi.faoReport.get(id);
      else if (type === 'aco') res = await managerApi.acoCalculation.get(id);
      else if (type === 'geo') res = await managerApi.geoReport.get(id);
      setReportModal({ type, data: res.data, loading: false })
    } catch (err) {
      toast.error(`Could not load ${type.toUpperCase()} details`);
      setReportModal({ type: null, data: null, loading: false })
    }
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
                <div className="detail-field"><label>Assessment No</label><span>{req.request_number}</span></div>
                <div className="detail-field"><label>Name</label><span>{req.beneficiary_name || "-"}</span></div>
                <div className="detail-field"><label>Category</label><span>{req.category}</span></div>
                <div className="detail-field"><label>Priority</label><span className={`badge ${req.priority === 'CRITICAL' || req.priority === 'URGENT' ? 'badge-red' : req.priority === 'HIGH' ? 'badge-yellow' : req.priority === 'NORMAL' ? 'badge-blue' : 'badge-gray'}`}>{req.priority}</span></div>
                <div className="detail-field"><label>Contact Number</label><span>{req.beneficiary_phone || "-"}</span></div>
                <div className="detail-field"><label>Address</label><span>{req.beneficiary_address || "-"}</span></div>
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
                {history.map((h, i) => {
                  let reportType = null;
                  const remarkLower = (h.remarks || '').toLowerCase();
                  if (remarkLower.includes('fao report submitted')) reportType = 'fao';
                  else if (remarkLower.includes('aco calculation submitted')) reportType = 'aco';
                  else if (remarkLower.includes('geo report submitted')) reportType = 'geo';

                  return (
                    <li key={h.id} className="timeline-item" 
                        style={reportType ? { cursor: 'pointer' } : {}} 
                        onClick={() => reportType && handleTimelineClick(reportType)}>
                      <div className="timeline-dot">✓</div>
                      <div className="timeline-content">
                        <div className="timeline-status" style={reportType ? { color: 'var(--primary)', textDecoration: 'underline' } : {}}>
                          {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}
                        </div>
                        <div className="timeline-meta">{h.changed_by_name} · {h.timestamp ? format(new Date(h.timestamp),"dd MMM yy, HH:mm") : ""}</div>
                        {h.remarks && <div className="timeline-remark">"{h.remarks}"</div>}
                        {reportType && <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontWeight: '600' }}>Click to view details &rarr;</div>}
                      </div>
                    </li>
                  )
                })}
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

      {reportModal.type && (
        <Modal 
          isOpen={true} 
          onClose={() => setReportModal({ type: null, data: null, loading: false })} 
          title={`${reportModal.type.toUpperCase()} Report Details`} 
          footer={<button className="btn btn-secondary" onClick={() => setReportModal({ type: null, data: null, loading: false })}>Close</button>}
        >
          {reportModal.loading ? (
            <LoadingState />
          ) : reportModal.data ? (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
              {reportModal.type === 'fao' && (
                <div className="detail-grid">
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Beneficiary Name</label><span style={{ fontSize: 16, fontWeight: '700', color: 'var(--text-primary)' }}>{req.beneficiary_name || "-"}</span></div>
                  <div className="detail-field"><label>Eligibility</label><span className={`badge ${reportModal.data.eligibility === 'ELIGIBLE' ? 'badge-green' : 'badge-red'}`}>{reportModal.data.eligibility}</span></div>
                  <div className="detail-field"><label>Urgency</label><span>{reportModal.data.urgency_assessment}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Officer Findings</label><span>{reportModal.data.officer_findings || "None"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Beneficiary Verified</label><span>{reportModal.data.beneficiary_verified_name || "-"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Address Corrections</label><span>{reportModal.data.address_corrections || "None"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Neighbour Statements</label>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {reportModal.data.neighbour_1_name ? <p><strong>{reportModal.data.neighbour_1_name} ({reportModal.data.neighbour_1_relationship}):</strong> {reportModal.data.neighbour_1_statement}</p> : <p>None</p>}
                    </div>
                  </div>
                </div>
              )}
              {reportModal.type === 'aco' && (
                <div>
                  <div className="detail-grid" style={{ marginBottom: 16 }}>
                    <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Beneficiary Name</label><span style={{ fontSize: 16, fontWeight: '700', color: 'var(--text-primary)' }}>{req.beneficiary_name || "-"}</span></div>
                    <div className="detail-field"><label>Recommended Amount</label><span className="amount amount-neutral">{formatINR(reportModal.data.recommended_amount)}</span></div>
                    <div className="detail-field"><label>Total Estimated Cost</label><span>{formatINR(reportModal.data.total_estimated_cost)}</span></div>
                    <div className="detail-field"><label>One Time Cost</label><span>{formatINR(reportModal.data.total_one_time_cost)}</span></div>
                    <div className="detail-field"><label>Recurring Cost</label><span>{reportModal.data.has_recurring_cost ? `${formatINR(reportModal.data.recurring_monthly_cost)} x ${reportModal.data.recurring_duration_months} mo` : 'None'}</span></div>
                    <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Justification</label><span>{reportModal.data.justification || "None"}</span></div>
                    {reportModal.data.notes && <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><span>{reportModal.data.notes}</span></div>}
                  </div>
                  {reportModal.data.line_items && reportModal.data.line_items.length > 0 && (
                    <>
                      <label className="form-label" style={{ marginTop: 16, marginBottom: 8 }}>Line Items</label>
                      <table className="table" style={{ width: '100%', fontSize: 13 }}>
                        <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
                        <tbody>
                          {reportModal.data.line_items.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.item}</td><td>{item.category}</td><td>{item.qty} {item.unit}</td>
                              <td>{formatINR(item.unit_cost)}</td><td>{formatINR(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
              {reportModal.type === 'geo' && (
                <div className="detail-grid">
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Beneficiary Name</label><span style={{ fontSize: 16, fontWeight: '700', color: 'var(--text-primary)' }}>{req.beneficiary_name || "-"}</span></div>
                  <div className="detail-field"><label>Recommendation</label><span>{reportModal.data.recommendation}</span></div>
                  <div className="detail-field"><label>Recommended Amount Override</label><span>{reportModal.data.recommended_amount_override ? formatINR(reportModal.data.recommended_amount_override) : "N/A"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Verification Findings</label><span>{reportModal.data.verification_findings || "None"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Discrepancies</label><span>{reportModal.data.discrepancies_found || "None"}</span></div>
                  <div className="detail-field" style={{ gridColumn: '1 / -1' }}><label>Field Notes</label><span>{reportModal.data.field_notes || "None"}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-500)' }}>Report details not found or not submitted yet.</div>
          )}
        </Modal>
      )}
    </div>
  )
}
