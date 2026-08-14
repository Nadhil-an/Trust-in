import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function ChequeList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [bankAccounts, setBankAccounts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ cheque_number:"", cheque_type:"ISSUED", date:format(new Date(),"yyyy-MM-dd"), amount:"", bank_account:"", payee_payer:"", purpose:"", status:"ISSUED" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, bRes] = await Promise.all([accountsApi.cheques.list({search}), accountsApi.bank.accounts()])
      setItems(cRes.data.results || cRes.data)
      setBankAccounts(bRes.data.results || bRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await accountsApi.cheques.create(form); toast.success("Cheque added."); setShowModal(false); load() }
    catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  const updateStatus = async (id, status) => {
    try { await accountsApi.cheques.update(id, {status}); toast.success("Status updated."); load() }
    catch (_) { toast.error("Update failed") }
  }

  return (
    <div>
      <PageHeader title="Cheque Management" subtitle="Track issued and received cheques">
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Cheque</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cheque No</th><th>Date</th><th>Bank</th><th>Payee/Payer</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="🧾" title="No cheques found" /></td></tr>
                  : items.map(c=>(
                  <tr key={c.id}>
                    <td className="td-mono">{c.cheque_number}</td>
                    <td>{c.date ? format(new Date(c.date),"dd MMM yyyy") : "-"}</td>
                    <td>{c.bank_name}</td>
                    <td>{c.payee_payer}</td>
                    <td><span className={`badge ${c.cheque_type==="ISSUED"?"badge-blue":"badge-green"}`}>{c.cheque_type}</span></td>
                    <td><AmountDisplay amount={c.amount} /></td>
                    <td><span className={`badge ${c.status==="CLEARED"?"badge-green":c.status==="BOUNCED"?"badge-red":c.status==="CANCELLED"?"badge-gray":"badge-yellow"}`}>{c.status}</span></td>
                    <td>
                      {c.status==="ISSUED" && <>
                        <button className="btn btn-sm btn-success" onClick={()=>updateStatus(c.id,"CLEARED")}>Clear</button>{" "}
                        <button className="btn btn-sm btn-danger" onClick={()=>updateStatus(c.id,"BOUNCED")}>Bounce</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="Add Cheque"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="cheque-form" type="submit" disabled={saving}>{saving?"Saving...":"Add"}</button></>}>
          <form id="cheque-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Cheque Number</label>
                <input className="form-control" required value={form.cheque_number} onChange={e=>setForm(f=>({...f,cheque_number:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label required">Bank Account</label>
                <select className="form-control" required value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))}>
                  <option value="">Select Bank</option>
                  {bankAccounts.map(b=><option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label required">Amount</label>
                <input className="form-control" type="number" required value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-control" value={form.cheque_type} onChange={e=>setForm(f=>({...f,cheque_type:e.target.value}))}>
                  {["ISSUED","RECEIVED"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Payee / Payer</label>
                <input className="form-control" value={form.payee_payer} onChange={e=>setForm(f=>({...f,payee_payer:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
