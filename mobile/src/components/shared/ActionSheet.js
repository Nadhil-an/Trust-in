// components/shared/ActionSheet.js
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const ActionSheet = ({ visible, onClose, title, options = [] }) => (
  <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay} />
    </TouchableWithoutFeedback>
    <View style={styles.sheet}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.divider} />
      {options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.option, opt.destructive && styles.destructive]}
          onPress={() => { onClose(); opt.onPress(); }}
          disabled={opt.disabled}
        >
          {opt.icon && <Ionicons name={opt.icon} size={20} color={opt.destructive ? Colors.error : Colors.primary} style={styles.optIcon} />}
          <Text style={[styles.optText, opt.destructive && styles.destructiveText, opt.disabled && styles.disabledText]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.option, styles.cancel]} onPress={onClose}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, paddingTop: 8,
  },
  title: {
    textAlign: 'center', fontSize: 14, color: Colors.gray500,
    paddingVertical: 12, paddingHorizontal: 20, fontWeight: '500',
  },
  divider: { height: 1, backgroundColor: Colors.gray200, marginHorizontal: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  optIcon: { marginRight: 14 },
  optText: { fontSize: 16, color: Colors.textPrimary },
  destructive: {},
  destructiveText: { color: Colors.error },
  disabledText: { color: Colors.gray400 },
  cancel: { marginTop: 8, borderBottomWidth: 0 },
  cancelText: { fontSize: 16, color: Colors.error, fontWeight: '600', textAlign: 'center', flex: 1 },
});

export default ActionSheet;
