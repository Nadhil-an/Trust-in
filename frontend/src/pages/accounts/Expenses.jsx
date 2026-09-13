import React, { useState, useCallback, useEffect } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from "../../components/shared"
import PaymentMethodSelector from "../../components/PaymentMethodSelector"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isPositiveNumber } from "../../utils/validators"

export default function ExpenseList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"))
  const [methodFilter, setMethodFilter] = useState("ALL")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ category:"", date:format(new Date(),"yyyy-MM-dd"), amount:"", payee:"", purpose:"", payment_method:"CASH", account_type:"CASH", expense_id:"", remarks:"" })
  const [saving, setSaving] = useState(false)

  const handleAddExpense = () => {
    let nextId = 1;
    if (items && items.length > 0) {
      const ids = items.map(i => {
        const match = String(i.expense_id).match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const maxId = Math.max(0, ...ids);
      nextId = maxId + 1;
    }
    const nextIdStr = nextId.toString().padStart(2, '0');
    setForm({ category:"", date:format(new Date(),"yyyy-MM-dd"), amount:"", payee:"", purpose:"", payment_method:"CASH", account_type:"CASH", expense_id: nextIdStr, remarks:"" });
    setShowModal(true);
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (dateFilter) params.date = dateFilter
      if (methodFilter !== "ALL") params.account_type = methodFilter

      const res = await accountsApi.expenses.list(params)
      setItems(res.data.results || res.data)
    }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, dateFilter, methodFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isPositiveNumber(form.amount)) return toast.error("Amount must be a positive number");
    
    setSaving(true)
    try { await accountsApi.expenses.create(form); toast.success("Expense recorded."); setShowModal(false); load() }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setSaving(false) }
  }

  const total = items.reduce((s,i)=>s+parseFloat(i.amount||0),0)

  return (
    <div>
      <PageHeader title="Expense Records" subtitle="All expense entries">
        <button className="btn btn-primary" onClick={handleAddExpense}>+ Add Expense</button>
      </PageHeader>
      <div className="data-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 150px)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}><FilterBar search={search} onSearch={setSearch} /></div>
          <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={()=>setDateFilter("")}>Clear Date</button>
          <select className="form-control" style={{ width: 'auto' }} value={methodFilter} onChange={e=>setMethodFilter(e.target.value)}>
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Online / Bank</option>
          </select>
        </div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Expense ID</th><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="📤" title="No expense records" /></td></tr>
                  : items.map(e=>(
                  <tr key={e.id}>
                    <td className="td-mono">{e.expense_id}</td>
                    <td>{e.date ? format(new Date(e.date),"dd MMM yyyy") : "-"}</td>
                    <td>{e.payee}</td>
                    <td><span className="badge badge-blue">{e.category}</span></td>
                    <td><AmountDisplay amount={e.amount} type="debit" /></td>
                    <td><span className="badge badge-gray">{e.payment_method}</span></td>
                    <td><span className={`badge ${e.status==="COMPLETED"?"badge-green":e.status==="PENDING"?"badge-yellow":"badge-gray"}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', position: 'sticky', bottom: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--gray-600)', marginRight: 12 }}>Total Expenses:</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>{formatINR(total)}</span>
        </div>
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="Add Expense Record" size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="expense-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="expense-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              {[["date","Date","date"],["payee","Payee","text"],["amount","Amount (₹)","number"],["expense_id","Bill Number","text"]].map(([k,l,t])=>(
                <div className="form-group" key={k}><label className={`form-label${["date","payee","amount","expense_id"].includes(k)?" required":""}`}>{l}</label>
                  <input className="form-control" type={t} value={form[k]} required={["date","payee","amount","expense_id"].includes(k)} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="form-group"><label className="form-label required">Category</label>
                <input className="form-control" type="text" value={form.category} required onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Office, Travel" /></div>
              <div className="form-group"><label className="form-label">Payment Method</label>
                <PaymentMethodSelector value={form.payment_method} onChange={v=>setForm(f=>({...f,payment_method:v}))} options={["CASH","CHEQUE","NEFT","UPI","OTHER"]} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
