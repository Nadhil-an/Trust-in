import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function CashBook() {
  const [txns, setTxns] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ cash_account:"", transaction_type:"RECEIPT", date:format(new Date(),"yyyy-MM-dd"), description:"", amount:"", reference_id:"", voucher_number:"" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, aRes] = await Promise.all([accountsApi.cash.transactions({search}), accountsApi.cash.accounts()])
      setTxns(tRes.data.results || tRes.data)
      setAccounts(aRes.data.results || aRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await accountsApi.cash.addTransaction(form); toast.success("Transaction added."); setShowModal(false); load() }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setSaving(false) }
  }

  const totalReceipts = txns.filter(t=>["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type)).reduce((s,t)=>s+parseFloat(t.amount||0),0)
  const totalPayments = txns.filter(t=>!["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type)).reduce((s,t)=>s+parseFloat(t.amount||0),0)

  return (
    <div>
      <PageHeader title="Cash Book" subtitle="All cash transactions">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Transaction</button>
      </PageHeader>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <div className="stat-card success"><div className="stat-card-header"><div className="stat-card-label">Total Receipts</div><div className="stat-card-icon">📥</div></div><div className="stat-card-value">{formatINR(totalReceipts)}</div></div>
        <div className="stat-card danger"><div className="stat-card-header"><div className="stat-card-label">Total Payments</div><div className="stat-card-icon">📤</div></div><div className="stat-card-value">{formatINR(totalPayments)}</div></div>
        <div className="stat-card"><div className="stat-card-header"><div className="stat-card-label">Net</div><div className="stat-card-icon">💰</div></div><div className="stat-card-value">{formatINR(totalReceipts-totalPayments)}</div></div>
      </div>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Type</th><th>Receipt (₹)</th><th>Payment (₹)</th><th>Balance (₹)</th></tr></thead>
              <tbody>
                {txns.length === 0 ? <tr><td colSpan={7}><EmptyState icon="💵" title="No transactions" /></td></tr>
                  : txns.map(t => {
                    const isReceipt = ["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type)
                    return (
                      <tr key={t.id}>
                        <td>{t.date ? format(new Date(t.date),"dd MMM yyyy") : "-"}</td>
                        <td className="td-mono">{t.reference_id || t.voucher_number || "-"}</td>
                        <td>{t.description}</td>
                        <td><span className="badge badge-blue">{t.transaction_type}</span></td>
                        <td>{isReceipt ? <AmountDisplay amount={t.amount} type="credit" /> : ""}</td>
                        <td>{!isReceipt ? <AmountDisplay amount={t.amount} type="debit" /> : ""}</td>
                        <td><AmountDisplay amount={t.balance_after} type="neutral" /></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={() => setShowModal(false)} title="Add Cash Transaction"
          footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="cash-form" type="submit" disabled={saving}>{saving?"Saving...":"Add"}</button></>}>
          <form id="cash-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Account</label>
                <select className="form-control" required value={form.cash_account} onChange={e=>setForm(f=>({...f,cash_account:e.target.value}))}>
                  <option value="">Select Account</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.account_name}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Type</label>
                <select className="form-control" value={form.transaction_type} onChange={e=>setForm(f=>({...f,transaction_type:e.target.value}))}>
                  {["RECEIPT","PAYMENT","TRANSFER_IN","TRANSFER_OUT"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label required">Amount (₹)</label>
                <input className="form-control" type="number" required min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Reference/Voucher</label>
                <input className="form-control" value={form.reference_id} onChange={e=>setForm(f=>({...f,reference_id:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Voucher No</label>
                <input className="form-control" value={form.voucher_number} onChange={e=>setForm(f=>({...f,voucher_number:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label required">Description</label>
              <textarea className="form-control" required rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
