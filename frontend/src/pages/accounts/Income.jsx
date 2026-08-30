import React, { useState, useCallback, useEffect } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from "../../components/shared"
import PaymentMethodSelector from "../../components/PaymentMethodSelector"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isPositiveNumber } from "../../utils/validators"

export default function IncomeList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"))
  const [methodFilter, setMethodFilter] = useState("ALL")
  const [showModal, setShowModal] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ source:"DONATION", date:format(new Date(),"yyyy-MM-dd"), amount:"", donor_name:"", phone:"", address:"", purpose:"", payment_method:"CASH", account_type:"CASH", reference_number:"", remarks:"" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (dateFilter) params.date = dateFilter
      if (methodFilter !== "ALL") params.account_type = methodFilter

      const [iRes, aRes] = await Promise.all([accountsApi.income.list(params), accountsApi.cash.accounts()])
      setItems(iRes.data.results || iRes.data)
      setAccounts(aRes.data.results || aRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
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
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (!isPositiveNumber(form.amount)) return toast.error("Amount must be a positive number");
    
    setSaving(true)
    try { 
      const fd = new FormData(e.target);
      if (fd.get('phone')) fd.append('donor_phone', fd.get('phone'));
      await accountsApi.income.create(fd); 
      toast.success("Income recorded."); 
      setShowModal(false); 
      load() 
    }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setSaving(false) }
  }

  const total = items.reduce((s,i)=>s+parseFloat(i.amount||0),0)

  return (
    <div>
      <PageHeader title="Income Records" subtitle="All income and donations">
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Income</button>
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
              <thead><tr><th>Receipt No</th><th>Date</th><th>Donor/Source</th><th>Type</th><th>Amount</th><th>Method</th><th>Purpose</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="📥" title="No income records" /></td></tr>
                  : items.map(i=>(
                  <tr key={i.id}>
                    <td className="td-mono">{i.receipt_number}</td>
                    <td>{i.date ? format(new Date(i.date),"dd MMM yyyy") : "-"}</td>
                    <td>{i.donor_name || i.source}</td>
                    <td><span className="badge badge-blue">{i.source}</span></td>
                    <td><AmountDisplay amount={i.amount} type="credit" /></td>
                    <td><span className="badge badge-gray">{i.payment_method}</span></td>
                    <td>{i.purpose || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', position: 'sticky', bottom: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--gray-600)', marginRight: 12 }}>Total Income:</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-700)' }}>{formatINR(total)}</span>
        </div>
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="Add Income Record" size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="income-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="income-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              {[["source","Income Source","select",["DONATION","GRANT","MEMBERSHIP_FEE","INTEREST","EVENT","SPONSORSHIP","OTHER"]],
                ["date","Date","date",null],["amount","Amount (₹)","number",null],["donor_name","Donor/Payer Name","text",null],
                ["phone","Phone","text",null],["payment_method","Payment Method","select",["CASH","CHEQUE","DD","NEFT","RTGS","IMPS","UPI"]],
                ["account_type","Account Type","select",["CASH","BANK"]],["reference_number","Reference Number","text",null]].map(([k,l,t,opts])=>(
                <div className="form-group" key={k}>
                  <label className={`form-label ${["date","amount","phone"].includes(k)?"required":""}`}>{l}</label>
                  {k === "payment_method" ? (
                    <PaymentMethodSelector 
                      value={form[k]} 
                      onChange={v=>setForm(f=>({...f,[k]:v}))} 
                      options={opts} 
                    />
                  ) : t==="select" ? (
                    <select className="form-control" name={k} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}>
                      {opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="form-control" type={t} name={k} value={form[k]} onChange={e=>setForm(f=>({...f,[k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value}))} required={["date","amount","phone"].includes(k)} />
                  )}
                </div>
              ))}
              <div className="form-group"><label className="form-label">Address</label>
                <textarea className="form-control" name="address" rows={2} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" name="purpose" rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
