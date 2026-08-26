// hooks/useOfflineSync.js — Offline sync queue processor
import { useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offlineStore';
import api from '../api';

export const useOfflineSync = () => {
  const { queue, removeFromQueue, setOnline } = useOfflineStore();

  const processQueue = useCallback(async () => {
    if (queue.length === 0) return;
    console.log(`[Offline] Processing ${queue.length} queued actions`);
    for (const item of queue) {
      try {
        const { method, url, data } = item;
        await api({ method, url, data });
        await removeFromQueue(item.id);
        console.log(`[Offline] Synced action ${item.id}`);
      } catch (e) {
        console.log(`[Offline] Failed to sync ${item.id}:`, e.message);
        // Keep in queue for next sync
      }
    }
  }, [queue, removeFromQueue]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable;
      setOnline(!!online);
      if (online) processQueue();
    });
    return () => unsubscribe();
  }, [processQueue, setOnline]);

  return { processQueue };
};
