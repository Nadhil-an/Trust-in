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
  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem('cashbook_dateFilter') || "all")
  const [customMonth, setCustomMonth] = useState(() => localStorage.getItem('cashbook_customMonth') || format(new Date(), "yyyy-MM"))
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('cashbook_typeFilter') || "all")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ cash_account:"", transaction_type:"RECEIPT", date:format(new Date(),"yyyy-MM-dd"), description:"", amount:"", reference_id:"", voucher_number:"" })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date();
      let from_date = "";
      let to_date = format(today, "yyyy-MM-dd");
      if (dateFilter === "today") { from_date = to_date; }
      else if (dateFilter === "yesterday") { const y = new Date(today); y.setDate(y.getDate() - 1); from_date = format(y, "yyyy-MM-dd"); to_date = from_date; }
      else if (dateFilter === "weekly") { const w = new Date(today); w.setDate(w.getDate() - 7); from_date = format(w, "yyyy-MM-dd"); }
      else if (dateFilter === "monthly") { const m = new Date(today); m.setMonth(m.getMonth() - 1); from_date = format(m, "yyyy-MM-dd"); }
      else if (dateFilter === "custom_month") {
        if (customMonth) {
          const [year, month] = customMonth.split("-");
          const mDate = new Date(year, parseInt(month) - 1, 1);
          from_date = format(mDate, "yyyy-MM-dd");
          const lastDay = new Date(year, parseInt(month), 0);
          to_date = format(lastDay, "yyyy-MM-dd");
        } else {
          from_date = ""; to_date = "";
        }
      }
      else { to_date = ""; } // 'all'

      const params = { search, page_size: 1000 };
      if (from_date) params.from_date = from_date;
      if (to_date) params.to_date = to_date;

      const [tRes, aRes] = await Promise.all([accountsApi.cash.transactions(params), accountsApi.cash.accounts()])
      setTxns(tRes.data.results || tRes.data)
      setAccounts(aRes.data.results || aRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, dateFilter, customMonth])

  useEffect(() => { localStorage.setItem('cashbook_dateFilter', dateFilter) }, [dateFilter])
  useEffect(() => { localStorage.setItem('cashbook_customMonth', customMonth) }, [customMonth])
  useEffect(() => { localStorage.setItem('cashbook_typeFilter', typeFilter) }, [typeFilter])

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
  const netAmount = totalReceipts - totalPayments

  return (
    <div>
      <PageHeader title="Cash Book" subtitle="All cash transactions">
        <button className="btn btn-primary" onClick={() => {
          setForm({ cash_account:"", transaction_type:"RECEIPT", date:format(new Date(),"yyyy-MM-dd"), description:"", amount:"", reference_id:"", voucher_number:"" });
          setShowModal(true);
        }}>+ Add Transaction</button>
      </PageHeader>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <div className="stat-card success"><div className="stat-card-header"><div className="stat-card-label">Total Inward</div><div className="stat-card-icon">📥</div></div><div className="stat-card-value">{formatINR(totalReceipts)}</div></div>
        <div className="stat-card danger"><div className="stat-card-header"><div className="stat-card-label">Total Outward</div><div className="stat-card-icon">📤</div></div><div className="stat-card-value">{formatINR(totalPayments)}</div></div>
        <div className="stat-card"><div className="stat-card-header"><div className="stat-card-label">Amount in Hand</div><div className="stat-card-icon">💰</div></div><div className="stat-card-value">{formatINR(netAmount)}</div></div>
      </div>
      <div className="data-card">
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <FilterBar search={search} onSearch={setSearch} />
          </div>
          <select className="form-control" style={{ width: "auto" }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="inward">Inward Only</option>
            <option value="outward">Outward Only</option>
          </select>
          <select className="form-control" style={{ width: "auto" }} value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
            <option value="custom_month">Specific Month</option>
          </select>
          {dateFilter === "custom_month" && (
            <input 
              type="month" 
              className="form-control" 
              style={{ width: "auto" }} 
              value={customMonth} 
              onChange={e => setCustomMonth(e.target.value)} 
            />
          )}
        </div>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Type</th><th>Inward (₹)</th><th>Outward (₹)</th><th>Balance (₹)</th></tr></thead>
              <tbody>
                {txns.filter(t => {
                  if (typeFilter === "inward") return ["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type);
                  if (typeFilter === "outward") return !["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type);
                  return true;
                }).length === 0 ? <tr><td colSpan={7}><EmptyState icon="💵" title="No transactions" /></td></tr>
                  : txns.filter(t => {
                  if (typeFilter === "inward") return ["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type);
                  if (typeFilter === "outward") return !["RECEIPT","TRANSFER_IN","OPENING"].includes(t.transaction_type);
                  return true;
                }).map(t => {
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
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label required">Type</label>
                <select className="form-control" required value={form.transaction_type} onChange={e=>setForm(f=>({...f,transaction_type:e.target.value}))}>
                  {["RECEIPT","PAYMENT","OPENING","TRANSFER_IN","TRANSFER_OUT","ADJUSTMENT"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date</label>
                <input className="form-control" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Amount (₹)</label>
                <input className="form-control" type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Reference/Voucher</label>
                <input className="form-control" value={form.reference_id} onChange={e=>setForm(f=>({...f,reference_id:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Voucher No</label>
                <input className="form-control" value={form.voucher_number} onChange={e=>setForm(f=>({...f,voucher_number:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {/* Fixed Bottom Bar */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: '#fff',
        borderTop: '1px solid #e2e8f0',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
        zIndex: 10,
        marginTop: '1rem',
        borderRadius: '0.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Inward</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{formatINR(totalReceipts)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Outward</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{formatINR(totalPayments)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Amount in Hand</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{formatINR(netAmount)}</div>
        </div>
      </div>
    </div>
  )
}
