import React, { useState, useEffect } from "react"
import { hrApi } from "../../api"
import { StatCard, LoadingState, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function HRDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = async () => {
    try { const res = await hrApi.dashboard(); setData(res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingState />
  const d = data || {}
  return (
    <div>
      <div className="page-header"><div className="page-header-left"><h2>HR Dashboard</h2><p>{format(new Date(),"EEEE, dd MMMM yyyy")}</p></div></div>
      <div className="stats-grid">
        <StatCard label="Total Members" value={d.members?.total || 0} icon="👥" sub={`${d.members?.active || 0} Active`} />
        <StatCard label="Volunteers" value={d.volunteers?.total || 0} icon="🙋" variant="info" sub={`${d.volunteers?.active || 0} Active`} />
        <StatCard label="Executive Members" value={d.executive_members || 0} icon="👔" />
        <StatCard label="Executive Officers" value={d.executive_officers || 0} icon="👨‍💼" />
        <StatCard label="Present Today" value={d.attendance?.present_today || 0} icon="✅" variant="success" />
        <StatCard label="Absent Today" value={d.attendance?.absent_today || 0} icon="❌" variant="danger" />
        <StatCard label="On Leave" value={d.attendance?.on_leave || 0} icon="📅" variant="warning" />
        <StatCard label="Pending Leave" value={d.leave?.pending || 0} icon="⏳" variant="warning" />
        <StatCard label="Expiring Documents" value={d.alerts?.expiring_documents || 0} icon="⚠️" variant="danger" />
      </div>
      <div className="data-card">
        <div className="data-card-header"><div className="data-card-title">Recent Members</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Member ID</th><th>Name</th><th>Phone</th><th>Type</th><th>Joining Date</th><th>Status</th></tr></thead>
            <tbody>
              {(d.recent_members || []).map(m=>(
                <tr key={m.id}>
                  <td className="td-mono">{m.member_id}</td><td>{m.full_name}</td><td>{m.phone}</td>
                  <td><span className="badge badge-blue">{m.membership_type}</span></td>
                  <td>{m.joining_date ? format(new Date(m.joining_date),"dd MMM yyyy") : "-"}</td>
                  <td><span className={`badge ${m.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
