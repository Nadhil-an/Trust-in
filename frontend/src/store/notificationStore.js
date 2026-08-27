import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  ws: null,

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
  }),

  addNotification: (notif) => set(state => ({
    notifications: [notif, ...state.notifications],
    unreadCount: state.unreadCount + 1,
  })),

  markRead: (id) => set(state => ({
    notifications: state.notifications.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  markAllRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, is_read: true })),
    unreadCount: 0,
  })),

  toggleDrawer: () => set(state => ({ isOpen: !state.isOpen })),
  closeDrawer: () => set({ isOpen: false }),

  connectWebSocket: (userId) => {
    const { ws } = get()
    if (ws) ws.close()

    const apiHost = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : window.location.host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${apiHost}/ws/notify/`
    try {
      const socket = new WebSocket(wsUrl)
  
      socket.onopen = () => {}
  
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'INIT') {
          set({ unreadCount: data.unread_count })
        } else if (data.type === 'NOTIFICATION') {
          get().addNotification(data.notification)
          // Browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification(data.notification.title, { body: data.notification.message })
          }
        } else if (data.type === 'REQUEST_UPDATE') {
          // Dispatch custom event for dashboard components to listen
          window.dispatchEvent(new CustomEvent('request-update', { detail: data.data }))
        } else if (data.type === 'DASHBOARD_REFRESH') {
          window.dispatchEvent(new CustomEvent('dashboard-refresh', { detail: data }))
        }
      }
  
      socket.onclose = (event) => {
        // Disconnected
        if (event.code === 4001) {
          console.error('[WS] Unauthorized connection')
          set({ ws: null })
          return
        }
        // Auto-reconnect after 3s
        setTimeout(() => {
          if (get().ws === socket) get().connectWebSocket(userId)
        }, 3000)
      }
  
      socket.onerror = (err) => console.error('[WS] Error:', err)
  
      set({ ws: socket })
    } catch (err) {
      console.error('[WS] Failed to construct WebSocket:', err)
      set({ ws: null })
    }
  },

  disconnect: () => {
    const { ws } = get()
    if (ws) { ws.close(); set({ ws: null }) }
  },
}))
