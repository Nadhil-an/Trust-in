import React, { useState, useEffect } from "react"
import { cashierApi, managerApi } from "../../api"
import { StatusBadge, AmountDisplay, LoadingState, EmptyState, PageHeader, Modal, formatINR } from "../../components/shared"
import PaymentMethodSelector from "../../components/PaymentMethodSelector"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PendingDisbursements() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState("WEEK")
  const [disburseModal, setDisburseModal] = useState(null)
  const [scheduleModal, setScheduleModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [form, setForm] = useState({ amount_disbursed:"", payment_method:"CASH", voucher_number:"", receiver_name:"", remarks:"", scheduled_payout_date:"", rejection_reason:"" })
  const [processing, setProcessing] = useState(false)

  const filteredRequests = requests.filter(r => {

    if (dateFilter === "ALL") return true;

    const targetDate = new Date(r.approved_at || new Date());
    const now = new Date();
    
    if (dateFilter === "DAY") {
      return targetDate.toDateString() === now.toDateString();
    }
    if (dateFilter === "WEEK") {
      const diffDays = (now - targetDate) / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= 7;
    }
    if (dateFilter === "MONTH") {
      return targetDate.getMonth() === now.getMonth() && targetDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const load = async () => {
    setLoading(true)
    try { const res = await cashierApi.pending(); setRequests(res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener("request-update", h)
    return () => window.removeEventListener("request-update", h)
  }, [])

  const openDisburse = (req) => {
    setForm({ amount_disbursed: req.amount_approved || req.amount_requested, payment_method:"CASH", voucher_number:"", receiver_name: req.beneficiary_name || "", remarks:"" })
    setDisburseModal(req)
  }

  const handleDisburse = async (e) => {
    e.preventDefault()
    setProcessing(true)
    try {
      const res = await cashierApi.disburse(disburseModal.id, form)
      toast.success(`₹${Number(form.amount_disbursed).toLocaleString("en-IN")} paid successfully!`)
      setDisburseModal(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || "Payout failed") } finally { setProcessing(false) }
  }

  const handleSchedule = async (e) => {
    e.preventDefault()
    setProcessing(true)
    try {
      await managerApi.requests.action(scheduleModal.id, 'schedule_payout', { scheduled_payout_date: form.scheduled_payout_date })
      toast.success("Payout scheduled successfully!")
      setScheduleModal(null)
      load()
    } catch (err) { toast.error("Failed to schedule payout") } finally { setProcessing(false) }
  }

  const handleReject = async (e) => {
    e.preventDefault()
    setProcessing(true)
    try {
      await managerApi.requests.action(rejectModal.id, 'cashier_reject', { rejection_reason: form.rejection_reason })
      toast.success("Request rejected")
      setRejectModal(null)
      load()
    } catch (err) { toast.error("Failed to reject request") } finally { setProcessing(false) }
  }

  return (
    <div>
      <PageHeader title="Pending Payouts" subtitle={`${filteredRequests.length} request(s) awaiting payout`} />
      
      <div className="data-card">
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginRight: 12 }}>Filter by Date:</span>
          <select className="form-control" style={{ width: 'auto' }} value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
            <option value="DAY">Today</option>
            <option value="WEEK">One Week</option>
            <option value="MONTH">This Month</option>
            <option value="ALL">All Time</option>
          </select>
        </div>

        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Request No</th><th>Beneficiary</th><th>Scheduled Payout</th><th>Purpose</th><th>Category</th><th>Requested</th><th>Approved</th><th>Requested By</th><th>Approved By</th><th>Priority</th><th>Action</th></tr></thead>
              <tbody>
                {filteredRequests.length===0 ? <tr><td colSpan={11}><EmptyState icon="✅" title="No pending payouts" message="Nothing found for the selected filters." /></td></tr>
                  : filteredRequests.map(r=>(
                  <tr key={r.id}>
                    <td className="td-mono">{r.request_number}</td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>
                      {r.beneficiary_name || "-"}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.scheduled_payout_date ? (
                        <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                          📅 {format(new Date(r.scheduled_payout_date), 'dd MMM yyyy')}
                        </div>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>Not set</span>
                      )}
                    </td>
                    <td>{r.purpose}</td>
                    <td><span className="badge badge-blue">{r.category}</span></td>
                    <td><AmountDisplay amount={r.amount_requested} /></td>
                    <td><AmountDisplay amount={r.amount_approved || r.amount_requested} type="neutral" /></td>
                    <td>{r.requested_by?.full_name || r.requested_by_name}</td>
                    <td>{r.reviewed_by?.full_name || r.reviewed_by_name || "-"}</td>
                    <td><span className={`badge ${r.priority==="URGENT"?"badge-red":r.priority==="HIGH"?"badge-yellow":"badge-gray"}`}>{r.priority}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-success" onClick={()=>openDisburse(r)}>
                          💸 Payout
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={()=>{setForm(f=>({...f,scheduled_payout_date:r.scheduled_payout_date||''})); setScheduleModal(r)}}>
                          📅 Schedule
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={()=>{setForm(f=>({...f,rejection_reason:''})); setRejectModal(r)}}>
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {disburseModal && (
        <Modal isOpen={true} onClose={()=>setDisburseModal(null)} title={`Payout: ${disburseModal.request_number}`}
          footer={<><button className="btn btn-secondary" onClick={()=>setDisburseModal(null)}>Cancel</button>
            <button className="btn btn-success" form="disburse-form" type="submit" disabled={processing}>{processing?"Processing...":"✓ Confirm Payout"}</button></>}>
          <div style={{background:"var(--primary-50)",borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <p style={{fontSize:13,color:"var(--gray-700)"}}><strong>Purpose:</strong> {disburseModal.purpose}</p>
            <p style={{fontSize:13,color:"var(--gray-700)"}}><strong>Approved Amount:</strong> {formatINR(disburseModal.amount_approved || disburseModal.amount_requested)}</p>
          </div>
          <form id="disburse-form" onSubmit={handleDisburse}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Amount to Pay (₹)</label>
                <input className="form-control" type="number" required value={form.amount_disbursed} onChange={e=>setForm(f=>({...f,amount_disbursed:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Payment Method</label>
                <PaymentMethodSelector 
                  value={form.payment_method} 
                  onChange={v=>setForm(f=>({...f,payment_method:v}))} 
                  options={["CASH","CHEQUE","NEFT","UPI"]} 
                /></div>
              <div className="form-group"><label className="form-label required">Receiver Name</label>
                <input className="form-control" required value={form.receiver_name} onChange={e=>setForm(f=>({...f,receiver_name:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Voucher Number</label>
                <input className="form-control" value={form.voucher_number} onChange={e=>setForm(f=>({...f,voucher_number:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {scheduleModal && (
        <Modal isOpen={true} onClose={()=>setScheduleModal(null)} title={`Schedule Payout: ${scheduleModal.request_number}`}
          footer={<><button className="btn btn-secondary" onClick={()=>setScheduleModal(null)}>Cancel</button>
            <button className="btn btn-primary" form="schedule-form" type="submit" disabled={processing}>{processing?"Saving...":"Save Date"}</button></>}>
          <form id="schedule-form" onSubmit={handleSchedule}>
            <div className="form-group"><label className="form-label required">Scheduled Date</label>
              <input type="date" className="form-control" required value={form.scheduled_payout_date} onChange={e=>setForm(f=>({...f,scheduled_payout_date:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {rejectModal && (
        <Modal isOpen={true} onClose={()=>setRejectModal(null)} title={`Reject Request: ${rejectModal.request_number}`}
          footer={<><button className="btn btn-secondary" onClick={()=>setRejectModal(null)}>Cancel</button>
            <button className="btn btn-danger" form="reject-form" type="submit" disabled={processing}>{processing?"Rejecting...":"Reject"}</button></>}>
          <form id="reject-form" onSubmit={handleReject}>
            <div className="form-group"><label className="form-label required">Reason for Rejection</label>
              <textarea className="form-control" rows={3} required value={form.rejection_reason} onChange={e=>setForm(f=>({...f,rejection_reason:e.target.value}))} placeholder="Explain why this request is being rejected at the payout stage..."></textarea></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
