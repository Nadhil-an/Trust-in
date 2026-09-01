// components/shared/OfflineBar.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore } from '../../store/offlineStore';
import { Colors } from '../../constants/Colors';
import { useTranslation } from 'react-i18next';

const OfflineBar = () => {
  const { isOnline, queue } = useOfflineStore();
  const insets = useSafeAreaInsets();

  if (isOnline && queue.length === 0) return null;

  if (!isOnline) {
    return (
      <View style={[styles.bar, styles.offline]}>
        <Ionicons name="cloud-offline-outline" size={16} color={Colors.white} />
        <Text style={styles.text}>
          ⚡ YOU ARE OFFLINE — {queue.length > 0 ? `${queue.length} item(s) queued for sync` : 'Transactions saved locally'}
        </Text>
      </View>
    );
  }

  if (queue.length > 0) {
    return (
      <View style={[styles.bar, styles.syncing]}>
        <Ionicons name="sync-outline" size={16} color={Colors.white} />
        <Text style={styles.text}>🔄 Syncing {queue.length} offline item(s)...</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 9,
    width: '100%',
  },
  offline: { backgroundColor: '#D97706' }, // Amber warning tag
  syncing: { backgroundColor: '#2563EB' }, // Blue sync tag
  text: { color: Colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
});

export default OfflineBar;
