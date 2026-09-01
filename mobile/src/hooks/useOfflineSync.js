// hooks/useOfflineSync.js — Offline sync queue processor
import { useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offlineStore';
import api from '../api';

import Toast from 'react-native-toast-message';

export const useOfflineSync = () => {
  const { queue, removeFromQueue, setOnline } = useOfflineStore();

  const processQueue = useCallback(async () => {
    if (queue.length === 0) return;
    const initialCount = queue.length;
    console.log(`[Offline] Processing ${initialCount} queued actions`);
    let syncedCount = 0;

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
        syncedCount += 1;
        console.log(`[Offline] Synced action ${item.id}`);
      } catch (e) {
        console.log(`[Offline] Failed to sync ${item.id}:`, e.message);
        // Keep in queue for next sync
      }
    }

    if (syncedCount > 0) {
      Toast.show({
        type: 'success',
        text1: 'Offline Sync Complete! 🚀',
        text2: `Successfully synced ${syncedCount} offline transaction${syncedCount > 1 ? 's' : ''} to all dashboards.`
      });
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
