import React, { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { coreApi } from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { MASTER_NAV_CONFIG, ADMIN_NAV_CONFIG, SOCIAL_MEDIA_NAV_CONFIG } from '../config/features'
import { useFeatureStore } from '../store/featureStore'
import {
  BarChart3,
  Users,
  Target,
  Award,
  Gift,
  HeartHandshake,
  Trophy,
  ShieldCheck,
  BadgeCheck,
  Megaphone,
  Handshake,
  Vote,
  Search,
  Bell,
  LogOut,
  UserCheck,
  Sliders,
  Smartphone,
  FileSearch,
  LineChart,
  X,
  Menu,
  ArrowLeft,
  Share2
} from 'lucide-react'

const resolveNavIcon = (item) => {
  if (item.label?.includes('Back to Admin')) return <ArrowLeft size={17} strokeWidth={2} />
  if (item.label === 'Social Platform Admin') return <Share2 size={17} strokeWidth={2} />
  if (item.label === 'Public Issues') return <Megaphone size={17} strokeWidth={2} />
  if (item.key === 'social_analytics' || item.path?.includes('tab=analytics')) return <BarChart3 size={17} strokeWidth={2} />
  if (item.key === 'social_mrm_members' || item.path?.includes('tab=mrm_members')) return <Users size={17} strokeWidth={2} />
  if (item.key === 'social_mrm_tasks' || item.path?.includes('tab=mrm_tasks')) return <Target size={17} strokeWidth={2} />
  if (item.key === 'social_mrm_badges' || item.path?.includes('tab=mrm_badges')) return <Award size={17} strokeWidth={2} />
  if (item.key === 'social_free_offers' || item.path?.includes('tab=offers')) return <Gift size={17} strokeWidth={2} />
  if (item.key === 'social_mrm_volunteers' || item.path?.includes('tab=mrm_volunteers')) return <HeartHandshake size={17} strokeWidth={2} />
  if (item.key === 'social_mrm_appreciation' || item.path?.includes('tab=mrm_appreciation')) return <Trophy size={17} strokeWidth={2} />
  if (item.key === 'social_posts' || item.path?.includes('tab=posts')) return <ShieldCheck size={17} strokeWidth={2} />
  if (item.key === 'social_verifications' || item.path?.includes('tab=verifications')) return <BadgeCheck size={17} strokeWidth={2} />
  if (item.key === 'social_official' || item.path?.includes('tab=official')) return <Megaphone size={17} strokeWidth={2} />
  if (item.key === 'social_pom' || item.path?.includes('tab=pom')) return <Handshake size={17} strokeWidth={2} />
  if (item.key === 'social_voting' || item.path?.includes('tab=voting')) return <Vote size={17} strokeWidth={2} />

  if (item.label === 'User Management') return <UserCheck size={17} strokeWidth={2} />
  if (item.label === 'Feature Access') return <Sliders size={17} strokeWidth={2} />
  if (item.label === 'Mobile Access') return <Smartphone size={17} strokeWidth={2} />
  if (item.label === 'Audit Log') return <FileSearch size={17} strokeWidth={2} />
  if (item.label === 'Reports') return <LineChart size={17} strokeWidth={2} />

  return item.icon || '•'
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
        <span className="notif-drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} /> Notifications
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={handleMarkAll}>Mark all read</button>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close notifications">
            <X size={16} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-icon">
              <Bell size={36} color="var(--gray-400)" strokeWidth={1.5} />
            </div>
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
      <Search size={15} color="var(--gray-400)" style={{ flexShrink: 0 }} />
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

  // Build nav items dynamically
  const navItems = React.useMemo(() => {
    // ADMIN has dedicated system management navigation only
    if (user?.role === 'ADMIN') return ADMIN_NAV_CONFIG

    // SOCIAL_MEDIA role has strictly validated social media features
    if (user?.role === 'SOCIAL_MEDIA') {
      return SOCIAL_MEDIA_NAV_CONFIG.filter(item => !item.key || hasFeature(item.key))
    }

    // For other roles (MANAGER, HR, etc.), filter master config by features
    return MASTER_NAV_CONFIG.filter(item => {
      // If the item specifies a hardcoded role (like the main dashboards), enforce it
      if (item.roles && !item.roles.includes(user?.role)) return false

      // Non-togglable dashboard or role-fixed pages without a feature key
      if (!item.key && item.roles && item.roles.includes(user?.role)) return true

      // Manager always has access to hr_members (Members Directory)
      if (user?.role === 'MANAGER' && item.key === 'hr_members') return true

      // Strictly check feature access
      return hasFeature(item.key)
    })
  }, [user, hasFeature, myFeatures])

  const handleLogout = async () => {
    await logout()
    navigate('/slt/portal/auth')
    toast.success('Logged out successfully.')
  }

  const currentPath = location.pathname
  const currentSearch = location.search || ''
  const currentFull = currentPath + currentSearch

  const checkIsActive = React.useCallback((itemPath) => {
    if (!itemPath) return false
    
    // Exact match including query params (e.g. /slt/social/overview?tab=mrm_appreciation)
    if (itemPath === currentFull) return true

    // When on /slt/social/overview without query params or with ?tab=analytics, match Platform Analytics
    if (currentPath === '/slt/social/overview' && (!currentSearch || currentSearch === '?tab=analytics')) {
      if (itemPath === '/slt/social/overview?tab=analytics' || itemPath === '/slt/social/overview') {
        return true
      }
    }

    // Exact path match when item has no query param and url has no query param
    if (!itemPath.includes('?') && !currentSearch && currentPath === itemPath) {
      return true
    }

    // Subpath match (e.g. /slt/mgr/requests/42 matches /slt/mgr/requests)
    if (!itemPath.includes('?') && currentPath.startsWith(itemPath + '/')) {
      return true
    }

    return false
  }, [currentPath, currentSearch, currentFull])

  const pageTitle = React.useMemo(() => {
    const matched = navItems.find(n => n.path && checkIsActive(n.path))
    return matched?.label || 'Dashboard'
  }, [navItems, checkIsActive])

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
                  {category !== 'OTHER' && (
                    <div className="nav-section-label" style={{ marginTop: 8 }}>{category}</div>
                  )}
                  {items.map(item => {
                    const isActive = checkIsActive(item.path);
                    return (
                      <div key={item.path}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => { navigate(item.path); setMobileOpen(false) }}>
                        <span className="nav-icon">{resolveNavIcon(item)}</span>
                        <span>{item.label}</span>
                      </div>
                    )
                  })}
                </React.Fragment>
              ))
            }

            // ADMIN flat rendering
            return navItems.map((item, idx) => {
              const isActive = checkIsActive(item.path);
              return (
                <div key={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => { navigate(item.path); setMobileOpen(false) }}>
                  <span className="nav-icon">{resolveNavIcon(item)}</span>
                  <span>{item.label}</span>
                </div>
              )
            })
          })()}
        </div>

        <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }} 
            onClick={() => { navigate('/slt/account/profile'); setMobileOpen(false); }}
            title="View Profile"
          >
            <div className="sidebar-user-avatar">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info" style={{ marginLeft: '12px' }}>
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}
            title="Logout"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <button className="icon-btn" style={{ display: 'none' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation">
            <Menu size={18} />
          </button>

          <div style={{ flex: 1 }}>
            <div className="header-title">{pageTitle}</div>
          </div>

          <div className="header-actions">
            <GlobalSearch />

            {/* Notification Bell */}
            <button className="icon-btn" onClick={toggleDrawer} id="notification-bell" aria-label="Notifications">
              <Bell size={17} color="var(--gray-600)" />
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
