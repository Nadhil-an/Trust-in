// components/shared/EligibilityToggle.js
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const EligibilityToggle = ({ value, onChange, disabled }) => {
  const slideAnim = useRef(new Animated.Value(value === 'ELIGIBLE' ? 1 : value === 'NOT_ELIGIBLE' ? -1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const toValue = value === 'ELIGIBLE' ? 1 : value === 'NOT_ELIGIBLE' ? -1 : 0;
    Animated.spring(slideAnim, { toValue, useNativeDriver: true, tension: 120, friction: 8 }).start();
  }, [value]);

  const handlePress = (choice) => {
    if (disabled) return;
    Vibration.vibrate(choice === 'ELIGIBLE' ? [0, 30] : [0, 30, 60, 30]);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onChange(choice === value ? 'PENDING' : choice);
  };

  const isEligible = value === 'ELIGIBLE';
  const isNotEligible = value === 'NOT_ELIGIBLE';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.label}>Eligibility Decision</Text>
      <Text style={styles.sub}>Mark whether this case qualifies for support</Text>

      <View style={styles.toggleRow}>
        {/* ELIGIBLE */}
        <TouchableOpacity
          style={[styles.toggleBtn, styles.eligibleBtn, isEligible && styles.eligibleActive]}
          onPress={() => handlePress('ELIGIBLE')}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Animated.View style={[
            styles.iconWrap,
            isEligible && styles.eligibleIconWrap,
            { transform: [{ scale: isEligible ? 1.15 : 1 }] }
          ]}>
            <Ionicons
              name={isEligible ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={36}
              color={isEligible ? Colors.white : Colors.success}
            />
          </Animated.View>
          <Text style={[styles.toggleLabel, isEligible && styles.eligibleLabel]}>ELIGIBLE</Text>
          <Text style={[styles.toggleSub, isEligible && { color: 'rgba(255,255,255,0.8)' }]}>
            Qualifies for support
          </Text>
        </TouchableOpacity>

        {/* NOT ELIGIBLE */}
        <TouchableOpacity
          style={[styles.toggleBtn, styles.notEligibleBtn, isNotEligible && styles.notEligibleActive]}
          onPress={() => handlePress('NOT_ELIGIBLE')}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Animated.View style={[
            styles.iconWrap,
            isNotEligible && styles.notEligibleIconWrap,
            { transform: [{ scale: isNotEligible ? 1.15 : 1 }] }
          ]}>
            <Ionicons
              name={isNotEligible ? 'close-circle' : 'close-circle-outline'}
              size={36}
              color={isNotEligible ? Colors.white : Colors.error}
            />
          </Animated.View>
          <Text style={[styles.toggleLabel, isNotEligible && styles.notEligibleLabel]}>NOT ELIGIBLE</Text>
          <Text style={[styles.toggleSub, isNotEligible && { color: 'rgba(255,255,255,0.8)' }]}>
            Does not qualify
          </Text>
        </TouchableOpacity>
      </View>

      {value && value !== 'PENDING' && (
        <View style={[styles.decisionBanner, isEligible ? styles.eligibleBanner : styles.notEligibleBanner]}>
          <Ionicons
            name={isEligible ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={isEligible ? Colors.success : Colors.error}
          />
          <Text style={[styles.decisionText, { color: isEligible ? Colors.success : Colors.error }]}>
            {isEligible
              ? 'Case will be automatically forwarded to ACO for cost calculation'
              : 'Case will be marked as rejected — Manager will be notified'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: Colors.gray500, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.gray200, backgroundColor: Colors.white,
  },
  eligibleBtn: { borderColor: Colors.success },
  eligibleActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  notEligibleBtn: { borderColor: Colors.error },
  notEligibleActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  iconWrap: { marginBottom: 8 },
  eligibleIconWrap: {},
  notEligibleIconWrap: {},
  toggleLabel: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  eligibleLabel: { color: Colors.white },
  notEligibleLabel: { color: Colors.white },
  toggleSub: { fontSize: 11, color: Colors.gray500, textAlign: 'center', marginTop: 4 },
  decisionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, borderRadius: 10, padding: 12,
  },
  eligibleBanner: { backgroundColor: Colors.successLight },
  notEligibleBanner: { backgroundColor: Colors.errorLight },
  decisionText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});

export default EligibilityToggle;
