// components/shared/CaseTimeline.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { format } from 'date-fns';

const ACTION_CONFIG = {
  SUBMITTED: { icon: 'paper-plane', color: Colors.info, label: 'Submitted' },
  WITH_FAO: { icon: 'person', color: Colors.warning, label: 'Assigned to FAO' },
  WITH_ACO: { icon: 'calculator', color: Colors.orange, label: 'Forwarded to ACO' },
  WITH_GEO: { icon: 'shield-checkmark', color: Colors.purple, label: 'Forwarded to GEO' },
  WITH_MANAGER: { icon: 'briefcase', color: '#7C3AED', label: 'Forwarded to Manager' },
  APPROVED: { icon: 'checkmark-circle', color: Colors.success, label: 'Approved' },
  PARTIAL: { icon: 'checkmark-done', color: Colors.success, label: 'Partially Approved' },
  REJECTED: { icon: 'close-circle', color: Colors.error, label: 'Rejected' },
  RETURNED: { icon: 'return-up-back', color: Colors.warning, label: 'Returned' },
  COMMENT: { icon: 'chatbubble', color: Colors.primary, label: 'Comment Added' },
  FIELD_VISIT: { icon: 'location', color: Colors.success, label: 'Field Visit' },
  FOLLOW_UP: { icon: 'add-circle', color: Colors.info, label: 'Follow-up Added' },
};

const CaseTimeline = ({ history = [] }) => {
  if (!history.length) {
    return <Text style={styles.empty}>No history yet.</Text>;
  }

  return (
    <View style={styles.container}>
      {history.map((item, index) => {
        const config = ACTION_CONFIG[item.action] || { icon: 'ellipse', color: Colors.gray400, label: item.action };
        const isLast = index === history.length - 1;

        return (
          <View key={item.id || index} style={styles.item}>
            <View style={styles.iconCol}>
              <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
              </View>
              {!isLast && <View style={styles.line} />}
            </View>
            <View style={styles.content}>
              <Text style={[styles.action, { color: config.color }]}>{item.label || config.label}</Text>
              {item.actor && (
                <Text style={styles.actor}>by {item.actor}</Text>
              )}
              {item.note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>{item.note}</Text>
                </View>
              )}
              {item.timestamp && (
                <Text style={styles.time}>
                  {format(new Date(item.timestamp), 'dd MMM yyyy, HH:mm')}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Stub for PipelineBar export (already defined in StatusPill.js)
export const PipelineBar = ({ status }) => null;

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  empty: { textAlign: 'center', color: Colors.gray400, fontSize: 13, marginTop: 16 },
  item: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  iconCol: { alignItems: 'center', width: 36 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { width: 2, flex: 1, backgroundColor: Colors.gray200, marginVertical: 4 },
  content: { flex: 1, paddingBottom: 16 },
  action: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  actor: { fontSize: 12, color: Colors.gray500, marginBottom: 4 },
  noteBox: {
    backgroundColor: Colors.gray50, borderRadius: 8,
    padding: 10, marginBottom: 6,
  },
  noteText: { fontSize: 13, color: Colors.gray700, lineHeight: 18 },
  time: { fontSize: 11, color: Colors.gray400 },
});

export default CaseTimeline;
