// screens/staff/CollectDonationScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Linking, Modal, TextInput, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { donationApi, membersApi, staffApi, notifyApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useOfflineStore } from '../../store/offlineStore';
import Toast from 'react-native-toast-message';
import { isValidPhone, isPositiveNumber } from '../../utils/validators';
import { verifyAttendanceMarked } from '../../utils/attendanceGuard';

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: 'cash-outline', isImage: true },
  { key: 'UPI', label: 'Online', icon: 'phone-portrait-outline', isImage: true },
  { key: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
];

const CollectDonationScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const { isOnline, addToQueue } = useOfflineStore();
  const insets = useSafeAreaInsets();
  
  const [form, setForm] = useState({
    donor_name: editItem?.donor_name || '', phone: editItem?.donor_phone || editItem?.phone || '', amount: editItem?.amount?.toString() || '',
    payment_method: editItem?.payment_method || 'CASH', notes: editItem?.notes || '', member_id: editItem?.member || '',
    voucher_id: editItem?.reference_number || editItem?.receipt_number || '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [noName, setNoName] = useState(false);
  const [noPhone, setNoPhone] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [receiptImageUri, setReceiptImageUri] = useState(null);
  
  const user = useAuthStore(s => s.user);
  const [voucher, setVoucher] = useState(null);
  // null = not checked, true = has WA, false = no WA, 'checking' = in progress
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const whatsappTimer = useRef(null);

  // Check attendance on screen load
  useEffect(() => {
    verifyAttendanceMarked(navigation, 'collect donations').then(isMarked => {
      if (!isMarked) {
        navigation.goBack();
      }
    });
  }, [navigation]);

  React.useEffect(() => {
    if (user?.id) {
      staffApi.vouchers.get(user.id)
        .then(res => {
          setVoucher(res.data);
          if (!isEdit) {
            set('voucher_id', String(res.data.current_voucher));
          }
        })
        .catch(err => console.log('No voucher assigned or offline', err));
    }
  }, [user?.id]);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  // Silent background WhatsApp check — debounced 1.5s after user stops typing
  // Status: null (not checked) | 'checking' | true (has WA) | false (no WA) | 'unverified' (gateway offline)
  useEffect(() => {
    if (noPhone || !form.phone || form.phone.length < 10) {
      setWhatsappStatus(null);
      return;
    }
    setWhatsappStatus('checking');
    clearTimeout(whatsappTimer.current);
    whatsappTimer.current = setTimeout(async () => {
      try {
        const res = await notifyApi.checkWhatsapp(form.phone);
        const status = res.data?.has_whatsapp;
        if (status === true) {
          setWhatsappStatus(true);       // confirmed has WhatsApp
        } else if (status === false) {
          setWhatsappStatus(false);      // confirmed no WhatsApp
        } else {
          setWhatsappStatus('unverified'); // gateway offline — cannot confirm
        }
      } catch {
        setWhatsappStatus('unverified'); // network error — cannot confirm
      }
    }, 1500);
    return () => clearTimeout(whatsappTimer.current);
  }, [form.phone, noPhone]);

  const validate = () => {
    const errs = {};
    if (!noName && !form.donor_name.trim()) errs.donor_name = t('common.required');
    if (!noPhone && form.phone && !isValidPhone(form.phone)) errs.phone = t('errors.invalid_phone_msg', 'Enter a valid 10-digit phone number');
    if (!isPositiveNumber(form.amount)) errs.amount = t('errors.validation', 'Enter a valid positive amount');
    // Photo required if: no phone OR no WhatsApp OR WhatsApp could not be verified
    const needsPhoto = noPhone || whatsappStatus === false || whatsappStatus === 'unverified';
    if (needsPhoto && !receiptImageUri) errs.receiptImage = 'Photo of receipt is required when WhatsApp receipt cannot be sent';
    setErrors(errs);
    if (errs.receiptImage) {
      Alert.alert('Receipt Photo Required', 'This donor cannot receive a WhatsApp receipt. Please take a photo of the written receipt before submitting.');
    }
    return Object.keys(errs).length === 0;
  };

  const captureReceipt = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'You need to grant camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceiptImageUri(result.assets[0].uri);
    }
  };

  const hasVoucherAssigned = voucher && Number(voucher.book_number) > 0 && Number(voucher.current_voucher) > 0;

  const handleSubmit = async () => {
    const isAttendanceOk = await verifyAttendanceMarked(navigation, 'collect donations');
    if (!isAttendanceOk) return;
    if (!hasVoucherAssigned && !isEdit) {
      Alert.alert(
        'Voucher Book Not Assigned',
        'You cannot collect donations until HR/Admin assigns a voucher book to your account. Please contact the office to get a voucher book assigned.'
      );
      return;
    }

    if (!validate()) return;
    setLoading(true);
    const data = {
      donor_name: noName ? 'Anonymous' : form.donor_name,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      purpose: form.notes,
      source: 'DONATION',
      donor_phone: noPhone ? null : form.phone,
      reference_number: form.voucher_id || form.notes,
    };
    if (receiptImageUri) {
      data.document_uri = receiptImageUri;
    }

    try {
      // ── Day-closed guard removed to allow rollover to next day ───────────────────────────────────────

      if (!isOnline && !isEdit) {
        await addToQueue({ method: 'POST', url: '/mobile/donations/', data });
        
        // Optimistically advance local voucher counter so next offline receipt uses next sequential number
        const currentNum = Number(form.voucher_id || voucher?.current_voucher || 0);
        if (voucher) {
          setVoucher(v => ({ ...v, current_voucher: currentNum + 1 }));
        }

        setSuccessData({
          receipt_number: form.voucher_id || (currentNum ? String(currentNum) : 'OFFLINE-QUEUED'),
          donor_name: data.donor_name,
          amount: data.amount,
          phone: form.phone,
          noPhone: noPhone,
          isOffline: true
        });
        return;
      }
      
      let sendData = data;
      if (receiptImageUri) {
        sendData = new FormData();
        Object.keys(data).forEach(key => {
          if (key === 'document_uri') {
            const docName = data.document_uri.split('/').pop() || 'receipt.jpg';
            sendData.append('document', { uri: data.document_uri, type: 'image/jpeg', name: docName });
          } else if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
            sendData.append(key, data[key]);
          }
        });
      }

      if (isEdit) {
        await donationApi.update(editItem.id, sendData);
        Toast.show({ type: 'success', text1: t('staff.donation_recorded', 'Donation Updated!') });
        navigation.goBack();
      } else {
        const res = await donationApi.create(sendData);
        if (voucher && user?.id) {
          await staffApi.vouchers.increment(user.id).catch(() => {});
        }
        setSuccessData({
          receipt_number: res.data.reference_number || res.data.receipt_number,
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
        <Text style={styles.headerTitle}>{isEdit ? t('staff.edit_donation') : t('staff.donation_collection')}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {!hasVoucherAssigned ? (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FCA5A5',
              borderLeftWidth: 5,
              borderLeftColor: '#EF4444',
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <Ionicons name="warning" size={24} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#991B1B', marginBottom: 4 }}>
                  No Voucher Book Assigned!
                </Text>
                <Text style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 18 }}>
                  You have not been assigned a voucher book by HR/Admin. Please contact the office to assign a voucher book to your account before collecting donations.
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' }}>
              <View style={{ backgroundColor: '#4338CA', padding: 8, borderRadius: 8, marginRight: 12 }}>
                <Ionicons name="ticket" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 12, color: '#4338CA', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>Voucher ID (Book {voucher.book_number})</Text>
                  <TextInput
                    style={{ fontSize: 20, color: '#312E81', fontWeight: '900', padding: 0, margin: 0 }}
                    value={form.voucher_id}
                    onChangeText={v => set('voucher_id', v)}
                    keyboardType="numeric"
                    placeholder={t('staff.amount_placeholder')}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Donor details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="cash-outline" size={16} color="#0B57D0" />
              </View>
              <Text style={styles.cardTitle}>{t('staff.donor_details')}</Text>
            </View>

            {/* Donor's Name */}
            <Text style={styles.inputLabel}>{t('staff.donor_name')} <Text style={styles.asterisk}>*</Text></Text>
            <View style={[styles.inputWrapper, errors.donor_name && styles.inputError]}>
              <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={noName ? 'Anonymous' : form.donor_name}
                onChangeText={v => set('donor_name', v)}
                placeholder={t('staff.full_name_placeholder')}
                placeholderTextColor="#94A3B8"
                editable={!noName}
              />
            </View>
            {errors.donor_name ? <Text style={styles.errorText}>{errors.donor_name}</Text> : null}
            <TouchableOpacity style={styles.checkboxRow} onPress={() => { setNoName(!noName); if (!noName) set('donor_name', ''); }}>
              <Ionicons name={noName ? "checkbox" : "square-outline"} size={20} color={noName ? "#0B57D0" : "#94A3B8"} />
              <Text style={styles.checkboxLabel}>{t('staff.no_name_interest')}</Text>
            </TouchableOpacity>

            {/* Phone Number */}
            <Text style={styles.inputLabel}>{t('staff.phone_whatsapp')}</Text>
            <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={noPhone ? '' : form.phone}
                onChangeText={v => set('phone', v)}
                placeholder={t('staff.phone_placeholder')}
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={10}
                editable={!noPhone}
              />
              {/* WhatsApp status badge — appears inline after 10 digits */}
              {!noPhone && form.phone.length === 10 && (
                whatsappStatus === 'checking' ? (
                  <Text style={{ fontSize: 11, color: '#6B7280', marginRight: 8 }}>Checking...</Text>
                ) : whatsappStatus === true ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <Ionicons name="logo-whatsapp" size={16} color="#22C55E" />
                    <Text style={{ fontSize: 11, color: '#16A34A', marginLeft: 3 }}>WhatsApp ✓</Text>
                  </View>
                ) : whatsappStatus === false ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <Ionicons name="warning-outline" size={16} color="#EF4444" />
                    <Text style={{ fontSize: 11, color: '#DC2626', marginLeft: 3 }}>No WhatsApp</Text>
                  </View>
                ) : whatsappStatus === 'unverified' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <Ionicons name="help-circle-outline" size={16} color="#D97706" />
                    <Text style={{ fontSize: 11, color: '#B45309', marginLeft: 3 }}>Unverified</Text>
                  </View>
                ) : null
              )}
            </View>
            {/* Warning text below phone field */}
            {!noPhone && whatsappStatus === false && (
              <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 4, marginLeft: 4 }}>
                ⚠️ This number is not registered on WhatsApp. A receipt photo is required.
              </Text>
            )}
            {!noPhone && whatsappStatus === 'unverified' && (
              <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4, marginLeft: 4 }}>
                ⚠️ WhatsApp status could not be verified. Please capture a receipt photo as proof.
              </Text>
            )}
            <TouchableOpacity onPress={() => { setNoPhone(!noPhone); if (!noPhone) set('phone', ''); setWhatsappStatus(null); }} style={styles.checkboxRow} activeOpacity={0.7}>
              <Ionicons name={noPhone ? "checkbox" : "square-outline"} size={22} color={noPhone ? "#0B57D0" : "#64748B"} />
              <Text style={styles.checkboxLabel}>{t('staff.no_phone_interest')}</Text>
            </TouchableOpacity>

            {/* Receipt photo panel — shown when no phone OR no WhatsApp OR unverified */}
            {(noPhone || whatsappStatus === false || whatsappStatus === 'unverified') && (
              <View style={{ marginTop: 10, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ fontSize: 13, color: '#991B1B', marginBottom: 10, fontWeight: '600' }}>
                  {noPhone
                    ? '⚠️ Phone number omitted. Please capture a photo of the written receipt.'
                    : whatsappStatus === 'unverified'
                      ? '⚠️ WhatsApp status unconfirmed. Please capture a receipt photo as proof.'
                      : '⚠️ No WhatsApp on this number. Please capture a photo of the written receipt.'}
                </Text>
                {receiptImageUri ? (
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: receiptImageUri }} style={{ width: '100%', height: 150, borderRadius: 8 }} />
                    <TouchableOpacity onPress={() => setReceiptImageUri(null)} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 15, padding: 4 }}>
                      <Ionicons name="close" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={captureReceipt} style={{ backgroundColor: '#EF4444', padding: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                    <Ionicons name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Take Receipt Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Donation Amount */}
            <Text style={styles.inputLabel}>{t('staff.donation_amount')} <Text style={styles.asterisk}>*</Text></Text>
            <View style={[styles.inputWrapper, errors.amount && styles.inputError]}>
              <Text style={styles.rupeeIcon}>₹</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={v => set('amount', v)}
                placeholder={t('staff.amount_placeholder')}
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
            <View style={styles.quickAmounts}>
              {[10, 20, 50, 100, 500].map(amt => {
                const isActive = form.amount === amt.toString();
                return (
                  <TouchableOpacity 
                    key={amt} 
                    style={[styles.quickAmountBtn, isActive && styles.quickAmountBtnActive]}
                    onPress={() => { set('amount', amt.toString()); setErrors(e => ({...e, amount: ''})); }}
                  >
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.quickAmountText, isActive && styles.quickAmountTextActive]}>₹{amt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Payment Method Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="card-outline" size={16} color="#0B57D0" />
              </View>
              <Text style={styles.cardTitle}>{t('staff.payment_method')}</Text>
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
                    {m.isImage ? (
                      <Image 
                        source={m.key === 'CASH' ? require('../../../assets/cash.png') : require('../../../assets/gpay.png')} 
                        style={{ 
                          width: m.key === 'CASH' ? 60 : 54, 
                          height: m.key === 'CASH' ? 60 : 32, 
                          marginBottom: 4, 
                          borderRadius: m.key === 'CASH' ? 12 : 0 
                        }} 
                        resizeMode="contain" 
                      />
                    ) : (
                      <Ionicons 
                        name={m.icon} 
                        size={28} 
                        color={isActive ? "#FFFFFF" : "#0B57D0"} 
                        style={{ marginBottom: 8 }} 
                      />
                    )}
                    <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>
                      {t(`staff.${m.key.toLowerCase()}`, m.label)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.payment_method === 'CHEQUE' && (
              <View style={[styles.inputWrapper, { marginTop: 16 }]}>
                <Ionicons name="document-text-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} value={form.notes} onChangeText={v => set('notes', v)} placeholder={t('staff.enter_cheque')} placeholderTextColor="#94A3B8" />
              </View>
            )}
            
            {form.payment_method === 'UPI' && (
              <View style={[styles.inputWrapper, { marginTop: 16 }]}>
                <Ionicons name="scan-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput style={styles.input} value={form.notes} onChangeText={v => set('notes', v)} placeholder={t('staff.enter_upi')} placeholderTextColor="#94A3B8" />
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, (!hasVoucherAssigned || loading) && styles.submitButtonDisabled]} 
            onPress={handleSubmit} 
            disabled={!hasVoucherAssigned && !isEdit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {!hasVoucherAssigned && !isEdit ? 'Voucher Book Required' : (loading ? (isEdit ? t('staff.updating') : t('staff.recording')) : (isEdit ? t('staff.update_donation') : t('staff.record_donation')))}
            </Text>
          </TouchableOpacity>
          
          {!isOnline && (
            <Text style={styles.offlineNote}>{t('staff.offline_note')}</Text>
          )}

        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#16B978" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>{t('staff.donation_collected', 'Donation Collected!')}</Text>
            <Text style={styles.modalText}>
              {t('staff.success_recorded_amount', 'Successfully recorded ₹{{amount}} from {{donor_name}}.', { amount: successData?.amount, donor_name: successData?.donor_name })}
            </Text>
            {successData?.receipt_number && (
              <Text style={styles.modalText}>{t('staff.voucher_id', 'Voucher ID')}: {successData?.receipt_number}</Text>
            )}
            
            {successData?.isOffline && (
              <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#FCD34D', width: '100%' }}>
                <Text style={{ fontSize: 12, color: '#92400E', textAlign: 'center', fontWeight: '700' }}>
                  ⚡ Saved Offline in Device Queue
                </Text>
                <Text style={{ fontSize: 11, color: '#B45309', textAlign: 'center', marginTop: 2 }}>
                  Will auto-sync to all users & dashboards once internet reconnects.
                </Text>
              </View>
            )}
            
            <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#0B57D0' }]} 
                onPress={() => {
                  setSuccessData(null);
                  navigation.goBack();
                }}
              >
                <Text style={styles.submitButtonText}>{t('common.done')}</Text>
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

  /* Quick Amounts */
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  quickAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAmountBtnActive: {
    backgroundColor: '#0B57D0',
    borderColor: '#0B57D0',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
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
