import React, { useState, useCallback, useEffect } from "react"
import { accountsApi, hrApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR, Combobox } from "../../components/shared"
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
  const [editId, setEditId] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [expenseToDelete, setExpenseToDelete] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [maxAdvanceAmount, setMaxAdvanceAmount] = useState("")

  useEffect(() => {
    hrApi.officers.list({ page_size: 100 }).then(res => {
      setStaffList(res.data.results || res.data)
    }).catch(console.error)
  }, [])

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
    setEditId(null);
    setShowModal(true);
  }

  const handleEdit = (expense) => {
    setForm({ ...expense })
    setEditId(expense.id)
    setShowModal(true)
  }

  const calculateSalaryAdvanceAmount = async (payeeName, dateStr, currentEditId = null) => {
    const staff = staffList.find(s => s.full_name === payeeName);
    if (!staff || !staff.salary_structure) return "";
    
    const basic = Number(staff.salary_structure.basic_salary) || 0;
    try {
      const monthPrefix = (dateStr || new Date().toISOString()).substring(0, 7);
      const res = await accountsApi.expenses.list({ category: 'SALARY ADVANCE', limit: 300 });
      let advances = res.data.results || res.data;
      
      const withdrawn = advances.filter(exp => 
        exp.payee === payeeName && 
        exp.date && exp.date.startsWith(monthPrefix) && 
        exp.status !== 'CANCELLED' && 
        exp.id !== currentEditId
      ).reduce((sum, exp) => sum + Number(exp.amount), 0);
      
      return Math.max(0, basic - withdrawn);
    } catch (e) {
      return basic;
    }
  };

  const handlePayeeChange = async (e) => {
    const payeeName = e.target.value;
    setForm(f => ({ ...f, payee: payeeName, amount: "" }));
    if (form.category === "SALARY ADVANCE" && payeeName) {
      const remaining = await calculateSalaryAdvanceAmount(payeeName, form.date, editId);
      if (remaining !== "") {
        setMaxAdvanceAmount(remaining);
      }
    } else {
      setMaxAdvanceAmount("");
    }
  };

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
    try { 
      if (editId) {
        await accountsApi.expenses.update(editId, form)
        toast.success("Expense updated.")
      } else {
        await accountsApi.expenses.create(form)
        toast.success("Expense recorded.")
      }
      setShowModal(false); 
      load() 
    }
    catch (err) { toast.error(err.response?.data?.detail || "Save failed") } finally { setSaving(false) }
  }

  const handleSoftDelete = async (expense) => {
    setProcessingId(expense.id)
    try {
      await accountsApi.expenses.update(expense.id, { status: 'CANCELLED' })
      toast.success("Expense cancelled (soft deleted)")
      load()
    } catch (err) { toast.error("Failed to cancel expense") }
    finally { setProcessingId(null) }
  }

  const handleRestore = async (expense) => {
    setProcessingId(expense.id)
    try {
      await accountsApi.expenses.update(expense.id, { status: 'COMPLETED' })
      toast.success("Expense restored")
      load()
    } catch (err) { toast.error("Failed to restore expense") }
    finally { setProcessingId(null) }
  }

  const handleHardDelete = (expense) => {
    setExpenseToDelete(expense)
  }

  const confirmHardDelete = async () => {
    if (!expenseToDelete) return
    const id = expenseToDelete.id
    setExpenseToDelete(null)
    setProcessingId(id)
    try {
      await accountsApi.expenses.delete(id)
      toast.success("Expense permanently deleted")
      load()
    } catch (err) { toast.error("Failed to delete expense") }
    finally { setProcessingId(null) }
  }

  const total = items.filter(i => i.status !== 'CANCELLED').reduce((s,i)=>s+parseFloat(i.amount||0),0)

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
              <thead><tr><th>Expense ID</th><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="📤" title="No expense records" /></td></tr>
                  : items.map(e=>(
                  <tr key={e.id} style={{ background: e.status === 'CANCELLED' ? '#f8fafc' : 'inherit', transition: 'all 0.3s ease' }}>
                    <td className="td-mono" style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}>{e.expense_id}</td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}>{e.date ? format(new Date(e.date),"dd MMM yyyy") : "-"}</td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}>{e.payee}</td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}><span className="badge badge-blue">{e.category}</span></td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}><AmountDisplay amount={e.amount} type="debit" /></td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}><span className="badge badge-gray">{e.payment_method}</span></td>
                    <td style={e.status === 'CANCELLED' ? { opacity: 0.4, filter: 'grayscale(100%)' } : {}}><span className={`badge ${e.status==="COMPLETED"?"badge-green":e.status==="PENDING"?"badge-yellow":"badge-gray"}`}>{e.status}</span></td>
                    <td>
                      {e.status !== 'CANCELLED' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 8px' }} onClick={() => handleEdit(e)} title="Edit">✏️</button>
                          <button className="btn btn-sm" style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px' }} onClick={() => handleSoftDelete(e)} disabled={processingId === e.id} title="Delete">🗑️</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 8px', border: '1px solid #10b981' }} onClick={() => handleRestore(e)} disabled={processingId === e.id} title="Restore">♻️</button>
                          <button className="btn btn-sm" style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', border: '1px solid #ef4444' }} onClick={() => handleHardDelete(e)} disabled={processingId === e.id} title="Delete Permanently">❌</button>
                        </div>
                      )}
                    </td>
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
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={editId ? "Edit Expense Record" : "Add Expense Record"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="expense-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="expense-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label required">Date</label>
                <input className="form-control" type="date" value={form.date} required onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
              </div>
              
              <div className="form-group"><label className="form-label required">Category</label>
                <Combobox 
                  value={form.category} 
                  onChange={v => {
                    setForm(f => ({...f, category: v, payee: v === 'SALARY ADVANCE' ? '' : f.payee}));
                    if (v !== 'SALARY ADVANCE') setMaxAdvanceAmount("");
                  }} 
                  options={["SALARY ADVANCE", "OFFICE EXPENSE", "TEA EXPENSE", "TRAVEL EXPENSE"]} 
                  placeholder="e.g. Office, Travel" 
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Payee</label>
                {form.category === "SALARY ADVANCE" ? (
                  <select className="form-control" value={form.payee} required onChange={handlePayeeChange}>
                    <option value="">Select Staff</option>
                    {staffList.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                  </select>
                ) : (
                  <input className="form-control" type="text" value={form.payee} required onChange={e=>setForm(f=>({...f,payee:e.target.value}))} />
                )}
              </div>

              <div className="form-group">
                <label className="form-label required">Amount (₹)</label>
                <input 
                  className="form-control" 
                  type="number" 
                  value={form.amount} 
                  required 
                  onChange={e=>setForm(f=>({...f,amount:e.target.value}))} 
                  placeholder={form.category === "SALARY ADVANCE" && maxAdvanceAmount !== "" ? `Max Allowed: ₹${maxAdvanceAmount}` : ""}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Bill Number</label>
                <input className="form-control" type="text" value={form.expense_id} required onChange={e=>setForm(f=>({...f,expense_id:e.target.value}))} />
              </div>

              <div className="form-group"><label className="form-label required">Payment Method</label>
                <PaymentMethodSelector value={form.payment_method} onChange={v=>setForm(f=>({...f,payment_method:v,account_type:v==="CASH"?"CASH":"BANK"}))} options={["CASH","CHEQUE","NEFT","UPI","OTHER"]} />
              </div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} /></div>
          </form>
        </Modal>
      )}

      {expenseToDelete && (
        <Modal isOpen={true} onClose={() => setExpenseToDelete(null)} title="Delete Expense?" size="modal-md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setExpenseToDelete(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={confirmHardDelete}>Yes, Delete</button>
            </>
          }
        >
          <div style={{ padding: '24px 20px', textAlign: 'center', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
            <h3 style={{ marginBottom: '12px', color: '#991b1b', fontWeight: 800 }}>Permanently Delete?</h3>
            <p style={{ color: '#7f1d1d', lineHeight: '1.6', fontSize: 14 }}>
              Are you sure you want to permanently delete this expense record for <strong>{expenseToDelete.payee || expenseToDelete.purpose || 'this amount'}</strong>? This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
