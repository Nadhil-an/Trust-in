import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { coreApi } from '../api';
import { useAuthStore } from '../store/authStore';

// Push notifications are not supported inside the Expo Go app starting from SDK 53+
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (_) {}
}

export function usePushNotifications() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (isExpoGo) {
      return;
    }

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
        console.log('[Push] User responded to notification:', response?.notification?.request?.content?.data);
      });
    } catch (_) {}

    return () => {
      try {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      } catch (_) {}
    };
  }, []);

  // When user is authenticated and token is obtained, send to backend
  useEffect(() => {
    if (isExpoGo) return;
    if (isAuthenticated && accessToken && expoPushToken) {
      coreApi.updatePushToken({ push_token: expoPushToken })
        .then(() => {
          console.log('[Push] Token successfully synced with backend for authenticated user');
        })
        .catch(err => {
          console.log('[Push] Failed to update push token on backend:', err?.message || err);
        });
    }
  }, [isAuthenticated, accessToken, expoPushToken]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  if (isExpoGo) {
    return null;
  }

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
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        return null;
      }

      const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenRes?.data;
    }
  } catch (e) {
    console.log('[Push] Push token registration skipped or unsupported in this client:', e?.message || e);
  }

  return token;
}
