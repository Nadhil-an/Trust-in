import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountsApi, managerApi, coreApi } from '../../api'
import { format } from 'date-fns'

const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0)

const ENTRIES = [
  {
    icon: '💝', label: 'Donation Entry',
    desc: 'Record donations from donors',
    path: '/slt/entry/donation',
    color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8',
  },
  {
    icon: '🪪', label: 'Membership Entry',
    desc: 'Record membership fee payments',
    path: '/slt/entry/membership',
    color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0',
  },
  {
    icon: '📋', label: 'Assessment Entry',
    desc: 'Record assessments from individuals & organisations',
    path: '/slt/entry/assessment',
    color: '#059669', bg: '#D1FAE5', border: '#6EE7B7',
  },
  {
    icon: '🤝', label: 'Partners Entry',
    desc: 'Register new partners & organisations',
    path: '/slt/entry/partners',
    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE',
  },
  {
    icon: '📥', label: 'Inward Entry',
    desc: 'Record incoming goods, materials & receipts',
    path: '/slt/entry/inward',
    color: '#1E4DB7', bg: '#EFF6FF', border: '#BFDBFE',
  },
  {
    icon: '📤', label: 'Outward Entry',
    desc: 'Record outgoing goods & disbursements',
    path: '/slt/entry/outward',
    color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
  },
  {
    icon: '🛒', label: 'Purchase / Orders Entry',
    desc: 'Record purchases, procurement or orders',
    path: '/slt/entry/purchase',
    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A',
  },
  {
    icon: '📖', label: 'Donation Registry',
    desc: 'Fast bulk-entry system for ledger data',
    path: '/slt/entry/donation-registry',
    color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
  },
  {
    icon: '📅', label: 'Event Entry',
    desc: 'Record event details and participants',
    path: '/slt/entry/events',
    color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC',
  },
]

function EntryCard({ entry, onClick, stat }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? entry.bg : 'white',
        border: `2px solid ${hovered ? entry.color : entry.border}`,
        borderRadius: 20, padding: '24px',
        cursor: 'pointer', transition: 'all .2s ease',
        boxShadow: hovered ? `0 12px 32px ${entry.color}22` : '0 2px 8px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background circle */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${entry.color}12`,
        transition: 'transform .3s',
        transform: hovered ? 'scale(2)' : 'scale(1)',
      }} />
      <div style={{
        width: 50, height: 50, borderRadius: 14,
        background: entry.bg, border: `1.5px solid ${entry.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, boxShadow: `0 4px 12px ${entry.color}20`,
        position: 'relative',
      }}>
        {entry.icon}
      </div>
      
      {/* Stat Block */}
      <div style={{ position: 'absolute', top: 24, right: 24, textAlign: 'right' }}>
        {stat ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {stat.hasAmount ? formatINR(stat.amount) : stat.count}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>
              {stat.hasAmount ? `${stat.count} Entries` : 'Total Count'}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div>
        )}
      </div>

      <div style={{ position: 'relative', marginTop: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: hovered ? entry.color : '#111827', marginBottom: 4, transition: 'color .2s' }}>
          {entry.label}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.4 }}>{entry.desc}</div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: entry.color, fontSize: 12, fontWeight: 700,
        opacity: hovered ? 1 : 0.6, transition: 'opacity .2s',
      }}>
        Open entry form →
      </div>
    </div>
  )
}

export default function DataEntryDashboard() {
  const navigate = useNavigate()
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const displayDate = format(new Date(filterDate), 'EEEE, dd MMMM yyyy')
  const [stats, setStats] = useState({})

  useEffect(() => {
    const fetchStats = async () => {
      const dateStr = filterDate
      
      const fetchWithAmount = async (apiCall, args) => {
        try {
          const res = await apiCall(args)
          const data = res.data?.results || res.data || []
          const count = data.length
          const amount = data.reduce((sum, item) => sum + (parseFloat(item.amount_requested || item.amount) || 0), 0)
          return { count, amount, hasAmount: true }
        } catch { return { count: 0, amount: 0, hasAmount: true } }
      }

      const fetchCountOnly = async (apiCall, args) => {
        try {
          const res = await apiCall(args)
          const data = res.data?.results || res.data || []
          return { count: data.length, amount: 0, hasAmount: false }
        } catch { return { count: 0, amount: 0, hasAmount: false } }
      }

      const results = await Promise.all([
        fetchWithAmount(accountsApi.income.list, { date: dateStr, source: 'DONATION' }),
        fetchWithAmount(accountsApi.income.list, { date: dateStr, source: 'MEMBERSHIP' }),
        fetchWithAmount(managerApi.requests.list, { date: dateStr }),
        fetchCountOnly(managerApi.partners.list, { date: dateStr }),
        fetchWithAmount(accountsApi.income.list, { date: dateStr, source: 'INWARD' }),
        fetchWithAmount(accountsApi.expenses.list, { date: dateStr, category: 'OUTWARD' }),
        fetchWithAmount(accountsApi.expenses.list, { date: dateStr, category: 'PURCHASE' }),
        fetchCountOnly(coreApi.events.list, { date: dateStr })
      ])

      setStats({
        '/slt/entry/donation': results[0],
        '/slt/entry/membership': results[1],
        '/slt/entry/assessment': results[2],
        '/slt/entry/partners': results[3],
        '/slt/entry/inward': results[4],
        '/slt/entry/outward': results[5],
        '/slt/entry/purchase': results[6],
        '/slt/entry/events': results[7]
      })
    }
    
    fetchStats()
  }, [filterDate])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #1E4DB7, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>📝</div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: -0.5 }}>
                Data Entry
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>{displayDate}</p>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, marginTop: 4, maxWidth: 520 }}>
            Select an entry type below to record transactions, goods movements, or registrations.
          </p>
        </div>
        
        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Date:</label>
          <input 
            type="date" 
            className="form-control" 
            style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid #E5E7EB', fontWeight: 600, color: '#4B5563', cursor: 'pointer' }}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      {/* Entry Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 18, marginBottom: 32,
      }}>
        {ENTRIES.map(e => (
          <EntryCard key={e.path} entry={e} onClick={() => navigate(e.path)} stat={stats[e.path]} />
        ))}
      </div>

      {/* Quick tip strip */}
      <div style={{
        background: 'linear-gradient(135deg, #F8FAFC, #F0F9FF)',
        border: '1px solid #E0F2FE',
        borderRadius: 14, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 24 }}>💡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>Tips for accurate data entry</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
            Always verify amounts before saving · Use the search to avoid duplicate entries · 
            Attach reference numbers whenever available for easy reconciliation
          </div>
        </div>
      </div>
    </div>
  )
}
