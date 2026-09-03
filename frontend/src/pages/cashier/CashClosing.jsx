import React, { useState, useEffect } from "react"
import { cashierApi, accountsApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function CashClosing() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ date:format(new Date(),"yyyy-MM-dd"), physical_cash:"", physical_bank:"", notes:"" })
  const [saving, setSaving] = useState(false)
  const [systemBal, setSystemBal] = useState(0)
  const [bankBal, setBankBal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const [rRes, dRes] = await Promise.all([cashierApi.cashClosing.list(), accountsApi.dashboard()])
      setRecords(rRes.data.results || rRes.data)
      setSystemBal(dRes.data.cash_balance || 0)
      setBankBal(dRes.data.bank_balance || 0)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await cashierApi.cashClosing.create(form); toast.success("Day book recorded."); setShowModal(false); load() }
    catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  const diff = form.physical_cash ? systemBal - parseFloat(form.physical_cash) : null
  const bankDiff = form.physical_bank ? bankBal - parseFloat(form.physical_bank) : null

  return (
    <div>
      <PageHeader title="Day Book" subtitle="End-of-day cash reconciliation">
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Record Day Book</button>
      </PageHeader>
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>System (Cash / Bank)</th><th>Physical (Cash / Bank)</th><th>Difference (Cash / Bank)</th><th>Closed By</th><th>Notes</th></tr></thead>
              <tbody>
                {records.length===0 ? <tr><td colSpan={6}><EmptyState icon="🔒" title="No closing records" /></td></tr>
                  : records.map(r=>(
                  <tr key={r.id}>
                    <td>{r.date ? format(new Date(r.date),"dd MMM yyyy") : "-"}</td>
                    <td>
                      <div>C: {formatINR(r.system_balance)}</div>
                      <div style={{color:'var(--gray-500)', fontSize: 12}}>B: {formatINR(r.system_bank_balance || 0)}</div>
                    </td>
                    <td>
                      <div>C: {formatINR(r.physical_cash)}</div>
                      <div style={{color:'var(--gray-500)', fontSize: 12}}>B: {formatINR(r.physical_bank || 0)}</div>
                    </td>
                    <td>
                      <div style={{color:parseFloat(r.difference||0)===0?"var(--success)":"var(--danger)",fontWeight:600}}>
                        C: {r.difference >= 0 ? "+" : ""}{formatINR(r.difference)}
                      </div>
                      <div style={{color:parseFloat(r.bank_difference||0)===0?"var(--success)":"var(--danger)",fontWeight:600, fontSize: 12}}>
                        B: {r.bank_difference >= 0 ? "+" : ""}{formatINR(r.bank_difference || 0)}
                      </div>
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
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="Day Book"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="closing-form" type="submit" disabled={saving}>{saving?"Saving...":"Record Day Book"}</button></>}>
          <div style={{background:"var(--primary-50)",borderRadius:8,padding:14,marginBottom:16, display: 'flex', justifyContent: 'space-between'}}>
            <p style={{fontSize:13,fontWeight:600}}>Total Cash Collection: <span style={{color:"var(--primary-700)"}}>{formatINR(systemBal)}</span></p>
            <p style={{fontSize:13,fontWeight:600}}>Total Cash in Bank: <span style={{color:"var(--blue-600)"}}>{formatINR(bankBal)}</span></p>
          </div>
          <form id="closing-form" onSubmit={handleSave}>
            <div className="form-group"><label className="form-label required">Date</label>
              <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Physical Cash Count (₹)</label>
                <input className="form-control" type="number" required step="0.01" value={form.physical_cash} onChange={e=>setForm(f=>({...f,physical_cash:e.target.value}))} />
                {diff !== null && (
                  <p className="form-hint" style={{color:diff===0?"var(--success)":"var(--danger)",fontWeight:600}}>
                    {diff===0 ? "✓ Balanced" : diff > 0 ? `⚠ Excess of ${formatINR(diff)}` : `⚠ Short by ${formatINR(Math.abs(diff))}`}
                  </p>
                )}
              </div>
              
              <div className="form-group"><label className="form-label required">Total Cash in Bank (₹)</label>
                <input className="form-control" type="number" required step="0.01" value={form.physical_bank} onChange={e=>setForm(f=>({...f,physical_bank:e.target.value}))} />
                {bankDiff !== null && (
                  <p className="form-hint" style={{color:bankDiff===0?"var(--success)":"var(--danger)",fontWeight:600}}>
                    {bankDiff===0 ? "✓ Balanced" : bankDiff > 0 ? `⚠ Excess of ${formatINR(bankDiff)}` : `⚠ Short by ${formatINR(Math.abs(bankDiff))}`}
                  </p>
                )}
              </div>
            </div>
            
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
