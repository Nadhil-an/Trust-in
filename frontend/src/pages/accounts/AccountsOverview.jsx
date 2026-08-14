import React, { useState, useEffect } from "react"
import { accountsApi } from "../../api"
import { LoadingState, formatINR, AmountDisplay, EmptyState, PageHeader } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts"

// ── Helpers ──────────────────────────────────────────────
const groupTransactionsByDate = (list) => {
  const grouped = {}
  list.forEach(t => {
    const d = t.date ? format(new Date(t.date), "dd MMM") : "Unknown"
    grouped[d] = (grouped[d] || 0) + parseFloat(t.amount || 0)
  })
  // list is usually latest first, so reverse to show chronological order
  return Object.keys(grouped).map(k => ({ name: k, amount: grouped[k] })).reverse()
}

// ── Minimal stat block ───────────────────────────────────
function StatBlock({ label, value, sub, color = "#6366f1", small, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        background: active ? `${color}10` : "#fff",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: `2px solid ${active ? color : "#f0f0f4"}`,
        boxShadow: active ? `0 4px 12px ${color}20` : "0 1px 4px rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? color : "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px" }}>
        {label}
      </span>
      <span style={{ fontSize: small ? 20 : 24, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: active ? color : "#6b7280", fontWeight: 500 }}>{sub}</span>}
    </div>
  )
}

