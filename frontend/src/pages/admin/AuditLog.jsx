import React, { useState, useEffect, useCallback } from "react"
import { coreApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  
  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await coreApi.auditLog({search, action:actionFilter}); setLogs(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, actionFilter])
  
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  return (
    <div>
      <PageHeader title="System Audit Log" subtitle="Track all critical system actions" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" value={actionFilter} onChange={e=>setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            {["CREATE","UPDATE","DELETE","LOGIN","LOGOUT","DISBURSE","APPROVE","REJECT","TRANSFER"].map(a=><option key={a}>{a}</option>)}
          </select>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Description</th><th>IP Address</th></tr></thead>
              <tbody>
                {logs.length===0 ? <tr><td colSpan={6}><EmptyState icon="🔍" title="No logs found" /></td></tr>
                  : logs.map(l=>(<tr key={l.id}>
                    <td style={{fontSize:12,whiteSpace:"nowrap"}}>{format(new Date(l.timestamp),"dd MMM yy, HH:mm:ss")}</td>
                    <td>{l.user_name || "System"}</td>
                    <td><span className={`badge ${l.action==="DELETE"||l.action==="REJECT"?"badge-red":l.action==="CREATE"||l.action==="APPROVE"?"badge-green":"badge-blue"}`}>{l.action}</span></td>
                    <td>{l.module_name}</td>
                    <td>{l.description}</td>
                    <td className="td-mono">{l.ip_address}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
