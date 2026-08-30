import { create } from 'zustand'
import { coreApi } from '../api'

export const useFeatureStore = create((set, get) => ({
  myFeatures: [],
  loading: true,

  fetchFeatures: async () => {
    try {
      const res = await coreApi.features.listMyFeatures()
      set({ myFeatures: res.data || [], loading: false })
    } catch (err) {
      console.error('Failed to fetch feature permissions', err)
      set({ myFeatures: [], loading: false })
    }
  },

  hasFeature: (featureKey) => {
    // If no featureKey is required, allow access
    if (!featureKey) return true
    
    // Check if user has the feature enabled
    return get().myFeatures.includes(featureKey)
  }
}))
