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
    { label: 'Scheduled Payouts', icon: '🎯', path: '/payouts' },
    { label: 'Charity Inventory', icon: '📦', path: '/manager/inventory' },
    { label: 'Minutes Registry', icon: '📝', path: '/manager/minutes' },
    { label: 'Partners', icon: '🤝', path: '/manager/partners' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  ACCOUNTANT: [
    { type: 'header', label: 'OVERVIEW' },
    { label: 'Dashboard', icon: '📊', path: '/accounts/dashboard' },
    { label: 'Scheduled Payouts', icon: '🎯', path: '/payouts' },
    { label: 'Money Requests', icon: '💰', path: '/accounts/money-requests', badge: 'pending' },
    { type: 'header', label: 'LEDGERS' },
    { label: 'Cash Book', icon: '💵', path: '/accounts/cash' },
    { label: 'Bank', icon: '🏦', path: '/accounts/bank' },
    { label: 'Income', icon: '📥', path: '/accounts/income' },
    { label: 'Expenses', icon: '📤', path: '/accounts/expenses' },
    { type: 'header', label: 'TRANSACTIONS' },
    { label: 'Cheques', icon: '🧾', path: '/accounts/cheques' },
    { label: 'Transfers', icon: '🔄', path: '/accounts/transfers' },
    { label: 'Transactions', icon: '📋', path: '/accounts/transactions' },
    { type: 'header', label: 'PAYOUTS & CLOSING' },
    { label: 'Pending Salaries', icon: '🧑‍💼', path: '/accounts/pending-salaries' },
    { label: 'Pending Payouts', icon: '⏳', path: '/cashier/pending', badge: 'pending' },
    { label: 'Payouts', icon: '💸', path: '/cashier/disbursements' },
    { label: 'Cash Closing', icon: '🔒', path: '/cashier/closing' },
    { type: 'header', label: 'ANALYTICS' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  CASHIER: [
    { label: 'Pending Payouts', icon: '⏳', path: '/cashier/pending', badge: 'pending' },
    { label: 'Cash Book', icon: '💵', path: '/accounts/cash' },
    { label: 'Payouts', icon: '💸', path: '/cashier/disbursements' },
    { label: 'Cash Closing', icon: '🔒', path: '/cashier/closing' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  HR: [
    { type: 'header', label: 'OVERVIEW' },
    { label: 'Dashboard', icon: '📊', path: '/hr/dashboard' },
    { type: 'header', label: 'DIRECTORY' },
    { label: 'Members', icon: '👥', path: '/hr/members' },
    { label: 'Volunteers', icon: '🙋', path: '/hr/volunteers' },
    { label: 'Executive Members', icon: '👔', path: '/hr/executive-members' },
    { label: 'Staff Members', icon: '👨‍💼', path: '/hr/officers' },
    { type: 'header', label: 'TIME & PAYROLL' },
    { label: 'Attendance', icon: '✅', path: '/hr/attendance' },
    { label: 'Leave Management', icon: '📅', path: '/hr/leave', badge: 'leave' },
    { label: 'Salary & Payroll', icon: '💰', path: '/hr/payroll' },
    { label: 'Payment Advances', icon: '💵', path: '/hr/payment-advances' },
    { type: 'header', label: 'SUPPORT & PERFORMANCE' },
    { label: 'Complaints', icon: '🗣️', path: '/hr/complaints' },
    { label: 'Staff Reports', icon: '📄', path: '/hr/staff-reports' },
    { label: 'Achieved Points', icon: '🏆', path: '/hr/performance-points' },
    { label: 'Analytics Reports', icon: '📈', path: '/reports' },
  ],

  ADMIN: [
    { label: 'User Management', icon: '👤', path: '/admin/users' },
    { label: 'Audit Log', icon: '🔍', path: '/admin/audit-log' },
    { label: 'Reports', icon: '📈', path: '/reports' },
  ],
  DATA_ENTRY: [
    { type: 'header', label: 'MAIN' },
    { label: 'Data Entry Hub', icon: '📝', path: '/data-entry' },
    { label: 'Scheduled Payouts', icon: '🎯', path: '/payouts' },

    { type: 'header', label: 'FINANCE & DONATIONS' },
    { label: 'Donation Entry', icon: '💝', path: '/data-entry/donation' },
    { label: 'Purchase Entry', icon: '🛒', path: '/data-entry/purchase' },

    { type: 'header', label: 'PEOPLE & RELATIONS' },
    { label: 'Membership Entry', icon: '🪪', path: '/data-entry/membership' },
    { label: 'Partners Entry', icon: '🤝', path: '/data-entry/partners' },

    { type: 'header', label: 'CHARITY ASSETS' },
    { label: 'Inward Entry', icon: '📥', path: '/data-entry/inward' },
    { label: 'Outward Entry', icon: '📤', path: '/data-entry/outward' },

    { type: 'header', label: 'MATERIAL INVENTORY' },
    { label: 'Material Inward', icon: '📦', path: '/data-entry/material-inward' },
    { label: 'Material Outward', icon: '📤', path: '/data-entry/material-outward' },
  ],
}

function NotificationDrawer({ onClose }) {
  const { notifications, setNotifications, markRead, markAllRead } = useNotificationStore()

  React.useEffect(() => {
    coreApi.notifications().then(res => {
      setNotifications(res.data.results || res.data)
    }).catch(console.error)
  }, [setNotifications])

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

  const safeFormatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      return format(d, 'dd MMM, HH:mm')
    } catch (e) {
      return ''
    }
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
              {safeFormatDate(n.created_at)}
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
          <div style={{ background: 'white', borderRadius: '50%', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, marginRight: 12, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <img src="/logo-only.png" alt="Sree Lakshmi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
          </div>
          <div className="sidebar-logo-text">
            <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0px' }}>Sree Lakshmi</h1>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px', fontWeight: 500 }}>Charitable Trust</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-label">{user?.role} MODULE</div>
          {(() => {
            const activeItem = [...navItems]
              .filter(i => i.path)
              .sort((a, b) => b.path.length - a.path.length)
              .find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));

            return navItems.map((item, idx) => {
              if (item.type === 'header') {
                return <div key={`header-${idx}`} className="nav-section-label" style={{ marginTop: 8 }}>{item.label}</div>
              }
              const isActive = activeItem && activeItem.path === item.path;
              return (
                <div key={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => { navigate(item.path); setMobileOpen(false) }}>
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )
            })
          })()}
        </div>

        <div style={{ position: 'relative' }}>
          {userMenuOpen && (
            <div className="sidebar-user-menu">
              <div className="sidebar-user-menu-item" onClick={() => { navigate('/profile'); setUserMenuOpen(false); setMobileOpen(false); }}>
                <span className="nav-icon">👤</span> Profile
              </div>
              <div className="sidebar-user-menu-item" onClick={handleLogout}>
                <span className="nav-icon">🚪</span> Logout
              </div>
            </div>
          )}
          <div className="sidebar-user" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ cursor: 'pointer' }}>
            <div className="sidebar-user-avatar">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
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
