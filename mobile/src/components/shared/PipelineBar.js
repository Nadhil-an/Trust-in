// components/shared/PipelineBar.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const STEPS = [
  { key: 'SUBMITTED', label: 'Filed', icon: 'paper-plane', color: Colors.info },
  { key: 'WITH_FAO', label: 'FAO', icon: 'person', color: Colors.warning },
  { key: 'WITH_ACO', label: 'ACO', icon: 'calculator', color: Colors.orange },
  { key: 'WITH_GEO', label: 'GEO', icon: 'shield-checkmark', color: Colors.purple },
  { key: 'WITH_MANAGER', label: 'Manager', icon: 'briefcase', color: '#7C3AED' },
  { key: 'APPROVED', label: 'Done', icon: 'checkmark-circle', color: Colors.success },
];

const PipelineBar = ({ status }) => {
  const isTerminal = status === 'REJECTED' || status === 'PARTIAL';
  const currentIdx = isTerminal
    ? STEPS.findIndex(s => s.key === 'WITH_MANAGER') // approximate
    : STEPS.findIndex(s => s.key === status);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isPending = i > currentIdx;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepCol}>
              <View style={[
                styles.circle,
                isDone && { backgroundColor: step.color, borderColor: step.color },
                isCurrent && { borderColor: step.color, borderWidth: 3 },
                isPending && styles.circleInactive,
              ]}>
                {isDone && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                {isCurrent && <View style={[styles.innerDot, { backgroundColor: step.color }]} />}
                {isPending && <View style={styles.innerDotGray} />}
              </View>
              <Text style={[
                styles.label,
                isCurrent && { color: step.color, fontWeight: '700' },
                isDone && { color: step.color },
                isPending && styles.labelInactive,
              ]} numberOfLines={1}>{step.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.line, isDone && { backgroundColor: STEPS[i + 1].color }]} />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepCol: { alignItems: 'center', width: 52 },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  circleInactive: { borderColor: Colors.gray200 },
  innerDot: { width: 10, height: 10, borderRadius: 5 },
  innerDotGray: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray300 },
  label: { fontSize: 10, color: Colors.gray600, textAlign: 'center' },
  labelInactive: { color: Colors.gray300 },
  line: { width: 24, height: 2, backgroundColor: Colors.gray200, marginBottom: 16 },
});

export default PipelineBar;
