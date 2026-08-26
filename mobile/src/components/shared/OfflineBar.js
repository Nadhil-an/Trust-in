// components/shared/OfflineBar.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../../store/offlineStore';
import { Colors } from '../../constants/Colors';
import { useTranslation } from 'react-i18next';

const OfflineBar = () => {
  const { isOnline, queue } = useOfflineStore();
  const { t } = useTranslation();

  if (isOnline && queue.length === 0) return null;

  if (!isOnline) {
    return (
      <View style={[styles.bar, styles.offline]}>
        <Ionicons name="cloud-offline" size={14} color={Colors.white} />
        <Text style={styles.text}>{t('common.no_internet')}</Text>
      </View>
    );
  }

  if (queue.length > 0) {
    return (
      <View style={[styles.bar, styles.syncing]}>
        <Ionicons name="sync" size={14} color={Colors.white} />
        <Text style={styles.text}>{queue.length} {t('common.sync_pending')}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offline: { backgroundColor: Colors.error },
  syncing: { backgroundColor: Colors.warning },
  text: { color: Colors.white, fontSize: 12, fontWeight: '500', flex: 1 },
});

export default OfflineBar;
