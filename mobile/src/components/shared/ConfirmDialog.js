// components/shared/ConfirmDialog.js
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import Button from './Button';

const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger', // danger | primary | warning
  icon,
  loading = false,
  children, // optional extra content (e.g. input)
}) => {
  const iconName = icon || (variant === 'danger' ? 'warning' : variant === 'warning' ? 'alert-circle' : 'checkmark-circle');
  const iconColor = variant === 'danger' ? Colors.error : variant === 'warning' ? Colors.warning : Colors.primary;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={iconName} size={28} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          {children && <View style={styles.childrenArea}>{children}</View>}
          <View style={styles.actions}>
            <Button title={cancelLabel} onPress={onCancel} variant="outline" style={styles.btn} />
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              style={styles.btn}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  dialog: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.gray800, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: Colors.gray500, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  childrenArea: { width: '100%', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  btn: { flex: 1 },
});

export default ConfirmDialog;
