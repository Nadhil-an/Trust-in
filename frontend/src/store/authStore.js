import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.login(credentials)
          set({ user: res.data.user, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          const msg = err.response?.data?.error || 'Login failed.'
          set({ error: msg, isLoading: false })
          return { success: false, error: msg }
        }
      },

      logout: async () => {
        try { await authApi.logout() } catch (_) {}
        set({ user: null, isAuthenticated: false })
      },

      fetchProfile: async () => {
        try {
          const res = await authApi.profile()
          set({ user: res.data, isAuthenticated: true })
        } catch (_) {
          set({ user: null, isAuthenticated: false })
        }
      },

      updateUser: (userData) => set({ user: { ...get().user, ...userData } }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'slt-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
