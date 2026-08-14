import React, { useState, useEffect, useCallback } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal, AmountDisplay, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
export default function PayrollPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ payment_method:"BANK", payment_reference:"" })
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.payroll.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])

  const handlePay = async (e) => {
    e.preventDefault(); setPaying(true)
    try { await hrApi.payroll.pay(payModal.id, payForm); toast.success("Salary paid."); setPayModal(null); load() }
    catch (_) { toast.error("Payment failed") } finally { setPaying(false) }
  }

  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Monthly payroll management" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payroll ID</th><th>Employee</th><th>Month/Year</th><th>Basic</th><th>Gross</th><th>Net Salary</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="💰" title="No payroll records" /></td></tr>
                  : items.map(p=>(<tr key={p.id}>
                    <td className="td-mono">{p.payroll_id}</td>
                    <td>{p.employee_name}</td>
                    <td>{p.month}/{p.year}</td>
                    <td><AmountDisplay amount={p.basic_salary} /></td>
                    <td><AmountDisplay amount={p.gross_salary} /></td>
                    <td><AmountDisplay amount={p.net_salary} type="neutral" /></td>
                    <td><span className={`badge ${p.status==="PAID"?"badge-green":p.status==="APPROVED"?"badge-blue":"badge-yellow"}`}>{p.status}</span></td>
                    <td>{p.status==="APPROVED" && <button className="btn btn-sm btn-success" onClick={()=>{setPayModal(p);setPayForm({payment_method:"BANK",payment_reference:""})}}>💸 Pay</button>}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {payModal && (
        <Modal isOpen={true} onClose={()=>setPayModal(null)} title={`Pay Salary — ${payModal.employee_name}`}
          footer={<><button className="btn btn-secondary" onClick={()=>setPayModal(null)}>Cancel</button>
            <button className="btn btn-success" form="pay-form" type="submit" disabled={paying}>{paying?"Processing...":"Confirm Payment"}</button></>}>
          <div style={{background:"var(--primary-50)",borderRadius:8,padding:14,marginBottom:16}}>
            <p><strong>Net Salary:</strong> {formatINR(payModal.net_salary)}</p>
            <p><strong>Period:</strong> {payModal.month}/{payModal.year}</p>
          </div>
          <form id="pay-form" onSubmit={handlePay}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Payment Method</label>
                <select className="form-control" value={payForm.payment_method} onChange={e=>setPayForm(f=>({...f,payment_method:e.target.value}))}>
                  {["BANK","CASH","CHEQUE"].map(m=><option key={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Reference</label>
                <input className="form-control" value={payForm.payment_reference} onChange={e=>setPayForm(f=>({...f,payment_reference:e.target.value}))} /></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
