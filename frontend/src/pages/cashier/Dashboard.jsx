import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { cashierApi } from "../../api"
import { StatCard, AmountDisplay, LoadingState, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function CashierDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try { const res = await cashierApi.dashboard(); setData(res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener("dashboard-refresh", h)
    return () => window.removeEventListener("dashboard-refresh", h)
  }, [])

  if (loading) return <LoadingState />
  const d = data || {}

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>Cashier Dashboard</h2><p>{format(new Date(),"EEEE, dd MMMM yyyy")}</p></div>
        <div className="page-header-actions">
          {d.pending_requests > 0 && (
            <button className="btn btn-primary" onClick={() => navigate("/cashier/pending")}>
              ⚡ {d.pending_requests} Pending Disbursement{d.pending_requests>1?"s":""}
            </button>
          )}
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Available Cash" value={formatINR(d.available_cash)} icon="💵" variant="success" sub="In hand" />
        <StatCard label="Pending Requests" value={d.pending_requests || 0} icon="⏳" variant="warning" sub="Awaiting disbursement" />
        <StatCard label="Today Receipts" value={formatINR(d.today_receipts)} icon="📥" variant="info" />
        <StatCard label="Today Payments" value={formatINR(d.today_payments)} icon="📤" variant="danger" />
        <StatCard label="Completed Today" value={d.completed_today || 0} icon="✅" variant="success" />
      </div>
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">Recent Disbursements</div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate("/cashier/disbursements")}>View All</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Disbursement ID</th><th>Request No</th><th>Purpose</th><th>Amount</th><th>Receiver</th><th>Method</th><th>Date</th></tr></thead>
            <tbody>
              {(d.recent_disbursements || []).length===0
                ? <tr><td colSpan={7} style={{textAlign:"center",padding:24,color:"var(--gray-400)"}}>No disbursements yet</td></tr>
                : (d.recent_disbursements || []).map(dis=>(
                <tr key={dis.id}>
                  <td className="td-mono">{dis.disbursement_id}</td>
                  <td className="td-mono">{dis.request_number}</td>
                  <td>{dis.request_purpose}</td>
                  <td><AmountDisplay amount={dis.amount_disbursed} type="debit" /></td>
                  <td>{dis.receiver_name}</td>
                  <td><span className="badge badge-gray">{dis.payment_method}</span></td>
                  <td style={{fontSize:12,color:"var(--gray-500)"}}>{dis.date ? format(new Date(dis.date),"dd MMM yyyy") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
