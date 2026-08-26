// components/shared/Badge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

const statusMap = {
  SUBMITTED: { bg: Colors.infoLight, text: Colors.info, label: 'Submitted' },
  WITH_FAO: { bg: Colors.warningLight, text: Colors.warning, label: 'With FAO' },
  WITH_ACO: { bg: Colors.orangeLight, text: Colors.orange, label: 'With ACO' },
  WITH_GEO: { bg: Colors.purpleLight, text: Colors.purple, label: 'With GEO' },
  WITH_MANAGER: { bg: '#F3E8FF', text: '#7C3AED', label: 'With Manager' },
  APPROVED: { bg: Colors.successLight, text: Colors.success, label: 'Approved' },
  PARTIAL: { bg: '#D1FAE5', text: '#059669', label: 'Partial' },
  REJECTED: { bg: Colors.errorLight, text: Colors.error, label: 'Rejected' },
  RETURNED: { bg: Colors.warningLight, text: Colors.warning, label: 'Returned' },
  DRAFT: { bg: Colors.gray100, text: Colors.gray500, label: 'Draft' },
  NORMAL: { bg: Colors.infoLight, text: Colors.info, label: 'Normal' },
  URGENT: { bg: Colors.warningLight, text: Colors.warning, label: 'Urgent' },
  CRITICAL: { bg: Colors.errorLight, text: Colors.error, label: 'Critical' },
  PAID: { bg: Colors.successLight, text: Colors.success, label: 'Paid' },
  DUE: { bg: Colors.warningLight, text: Colors.warning, label: 'Due' },
};

const Badge = ({ status, label, color, bg, size = 'md', dot = false, style }) => {
  const config = statusMap[status] || { bg: bg || Colors.gray100, text: color || Colors.gray600, label: label || status };
  const displayLabel = label || config.label;

  return (
    <View style={[styles.badge, styles[`size_${size}`], { backgroundColor: config.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: config.text }]} />}
      <Text style={[styles.text, styles[`textSize_${size}`], { color: config.text }]}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  size_sm: { paddingHorizontal: 8, paddingVertical: 3 },
  size_md: { paddingHorizontal: 10, paddingVertical: 4 },
  size_lg: { paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontWeight: '600' },
  textSize_sm: { fontSize: 11 },
  textSize_md: { fontSize: 12 },
  textSize_lg: { fontSize: 13 },
});

export default Badge;
