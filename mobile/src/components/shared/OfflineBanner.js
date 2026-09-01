// components/shared/OfflineBanner.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore } from '../../store/offlineStore';

export const OfflineBanner = () => {
  const { isOnline, queue } = useOfflineStore();
  const insets = useSafeAreaInsets();

  if (isOnline && queue.length === 0) return null;

  return (
    <View style={[
      styles.banner,
      !isOnline ? styles.offlineBanner : styles.syncingBanner,
      { paddingTop: Math.max(insets.top, 8) }
    ]}>
      <Ionicons
        name={!isOnline ? "cloud-offline-outline" : "sync-outline"}
        size={16}
        color="#FFFFFF"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.text}>
        {!isOnline
          ? `OFFLINE MODE — ${queue.length > 0 ? `${queue.length} item${queue.length > 1 ? 's' : ''} queued` : 'Saved locally until reconnected'}`
          : `Syncing ${queue.length} offline item${queue.length > 1 ? 's' : ''}...`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 99999,
  },
  offlineBanner: {
    backgroundColor: '#D97706', // Warm amber / orange
  },
  syncingBanner: {
    backgroundColor: '#2563EB', // Blue
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
