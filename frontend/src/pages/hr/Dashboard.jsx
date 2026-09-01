import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrApi } from '../../api'
import { LoadingState, EmptyState, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import BirthdayBanner from '../../components/BirthdayBanner'
import StaffPerformanceReport from '../../components/reports/StaffPerformanceReport'
import StaffPerformanceFilter from '../../components/reports/StaffPerformanceFilter'

// ── colour tokens ────────────────────────────────────────────────
const C = {
  green:  '#22C55E', red:    '#EF4444', yellow: '#F59E0B',
  blue:   '#1E4DB7', purple: '#A855F7', indigo: '#6366F1', gray: '#94A3B8',
}

const pct = (n, t) => t ? Math.round((n / t) * 100) : 0

// ── Shared tooltip ───────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      {label && <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          <span style={{ color: '#6b7280' }}>{p.name}:</span>
          <strong style={{ color: '#111' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Big clickable summary card ───────────────────────────────────
function SummaryCard({ icon, label, value, sub, color, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `linear-gradient(135deg,${color}18,${color}06)` : 'white',
      border: `2px solid ${active ? color : '#e5e7eb'}`,
      borderRadius: 16, padding: '26px 22px', cursor: 'pointer',
      transition: 'all .22s ease', flex: 1, minWidth: 200, position: 'relative', overflow: 'hidden',
      boxShadow: active ? `0 8px 28px ${color}22` : '0 1px 4px rgba(0,0,0,.05)',
    }}>
      <div style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70, borderRadius: '50%', background: `${color}18`, transform: active ? 'scale(1.6)' : 'scale(1)', transition: 'all .3s' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: active ? color : '#111827', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      {active && <div style={{ marginTop: 12, fontSize: 11, color: color, fontWeight: 600 }}>Click again to collapse ▲</div>}
    </div>
  )
}

// ── Mini info tile ───────────────────────────────────────────────
function MiniTile({ icon, label, value, color = C.blue }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #f0f0f4', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#111' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Progress bar row ─────────────────────────────────────────────
function ProgressRow({ label, value, total, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value} ({pct(value, total)}%)</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct(value, total)}%`, background: color, borderRadius: 4, transition: 'width .5s ease' }} />
      </div>
    </div>
  )
}

// ── Expand panel wrapper ─────────────────────────────────────────
function Panel({ children }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 16, padding: 22, marginBottom: 20, animation: 'fadeIn .2s ease' }}>
      {children}
    </div>
  )
}

function PLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 14 }}>{children}</div>
}

// ──────────────────────────────────────────────────────────────────
export default function HRDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [showStaffFilterReport, setShowStaffFilterReport] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try { const res = await hrApi.dashboard(); setData(res.data) }
    catch { toast.error('Failed to load dashboard') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState />

  const d = data || {}
  const att = d.attendance || {}
  const attTotal = (att.present_today||0) + (att.absent_today||0) + (att.on_leave||0)
  const history  = att.history || []

  const toggle = (key) => setActive(p => p === key ? null : key)

  // ── chart data ───────────────────────────────────────────────
  const memberPieData = [
    { name: 'Active Members',  value: d.members?.active     || 0, fill: C.blue   },
    { name: 'Inactive',        value: (d.members?.total||0) - (d.members?.active||0), fill: C.gray },
    { name: 'Active Volunteers', value: d.volunteers?.active  || 0, fill: C.purple },
  ].filter(x => x.value > 0)

  const attPieData = [
    { name: 'Present',  value: att.present_today || 0, fill: C.green  },
    { name: 'Absent',   value: att.absent_today  || 0, fill: C.red    },
    { name: 'On Leave', value: att.on_leave      || 0, fill: C.yellow },
  ].filter(x => x.value > 0)

  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'

  if (showStaffFilterReport) {
    return <StaffPerformanceFilter initialPeriod="daily" onClose={() => setShowStaffFilterReport(false)} />
  }

  return (
    <div>
      {/* Printable Staff Performance Report Modal */}
      {showReport && <StaffPerformanceReport initialPeriod="weekly" onClose={() => setShowReport(false)} />}

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>HR Dashboard</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>Good {greeting} — {format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowStaffFilterReport(true)} style={{ background: '#F0FDF4', color: '#16A34A', fontWeight: 700, border: '1px solid #BBF7D0' }}>
            📈 Staff Performance
          </button>
          <button className="btn btn-secondary" onClick={() => setShowReport(true)} style={{ background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, border: '1px solid #C7D2FE' }}>
            📊 Performance Report
          </button>
          {(d.alerts?.expiring_documents || 0) > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
              ⚠️ {d.alerts.expiring_documents} docs expiring soon
            </div>
          )}
          {(d.leave?.pending || 0) > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#D97706', fontWeight: 600 }}>
              📅 {d.leave.pending} leave requests pending
            </div>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/hr/attendance')}>Mark Attendance</button>
        </div>
      </div>

      {/* Birthday Banner */}
      <BirthdayBanner />

      {/* ── 3 SUMMARY CARDS ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <SummaryCard
          icon="👥" label="People" color={C.blue} active={active === 'people'}
          value={(d.members?.active || 0) + (d.volunteers?.active || 0)}
          sub={`${d.members?.active || 0} members · ${d.volunteers?.active || 0} volunteers`}
          onClick={() => toggle('people')}
        />
        <SummaryCard
          icon="📋" label="Today's Attendance" color={C.green} active={active === 'attendance'}
          value={`${att.present_today || 0} / ${d.executive_officers || 0}`}
          sub={`${pct(att.present_today, d.executive_officers)}% present · ${att.absent_today || 0} absent`}
          onClick={() => toggle('attendance')}
        />
        <SummaryCard
          icon="📅" label="Leave & Alerts" color={C.yellow} active={active === 'leave'}
          value={d.leave?.pending || 0}
          sub={`Pending leave requests · ${d.alerts?.expiring_documents || 0} docs expiring`}
          onClick={() => toggle('leave')}
        />
      </div>

      {/* ── EXPANDED: PEOPLE ──────────────────────────────────── */}
      {active === 'people' && (
        <Panel>
          <PLabel>👥 People Overview</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="👥" label="Total Members"    value={d.members?.total      || 0} color={C.blue}   />
            <MiniTile icon="✅" label="Active Members"   value={d.members?.active     || 0} color={C.green}  />
            <MiniTile icon="🙋" label="Volunteers"       value={d.volunteers?.total   || 0} color={C.purple} />
            <MiniTile icon="🙋‍♂️" label="Active Volunteers" value={d.volunteers?.active || 0} color={C.indigo} />
            <MiniTile icon="👔" label="Exec. Members"    value={d.executive_members   || 0} color={C.yellow} />
            <MiniTile icon="🧑‍💼" label="Staff Officers"   value={d.executive_officers  || 0} color={C.gray}   />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Donut */}
            <div style={{ background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>PEOPLE COMPOSITION</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={memberPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {memberPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Recent members */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f0f0f4', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>RECENTLY JOINED MEMBERS</div>
              </div>
              <div className="table-wrap" style={{ margin: 0 }}>
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                  <tbody>
                    {(d.recent_members || []).length === 0
                      ? <tr><td colSpan={4}><EmptyState icon="👥" title="No members yet" /></td></tr>
                      : (d.recent_members || []).map(m => (
                        <tr key={m.id}>
                          <td className="td-mono" style={{ fontSize: 11 }}>{m.member_id}</td>
                          <td>{m.full_name}</td>
                          <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{m.membership_type}</span></td>
                          <td><span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10 }}>{m.status}</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'right' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/hr/members')}>View All Members →</button>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* ── EXPANDED: ATTENDANCE ──────────────────────────────── */}
      {active === 'attendance' && (
        <Panel>
          <PLabel>📋 Today's Attendance — {format(new Date(), 'dd MMMM yyyy')}</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="✅" label="Present"    value={att.present_today || 0} color={C.green}  />
            <MiniTile icon="❌" label="Absent"     value={att.absent_today  || 0} color={C.red}    />
            <MiniTile icon="🏖️" label="On Leave"   value={att.on_leave      || 0} color={C.yellow} />
            <MiniTile icon="🧑‍💼" label="Total Staff" value={d.executive_officers || 0} color={C.gray} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Donut */}
            <div style={{ background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>TODAY'S SPLIT</div>
              {attPieData.length === 0
                ? <EmptyState icon="📭" title="No attendance marked yet today" />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={attPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {attPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </div>

            {/* Progress bars */}
            <div style={{ background: 'white', borderRadius: 12, padding: '18px 18px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 14 }}>ATTENDANCE RATE</div>
              <ProgressRow label="Present"  value={att.present_today || 0} total={attTotal} color={C.green}  />
              <ProgressRow label="Absent"   value={att.absent_today  || 0} total={attTotal} color={C.red}    />
              <ProgressRow label="On Leave" value={att.on_leave      || 0} total={attTotal} color={C.yellow} />
              <div style={{ marginTop: 18 }}>
                <button className="btn btn-sm btn-primary" onClick={() => navigate('/hr/attendance')}>Mark / View Attendance →</button>
              </div>
            </div>
          </div>

          {/* 7-day bar chart */}
          {history.length > 0 && (
            <div style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>LAST 7 DAYS — ATTENDANCE HISTORY</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={history} barSize={18} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="present" name="Present" fill={C.green}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent"  name="Absent"  fill={C.red}    radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leave"   name="Leave"   fill={C.yellow} radius={[4, 4, 0, 0]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      )}

      {/* ── EXPANDED: LEAVE & ALERTS ──────────────────────────── */}
      {active === 'leave' && (
        <Panel>
          <PLabel>📅 Leave & Document Alerts</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="📅" label="Pending Leaves"     value={d.leave?.pending            || 0} color={C.yellow} />
            <MiniTile icon="⚠️" label="Expiring Documents" value={d.alerts?.expiring_documents || 0} color={C.red}    />
            <MiniTile icon="🎂" label="Birthdays This Month" value={d.alerts?.upcoming_birthdays || 0} color={C.purple} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/hr/leave')}>Review Leave Requests →</button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/hr/officers')}>Manage Staff Documents →</button>
          </div>
        </Panel>
      )}

      {/* ── BOTTOM: 7-day trend (always visible) ─────────────── */}
      <div style={{ background: 'white', borderRadius: 16, padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Attendance — Last 7 Days</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Daily present vs absent vs leave trend</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/hr/attendance')}>View Full Attendance →</button>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={history} barSize={16} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="present" name="Present" fill={C.green}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="absent"  name="Absent"  fill={C.red}    radius={[4, 4, 0, 0]} />
            <Bar dataKey="leave"   name="Leave"   fill={C.yellow} radius={[4, 4, 0, 0]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
