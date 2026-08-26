// store/offlineStore.js — Offline action queue
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';

const QUEUE_KEY = Config.OFFLINE_QUEUE_KEY;

export const useOfflineStore = create((set, get) => ({
  queue: [],
  isOnline: true,

  setOnline: (status) => set({ isOnline: status }),

  loadQueue: async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) set({ queue: JSON.parse(stored) });
    } catch (_) {}
  },

  addToQueue: async (action) => {
    const item = { ...action, id: Date.now(), timestamp: new Date().toISOString() };
    const queue = [...get().queue, item];
    set({ queue });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return item;
  },

  removeFromQueue: async (id) => {
    const queue = get().queue.filter((item) => item.id !== id);
    set({ queue });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  clearQueue: async () => {
    set({ queue: [] });
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  getQueueCount: () => get().queue.length,
}));
