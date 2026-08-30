import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isPositiveNumber } from "../../utils/validators"

export default function TransferList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cash, setCash] = useState([])
  const [banks, setBanks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ transfer_type:"CASH_TO_BANK", date:format(new Date(),"yyyy-MM-dd"), amount:"", description:"", from_cash:"", to_bank:"", from_bank:"", to_cash:"" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, cRes, bRes] = await Promise.all([accountsApi.transfers.list({}), accountsApi.cash.accounts(), accountsApi.bank.accounts()])
      setItems(tRes.data.results || tRes.data)
      setCash(cRes.data.results || cRes.data)
      setBanks(bRes.data.results || bRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [])

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
    try { await accountsApi.transfers.create(form); toast.success("Transfer recorded."); setShowModal(false); load() }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Fund Transfers" subtitle="Cash ↔ Bank transfers">
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ New Transfer</button>
      </PageHeader>
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Amount</th><th>Description</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={5}><EmptyState icon="🔄" title="No transfers" /></td></tr>
                  : items.map(t=>(
                  <tr key={t.id}>
                    <td className="td-mono">{t.transfer_id}</td>
                    <td>{t.date ? format(new Date(t.date),"dd MMM yyyy") : "-"}</td>
                    <td><span className="badge badge-blue">{t.transfer_type}</span></td>
                    <td><AmountDisplay amount={t.amount} /></td>
                    <td>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title="New Fund Transfer"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="transfer-form" type="submit" disabled={saving}>{saving?"Saving...":"Transfer"}</button></>}>
          <form id="transfer-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Transfer Type</label>
                <select className="form-control" value={form.transfer_type} onChange={e=>setForm(f=>({...f,transfer_type:e.target.value}))}>
                  {["CASH_TO_BANK","BANK_TO_CASH","BANK_TO_BANK"].map(t=><option key={t}>{t.replace(/_/g," ")}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label required">Amount (₹)</label>
                <input className="form-control" type="number" required value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              {["CASH_TO_BANK","BANK_TO_CASH"].includes(form.transfer_type) && form.transfer_type==="CASH_TO_BANK" && <>
                <div className="form-group"><label className="form-label">From Cash Account</label>
                  <select className="form-control" value={form.from_cash} onChange={e=>setForm(f=>({...f,from_cash:e.target.value}))}>
                    <option value="">Select</option>{cash.map(c=><option key={c.id} value={c.id}>{c.account_name}</option>)}</select></div>
                <div className="form-group"><label className="form-label">To Bank Account</label>
                  <select className="form-control" value={form.to_bank} onChange={e=>setForm(f=>({...f,to_bank:e.target.value}))}>
                    <option value="">Select</option>{banks.map(b=><option key={b.id} value={b.id}>{b.bank_name}</option>)}</select></div>
              </>}
            </div>
            <div className="form-group"><label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
