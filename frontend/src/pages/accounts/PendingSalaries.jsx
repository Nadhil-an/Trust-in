import React, { useState, useEffect, useCallback } from 'react'
import { accountsApi } from '../../api'
import { PageHeader, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

function AmountDisplay({ amount, type="positive" }) {
  const color = type === "positive" ? "var(--success-color)" : type === "negative" ? "var(--danger-color)" : "var(--primary-color)"
  return <div style={{fontWeight: 600, color}}>{formatINR(amount)}</div>
}

export default function PendingSalaries() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ payment_method:"BANK", payment_reference:"" })
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { 
      const res = await accountsApi.pendingSalaries.list({
        search,
        status: statusFilter,
        month: monthFilter,
        year: yearFilter
      })
      setItems(res.data.results || res.data)
    }
    catch (err) { toast.error("Failed to load pending salaries") }
    finally { setLoading(false) }
  }, [search, statusFilter, monthFilter, yearFilter])

  useEffect(() => { load() }, [load])

  const handlePay = async (e) => {
    e.preventDefault(); setPaying(true)
    try { 
      await accountsApi.pendingSalaries.pay(payModal.id, payForm)
      toast.success("Salary paid and recorded in expenses.")
      setPayModal(null)
      load()
    }
    catch (_) { toast.error("Payment failed") } 
    finally { setPaying(false) }
  }

  return (
    <div>
      <PageHeader title="Pending Salaries" subtitle="Pay approved employee salaries" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" style={{ width: '130px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="APPROVED">Pending</option>
            <option value="PAID">Paid</option>
          </select>
          <select className="filter-select" style={{ width: '130px' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="">All Months</option>
            {Array.from({length:12}).map((_,i) => <option key={i+1} value={i+1}>{format(new Date(2020, i, 1), 'MMMM')}</option>)}
          </select>
          <input type="number" className="filter-select" style={{ width: '80px' }} placeholder="Year" value={yearFilter} onChange={e => setYearFilter(e.target.value)} />
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payroll ID</th><th>Employee</th><th>Month/Year</th><th>Basic</th><th>Gross</th><th>Net Salary</th><th>Status</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="💰" title="No pending salaries" /></td></tr>
                  : items.map(p=>(<tr key={p.id}>
                    <td className="td-mono">{p.payroll_id}</td>
                    <td>{p.employee_name}</td>
                    <td>{p.month}/{p.year}</td>
                    <td><AmountDisplay amount={p.basic_salary} /></td>
                    <td><AmountDisplay amount={p.gross_salary} /></td>
                    <td><AmountDisplay amount={p.net_salary} type="neutral" /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`badge ${p.status==="PAID"?"badge-green":p.status==="APPROVED"?"badge-yellow":"badge-gray"}`}>{p.status==="APPROVED"?"PENDING":p.status}</span>
                        {p.status==="APPROVED" && <button className="btn btn-sm btn-success" onClick={()=>{setPayModal(p);setPayForm({payment_method:"BANK",payment_reference:""})}}>💸 Pay</button>}
                      </div>
                    </td>
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