export default function AccountsOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("cash") // cash, bank, income, expense

  const [incomeList, setIncomeList] = useState([])
  const [expenseList, setExpenseList] = useState([])
  const [loadingLists, setLoadingLists] = useState(false)

  const loadDashboard = async () => {
    try {
      const res = await accountsApi.dashboard()
      setData(res.data)
    } catch (_) {
      toast.error("Failed to load overview data")
    } finally {
      setLoading(false)
    }
  }

  const loadIncome = async () => {
    setLoadingLists(true)
    try {
      const res = await accountsApi.income.list({ limit: 100 })
      setIncomeList(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load income history")
    } finally {
      setLoadingLists(false)
    }
  }

  const loadExpense = async () => {
    setLoadingLists(true)
    try {
      const res = await accountsApi.expenses.list({ limit: 100 })
      setExpenseList(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load expense history")
    } finally {
      setLoadingLists(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeTab === "income" && incomeList.length === 0) loadIncome()
    if (activeTab === "expense" && expenseList.length === 0) loadExpense()
  }, [activeTab])

  if (loading) return <LoadingState />
  const acc = data || {}

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader title="Accounts Overview" subtitle="Detailed breakdown of balances and transactions" />

      {/* Secondary stats row (Clickable Tabs) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatBlock 
          label="Cash in Hand" value={formatINR(acc.cash_balance)} sub="Available" color="#10b981" small 
          active={activeTab === "cash"} onClick={() => setActiveTab("cash")} 
        />
        <StatBlock 
          label="Bank Balance" value={formatINR(acc.bank_balance)} sub="All accounts" color="#6366f1" small 
          active={activeTab === "bank"} onClick={() => setActiveTab("bank")} 
        />
        <StatBlock 
          label="Money Received" value={formatINR(acc.income_this_month)} sub="This month" color="#10b981" small 
          active={activeTab === "income"} onClick={() => setActiveTab("income")} 
        />
        <StatBlock 
          label="Money Spent" value={formatINR(acc.expenses_this_month)} sub="This month" color="#ef4444" small 
          active={activeTab === "expense"} onClick={() => setActiveTab("expense")} 
        />
      </div>

      {/* Dynamic Bottom Section */}
      <div className="data-card">
        
        {/* CASH ACCOUNTS */}
        {activeTab === "cash" && (
          <>
            <div className="data-card-header"><div className="data-card-title">Cash Accounts</div></div>
            
            {(acc.cash_accounts || []).length > 0 && (
              <div style={{ padding: "0 24px 20px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(acc.cash_accounts || []).map(a => ({ name: a.account_name, amount: parseFloat(a.current_balance || 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => `₹${v}`} />
                    <Tooltip cursor={{ fill: "#f3f4f6" }} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }} formatter={v => [formatINR(v), "Balance"]} />
                    <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead><tr><th>Account Name</th><th>Balance</th></tr></thead>
                <tbody>
                  {(acc.cash_accounts || []).length === 0 ? (
                    <tr><td colSpan={2}><EmptyState title="No cash accounts" /></td></tr>
                  ) : (
                    (acc.cash_accounts || []).map(a => (
                      <tr key={a.id}>
                        <td>{a.account_name}</td>
                        <td><AmountDisplay amount={a.current_balance} type="neutral" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* BANK ACCOUNTS */}
        {activeTab === "bank" && (
          <>
            <div className="data-card-header"><div className="data-card-title">Bank Accounts</div></div>

            {(acc.bank_accounts || []).length > 0 && (
              <div style={{ padding: "0 24px 20px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(acc.bank_accounts || []).map(b => ({ name: b.bank_name, amount: parseFloat(b.current_balance || 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => `₹${v}`} />
                    <Tooltip cursor={{ fill: "#f3f4f6" }} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }} formatter={v => [formatINR(v), "Balance"]} />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead><tr><th>Bank</th><th>Account No</th><th>Balance</th></tr></thead>
                <tbody>
                  {(acc.bank_accounts || []).length === 0 ? (
                    <tr><td colSpan={3}><EmptyState title="No bank accounts" /></td></tr>
                  ) : (
                    (acc.bank_accounts || []).map(b => (
                      <tr key={b.id}>
                        <td>{b.bank_name}</td>
                        <td className="td-mono">{b.account_number}</td>
                        <td><AmountDisplay amount={b.current_balance} type="neutral" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* INCOME TRANSACTIONS */}
        {activeTab === "income" && (
          <>
            <div className="data-card-header"><div className="data-card-title">Recent Income History</div></div>
            
            {incomeList.length > 0 && !loadingLists && (
              <div style={{ padding: "0 24px 20px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={groupTransactionsByDate(incomeList)}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => `₹${v}`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }} formatter={v => [formatINR(v), "Income"]} />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {loadingLists ? <LoadingState /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Receipt No</th><th>Date</th><th>Donor / Source</th><th>Purpose</th><th>Method</th><th>Amount</th></tr></thead>
                  <tbody>
                    {incomeList.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState title="No recent income" /></td></tr>
                    ) : (
                      incomeList.map(i => (
                        <tr key={i.id}>
                          <td className="td-mono">{i.receipt_number}</td>
                          <td style={{fontSize:12,color:"var(--gray-500)"}}>{format(new Date(i.date), "dd MMM yyyy")}</td>
                          <td>{i.donor_name || i.source}</td>
                          <td>{i.purpose || "-"}</td>
                          <td><span className="badge badge-gray">{i.payment_method}</span></td>
                          <td><AmountDisplay amount={i.amount} type="credit" /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* EXPENSE TRANSACTIONS */}
        {activeTab === "expense" && (
          <>
            <div className="data-card-header"><div className="data-card-title">Recent Expense History</div></div>

            {expenseList.length > 0 && !loadingLists && (
              <div style={{ padding: "0 24px 20px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={groupTransactionsByDate(expenseList)}>
                    <defs>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => `₹${v}`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }} formatter={v => [formatINR(v), "Expense"]} />
                    <Area type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {loadingLists ? <LoadingState /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Expense ID</th><th>Date</th><th>Payee / Category</th><th>Purpose</th><th>Method</th><th>Amount</th></tr></thead>
                  <tbody>
                    {expenseList.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState title="No recent expenses" /></td></tr>
                    ) : (
                      expenseList.map(e => (
                        <tr key={e.id}>
                          <td className="td-mono">{e.expense_id}</td>
                          <td style={{fontSize:12,color:"var(--gray-500)"}}>{format(new Date(e.date), "dd MMM yyyy")}</td>
                          <td>{e.payee || e.category}</td>
                          <td>{e.purpose || "-"}</td>
                          <td><span className="badge badge-gray">{e.payment_method}</span></td>
                          <td><AmountDisplay amount={e.amount} type="debit" /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
