// screens/staff/CollectDonationScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Linking, Modal, TextInput
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donationApi, membersApi } from '../../api';
import { useOfflineStore } from '../../store/offlineStore';
import Toast from 'react-native-toast-message';
import { isValidPhone, isPositiveNumber } from '../../utils/validators';

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
  { key: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
];

const CollectDonationScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const { isOnline, addToQueue } = useOfflineStore();
  const insets = useSafeAreaInsets();
  
  const [form, setForm] = useState({
    donor_name: editItem?.donor_name || '', phone: editItem?.phone || '', amount: editItem?.amount?.toString() || '',
    payment_method: editItem?.payment_method || 'CASH', notes: editItem?.notes || '', member_id: editItem?.member || '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [noName, setNoName] = useState(false);
  const [noPhone, setNoPhone] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  const validate = () => {
    const errs = {};
    if (!noName && !form.donor_name.trim()) errs.donor_name = t('common.required');
    if (!noPhone && form.phone && !isValidPhone(form.phone)) errs.phone = t('errors.invalid_phone_msg', 'Enter a valid 10-digit phone number');
    if (!isPositiveNumber(form.amount)) errs.amount = t('errors.validation', 'Enter a valid positive amount');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const data = {
      donor_name: noName ? 'Anonymous' : form.donor_name,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      purpose: form.notes,
      source: 'DONATION',
      donor_phone: noPhone ? null : form.phone,
    };

    try {
      if (!isOnline && !isEdit) {
        await addToQueue({ method: 'POST', url: '/mobile/donations/', data });
        Toast.show({ type: 'success', text1: 'Donation Saved Offline', text2: 'Will sync when connected.' });
        navigation.goBack();
        return;
      }
      
      if (isEdit) {
        await donationApi.update(editItem.id, data);
        Toast.show({ type: 'success', text1: t('staff.donation_recorded', 'Donation Updated!') });
        navigation.goBack();
      } else {
        const res = await donationApi.create(data);
        setSuccessData({
          receipt_number: res.data.receipt_number,
          donor_name: data.donor_name,
          amount: data.amount,
          phone: form.phone,
          noPhone: noPhone
        });
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || t('common.error'));
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Donation' : 'Donation Collection'}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {/* Donor details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="cash-outline" size={16} color="#0B57D0" />
              </View>
              <Text style={styles.cardTitle}>Donor Details</Text>
            </View>

            {/* Donor's Name */}
            <Text style={styles.inputLabel}>Donor's Name <Text style={styles.asterisk}>*</Text></Text>
            <View style={[styles.inputWrapper, errors.donor_name && styles.inputError]}>
              <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={noName ? 'Anonymous' : form.donor_name}
                onChangeText={v => set('donor_name', v)}
                placeholder="Full name of donor"
                placeholderTextColor="#94A3B8"
                editable={!noName}
              />
            </View>
            <TouchableOpacity onPress={() => setNoName(!noName)} style={styles.checkboxRow} activeOpacity={0.7}>
              <Ionicons name={noName ? "checkbox" : "square-outline"} size={22} color={noName ? "#0B57D0" : "#64748B"} />
              <Text style={styles.checkboxLabel}>Donator is not interested in sharing name</Text>
            </TouchableOpacity>

            {/* Phone Number */}
            <Text style={styles.inputLabel}>Phone (for WhatsApp receipt)</Text>
            <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={noPhone ? '' : form.phone}
                onChangeText={v => set('phone', v)}
                placeholder="10-digit number"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={10}
                editable={!noPhone}
              />
            </View>
            <TouchableOpacity onPress={() => setNoPhone(!noPhone)} style={styles.checkboxRow} activeOpacity={0.7}>
              <Ionicons name={noPhone ? "checkbox" : "square-outline"} size={22} color={noPhone ? "#0B57D0" : "#64748B"} />
              <Text style={styles.checkboxLabel}>Donator is not interested in sharing phone number</Text>
            </TouchableOpacity>

            {/* Donation Amount */}
            <Text style={styles.inputLabel}>Donation Amount (₹) <Text style={styles.asterisk}>*</Text></Text>
            <View style={[styles.inputWrapper, errors.amount && styles.inputError]}>
              <Text style={styles.rupeeIcon}>₹</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={v => set('amount', v)}
                placeholder="Amount in ₹"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Payment Method Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="card-outline" size={16} color="#0B57D0" />
              </View>
              <Text style={styles.cardTitle}>Payment Method</Text>
            </View>

            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => {
                const isActive = form.payment_method === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                    onPress={() => set('payment_method', m.key)}
                    activeOpacity={0.8}
                  >
                    {isActive && (
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={12} color="#0B57D0" />
                      </View>
                    )}
                    <Ionicons 
                      name={m.icon} 
                      size={28} 
                      color={isActive ? "#FFFFFF" : "#0B57D0"} 
                      style={{ marginBottom: 8 }} 
                    />
                    <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.payment_method === 'CHEQUE' && (
              <View style={[styles.inputWrapper, { marginTop: 16 }]}>
                <Ionicons name="document-text-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} value={form.notes} onChangeText={v => set('notes', v)} placeholder="Enter cheque number" placeholderTextColor="#94A3B8" />
              </View>
            )}
            
            {form.payment_method === 'UPI' && (
              <View style={[styles.inputWrapper, { marginTop: 16 }]}>
                <Ionicons name="scan-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} value={form.notes} onChangeText={v => set('notes', v)} placeholder="Enter UPI ref number" placeholderTextColor="#94A3B8" />
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
            onPress={handleSubmit} 
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {loading ? (isEdit ? 'Updating...' : 'Recording...') : (isEdit ? 'Update Donation' : 'Record Donation')}
            </Text>
          </TouchableOpacity>
          
          {!isOnline && (
            <Text style={styles.offlineNote}>You're offline. Donation will be saved and synced automatically.</Text>
          )}

        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#16B978" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Donation Collected!</Text>
            <Text style={styles.modalText}>
              Successfully recorded ₹{successData?.amount} from {successData?.donor_name}.
            </Text>
            {successData?.receipt_number && (
              <Text style={styles.modalText}>Receipt No: {successData?.receipt_number}</Text>
            )}
            
            <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#0B57D0' }]} 
                onPress={() => {
                  setSuccessData(null);
                  navigation.goBack();
                }}
              >
                <Text style={styles.submitButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8FB' },
  
  /* Header */
  header: {
    backgroundColor: '#0B57D0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  scroll: {
    padding: 16,
    paddingBottom: 100, // Make room for waves/bottom
  },

  /* Card Styles */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Input Styles */
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 6,
  },
  asterisk: {
    color: '#EF4444',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  rupeeIcon: {
    fontSize: 18,
    color: '#64748B',
    marginRight: 12,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },

  /* Checkbox Styles */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: -4,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 13,
    color: '#475569',
  },

  /* Payment Methods */
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  methodBtn: {
    flex: 1,
    height: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0B57D0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  methodBtnActive: {
    backgroundColor: '#0B57D0',
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B57D0',
  },
  methodLabelActive: {
    color: '#FFFFFF',
  },

  /* Submit Button */
  submitButton: {
    backgroundColor: '#0B57D0',
    borderRadius: 10,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  offlineNote: { textAlign: 'center', color: '#F59E0B', fontSize: 13, marginTop: 12, lineHeight: 20 },
  
  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  modalText: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 4 },
});

export default CollectDonationScreen;
