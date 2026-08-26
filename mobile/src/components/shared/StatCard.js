// components/shared/StatCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const StatCard = ({ title, value, icon, color = Colors.primary, bg, onPress, subtitle }) => (
  <TouchableOpacity
    style={[styles.card, { backgroundColor: bg || Colors.primaryLight }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={[styles.iconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color={Colors.white} />
    </View>
    <Text style={[styles.value, { color }]}>{value ?? '-'}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 14, padding: 14,
    alignItems: 'center', minWidth: 80,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  value: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  title: { fontSize: 11, color: Colors.gray600, textAlign: 'center', fontWeight: '500' },
  subtitle: { fontSize: 10, color: Colors.gray400, marginTop: 2, textAlign: 'center' },
});

export default StatCard;
