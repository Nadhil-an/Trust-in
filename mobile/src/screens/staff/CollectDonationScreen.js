// screens/staff/CollectDonationScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Linking, Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Button, Input, Card } from '../../components/shared';
import { donationApi, membersApi } from '../../api';
import { useOfflineStore } from '../../store/offlineStore';
import Toast from 'react-native-toast-message';
import { isValidPhone, isPositiveNumber } from '../../utils/validators';

const PAYMENT_METHODS = [
  { key: 'CASH', labelKey: 'staff.cash', icon: 'cash' },
  { key: 'UPI', labelKey: 'staff.upi', icon: 'phone-portrait' },
  { key: 'CHEQUE', labelKey: 'staff.cheque', icon: 'document-text' },
];

const CollectDonationScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const { isOnline, addToQueue } = useOfflineStore();
  const [form, setForm] = useState({
    donor_name: editItem?.donor_name || '', phone: editItem?.phone || '', amount: editItem?.amount?.toString() || '',
    payment_method: editItem?.payment_method || 'CASH', notes: editItem?.notes || '', member_id: editItem?.member || '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [foundMember, setFoundMember] = useState(null);
  const [searching, setSearching] = useState(false);
  const [noName, setNoName] = useState(false);
  const [noPhone, setNoPhone] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  const searchMember = async () => {
    if (!memberSearch.trim()) return;
    setSearching(true);
    try {
      const res = await membersApi.search(memberSearch);
      const members = res.data.results || res.data;
      if (members.length > 0) {
        const m = members[0];
        setFoundMember(m);
        set('donor_name', m.full_name);
        set('phone', m.phone || '');
        set('member_id', m.id);
      } else {
        Alert.alert(t('errors.not_found', 'Not Found'), t('errors.search_failed', 'Search failed. Please try again.'));
      }
    } catch (_) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally { setSearching(false); }
  };

  const clearMember = () => { setFoundMember(null); set('donor_name', ''); set('phone', ''); set('member_id', ''); };

  const validate = () => {
    const errs = {};
    if (!noName && !form.donor_name.trim()) errs.donor_name = t('common.required');
    if (!noPhone && form.phone && !isValidPhone(form.phone)) errs.phone = t('errors.invalid_phone_msg', 'Enter a valid 10-digit phone number');
    if (!isPositiveNumber(form.amount)) errs.amount = t('errors.validation', 'Enter a valid positive amount');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const sendWhatsAppReceipt = (donorName, amount, receiptNo, phone) => {
    const msg = `Dear ${donorName},\n\nThank you for your generous donation of ₹${amount} to Sree Lakshmi Charitable Trust.\nReceipt No: ${receiptNo}\n\nMay God bless you! 🙏`;
    const url = `whatsapp://send?phone=91${phone}&text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then(can => {
      if (can) Linking.openURL(url);
    });
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
      phone: noPhone ? null : form.phone,
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? t('staff.edit_donation', 'Edit Donation') : t('staff.donation_collection')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Donor details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>💰 {t('staff.donor_details', 'Donor Details')}</Text>
          <Input
            label={t('staff.donor_name')}
            value={noName ? 'Anonymous' : form.donor_name}
            onChangeText={v => set('donor_name', v)}
            placeholder={t('staff.full_name_placeholder', 'Full name of donor')}
            required={!noName}
            error={errors.donor_name}
            disabled={noName}
          />
          <TouchableOpacity onPress={() => setNoName(!noName)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name={noName ? "checkbox" : "square-outline"} size={20} color={Colors.primary} />
            <Text style={{ marginLeft: 8, color: Colors.gray700 }}>{t('staff.no_name_interest', 'Donator is not interested in sharing name')}</Text>
          </TouchableOpacity>
          <Input
            label={t('staff.phone_whatsapp', 'Phone (for WhatsApp receipt)')}
            value={noPhone ? t('staff.not_provided', 'Not provided') : form.phone}
            onChangeText={v => set('phone', v)}
            type="phone"
            placeholder={t('staff.phone_placeholder', '10-digit number')}
            disabled={noPhone}
            maxLength={10}
            keyboardType="numeric"
            error={errors.phone}
          />
          <TouchableOpacity onPress={() => setNoPhone(!noPhone)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name={noPhone ? "checkbox" : "square-outline"} size={20} color={Colors.primary} />
            <Text style={{ marginLeft: 8, color: Colors.gray700 }}>{t('staff.no_phone_interest', 'Donator is not interested in sharing phone number')}</Text>
          </TouchableOpacity>
          <Input
            label={t('staff.donation_amount')}
            value={form.amount}
            onChangeText={v => set('amount', v)}
            type="number"
            placeholder={t('staff.amount_placeholder', 'Amount in ₹')}
            required
            error={errors.amount}
            leftIcon={<Text style={styles.rupee}>₹</Text>}
          />
        </Card>

        {/* Payment method */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('staff.payment_method')}</Text>
          <View style={styles.methodRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodBtn, form.payment_method === m.key && styles.methodActive]}
                onPress={() => set('payment_method', m.key)}
              >
                <Ionicons name={m.icon} size={22} color={form.payment_method === m.key ? Colors.white : Colors.primary} />
                <Text style={[styles.methodLabel, form.payment_method === m.key && styles.methodLabelActive]}>{t(m.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.payment_method === 'CHEQUE' && (
            <Input label={t('staff.cheque_number', 'Cheque Number')} value={form.notes} onChangeText={v => set('notes', v)} placeholder={t('staff.enter_cheque', 'Enter cheque number')} />
          )}
          {form.payment_method === 'UPI' && (
            <View style={{alignItems: 'center', marginTop: 10}}>
              <View style={{width: 200, height: 200, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}>
                <Ionicons name="qr-code-outline" size={120} color={Colors.gray800} />
                <Text style={{color: Colors.gray600, marginTop: 4, fontWeight: '600'}}>{t('staff.scan_pay', 'Scan to Pay')}</Text>
              </View>
              <View style={{width: '100%'}}>
                <Input label={t('staff.upi_txn_id', 'UPI Transaction ID')} value={form.notes} onChangeText={v => set('notes', v)} placeholder={t('staff.enter_upi', 'Enter UPI ref number')} />
              </View>
            </View>
          )}
        </Card>

        <Button title={loading ? (isEdit ? t('staff.updating', 'Updating...') : t('staff.recording', 'Recording...')) : (isEdit ? t('staff.update_donation', 'Update Donation') : t('staff.record_donation', 'Record Donation'))} onPress={handleSubmit} loading={loading} size="lg" variant="success" />
        {!isOnline && (
          <Text style={styles.offlineNote}>{t('staff.offline_note', '📴 You\'re offline. Donation will be saved and synced automatically.')}</Text>
        )}
      </ScrollView>

      <Modal visible={!!successData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color={Colors.success} style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>{t('staff.donation_collected', 'Donation Collected!')}</Text>
            <Text style={styles.modalText}>
              {t('staff.recorded_success', 'Successfully recorded ₹{{amount}} from {{name}}.', { amount: successData?.amount, name: successData?.donor_name })}
            </Text>
            {successData?.receipt_number && (
              <Text style={styles.modalText}>{t('staff.receipt_no', 'Receipt No: {{receipt}}', { receipt: successData?.receipt_number })}</Text>
            )}
            
            <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
              {successData?.phone && !successData?.noPhone && (
                <Button 
                  title={t('staff.send_whatsapp', 'Send WhatsApp Receipt')} 
                  icon={<Ionicons name="logo-whatsapp" size={20} color={Colors.white} />}
                  onPress={() => {
                    sendWhatsAppReceipt(successData.donor_name, successData.amount, successData.receipt_number, successData.phone);
                    setSuccessData(null);
                    navigation.goBack();
                  }}
                  variant="primary"
                  style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
                />
              )}
              <Button 
                title={t('common.done', 'Done')} 
                variant="outline"
                onPress={() => {
                  setSuccessData(null);
                  navigation.goBack();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.success, flexDirection: 'row',
    alignItems: 'center', gap: 12, paddingTop: 50,
    paddingBottom: 14, paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  scroll: { padding: 16, gap: 12 },
  section: { padding: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  searchInput: { flex: 1, marginBottom: 0 },
  searchBtn: {
    width: 46, height: 50, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  memberFound: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.successLight, borderRadius: 10, padding: 12,
  },
  memberInfo: {},
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.success },
  memberId: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodBtn: {
    flex: 1, alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    gap: 6,
  },
  methodActive: { backgroundColor: Colors.primary },
  methodLabel: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  methodLabelActive: { color: Colors.white },
  rupee: { fontSize: 18, color: Colors.gray500, fontWeight: '600' },
  offlineNote: { textAlign: 'center', color: Colors.warning, fontSize: 13, marginTop: 12, lineHeight: 20 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  modalText: { fontSize: 15, color: Colors.gray600, textAlign: 'center', marginBottom: 4 },
});

export default CollectDonationScreen;
