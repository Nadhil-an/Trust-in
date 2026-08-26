// components/shared/StatusPill.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

const STATUS_STEPS = ['SUBMITTED', 'WITH_FAO', 'WITH_ACO', 'WITH_GEO', 'WITH_MANAGER', 'APPROVED'];
const STATUS_CONFIG = {
  SUBMITTED: { label: 'Submitted', color: Colors.info },
  WITH_FAO: { label: 'FAO Review', color: Colors.warning },
  WITH_ACO: { label: 'ACO Calc.', color: Colors.orange },
  WITH_GEO: { label: 'GEO Final', color: Colors.purple },
  WITH_MANAGER: { label: 'Manager', color: '#7C3AED' },
  APPROVED: { label: 'Approved', color: Colors.success },
  PARTIAL: { label: 'Partial', color: Colors.success },
  REJECTED: { label: 'Rejected', color: Colors.error },
  RETURNED: { label: 'Returned', color: Colors.warning },
};

const StatusPill = ({ status }) => {
  const config = STATUS_CONFIG[status] || { label: status, color: Colors.gray500 };
  return (
    <View style={[styles.pill, { backgroundColor: config.color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

export const PipelineBar = ({ status }) => {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isRejected = status === 'REJECTED';
  const isPartial = status === 'PARTIAL';
  const finalIdx = isRejected || isPartial ? currentIdx : currentIdx;

  return (
    <View style={pStyles.container}>
      {STATUS_STEPS.map((step, i) => {
        const config = STATUS_CONFIG[step];
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const isLast = i === STATUS_STEPS.length - 1;
        return (
          <View key={step} style={pStyles.stepWrapper}>
            <View style={[
              pStyles.circle,
              isActive && { backgroundColor: config.color, borderColor: config.color },
              isCurrent && pStyles.circleCurrent,
            ]}>
              {isActive && !isCurrent && (
                <Text style={pStyles.checkmark}>✓</Text>
              )}
              {isCurrent && <View style={pStyles.innerDot} />}
            </View>
            <Text style={[pStyles.stepLabel, isActive && { color: config.color }]} numberOfLines={1}>
              {config.label}
            </Text>
            {!isLast && (
              <View style={[pStyles.line, i < currentIdx && { backgroundColor: STATUS_CONFIG[STATUS_STEPS[i + 1]]?.color || Colors.gray300 }]} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '600' },
});

const pStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  stepWrapper: { flex: 1, alignItems: 'center', position: 'relative' },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  circleCurrent: { borderWidth: 3 },
  innerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  checkmark: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: 9, color: Colors.gray400, textAlign: 'center', fontWeight: '500' },
  line: {
    position: 'absolute', top: 11, left: '50%', right: '-50%',
    height: 2, backgroundColor: Colors.gray200, zIndex: -1,
  },
});

export default StatusPill;
