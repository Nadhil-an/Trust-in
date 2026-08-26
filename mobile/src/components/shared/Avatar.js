// components/shared/Avatar.js
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../constants/Colors';

const Avatar = ({ name = '', uri, size = 40, style }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = [Colors.primary, Colors.purple, Colors.success, Colors.warning, Colors.orange];
  const colorIdx = name.charCodeAt(0) % colors.length;

  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]} />;
  }

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors[colorIdx] }, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
};

// stub ActionSheet
export const ActionSheet = ({ visible, onClose, options = [] }) => null;
export const PipelineBar = ({ status }) => null;

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: Colors.white, fontWeight: '700' },
});

export default Avatar;
