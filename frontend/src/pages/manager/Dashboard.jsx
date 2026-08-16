import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi, accountsApi } from '../../api'
import { AmountDisplay, LoadingState, PageHeader, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import BirthdayBanner from '../../components/BirthdayBanner'

// ── colour tokens ────────────────────────────────────────────────
const CLR = {
  blue:   '#1E4DB7',
  indigo: '#6366F1',
  green:  '#22C55E',
  yellow: '#F59E0B',
  red:    '#EF4444',
  purple: '#A855F7',
  gray:   '#94A3B8',
}

// ── small helpers ────────────────────────────────────────────────
const pct = (n, total) => total ? Math.round((n / total) * 100) : 0

// ── Tooltip for charts ───────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', border: '1px solid var(--gray-200)',
      borderRadius: 8, padding: '8px 14px', boxShadow: 'var(--shadow-md)',
      fontSize: 12, minWidth: 120,
    }}>
      {label && <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || CLR.blue, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--gray-600)' }}>{p.name}:</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Big summary card (top 3) ─────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active
          ? `linear-gradient(135deg, ${color}15, ${color}05)`
          : 'white',
        border: `2px solid ${active ? color : 'var(--gray-200)'}`,
        borderRadius: 16,
        padding: '28px 24px',
        cursor: 'pointer',
        transition: 'all 0.22s ease',
        boxShadow: active
          ? `0 8px 28px ${color}22`
          : 'var(--shadow-sm)',
        flex: 1,
        minWidth: 200,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* glow blob */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}18`,
        transition: 'all 0.3s',
        transform: active ? 'scale(1.5)' : 'scale(1)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: active ? color : 'var(--gray-800)', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{sub}</div>}
        </div>
      </div>
      {active && (
        <div style={{ marginTop: 14, fontSize: 11, color: color, fontWeight: 600 }}>
          Click again to collapse ▲
        </div>
      )}
    </div>
  )
}

// ── Mini stat tile inside expanded panel ─────────────────────────
function MiniTile({ label, value, color = CLR.blue, icon }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '16px 18px',
      border: '1px solid var(--gray-100)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 140,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Expanded panel wrapper ────────────────────────────────────────
function ExpandPanel({ children }) {
  return (
    <div style={{
      background: 'var(--gray-50)',
      border: '1px solid var(--gray-200)',
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      animation: 'fadeIn .2s ease',
    }}>
      {children}
    </div>
  )
}

// ── Section title inside panel ────────────────────────────────────
function PanelTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.6px' }}>
      {children}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null) // 'requests' | 'finance' | 'attendance' | 'donations'
  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await managerApi.dashboard()
      setData(res.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener('dashboard-refresh', handler)
    return () => window.removeEventListener('dashboard-refresh', handler)
  }, [])

  if (loading) return <LoadingState />

  const {
    requests = {}, finance = {}, hr = {}, attendance = {}, payouts = {},
    monthly_trend = [], recent_requests = [],
  } = data || {}

  const toggle = (key) => setActive(prev => prev === key ? null : key)

  // ── chart datasets ────────────────────────────────────────────
  const requestStatusData = [
    { name: 'Pending',      value: requests.pending || 0,        fill: CLR.yellow },
    { name: 'Under Review', value: requests.under_review || 0,   fill: CLR.blue   },
    { name: 'Approved',     value: requests.approved || 0,       fill: CLR.green  },
    { name: 'Completed',    value: requests.completed || 0,      fill: CLR.purple },
    { name: 'Rejected',     value: requests.rejected || 0,       fill: CLR.red    },
    { name: 'On Hold',      value: requests.on_hold || 0,        fill: CLR.gray   },
  ].filter(d => d.value > 0)

  const attendanceData = [
    { name: 'Present',  value: attendance.present || 0,  fill: CLR.green  },
    { name: 'Absent',   value: attendance.absent  || 0,  fill: CLR.red    },
    { name: 'Late',     value: attendance.late    || 0,  fill: CLR.yellow },
    { name: 'On Leave', value: attendance.on_leave|| 0,  fill: CLR.blue   },
  ].filter(d => d.value > 0)

  const attTotal = (attendance.present||0) + (attendance.absent||0) + (attendance.late||0) + (attendance.on_leave||0)

  return (
    <div>
      <PageHeader
        title="Manager Dashboard"
        subtitle={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} — ${format(new Date(), 'EEEE, dd MMMM yyyy')}`}
      >
        <button className="btn btn-primary" onClick={() => navigate('/manager/requests')}>
          + New Request
        </button>
      </PageHeader>

      {/* Birthday Banner */}
      <BirthdayBanner />

      {/* ── 5 SUMMARY CARDS ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        <SummaryCard
          icon="📋"
          label="Assessment Requests"
          value={requests.pending || 0}
          sub={`${requests.total || 0} total · ${requests.completed || 0} completed`}
          color={CLR.blue}
          active={active === 'requests'}
          onClick={() => toggle('requests')}
        />
        <SummaryCard
          icon="💰"
          label="Total Funds Available"
          value={formatINR(finance.total_balance)}
          sub={`Cash ₹${(finance.cash_balance||0).toLocaleString('en-IN')} · Bank ₹${(finance.bank_balance||0).toLocaleString('en-IN')}`}
          color={CLR.green}
          active={active === 'finance'}
          onClick={() => toggle('finance')}
        />
        <SummaryCard
          icon="👥"
          label="Today's Attendance"
          value={`${attendance.present || 0} / ${attendance.total_staff || 0}`}
          sub={`${pct(attendance.present, attendance.total_staff)}% present · ${attendance.absent || 0} absent`}
          color={CLR.purple}
          active={active === 'attendance'}
          onClick={() => toggle('attendance')}
        />
        <SummaryCard
          icon="💝"
          label="Today's Donations"
          value={formatINR(finance.todays_donations)}
          sub="Total donation amount received today"
          color={CLR.yellow}
          active={active === 'donations'}
          onClick={() => toggle('donations')}
        />
        <SummaryCard
          icon="🎯"
          label="Scheduled Payouts"
          value={payouts.pending || 0}
          sub="Pending scheduled payouts"
          color={CLR.red}
          active={false}
          onClick={() => navigate('/payouts')}
        />
      </div>

      {/* ── EXPANDED: REQUESTS ───────────────────────────────── */}
      {active === 'requests' && (
        <ExpandPanel>
          <PanelTitle>📋 Assessment Requests — Detailed Breakdown</PanelTitle>

          {/* Mini tiles row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <MiniTile icon="⏳" label="Pending"        value={requests.pending       || 0} color={CLR.yellow} />
            <MiniTile icon="🔍" label="Under Review"   value={requests.under_review  || 0} color={CLR.blue}   />
            <MiniTile icon="✅" label="Approved"       value={requests.approved      || 0} color={CLR.green}  />
            <MiniTile icon="🏧" label="Cashier Pending"value={requests.cashier_pending||0} color={CLR.indigo} />
            <MiniTile icon="🎯" label="Completed"      value={requests.completed     || 0} color={CLR.purple} />
            <MiniTile icon="❌" label="Rejected"       value={requests.rejected      || 0} color={CLR.red}    />
            <MiniTile icon="⏸️" label="On Hold"        value={requests.on_hold       || 0} color={CLR.gray}   />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Donut — status split */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 16px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 12 }}>STATUS DISTRIBUTION</div>
              {requestStatusData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={requestStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {requestStatusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar — monthly trend */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 16px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 12 }}>REQUESTS PER MONTH (LAST 6 MONTHS)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly_trend} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Requests" fill={CLR.blue} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent requests table */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10 }}>RECENT REQUESTS</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Request No</th>
                    <th>Purpose</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Requested By</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_requests.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No requests found</td></tr>
                  ) : recent_requests.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/manager/requests/${r.id}`)}>
                      <td className="td-mono">{r.request_number}</td>
                      <td>{r.purpose}</td>
                      <td><span className="badge badge-blue">{r.category?.replace(/_/g,' ')}</span></td>
                      <td><AmountDisplay amount={r.amount_requested} /></td>
                      <td>{r.requested_by_name}</td>
                      <td>
                        <span className={`badge ${r.priority==='URGENT'?'badge-red':r.priority==='HIGH'?'badge-yellow':'badge-gray'}`}>
                          {r.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          r.status==='COMPLETED'?'badge-green':
                          r.status==='REJECTED'?'badge-red':
                          r.status==='APPROVED'?'badge-blue':
                          'badge-yellow'
                        }`}>{r.status?.replace(/_/g,' ')}</span>
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                        {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/manager/requests')}>
                View All Requests →
              </button>
            </div>
          </div>
        </ExpandPanel>
      )}

      {/* ── EXPANDED: FINANCE ────────────────────────────────── */}
      {active === 'finance' && (
        <ExpandPanel>
          <PanelTitle>💰 Financial Overview — Fund Balances</PanelTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <MiniTile icon="💵" label="Cash in Hand"  value={formatINR(finance.cash_balance)}  color={CLR.green}  />
            <MiniTile icon="🏦" label="Bank Balance"  value={formatINR(finance.bank_balance)}  color={CLR.blue}   />
            <MiniTile icon="💰" label="Total Funds"   value={formatINR(finance.total_balance)} color={CLR.purple} />
            <MiniTile icon="✅" label="Approved Amt"  value={formatINR(requests.total_approved_amount)} color={CLR.indigo} />
            <MiniTile icon="👥" label="Active Members" value={hr.members || 0}                  color={CLR.yellow} />
            <MiniTile icon="🙋" label="Volunteers"     value={hr.volunteers || 0}               color={CLR.gray}   />
          </div>

          {/* Bar chart: cash vs bank */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 16px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 12 }}>FUND SPLIT</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: 'Cash Balance', amount: finance.cash_balance || 0 },
                  { name: 'Bank Balance', amount: finance.bank_balance || 0 },
                ]} barSize={50}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                  <Bar dataKey="amount" name="Balance (₹)" radius={[6,6,0,0]}>
                    <Cell fill={CLR.green} />
                    <Cell fill={CLR.blue}  />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* HR composition */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 16px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 12 }}>PEOPLE OVERVIEW</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active Members', value: hr.members || 0 },
                      { name: 'Volunteers',     value: hr.volunteers || 0 },
                    ]}
                    dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={85} paddingAngle={4}
                  >
                    <Cell fill={CLR.blue} />
                    <Cell fill={CLR.purple} />
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ExpandPanel>
      )}

      {/* ── EXPANDED: ATTENDANCE ─────────────────────────────── */}
      {active === 'attendance' && (
        <ExpandPanel>
          <PanelTitle>👥 Today's Attendance — {format(new Date(), 'dd MMMM yyyy')}</PanelTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <MiniTile icon="✅" label="Present"  value={attendance.present  || 0} color={CLR.green}  />
            <MiniTile icon="❌" label="Absent"   value={attendance.absent   || 0} color={CLR.red}    />
            <MiniTile icon="🕐" label="Late"     value={attendance.late     || 0} color={CLR.yellow} />
            <MiniTile icon="🏖️" label="On Leave" value={attendance.on_leave || 0} color={CLR.blue}   />
            <MiniTile icon="👥" label="Total Staff" value={attendance.total_staff || 0} color={CLR.gray} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Donut - attendance breakdown */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 16px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 12 }}>ATTENDANCE BREAKDOWN</div>
              {attendanceData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                  <div>No attendance marked today</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {attendanceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Attendance rate bar */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px 18px', border: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>ATTENDANCE RATE</div>
              {[
                { label: 'Present',  value: attendance.present  || 0, color: CLR.green,  total: attTotal },
                { label: 'Absent',   value: attendance.absent   || 0, color: CLR.red,    total: attTotal },
                { label: 'Late',     value: attendance.late     || 0, color: CLR.yellow, total: attTotal },
                { label: 'On Leave', value: attendance.on_leave || 0, color: CLR.blue,   total: attTotal },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-600)', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value} ({pct(row.value, row.total)}%)</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--gray-100)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct(row.value, row.total)}%`,
                      background: row.color, borderRadius: 4,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExpandPanel>
      )}

      {/* ── EXPANDED: DONATIONS ──────────────────────────────── */}
      {active === 'donations' && (
        <ExpandPanel>
          <PanelTitle>💝 Donations Viewer</PanelTitle>
          <DonationsTable />
        </ExpandPanel>
      )}

      {/* ── BOTTOM: Monthly trend line chart (always visible) ── */}
      <div style={{ background: 'white', borderRadius: 16, padding: '24px', border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Assessment Requests — 6-Month Trend</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>How many requests were submitted each month</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/manager/requests')}>
            View All →
          </button>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={monthly_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTip />} />
            <Line
              type="monotone" dataKey="count" name="Requests"
              stroke={CLR.blue} strokeWidth={2.5}
              dot={{ r: 4, fill: CLR.blue, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DonationsTable() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    const fetchDonations = async () => {
      setLoading(true)
      try {
        const res = await accountsApi.income.list({ source: 'DONATION', date: selectedDate, search })
        setItems(res.data.results || res.data)
      } catch (err) {
        toast.error('Failed to load donations')
      } finally {
        setLoading(false)
      }
    }
    fetchDonations()
  }, [selectedDate, search])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
          Showing donations for: <strong>{format(new Date(selectedDate), 'dd MMMM yyyy')}</strong>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            className="form-control" 
            style={{ width: '200px', padding: '6px 12px', fontSize: 13 }}
            placeholder="Search donor..."
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <input 
            type="date" 
            className="form-control" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)} 
          />
        </div>
      </div>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-500)', border: '1px dashed var(--gray-200)', borderRadius: 8 }}>
          No donations recorded on this date.
        </div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Donor Name</th>
                <th>Phone</th>
                <th>Payment</th>
                <th>Remarks</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontSize: 12 }}>{format(new Date(item.created_at), 'dd MMM, hh:mm a')}</td>
                  <td style={{ fontWeight: 600 }}>{item.donor_name || 'Anonymous'}</td>
                  <td style={{ fontSize: 12 }}>{item.phone || '—'}</td>
                  <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{item.payment_method}</span></td>
                  <td style={{ fontSize: 12, maxWidth: 200 }}>{item.remarks || item.purpose || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
