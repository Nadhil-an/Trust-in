import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountsApi } from '../../api'
import { LoadingState, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts'

// ── colour tokens ────────────────────────────────────────────────
const C = {
  green:  '#22C55E', red: '#EF4444', yellow: '#F59E0B',
  blue:   '#3B82F6', purple: '#A855F7', indigo: '#6366F1', gray: '#94A3B8',
}

// ── Shared tooltip ───────────────────────────────────────────────
const ChartTip = ({ active, payload, label, money }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      {label && <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          <span style={{ color: '#6b7280' }}>{p.name}:</span>
          <strong style={{ color: '#111' }}>{money ? formatINR(p.value) : p.value}</strong>
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
          <div style={{ fontSize: 22, fontWeight: 800, color: active ? color : '#111827', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      {active && <div style={{ marginTop: 12, fontSize: 11, color, fontWeight: 600 }}>Click again to collapse ▲</div>}
    </div>
  )
}

// ── Mini tile ────────────────────────────────────────────────────
function MiniTile({ icon, label, value, color = C.blue }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #f0f0f4', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{value}</div>
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

// ── Net indicator badge ──────────────────────────────────────────
function NetBadge({ value }) {
  const positive = value >= 0
  return (
    <span style={{
      background: positive ? '#DCFCE7' : '#FEE2E2',
      color: positive ? '#16A34A' : '#DC2626',
      fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 8,
    }}>
      {positive ? '▲' : '▼'} {formatINR(Math.abs(value))}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────
export default function AccountsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await accountsApi.dashboard()
      setData(res.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener('dashboard-refresh', h)
    return () => window.removeEventListener('dashboard-refresh', h)
  }, [])

  if (loading) return <LoadingState />
  const acc = data || {}
  const trend = acc.monthly_trend || []
  const toggle = (k) => setActive(p => p === k ? null : k)

  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'

  // ── chart data ───────────────────────────────────────────────
  const balancePieData = [
    { name: 'Cash in Hand', value: acc.cash_balance || 0, fill: C.indigo },
    { name: 'Bank',         value: acc.bank_balance || 0, fill: C.blue   },
  ].filter(d => d.value > 0)

  return (
    <div>
      {/* ── HEADER ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Accounts Dashboard</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '3px 0 0' }}>Good {greeting} — {format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(acc.pending_money_requests || 0) > 0 && (
            <button onClick={() => navigate('/accounts/money-requests')}
              style={{ background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              💰 {acc.pending_money_requests} Pending Requests
            </button>
          )}
          {(acc.pending_salaries || 0) > 0 && (
            <button onClick={() => navigate('/accounts/pending-salaries')}
              style={{ background: '#FEF9C3', color: '#CA8A04', border: '1px solid #FDE047', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              👤 {acc.pending_salaries} Salaries to Pay
            </button>
          )}
        </div>
      </div>

      {/* ── 3 SUMMARY CARDS ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <SummaryCard
          icon="💰" label="Total Funds" color={C.indigo} active={active === 'balance'}
          value={formatINR(acc.total_balance)}
          sub={`Cash ${formatINR(acc.cash_balance)} · Bank ${formatINR(acc.bank_balance)}`}
          onClick={() => toggle('balance')}
        />
        <SummaryCard
          icon="📥" label="This Month — Income" color={C.green} active={active === 'income'}
          value={formatINR(acc.income_this_month)}
          sub={`Today received: ${formatINR(acc.today_income)}`}
          onClick={() => toggle('income')}
        />
        <SummaryCard
          icon="📤" label="This Month — Expenses" color={C.red} active={active === 'expense'}
          value={formatINR(acc.expenses_this_month)}
          sub={`Today spent: ${formatINR(acc.today_expense)}`}
          onClick={() => toggle('expense')}
        />
      </div>

      {/* ── Net summary strip ─────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>This Month Net:</span>
        <NetBadge value={acc.net_this_month || 0} />
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
          Income {formatINR(acc.income_this_month)} − Expenses {formatINR(acc.expenses_this_month)}
        </span>
      </div>

      {/* ── EXPANDED: BALANCE ─────────────────────────────────── */}
      {active === 'balance' && (
        <Panel>
          <PLabel>💰 Fund Balances — Where Is the Money?</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="💵" label="Cash in Hand"  value={formatINR(acc.cash_balance)}  color={C.indigo} />
            <MiniTile icon="🏦" label="Bank Balance"  value={formatINR(acc.bank_balance)}  color={C.blue}   />
            <MiniTile icon="💰" label="Total Balance" value={formatINR(acc.total_balance)} color={C.green}  />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Donut */}
            <div style={{ background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>CASH VS BANK</div>
              {balancePieData.length === 0
                ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No funds recorded</div>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={balancePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                        {balancePieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTip money />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </div>
            {/* Bank accounts list */}
            <div style={{ background: 'white', borderRadius: 12, padding: '18px 16px', border: '1px solid #f0f0f4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>BANK ACCOUNTS</div>
              {(acc.bank_accounts || []).length === 0
                ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No bank accounts added yet</div>
                : (acc.bank_accounts || []).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{b.bank_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>...{b.account_number?.slice(-4)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{formatINR(b.current_balance)}</div>
                  </div>
                ))
              }
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/accounts/bank')}>Manage Banks →</button>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* ── EXPANDED: INCOME ──────────────────────────────────── */}
      {active === 'income' && (
        <Panel>
          <PLabel>📥 Income — Monthly Overview</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="📅" label="This Month"   value={formatINR(acc.income_this_month)} color={C.green} />
            <MiniTile icon="📆" label="Today"        value={formatINR(acc.today_income)}       color={C.blue}  />
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>INCOME — LAST 6 MONTHS</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                <Tooltip content={<ChartTip money />} />
                <Bar dataKey="income" name="Income" fill={C.green} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/accounts/income')}>View All Income →</button>
          </div>
        </Panel>
      )}

      {/* ── EXPANDED: EXPENSE ─────────────────────────────────── */}
      {active === 'expense' && (
        <Panel>
          <PLabel>📤 Expenses — Monthly Overview</PLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MiniTile icon="📅" label="This Month" value={formatINR(acc.expenses_this_month)} color={C.red}    />
            <MiniTile icon="📆" label="Today"      value={formatINR(acc.today_expense)}        color={C.yellow} />
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '18px 14px', border: '1px solid #f0f0f4' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>EXPENSES — LAST 6 MONTHS</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                <Tooltip content={<ChartTip money />} />
                <Bar dataKey="expense" name="Expense" fill={C.red} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/accounts/expenses')}>View All Expenses →</button>
          </div>
        </Panel>
      )}

      {/* ── BOTTOM: Income vs Expense trend (always visible) ──── */}
      <div style={{ background: 'white', borderRadius: 16, padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Income vs Expenses — Last 6 Months</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Monthly money flow at a glance</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/accounts/transactions')}>All Transactions →</button>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTip money />} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Line type="monotone" dataKey="income"  name="Income"  stroke={C.green} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke={C.red}   strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
