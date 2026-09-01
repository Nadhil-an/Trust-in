import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useOfflineSync } from './src/hooks/useOfflineSync';
import { initI18n } from './src/i18n';
import { LoadingScreen, GlobalAttendanceModal } from './src/components/shared';
import OfflineBar from './src/components/shared/OfflineBar';

// Initialize i18n
let i18nInitialized = false;
initI18n().then(() => { i18nInitialized = true; });

// Main App Component wrapper to use hooks that require Context
const AppContent = () => {
  useOfflineSync();
  return (
    <>
      <AppNavigator />
      <GlobalAttendanceModal />
    </>
  );
};

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for i18n to load before rendering
    const checkI18n = setInterval(() => {
      if (i18nInitialized) {
        clearInterval(checkI18n);
        setReady(true);
      }
    }, 100);
    return () => clearInterval(checkI18n);
  }, []);

  if (!ready) {
    return <LoadingScreen message="Loading resources..." />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppContent />
      <Toast />
    </SafeAreaProvider>
  );
}
