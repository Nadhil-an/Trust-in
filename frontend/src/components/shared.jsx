// Shared utility components for all pages

import React from 'react'
import toast from 'react-hot-toast'
import { Search, X, Inbox, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react'

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
    PENDING_DISBURSEMENT: 'badge-yellow', DISBURSED: 'badge-green', COMPLETED: 'badge-green',
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

export function EmptyState({ icon = null, title = 'No records found', message = '', subtitle = '' }) {
  const renderIcon = () => {
    if (!icon) return <Inbox size={42} strokeWidth={1.5} color="var(--gray-400)" />
    if (typeof icon === 'function') {
      const IconComponent = icon
      return <IconComponent size={42} strokeWidth={1.5} color="var(--gray-400)" />
    }
    if (React.isValidElement(icon)) return icon
    return icon
  }

  const desc = message || subtitle

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {renderIcon()}
      </div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
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

export function FilterBar({ search, onSearch, placeholder = 'Search...', children }) {
  return (
    <div className="filter-bar">
      <div className="filter-search">
        <Search size={15} color="var(--gray-400)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      {children}
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer, size = '', overlayClass = '' }) {
  const mouseDownTarget = React.useRef(null)

  if (!isOpen) return null
  return (
    <div 
      className={`modal-overlay ${overlayClass}`} 
      onMouseDown={e => { mouseDownTarget.current = e.target }}
      onMouseUp={e => {
        if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Are you sure?", 
  message = "This action cannot be undone.", 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  isDanger = true,
  icon = null
}) {
  const mouseDownTarget = React.useRef(null)

  if (!isOpen) return null
  return (
    <div 
      className="modal-overlay" 
      style={{ zIndex: 1100 }}
      onMouseDown={e => { mouseDownTarget.current = e.target }}
      onMouseUp={e => {
        if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="modal" 
        style={{ 
          maxWidth: 440,
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid var(--gray-200)',
          background: '#ffffff'
        }}
      >
        <div 
          style={{ 
            padding: '24px 24px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div 
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: isDanger ? '#FEE2E2' : '#FEF3C7',
              color: isDanger ? '#DC2626' : '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isDanger ? '0 0 0 4px #FEF2F2' : '0 0 0 4px #FFFBEB'
            }}
          >
            {icon || (isDanger ? <AlertTriangle size={22} strokeWidth={2.2} /> : <AlertCircle size={22} strokeWidth={2.2} />)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 
              style={{ 
                margin: 0, 
                fontSize: 17, 
                fontWeight: 600, 
                color: 'var(--gray-900)',
                lineHeight: 1.3
              }}
            >
              {title}
            </h3>
            <div 
              style={{ 
                marginTop: 8, 
                fontSize: 14, 
                color: 'var(--gray-600)', 
                lineHeight: 1.5,
                wordBreak: 'break-word'
              }}
            >
              {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
            </div>
          </div>
          <button 
            type="button"
            className="modal-close-btn" 
            onClick={onClose} 
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gray-400)',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div 
          style={{ 
            padding: '14px 24px', 
            background: 'var(--gray-50)',
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 12,
            borderTop: '1px solid var(--gray-100)'
          }}
        >
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ minWidth: 84 }}
          >
            {cancelText}
          </button>
          <button 
            type="button"
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
            onClick={() => { onConfirm(); onClose(); }}
            style={{ 
              minWidth: 100,
              ...(isDanger ? { backgroundColor: '#DC2626', borderColor: '#DC2626', color: '#ffffff' } : {})
            }}
          >
            {confirmText}
          </button>
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

export function Combobox({ value, onChange, options, placeholder = '' }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const filtered = options.filter(o => o.toLowerCase().includes((value || '').toLowerCase()))
  
  return (
    <div style={{ position: 'relative' }}>
      <input 
        type="text"
        className="form-control"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
        style={{ width: '100%', paddingRight: '24px' }}
      />
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: 10 }}>▼</div>
      
      {isOpen && filtered.length > 0 && (
        <div style={{ 
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, 
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', 
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', zIndex: 1000, 
          maxHeight: '200px', overflowY: 'auto', padding: '4px' 
        }}>
          {filtered.map(o => (
            <div 
              key={o} 
              style={{ 
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px', 
                borderRadius: '6px', color: '#334155', transition: 'background 0.2s',
                fontWeight: 500
              }}
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setIsOpen(false); }}
              onMouseEnter={e => { e.target.style.background = '#f8fafc'; e.target.style.color = '#0f172a'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#334155'; }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Secret Permanent Deletion Mode Hook (Ctrl + Shift + Q) ───────────
export function useSecretDelete({ items = [], onDelete, itemName = 'record', reload } = {}) {
  const [secretDeleteMode, setSecretDeleteMode] = React.useState(false);
  const [selectedRowIds, setSelectedRowIds] = React.useState([]);
  const [deleteConfirmModal, setDeleteConfirmModal] = React.useState({ open: false, items: [] });
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setSecretDeleteMode((prev) => {
          const next = !prev;
          if (next) {
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
        setSelectedRowIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSelectRow = React.useCallback((id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = React.useCallback((customList) => {
    const list = customList || items;
    setSelectedRowIds(prev => {
      if (prev.length === list.length && list.length > 0) {
        return [];
      } else {
        return list.map(i => i.id);
      }
    });
  }, [items]);

  const confirmDeleteSelected = React.useCallback((customList) => {
    const list = customList || items;
    const toDelete = list.filter(i => selectedRowIds.includes(i.id));
    if (toDelete.length > 0) {
      setDeleteConfirmModal({ open: true, items: toDelete });
    }
  }, [items, selectedRowIds]);

  const confirmDeleteOne = React.useCallback((item, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDeleteConfirmModal({ open: true, items: [item] });
  }, []);

  const handlePermanentDelete = React.useCallback(async () => {
    const itemsToDelete = deleteConfirmModal.items || [];
    if (itemsToDelete.length === 0) return;
    setDeleting(true);
    try {
      if (onDelete) {
        await onDelete(itemsToDelete);
      }
      toast.success(
        itemsToDelete.length === 1
          ? `Successfully permanently deleted 1 ${itemName} from database.`
          : `Successfully permanently deleted ${itemsToDelete.length} ${itemName}s from database.`
      );
      setSelectedRowIds(prev => prev.filter(id => !itemsToDelete.some(it => it.id === id)));
      setDeleteConfirmModal({ open: false, items: [] });
      if (reload) reload();
      window.dispatchEvent(new CustomEvent('dashboard-refresh'));
    } catch (err) {
      toast.error('Failed to permanently delete: ' + (err.response?.data?.error || err.response?.data?.detail || err.message || 'Server error'));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmModal.items, onDelete, itemName, reload]);

  return {
    secretDeleteMode,
    setSecretDeleteMode,
    selectedRowIds,
    setSelectedRowIds,
    deleteConfirmModal,
    setDeleteConfirmModal,
    deleting,
    toggleSelectRow,
    toggleSelectAll,
    confirmDeleteSelected,
    confirmDeleteOne,
    handlePermanentDelete,
  };
}

export function SecretDeleteBanner({
  secretDeleteMode,
  selectedRowIds = [],
  onDeleteSelected,
  itemName = 'records'
}) {
  if (!secretDeleteMode) return null;
  return (
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
        <span style={{ fontSize: 24 }}>🚨</span>
        <div>
          <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.88rem', letterSpacing: '0.5px' }}>
            SECRET PERMANENT DELETION MODE (Press Ctrl+Shift+Q to exit)
          </div>
          <div style={{ color: '#B91C1C', fontSize: '0.78rem', marginTop: 2 }}>
            Select row lines with checkboxes or click individual "Delete" buttons to permanently purge them from the database.
          </div>
        </div>
      </div>
      {selectedRowIds.length > 0 && (
        <button
          className="btn btn-sm"
          style={{
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontWeight: 700,
            border: 'none',
            padding: '7px 16px',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onClick={onDeleteSelected}
        >
          <span>🗑️</span>
          <span>Permanently Delete Selected ({selectedRowIds.length})</span>
        </button>
      )}
    </div>
  );
}
