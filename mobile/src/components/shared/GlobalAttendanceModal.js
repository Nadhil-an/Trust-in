import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useModalStore } from '../../store/modalStore';
import { Colors } from '../../constants/Colors';

const { width } = Dimensions.get('window');

const GlobalAttendanceModal = () => {
  const { visible, title, message, actionTitle, onConfirm, hideModal } = useModalStore();
  const { t } = useTranslation();
  
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={hideModal}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning" size={24} color="#D97706" />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
          
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonColumn}>
            <TouchableOpacity style={styles.confirmButtonBlock} onPress={() => { hideModal(); if (onConfirm) onConfirm(); }} activeOpacity={0.7}>
              <Text style={styles.confirmTextBlock}>{actionTitle}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButtonBlock} onPress={hideModal} activeOpacity={0.7}>
              <Text style={styles.cancelTextBlock}>{t('common.cancel', 'CANCEL').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 26,
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 30,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 10,
  },
  confirmButtonBlock: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTextBlock: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  cancelButtonBlock: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTextBlock: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default GlobalAttendanceModal;
