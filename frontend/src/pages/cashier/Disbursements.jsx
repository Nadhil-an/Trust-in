import React, { useState, useEffect, useCallback } from "react"
import { cashierApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function DisbursementList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await cashierApi.disbursements({search}); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  return (
    <div>
      <PageHeader title="Payout History" subtitle="All completed payouts" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payout ID</th><th>Request No</th><th>Purpose</th><th>Amount</th><th>Receiver</th><th>Method</th><th>Voucher</th><th>Paid By</th><th>Date</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={9}><EmptyState icon="💸" title="No payouts" /></td></tr>
                  : items.map(d=>(
                  <tr key={d.id}>
                    <td className="td-mono">{d.disbursement_id}</td>
                    <td className="td-mono">{d.request_number}</td>
                    <td>{d.request_purpose}</td>
                    <td><AmountDisplay amount={d.amount_disbursed} type="debit" /></td>
                    <td>{d.receiver_name}</td>
                    <td><span className="badge badge-gray">{d.payment_method}</span></td>
                    <td>{d.voucher_number || "-"}</td>
                    <td>{d.disbursed_by?.full_name || "-"}</td>
                    <td style={{fontSize:12,color:"var(--gray-500)"}}>{d.date ? format(new Date(d.date),"dd MMM yyyy") : "-"}</td>
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
