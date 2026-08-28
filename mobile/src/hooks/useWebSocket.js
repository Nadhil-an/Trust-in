// hooks/useWebSocket.js — Real-time WebSocket connection
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { Config } from '../constants/Config';

export const useWebSocket = (path, onMessage) => {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const hasConnectedOnceRef = useRef(false);
  const savedOnMessage = useRef(onMessage);
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    savedOnMessage.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return;

    const url = `${Config.WS_BASE_URL}${path}?token=${accessToken}`;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WS] Connected:', path);
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
        
        // Trigger a refresh if this is a reconnection, to fetch any missed updates
        if (hasConnectedOnceRef.current && savedOnMessage.current) {
          savedOnMessage.current({ type: 'DASHBOARD_REFRESH' });
        }
        hasConnectedOnceRef.current = true;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (savedOnMessage.current) {
             savedOnMessage.current(data);
          }
        } catch (e) {
          console.log('[WS] Parse error:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code);
        if (event.code !== 1000) {
          // Auto-reconnect after 3 seconds
          reconnectRef.current = setTimeout(() => connect(), 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.log('[WS] Error:', error.message);
      };
    } catch (e) {
      console.log('[WS] Failed to connect:', e);
    }
  }, [path, accessToken, isAuthenticated]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close(1000);
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect]);

  return { send, disconnect, reconnect: connect };
};

// Global notification WebSocket
export const useNotificationSocket = (onNotification) => {
  return useWebSocket('/notify/', onNotification);
};

// Assessment-specific WebSocket
export const useAssessmentSocket = (assessmentId, onUpdate) => {
  return useWebSocket(`/assessments/${assessmentId}/`, onUpdate);
};
