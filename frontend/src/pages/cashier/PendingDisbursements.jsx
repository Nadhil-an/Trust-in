import React, { useState, useEffect } from "react"
import { cashierApi } from "../../api"
import { StatusBadge, AmountDisplay, LoadingState, EmptyState, PageHeader, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PendingDisbursements() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [disburseModal, setDisburseModal] = useState(null)
  const [form, setForm] = useState({ amount_disbursed:"", payment_method:"CASH", voucher_number:"", receiver_name:"", remarks:"" })
  const [processing, setProcessing] = useState(false)

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

  return (
    <div>
      <PageHeader title="Pending Payouts" subtitle={`${requests.length} request(s) awaiting payout`} />
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Request No</th><th>Purpose</th><th>Category</th><th>Requested</th><th>Approved</th><th>Requested By</th><th>Approved By</th><th>Priority</th><th>Action</th></tr></thead>
              <tbody>
                {requests.length===0 ? <tr><td colSpan={9}><EmptyState icon="✅" title="No pending payouts" message="All requests have been processed." /></td></tr>
                  : requests.map(r=>(
                  <tr key={r.id}>
                    <td className="td-mono">{r.request_number}</td>
                    <td>{r.purpose}</td>
                    <td><span className="badge badge-blue">{r.category}</span></td>
                    <td><AmountDisplay amount={r.amount_requested} /></td>
                    <td><AmountDisplay amount={r.amount_approved || r.amount_requested} type="neutral" /></td>
                    <td>{r.requested_by?.full_name || r.requested_by_name}</td>
                    <td>{r.reviewed_by?.full_name || r.reviewed_by_name || "-"}</td>
                    <td><span className={`badge ${r.priority==="URGENT"?"badge-red":r.priority==="HIGH"?"badge-yellow":"badge-gray"}`}>{r.priority}</span></td>
                    <td>
                      <button className="btn btn-sm btn-success" id={`disburse-${r.id}`} onClick={()=>openDisburse(r)}>
                        💸 Payout
                      </button>
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
                <select className="form-control" value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}>
                  {["CASH","CHEQUE","NEFT","UPI"].map(m=><option key={m}>{m}</option>)}</select></div>
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
    </div>
  )
}
