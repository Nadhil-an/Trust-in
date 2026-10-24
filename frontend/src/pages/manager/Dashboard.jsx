import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi, accountsApi } from '../../api'
import { AmountDisplay, LoadingState, PageHeader, formatINR, Modal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import BirthdayBanner from '../../components/BirthdayBanner'
import StaffPerformanceReport from '../../components/reports/StaffPerformanceReport'
import StaffPerformanceFilter from '../../components/reports/StaffPerformanceFilter'

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
function MiniTile({ label, value, color = CLR.blue, icon, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}0F` : 'white', borderRadius: 12, padding: '16px 18px',
        border: `1px solid ${active ? color : 'var(--gray-100)'}`,
        boxShadow: active ? `0 4px 12px ${color}22` : 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', gap: 12, minWidth: 140,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
    >
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
  const [showReport, setShowReport] = useState(false)
  const [showStaffFilterReport, setShowStaffFilterReport] = useState(false)
  const navigate = useNavigate()

  // Secret delete mode (Ctrl + Shift + Q)
  const [secretDeleteMode, setSecretDeleteMode] = useState(false)
  const [selectedRequestIds, setSelectedRequestIds] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, type: 'REQUEST', items: [] })
  const [deleting, setDeleting] = useState(false)

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

  // Secret key combination: Ctrl + Shift + Q
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setSecretDeleteMode((prev) => {
          const next = !prev;
          if (next) {
            setActive(p => p || 'requests');
            toast('🚨 Secret Delete Mode ENABLED. Select rows or click Delete to permanently erase data.', {
              id: 'secret-delete-mode',
              icon: '🗑️',
              duration: 4000,
              style: {
                borderRadius: '8px',
                background: '#18181B',
                color: '#EF4444',
                fontWeight: '700',
                border: '1px solid #DC2626'
              }
            });
          } else {
            toast.success('Secret Delete Mode DISABLED', { id: 'secret-delete-mode' });
          }
          return next;
        });
        setSelectedRequestIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSelectRequest = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedRequestIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllRequests = () => {
    const recs = data?.recent_requests || [];
    if (selectedRequestIds.length === recs.length && recs.length > 0) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(recs.map(i => i.id));
    }
  };

  const handlePermanentDelete = async () => {
    const { type, items: itemsToDelete } = deleteConfirmModal;
    if (!itemsToDelete || itemsToDelete.length === 0) return;
    setDeleting(true);
    try {
      if (type === 'REQUEST') {
        for (const item of itemsToDelete) {
          await managerApi.requests.delete(item.id);
        }
        toast.success(
          itemsToDelete.length === 1
            ? `Request "${itemsToDelete[0].request_number}" permanently deleted.`
            : `${itemsToDelete.length} requests permanently deleted.`
        );
        setSelectedRequestIds(prev => prev.filter(id => !itemsToDelete.some(it => it.id === id)));
      } else if (type === 'DONATION') {
        for (const item of itemsToDelete) {
          await accountsApi.income.delete(item.id);
        }
        toast.success(
          itemsToDelete.length === 1
            ? `Donation record permanently deleted.`
            : `${itemsToDelete.length} donation records permanently deleted.`
        );
      }
      setDeleteConfirmModal({ open: false, type: 'REQUEST', items: [] });
      load();
    } catch (err) {
      toast.error('Failed to delete: ' + (err.response?.data?.error || err.message || 'Server error'));
    } finally {
      setDeleting(false);
    }
  };


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

  if (showStaffFilterReport) {
    return <StaffPerformanceFilter initialPeriod="daily" onClose={() => setShowStaffFilterReport(false)} />
  }

  return (
    <div>
      {/* Secret Permanent Deletion Alert Banner */}
      {secretDeleteMode && (
        <div style={{
          background: 'linear-gradient(90deg, #FEF2F2 0%, #FFF1F2 100%)',
          border: '1.5px dashed #EF4444',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: '0.95rem', letterSpacing: '0.3px' }}>
                SECRET PERMANENT DATABASE DELETION MODE ACTIVE
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7F1D1D', marginTop: 2 }}>
                Records deleted here are <strong>permanently purged</strong> from the database. Press <code>Ctrl + Shift + Q</code> again to exit.
              </div>
            </div>
          </div>

          {selectedRequestIds.length > 0 && (
            <button
              className="btn"
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '7px 16px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
                cursor: 'pointer'
              }}
              onClick={() => setDeleteConfirmModal({
                open: true,
                type: 'REQUEST',
                items: (recent_requests || []).filter(i => selectedRequestIds.includes(i.id))
              })}
            >
              <span>🗑️</span>
              <span>Permanently Delete Selected Requests ({selectedRequestIds.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Printable Staff Performance Report Modal */}
      {showReport && <StaffPerformanceReport initialPeriod="weekly" onClose={() => setShowReport(false)} />}

      <PageHeader
        title="Manager Dashboard"
        subtitle={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} — ${format(new Date(), 'EEEE, dd MMMM yyyy')}`}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowStaffFilterReport(true)} style={{ background: '#F0FDF4', color: '#16A34A', fontWeight: 700, border: '1px solid #BBF7D0' }}>
            📈 Staff Performance
          </button>
          <button className="btn btn-secondary" onClick={() => setShowReport(true)} style={{ background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, border: '1px solid #C7D2FE' }}>
            📊 Performance Report
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/slt/disburse/day-sheet')} style={{ background: '#FFFBEB', color: '#B45309', fontWeight: 700, border: '1px solid #FEF3C7' }}>
            📖 Day Book
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/manager/requests')}>
            + New Request
          </button>
        </div>
      </PageHeader>

      {/* Birthday Banner */}
      <BirthdayBanner />

      {/* ── 5 SUMMARY CARDS ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        <SummaryCard
          icon="💝"
          label="Today's Donations"
          value={formatINR(finance.todays_donations)}
          sub={`Cash ₹${(finance.todays_donations_cash||0).toLocaleString('en-IN')} · Bank ₹${(finance.todays_donations_bank||0).toLocaleString('en-IN')}`}
          color={CLR.yellow}
          active={active === 'donations'}
          onClick={() => toggle('donations')}
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
          icon="📋"
          label="Assessment Requests"
          value={requests.pending || 0}
          sub={`${requests.total || 0} total · ${requests.completed || 0} completed`}
          color={CLR.blue}
          active={active === 'requests'}
          onClick={() => toggle('requests')}
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
                    {secretDeleteMode && (
                      <th style={{ width: 38, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.length === recent_requests.length && recent_requests.length > 0}
                          onChange={toggleSelectAllRequests}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                          title="Select All"
                        />
                      </th>
                    )}
                    <th>Request No</th>
                    <th>Purpose</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Requested By</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                    {secretDeleteMode && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {recent_requests.length === 0 ? (
                    <tr><td colSpan={secretDeleteMode ? 9 : 8} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No requests found</td></tr>
                  ) : recent_requests.map(r => {
                    const isSelected = selectedRequestIds.includes(r.id);
                    return (
                      <tr
                        key={r.id}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#FEF2F2' : undefined
                        }}
                        onClick={() => {
                          if (secretDeleteMode) toggleSelectRequest(r.id);
                          else navigate(`/manager/requests/${r.id}`);
                        }}
                      >
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectRequest(r.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td className="td-mono">{r.request_number}</td>
                        <td style={{ fontWeight: isSelected ? 700 : undefined }}>{r.purpose}</td>
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
                        {secretDeleteMode && (
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm"
                              style={{
                                backgroundColor: '#DC2626',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: 4,
                                cursor: 'pointer'
                              }}
                              onClick={() => setDeleteConfirmModal({ open: true, type: 'REQUEST', items: [r] })}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
            <MiniTile icon="✅" label="Present"  value={attendance.present  || 0} color={CLR.green} />
            <MiniTile icon="❌" label="Absent"   value={attendance.absent   || 0} color={CLR.red} />
            <MiniTile icon="👥" label="Total Staff" value={attendance.total_staff || 0} color={CLR.gray} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* PRESENT STAFF LIST */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 16 }}>
                PRESENT STAFF
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(!attendance.present_list || attendance.present_list.length === 0) ? (
                  <div style={{ color: 'var(--gray-400)', fontSize: 13, fontStyle: 'italic' }}>No staff present</div>
                ) : (
                  attendance.present_list.map(emp => (
                    <div key={emp.id} style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLR.green }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{emp.emp_id}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ABSENT STAFF LIST */}
            <div style={{ background: 'white', borderRadius: 12, padding: '20px', border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 16 }}>
                ABSENT STAFF
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(!attendance.absent_list || attendance.absent_list.length === 0) ? (
                  <div style={{ color: 'var(--gray-400)', fontSize: 13, fontStyle: 'italic' }}>No staff absent</div>
                ) : (
                  attendance.absent_list.map(emp => (
                    <div key={emp.id} style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLR.red }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{emp.emp_id}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ExpandPanel>
      )}

      {/* ── EXPANDED: DONATIONS ──────────────────────────────── */}
      {active === 'donations' && (
        <ExpandPanel>
          <PanelTitle>💝 Donations Viewer</PanelTitle>
          <DonationsTable
            secretDeleteMode={secretDeleteMode}
            onDeleteDonation={(donation) => setDeleteConfirmModal({ open: true, type: 'DONATION', items: [donation] })}
          />
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
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly_trend} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--gray-500)' }} />
            <Tooltip content={<ChartTip />} />
            <Bar
              dataKey="count"
              name="Requests"
              fill={CLR.blue}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Permanent Deletion Confirmation Modal */}
      {deleteConfirmModal.open && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setDeleteConfirmModal({ open: false, type: 'REQUEST', items: [] })}
          title="⚠️ Confirm Permanent Database Deletion"
          size="modal-md"
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmModal({ open: false, type: 'REQUEST', items: [] })}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={deleting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={handlePermanentDelete}
              >
                {deleting ? 'Purging from Database...' : 'Permanently Delete Now'}
              </button>
            </>
          }
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#991B1B',
              fontSize: '0.85rem'
            }}>
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected {deleteConfirmModal.type === 'REQUEST' ? 'request(s)' : 'donation record(s)'} will be permanently removed from the database.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'record' : `${deleteConfirmModal.items.length} records`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  {deleteConfirmModal.type === 'REQUEST' ? (
                    <>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{it.request_number}</span> — {it.purpose || it.beneficiary_name} (₹{it.amount_requested})
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{it.donor_name || 'Anonymous'}</span> — {formatINR(it.amount)} ({it.payment_method})
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DonationsTable({ secretDeleteMode, onDeleteDonation }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

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

  useEffect(() => {
    fetchDonations()
  }, [selectedDate, search])

  // Real-time refresh
  useEffect(() => {
    const handler = () => fetchDonations()
    window.addEventListener('dashboard-refresh', handler)
    return () => window.removeEventListener('dashboard-refresh', handler)
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
                {secretDeleteMode && <th style={{ textAlign: 'center' }}>Action</th>}
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
                  {secretDeleteMode && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: 4,
                          cursor: 'pointer'
                        }}
                        onClick={() => onDeleteDonation && onDeleteDonation(item)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

