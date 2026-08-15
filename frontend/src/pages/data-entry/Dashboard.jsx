// pages/data-entry/Dashboard.jsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountsApi, managerApi } from '../../api'
import { format } from 'date-fns'

const ENTRIES = [
  {
    icon: '📥', label: 'Inward Entry',
    desc: 'Record incoming goods, materials & receipts',
    path: '/data-entry/inward',
    color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE',
  },
  {
    icon: '📤', label: 'Outward Entry',
    desc: 'Record outgoing goods & disbursements',
    path: '/data-entry/outward',
    color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
  },
  {
    icon: '🛒', label: 'Purchase Entry',
    desc: 'Record purchases & procurement',
    path: '/data-entry/purchase',
    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A',
  },
  {
    icon: '💝', label: 'Donation Entry',
    desc: 'Record donations from donors',
    path: '/data-entry/donation',
    color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8',
  },
  {
    icon: '🪪', label: 'Membership Entry',
    desc: 'Record membership fee payments',
    path: '/data-entry/membership',
    color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0',
  },
  {
    icon: '🤝', label: 'Partners Entry',
    desc: 'Register new partners & organisations',
    path: '/data-entry/partners',
    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE',
  },
]

function EntryCard({ entry, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? entry.bg : 'white',
        border: `2px solid ${hovered ? entry.color : entry.border}`,
        borderRadius: 20, padding: '28px 24px',
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
        width: 56, height: 56, borderRadius: 16,
        background: entry.bg, border: `1.5px solid ${entry.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, boxShadow: `0 4px 12px ${entry.color}20`,
        position: 'relative',
      }}>
        {entry.icon}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: hovered ? entry.color : '#111827', marginBottom: 4, transition: 'color .2s' }}>
          {entry.label}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>{entry.desc}</div>
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
  const today = format(new Date(), 'EEEE, dd MMMM yyyy')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>📝</div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: -0.5 }}>
              Data Entry
            </h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>{today}</p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, marginTop: 4, maxWidth: 520 }}>
          Select an entry type below to record transactions, goods movements, or registrations.
        </p>
      </div>

      {/* Entry Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 18, marginBottom: 32,
      }}>
        {ENTRIES.map(e => (
          <EntryCard key={e.path} entry={e} onClick={() => navigate(e.path)} />
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
