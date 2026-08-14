import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { coreApi } from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const NAV_CONFIG = {
  MANAGER: [
    { label: 'Dashboard', icon: '📊', path: '/manager/dashboard' },
    { label: 'Assessment Requests', icon: '📋', path: '/manager/requests', badge: 'requests' },
    { label: 'Charity Inventory', icon: '📦', path: '/manager/inventory' },
    { label: 'Minutes Registry', icon: '📝', path: '/manager/minutes' },
    { label: 'Partners', icon: '🤝', path: '/manager/partners' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  ACCOUNTANT: [
    { label: 'Dashboard', icon: '📊', path: '/accounts/dashboard' },
    { label: 'Money Requests', icon: '💰', path: '/accounts/money-requests', badge: 'pending' },
    { label: 'Cash Book', icon: '💵', path: '/accounts/cash' },
    { label: 'Bank', icon: '🏦', path: '/accounts/bank' },
    { label: 'Income', icon: '📥', path: '/accounts/income' },
    { label: 'Expenses', icon: '📤', path: '/accounts/expenses' },
    { label: 'Cheques', icon: '🧾', path: '/accounts/cheques' },
    { label: 'Transfers', icon: '🔄', path: '/accounts/transfers' },
    { label: 'Transactions', icon: '📋', path: '/accounts/transactions' },
    { label: 'Pending Payouts', icon: '⏳', path: '/cashier/pending', badge: 'pending' },
    { label: 'Payouts', icon: '💸', path: '/cashier/disbursements' },
    { label: 'Cash Closing', icon: '🔒', path: '/cashier/closing' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  CASHIER: [
    { label: 'Dashboard', icon: '📊', path: '/cashier/dashboard' },
    { label: 'Pending Payouts', icon: '⏳', path: '/cashier/pending', badge: 'pending' },
    { label: 'Cash Book', icon: '💵', path: '/accounts/cash' },
    { label: 'Payouts', icon: '💸', path: '/cashier/disbursements' },
    { label: 'Cash Closing', icon: '🔒', path: '/cashier/closing' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  HR: [
    { label: 'Dashboard', icon: '📊', path: '/hr/dashboard' },
    { label: 'Members', icon: '👥', path: '/hr/members' },
    { label: 'Volunteers', icon: '🙋', path: '/hr/volunteers' },
    { label: 'Executive Members', icon: '👔', path: '/hr/executive-members' },
    { label: 'Executive Officers', icon: '👨‍💼', path: '/hr/officers' },
    { label: 'Attendance', icon: '✅', path: '/hr/attendance' },
    { label: 'Leave Management', icon: '📅', path: '/hr/leave', badge: 'leave' },
    { label: 'Salary & Payroll', icon: '💰', path: '/hr/payroll' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  ADMIN: [
    { label: 'User Management', icon: '👤', path: '/admin/users' },
    { label: 'Audit Log', icon: '🔍', path: '/admin/audit-log' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
}

function NotificationDrawer({ onClose }) {
  const { notifications, markRead, markAllRead } = useNotificationStore()
  const { coreApi: cApi } = { coreApi }

  const handleMarkRead = async (id) => {
    try {
      await coreApi.markRead(id)
      markRead(id)
    } catch (_) {}
  }

  const handleMarkAll = async () => {
    try {
      await coreApi.markAllRead('all')
      markAllRead()
    } catch (_) {}
  }

  return (
    <div className="notif-drawer">
      <div className="notif-drawer-header">
        <span className="notif-drawer-title">🔔 Notifications</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={handleMarkAll}>Mark all read</button>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-icon">🔔</div>
            <p>No notifications</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}
            onClick={() => !n.is_read && handleMarkRead(n.id)}>
            <div className="notif-item-title">{n.title}</div>
            <div className="notif-item-msg">{n.message}</div>
            <div className="notif-item-time">
              {n.created_at ? format(new Date(n.created_at), 'dd MMM, HH:mm') : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSearch = async (e) => {
    const q = e.target.value
    setQuery(q)
    if (q.length >= 2) {
      setLoading(true)
      try {
        const res = await coreApi.search(q)
        setResults(res.data.results)
      } catch (_) {}
      setLoading(false)
    } else {
      setResults([])
    }
  }

  return (
    <div className="header-search" style={{ position: 'relative' }}>
      <span style={{ color: 'var(--gray-400)' }}>🔍</span>
      <input
        type="text"
        placeholder="Search ID, member, transaction..."
        value={query}
        onChange={handleSearch}
      />
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid var(--gray-200)',
          borderRadius: 8, boxShadow: 'var(--shadow-lg)',
          zIndex: 300, marginTop: 4, overflow: 'hidden',
        }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => { navigate(r.url); setResults([]); setQuery('') }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <span style={{ fontSize: 11, color: 'var(--gray-500)', marginRight: 8 }}>{r.type}</span>
              <strong>{r.ref}</strong> — {r.label}
              <span style={{ marginLeft: 8, float: 'right' }}
                className={`badge ${r.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const { unreadCount, isOpen, toggleDrawer, closeDrawer } = useNotificationStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = NAV_CONFIG[user?.role] || []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    toast.success('Logged out successfully.')
  }

  const pageTitle = navItems.find(n => location.pathname.startsWith(n.path))?.label || 'Dashboard'

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo-only.png" alt="Sree Lakshmi Logo" style={{ height: 42, marginRight: 12, objectFit: 'contain' }} />
          <div className="sidebar-logo-text">
            <h1>Sree Lakshmi</h1>
            <p>Charitable Trust</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-label">{user?.role} MODULE</div>
          {navItems.map(item => (
            <div key={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          <div className="nav-section-label" style={{ marginTop: 8 }}>ACCOUNT</div>
          <div className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
            onClick={() => navigate('/profile')}>
            <span className="nav-icon">👤</span>
            <span>Profile</span>
          </div>
          <div className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <button className="icon-btn" style={{ display: 'none' }}
            onClick={() => setMobileOpen(!mobileOpen)}>☰</button>

          <div style={{ flex: 1 }}>
            <div className="header-title">{pageTitle}</div>
          </div>

          <div className="header-actions">
            <GlobalSearch />

            {/* Notification Bell */}
            <button className="icon-btn" onClick={toggleDrawer} id="notification-bell">
              🔔
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {/* Role Badge */}
            <span className="badge badge-blue" style={{ fontSize: 11 }}>{user?.role}</span>
          </div>
        </header>

        {/* Notification Drawer */}
        {isOpen && <NotificationDrawer onClose={closeDrawer} />}
        {isOpen && (
          <div onClick={closeDrawer} style={{
            position: 'fixed', inset: 0, zIndex: 199, background: 'transparent'
          }} />
        )}

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
