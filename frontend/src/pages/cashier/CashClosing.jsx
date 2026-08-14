import React, { useState, useEffect } from "react"
import { cashierApi, accountsApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function CashClosing() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ date:format(new Date(),"yyyy-MM-dd"), physical_cash:"", notes:"" })
  const [saving, setSaving] = useState(false)
  const [systemBal, setSystemBal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const [rRes, cRes] = await Promise.all([cashierApi.cashClosing.list(), accountsApi.cash.accounts()])
      setRecords(rRes.data.results || rRes.data)
      const total = (cRes.data.results || cRes.data).reduce((s,a)=>s+parseFloat(a.current_balance||0),0)
      setSystemBal(total)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await cashierApi.cashClosing.create(form); toast.success("Cash closing recorded."); setShowModal(false); load() }
    catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  const diff = form.physical_cash ? systemBal - parseFloat(form.physical_cash) : null

  return (
    <div>
      <PageHeader title="Daily Cash Closing" subtitle="End-of-day cash reconciliation">
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Record Closing</button>
      </PageHeader>
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>System Balance</th><th>Physical Cash</th><th>Difference</th><th>Closed By</th><th>Notes</th></tr></thead>
              <tbody>
                {records.length===0 ? <tr><td colSpan={6}><EmptyState icon="🔒" title="No closing records" /></td></tr>
                  : records.map(r=>(
                  <tr key={r.id}>
                    <td>{r.date ? format(new Date(r.date),"dd MMM yyyy") : "-"}</td>
                    <td>{formatINR(r.system_balance)}</td>
                    <td>{formatINR(r.physical_cash)}</td>
                    <td style={{color:parseFloat(r.difference||0)===0?"var(--success)":"var(--danger)",fontWeight:600}}>
                      {r.difference >= 0 ? "+" : ""}{formatINR(r.difference)}
                    </td>
                    <td>{r.closed_by?.full_name || "-"}</td>
                    <td>{r.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="Daily Cash Closing"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="closing-form" type="submit" disabled={saving}>{saving?"Saving...":"Record Closing"}</button></>}>
          <div style={{background:"var(--primary-50)",borderRadius:8,padding:14,marginBottom:16}}>
            <p style={{fontSize:13,fontWeight:600}}>System Cash Balance: <span style={{color:"var(--primary-700)"}}>{formatINR(systemBal)}</span></p>
          </div>
          <form id="closing-form" onSubmit={handleSave}>
            <div className="form-group"><label className="form-label required">Date</label>
              <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label required">Physical Cash Count (₹)</label>
              <input className="form-control" type="number" required step="0.01" value={form.physical_cash} onChange={e=>setForm(f=>({...f,physical_cash:e.target.value}))} />
              {diff !== null && (
                <p className="form-hint" style={{color:diff===0?"var(--success)":"var(--danger)",fontWeight:600}}>
                  {diff===0 ? "✓ Balanced" : diff > 0 ? `⚠ Excess of ${formatINR(diff)} in system` : `⚠ Short by ${formatINR(Math.abs(diff))}`}
                </p>
              )}
            </div>
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
