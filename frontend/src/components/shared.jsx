// Shared utility components for all pages

import React from 'react'

export function StatCard({ label, value, icon, variant = '', sub = '', onClick }) {
  return (
    <div className={`stat-card ${variant}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="stat-card-header">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-icon">{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    DRAFT: 'badge-gray', SUBMITTED: 'badge-blue', UNDER_REVIEW: 'badge-info',
    ON_HOLD: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red',
    CASHIER_PENDING: 'badge-yellow', DISBURSED: 'badge-green', COMPLETED: 'badge-green',
    CANCELLED: 'badge-gray', ACTIVE: 'badge-green', INACTIVE: 'badge-gray',
    SUSPENDED: 'badge-red', PENDING: 'badge-yellow', PAID: 'badge-green',
    GENERATED: 'badge-blue', PRESENT: 'badge-green', ABSENT: 'badge-red',
    LEAVE: 'badge-yellow', LATE: 'badge-yellow', CLEARED: 'badge-green',
    BOUNCED: 'badge-red', ISSUED: 'badge-blue', VALID: 'badge-green', EXPIRED: 'badge-red',
  }
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace(/_/g, ' ')}</span>
}

export function AmountDisplay({ amount, type = 'neutral' }) {
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const cls = type === 'credit' ? 'amount-credit' : type === 'debit' ? 'amount-debit' : 'amount-neutral'
  return <span className={`amount ${cls}`}>{fmt(amount)}</span>
}

export function LoadingState() {
  return (
    <div className="loading-overlay">
      <span className="spinner" />
      <span>Loading...</span>
    </div>
  )
}

export function EmptyState({ icon = '📭', title = 'No records found', message = '' }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  )
}

export function FilterBar({ search, onSearch, children }) {
  return (
    <div className="filter-bar">
      <div className="filter-search">
        <span>🔍</span>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      {children}
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer, size = '', overlayClass = '' }) {
  if (!isOpen) return null
  return (
    <div className={`modal-overlay ${overlayClass}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title="Are you sure?", message="This action cannot be undone.", confirmText="Confirm", cancelText="Cancel", isDanger=true }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: isDanger ? 'var(--red-600)' : 'inherit' }}>{title}</div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
          <button className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

export function useApi(apiFn, deps = []) {
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const fetch = React.useCallback(async (...args) => {
    setLoading(true)
    try {
      const res = await apiFn(...args)
      setData(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data || err.message)
    } finally {
      setLoading(false)
    }
  }, deps)

  React.useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function downloadBlob(response, filename) {
  const url = URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}
