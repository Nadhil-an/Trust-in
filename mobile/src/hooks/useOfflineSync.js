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
        
        let sendData = data;
        let headers = undefined;

        // Convert to FormData if an image URI is attached
        if (data && data.document_uri) {
          sendData = new FormData();
          for (const key in data) {
            if (key === 'document_uri') {
              sendData.append('document', {
                uri: data.document_uri,
                name: 'receipt.jpg',
                type: 'image/jpeg'
              });
            } else if (data[key] !== null && data[key] !== undefined) {
              sendData.append(key, data[key]);
            }
          }
        }

        await api({ method, url, data: sendData, headers });
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
