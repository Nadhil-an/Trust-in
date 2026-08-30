import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { coreApi } from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { MASTER_NAV_CONFIG, ADMIN_NAV_CONFIG } from '../config/features'
import { useFeatureStore } from '../store/featureStore'

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
  const { hasFeature, myFeatures, loading } = useFeatureStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Build nav items dynamically
  const navItems = React.useMemo(() => {
    if (user?.role === 'ADMIN') return ADMIN_NAV_CONFIG
    
    // For non-admin, filter master config by features
    return MASTER_NAV_CONFIG.filter(item => {
      // If the item specifies a hardcoded role (like the main dashboards), enforce it
      if (item.roles && !item.roles.includes(user?.role)) return false
      
      // Check feature access
      return hasFeature(item.key)
    })
  }, [user, hasFeature, myFeatures])

  const handleLogout = async () => {
    await logout()
    navigate('/slt/portal/auth')
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
            if (loading && myFeatures.length === 0 && user?.role !== 'ADMIN') {
              return (
                <div style={{ padding: '20px', opacity: 0.5 }}>
                  <div className="animate-pulse flex flex-col gap-4">
                    <div className="h-4 bg-gray-400 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-400 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-400 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-400 rounded w-2/3"></div>
                  </div>
                </div>
              )
            }

            const activeItem = [...navItems]
              .filter(i => i.path)
              .sort((a, b) => b.path.length - a.path.length)
              .find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));

            // Group by category if non-admin
            if (user?.role !== 'ADMIN') {
              const grouped = {}
              navItems.forEach(item => {
                const cat = item.category || 'OTHER'
                if (!grouped[cat]) grouped[cat] = []
                grouped[cat].push(item)
              })
              
              return Object.entries(grouped).map(([category, items]) => (
                <React.Fragment key={category}>
                  <div className="nav-section-label" style={{ marginTop: 8, opacity: category === 'OTHER' ? 0 : 1 }}>{category}</div>
                  {items.map(item => {
                    const isActive = activeItem && activeItem.path === item.path;
                    return (
                      <div key={item.path}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => { navigate(item.path); setMobileOpen(false) }}>
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    )
                  })}
                </React.Fragment>
              ))
            }

            // ADMIN flat rendering
            return navItems.map((item, idx) => {
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
              <div className="sidebar-user-menu-item" onClick={() => { navigate('/slt/account/profile'); setUserMenuOpen(false); setMobileOpen(false); }}>
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
