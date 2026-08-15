import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { hrApi } from "../../api"
import { StatCard, LoadingState, formatINR, Modal, EmptyState } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export default function HRDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false)
  const [activeGraph, setActiveGraph] = useState("present")
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [empGraphData, setEmpGraphData] = useState([])
  const [empGraphLoading, setEmpGraphLoading] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try { const res = await hrApi.dashboard(); setData(res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const fetchEmpGraph = async (empId) => {
    setEmpGraphLoading(true)
    try {
      const res = await hrApi.officers.attendanceGraph(empId, { days: 7 })
      setEmpGraphData(res.data.history || [])
    } catch (_) {
      toast.error("Failed to load attendance graph")
    } finally {
      setEmpGraphLoading(false)
    }
  }

  const handleEmpClick = (emp) => {
    setSelectedEmp(emp)
    fetchEmpGraph(emp.id)
  }
  
  if (loading) return <LoadingState />
  const d = data || {}
  const history = d.attendance?.history || []
  
  const activeList = activeGraph === 'present' 
    ? (d.attendance?.present_list || []) 
    : activeGraph === 'absent' 
      ? (d.attendance?.absent_list || []) 
      : (d.attendance?.leave_list || []);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="page-header-left">
          <h2>HR Dashboard</h2>
          <p>{format(new Date(),"EEEE, dd MMMM yyyy")}</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => navigate('/hr/attendance')}>
            Mark Attendance
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Staff Attendance" value={d.attendance?.present_today || 0} icon="📋" variant="info" sub="Click to view details" onClick={() => setAttendanceModalOpen(true)} />
        <StatCard label="Executive Members" value={d.executive_members || 0} icon="👔" onClick={() => navigate('/hr/executive-members')} />
        <StatCard label="Volunteers" value={d.volunteers?.total || 0} icon="🙋" variant="info" sub={`${d.volunteers?.active || 0} Active`} onClick={() => navigate('/hr/volunteers')} />
      </div>

      <div className="data-card" style={{ marginTop: 24 }}>
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

      <Modal isOpen={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)} title="Staff Attendance Details" size="modal-fullscreen" overlayClass="modal-overlay-content">
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <StatCard label="Present Today" value={d.attendance?.present_today || 0} icon="✅" variant={activeGraph === 'present' ? 'success' : ''} onClick={() => setActiveGraph('present')} />
          <StatCard label="Absent Today" value={d.attendance?.absent_today || 0} icon="❌" variant={activeGraph === 'absent' ? 'danger' : ''} onClick={() => setActiveGraph('absent')} />
          <StatCard label="On Leave" value={d.attendance?.on_leave || 0} icon="📅" variant={activeGraph === 'leave' ? 'warning' : ''} onClick={() => setActiveGraph('leave')} />
          <StatCard label="Total Staff Members" value={d.executive_officers || 0} icon="👨‍💼" variant="info" sub="Click to view all" onClick={() => navigate('/hr/officers?employment_type=FULL_TIME')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, flex: 1, minHeight: 0 }}>
          
          <div className="data-card" style={{ display: 'flex', flexDirection: 'column', margin: 0, height: '100%' }}>
            <div className="data-card-header">
              <div className="data-card-title" style={{ textTransform: 'capitalize' }}>
                {activeGraph} Today ({activeList.length})
              </div>
            </div>
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              {activeList.length === 0 ? (
                <EmptyState icon="📭" title={`No staff ${activeGraph} today`} />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Emp ID</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.map(emp => (
                      <tr 
                        key={emp.id} 
                        onClick={() => handleEmpClick(emp)}
                        style={{ cursor: 'pointer', background: selectedEmp?.id === emp.id ? 'var(--primary-50)' : '' }}
                        className="hover-row"
                      >
                        <td className="td-mono">{emp.emp_id}</td>
                        <td>{emp.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
          <div className="data-card" style={{ display: 'flex', flexDirection: 'column', margin: 0, height: '100%', padding: 24 }}>
            {selectedEmp ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0 }}>{selectedEmp.name}'s Attendance</h4>
                  <button className="btn btn-sm btn-secondary" onClick={() => setSelectedEmp(null)}>View All</button>
                </div>
                {empGraphLoading ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><LoadingState /></div> : (
                  <div style={{ flex: 1, width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={empGraphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                        <YAxis axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }} 
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.875rem' }} 
                          formatter={(value, name, props) => [props.payload.status, 'Status']}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {empGraphData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.status === 'PRESENT' ? '#16A34A' : entry.status === 'HALF_DAY' ? '#D97706' : entry.status === 'NOT_MARKED' ? '#9CA3AF' : '#DC2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : history.length > 0 ? (
              <>
                <h4 style={{ marginBottom: 16, textAlign: 'center', textTransform: 'capitalize' }}>{activeGraph} History (Last 7 Days)</h4>
                <div style={{ flex: 1, width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={history}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey={activeGraph} fill={activeGraph === 'present' ? '#16A34A' : activeGraph === 'absent' ? '#DC2626' : '#D97706'} radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <EmptyState icon="📊" title="No history available" />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
