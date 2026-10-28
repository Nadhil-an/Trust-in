import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { coreApi } from '../api';
import { useAuthStore } from '../store/authStore';

// Always configure notification display behavior (foreground + background)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (_) {}

export function usePushNotifications() {
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(token => {
        if (token) {
          setExpoPushToken(token);
        }
      })
      .catch(err => {
        console.log('[Push] Registration error:', err?.message || err);
      });

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
        setNotification(notif);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[Push] User tapped notification outside app:', response?.notification?.request?.content?.data);
      });
    } catch (_) {}

    return () => {
      try {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      } catch (_) {}
    };
  }, []);

  // When user is authenticated and token is obtained, sync with backend
  useEffect(() => {
    if (isAuthenticated && accessToken && expoPushToken) {
      coreApi.updatePushToken({ push_token: expoPushToken })
        .then(() => {
          console.log(`[Push] Token successfully synced with backend for ${user?.username || user?.phone || 'user'}`);
        })
        .catch(err => {
          console.log('[Push] Failed to update push token on backend:', err?.message || err);
        });
    }
  }, [isAuthenticated, accessToken, expoPushToken, user?.id]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  let token = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284c7',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('[Push] Push notification permission not granted');
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        '5f773548-6ce7-48a6-a853-7bc68bd656b8';

      const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenRes?.data;
      if (token) {
        console.log('[Push] Successfully registered Expo push token:', token);
      }
    } else {
      console.log('[Push] Physical device required for remote push notifications');
    }
  } catch (e) {
    console.log('[Push] Push token registration skipped or unsupported in this client:', e?.message || e);
  }

  return token;
}
