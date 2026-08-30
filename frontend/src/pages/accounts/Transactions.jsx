import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function TransactionList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await accountsApi.transactions.list({search, transaction_type:typeFilter}); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, typeFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  return (
    <div>
      <PageHeader title="Transaction Register" subtitle="Complete financial transaction history" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {["INCOME","EXPENSE","DISBURSEMENT","SALARY","TRANSFER"].map(t=><option key={t}>{t}</option>)}
          </select>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Txn ID</th><th>Date</th><th>Type</th><th>Description</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Account</th><th>Reference</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="📋" title="No transactions" /></td></tr>
                  : items.map(t=>(
                  <tr key={t.id}>
                    <td className="td-mono">{t.transaction_id}</td>
                    <td>{t.date ? format(new Date(t.date),"dd MMM yyyy") : "-"}</td>
                    <td><span className="badge badge-blue">{t.transaction_type}</span></td>
                    <td>{t.description}</td>
                    <td>{t.debit ? <AmountDisplay amount={t.debit} type="debit" /> : "-"}</td>
                    <td>{t.credit ? <AmountDisplay amount={t.credit} type="credit" /> : "-"}</td>
                    <td><span className="badge badge-gray">{t.account_type}</span></td>
                    <td className="td-mono" style={{fontSize:11}}>{t.reference_id || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
