import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { coreApi } from '../api';

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
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Skip remote push token registration inside Expo Go to avoid SDK 53+ error
    if (isExpoGo) {
      return;
    }

    try {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setExpoPushToken(token);
          // Send to backend
          try {
            coreApi.updatePushToken({ push_token: token });
          } catch (e) {
            console.log('Failed to send push token', e);
          }
        }
      }).catch(err => {
        console.log('Push notification registration skipped:', err?.message || err);
      });

      notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
        setNotification(notif);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Push response:', response);
      });
    } catch (err) {
      console.log('Push notification setup error:', err);
    }

    return () => {
      try {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      } catch (_) {}
    };
  }, []);

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
        lightColor: '#FF231F7C',
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
        console.log('Push permission not granted');
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
    console.log('Push token registration skipped or unsupported in this client:', e?.message || e);
  }

  return token;
}
