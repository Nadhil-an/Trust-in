import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([])
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBank, setSelectedBank] = useState(null)
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)
  const [form, setForm] = useState({ bank_account:"", transaction_type:"DEPOSIT", date:format(new Date(),"yyyy-MM-dd"), description:"", amount:"", payment_method:"NEFT", reference_id:"" })
  const [bankForm, setBankForm] = useState({ bank_name:"", account_number:"", account_holder:"", ifsc_code:"", branch:"", opening_balance:"0" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, tRes] = await Promise.all([accountsApi.bank.accounts(), accountsApi.bank.transactions({})])
      setAccounts(aRes.data.results || aRes.data)
      setTxns(tRes.data.results || tRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddTxn = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await accountsApi.bank.addTransaction({...form, bank_account:selectedBank||form.bank_account}); toast.success("Transaction added."); setShowTxnModal(false); load() }
    catch (err) { toast.error(err.response?.data?.detail || "Failed") } finally { setSaving(false) }
  }

  const handleAddBank = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await accountsApi.bank.createAccount(bankForm); toast.success("Bank added."); setShowAddBank(false); load() }
    catch (err) { toast.error("Failed") } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="All bank accounts and transactions">
        <button className="btn btn-secondary" onClick={() => setShowAddBank(true)}>+ Add Bank Account</button>
        <button className="btn btn-primary" onClick={() => { setShowTxnModal(true) }}>+ Add Transaction</button>
      </PageHeader>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
        {accounts.map(b=>(
          <div key={b.id} className={`stat-card ${selectedBank===b.id?"info":""}`} style={{cursor:"pointer"}} onClick={()=>setSelectedBank(selectedBank===b.id?null:b.id)}>
            <div className="stat-card-header"><div className="stat-card-label">{b.bank_name}</div><div className="stat-card-icon">🏦</div></div>
            <div className="stat-card-value">{formatINR(b.current_balance)}</div>
            <div className="stat-card-sub">{b.account_number}</div>
          </div>
        ))}
      </div>
      <div className="data-card">
        <div className="data-card-header"><div className="data-card-title">Transactions {selectedBank ? `— ${accounts.find(a=>a.id===selectedBank)?.bank_name}` : "(All)"}</div></div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Bank</th><th>Description</th><th>Type</th><th>Method</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
              <tbody>
                {txns.filter(t=>!selectedBank||t.bank_account===selectedBank).length===0
                  ? <tr><td colSpan={8}><EmptyState icon="🏦" title="No transactions" /></td></tr>
                  : txns.filter(t=>!selectedBank||t.bank_account===selectedBank).map(t=>{
                    const isCredit = ["DEPOSIT","TRANSFER_IN","INTEREST"].includes(t.transaction_type)
                    return <tr key={t.id}>
                      <td>{t.date ? format(new Date(t.date),"dd MMM yyyy") : "-"}</td>
                      <td>{accounts.find(a=>a.id===t.bank_account)?.bank_name||"-"}</td>
                      <td>{t.description}</td>
                      <td><span className="badge badge-blue">{t.transaction_type}</span></td>
                      <td><span className="badge badge-gray">{t.payment_method}</span></td>
                      <td>{!isCredit?<AmountDisplay amount={t.amount} type="debit"/>:""}</td>
                      <td>{isCredit?<AmountDisplay amount={t.amount} type="credit"/>:""}</td>
                      <td><AmountDisplay amount={t.balance_after} type="neutral"/></td>
                    </tr>
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTxnModal && (
        <Modal isOpen={true} onClose={()=>setShowTxnModal(false)} title="Add Bank Transaction"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowTxnModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="bank-txn-form" type="submit" disabled={saving}>{saving?"Saving...":"Add"}</button></>}>
          <form id="bank-txn-form" onSubmit={handleAddTxn}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Bank Account</label>
                <select className="form-control" required value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))}>
                  <option value="">Select Bank</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Type</label>
                <select className="form-control" value={form.transaction_type} onChange={e=>setForm(f=>({...f,transaction_type:e.target.value}))}>
                  {["DEPOSIT","WITHDRAWAL","TRANSFER_IN","TRANSFER_OUT","INTEREST","CHARGES"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Date</label>
                <input className="form-control" type="date" required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label required">Amount (₹)</label>
                <input className="form-control" type="number" required min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Payment Method</label>
                <select className="form-control" value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}>
                  {["NEFT","RTGS","IMPS","UPI","CHEQUE","CASH","DD"].map(m=><option key={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Reference/UTR</label>
                <input className="form-control" value={form.reference_id} onChange={e=>setForm(f=>({...f,reference_id:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label required">Description</label>
              <textarea className="form-control" required rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {showAddBank && (
        <Modal isOpen={true} onClose={()=>setShowAddBank(false)} title="Add Bank Account"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowAddBank(false)}>Cancel</button>
            <button className="btn btn-primary" form="add-bank-form" type="submit" disabled={saving}>{saving?"Saving...":"Add Bank"}</button></>}>
          <form id="add-bank-form" onSubmit={handleAddBank}>
            <div className="form-grid-2">
              {[["bank_name","Bank Name",true],["account_number","Account Number",true],["account_holder","Account Holder",true],["ifsc_code","IFSC Code",false],["branch","Branch",false]].map(([k,l,r])=>(
                <div className="form-group" key={k}><label className={`form-label${r?" required":""}`}>{l}</label>
                  <input className="form-control" required={r} value={bankForm[k]} onChange={e=>setBankForm(f=>({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="form-group"><label className="form-label">Opening Balance (₹)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={bankForm.opening_balance} onChange={e=>setBankForm(f=>({...f,opening_balance:e.target.value}))} /></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
