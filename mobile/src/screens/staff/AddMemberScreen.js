// screens/staff/AddMemberScreen.js — Step-by-step wizard
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image, Linking, Modal
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { isValidPhone, isValidEmail } from '../../utils/validators';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Button, Input, PhotoPicker } from '../../components/shared';
import { membersApi } from '../../api';
import Toast from 'react-native-toast-message';

const MEMBER_TYPES = [
  { key: 'General', labelKey: 'staff.member_types.general' },
  { key: 'Donor', labelKey: 'staff.member_types.donor' },
  { key: 'Volunteer', labelKey: 'staff.member_types.volunteer' },
  { key: 'Beneficiary', labelKey: 'staff.member_types.beneficiary' },
  { key: 'Life Member', labelKey: 'staff.member_types.life' },
  { key: 'Honorary', labelKey: 'staff.member_types.honorary' }
];
const GENDER_OPTIONS = [
  { key: 'Male', labelKey: 'common.male' },
  { key: 'Female', labelKey: 'common.female' },
  { key: 'Other', labelKey: 'common.other' }
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ID_TYPES = [
  { key: 'Aadhaar Card', labelKey: 'staff.id_types.aadhaar' },
  { key: 'Voter ID', labelKey: 'staff.id_types.voter' },
  { key: 'Passport', labelKey: 'staff.id_types.passport' },
  { key: 'Driving Licence', labelKey: 'staff.id_types.driving' },
  { key: 'PAN Card', labelKey: 'staff.id_types.pan' },
  { key: 'Ration Card', labelKey: 'staff.id_types.ration' }
];

const StepDots = ({ total, current }) => (
  <View style={styles.dots}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={[styles.dot, i === current && styles.dotActive, i < current && styles.dotDone]} />
    ))}
  </View>
);

const AddMemberScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [idPhotos, setIdPhotos] = useState([]);
  const [form, setForm] = useState({
    full_name: editItem?.full_name || '', phone: editItem?.phone || '', email: editItem?.email || '',
    age: editItem?.age?.toString() || '', gender: editItem?.gender || 'Male',
    address: editItem?.address || '', district: editItem?.district || '', state: editItem?.state || 'Kerala', pincode: editItem?.pincode || '',
    membership_type: editItem?.membership_type || 'General', blood_group: editItem?.blood_group || '',
    id_type: editItem?.id_type || 'Aadhaar Card', id_number: editItem?.id_number || '',
    payment_mode: editItem?.payment_mode || 'Cash', transaction_id: editItem?.transaction_id || '',
    temp_password: '',
  });
  const [errors, setErrors] = useState({});
  const [successData, setSuccessData] = useState(null);

  React.useEffect(() => {
    if (editItem) {
      setForm({
        full_name: editItem.full_name || '', phone: editItem.phone || '', email: editItem.email || '',
        age: editItem.age?.toString() || '', gender: editItem.gender || 'Male',
        address: editItem.address || '', district: editItem.district || '', state: editItem.state || 'Kerala', pincode: editItem.pincode || '',
        membership_type: editItem.membership_type || 'General', blood_group: editItem.blood_group || '',
        id_type: editItem.id_type || 'Aadhaar Card', id_number: editItem.id_number || '',
        payment_mode: editItem.payment_mode || 'Cash', transaction_id: editItem.transaction_id || '',
        temp_password: '',
      });
    }
  }, [editItem]);

  const TOTAL_STEPS = 6;

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.full_name.trim()) errs.full_name = t('common.required');
      if (!form.phone.trim()) errs.phone = t('common.required');
      else if (!isValidPhone(form.phone)) errs.phone = t('errors.invalid_phone_msg', 'Enter a valid 10-digit phone number');
      if (form.email && !isValidEmail(form.email)) errs.email = t('errors.invalid_email', 'Enter a valid email address');
    }
    if (step === 1) {
      if (!form.age) errs.age = t('common.required');
    }
    if (step === 2) {
      if (!form.address.trim()) errs.address = t('common.required');
    }
    if (step === 4) {
      if (form.payment_mode === 'UPI' && !form.transaction_id.trim()) errs.transaction_id = t('errors.req_txn_id', 'Please enter transaction ID');
    }
    if (step === 5 && !isEdit) {
      if (!form.temp_password || form.temp_password.length < 6) errs.temp_password = t('errors.pass_min_6', 'Password must be at least 6 characters');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();

      const genderMap = { 'Male': 'MALE', 'Female': 'FEMALE', 'Other': 'OTHER' };
      const membershipMap = {
        'General': 'GENERAL',
        'Life Member': 'LIFE',
        'Honorary': 'HONORARY',
        'Patron': 'PATRON',
        'Donor': 'GENERAL',
        'Volunteer': 'GENERAL',
        'Beneficiary': 'GENERAL',
      };

      Object.keys(form).forEach(key => {
        // Exclude fields that are empty or not in the model
        if (form[key] !== '' && form[key] !== null && key !== 'id_type' && key !== 'id_number' && key !== 'temp_password' && key !== 'age' && key !== 'payment_mode' && key !== 'transaction_id') {
          let value = form[key];
          if (key === 'gender') value = genderMap[value] || value;
          if (key === 'membership_type') value = membershipMap[value] || 'GENERAL';
          formData.append(key, value);
        }
      });

      // Append payment details to formData if collected
      if (form.payment_mode) formData.append('payment_mode', form.payment_mode);
      if (form.payment_mode === 'UPI' && form.transaction_id) formData.append('transaction_id', form.transaction_id);

      // Calculate approximate date of birth from age if provided
      if (form.age) {
        const currentYear = new Date().getFullYear();
        const dobYear = currentYear - parseInt(form.age, 10);
        formData.append('date_of_birth', `${dobYear}-01-01`);
      }

      if (photos.length > 0) {
        formData.append('photo', { uri: photos[0].uri, type: 'image/jpeg', name: 'photo.jpg' });
      }

      if (isEdit) {
        await membersApi.update(editItem.id, formData);
        Toast.show({ type: 'success', text1: t('staff.update_member', 'Member Updated!') });
        navigation.goBack();
      } else {
        const res = await membersApi.create(formData);
        setSuccessData({
          member_id: res.data.member_id,
          password: form.temp_password,
          name: form.full_name,
          phone: form.phone
        });
      }
    } catch (err) {
      let msg = err.response?.data?.detail;
      if (!msg && err.response?.data && typeof err.response.data === 'object') {
        const firstKey = Object.keys(err.response.data)[0];
        const val = err.response.data[firstKey];
        msg = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
      }
      Alert.alert('Error', msg || t('common.error'));
    } finally { setLoading(false); }
  };

  const SelectChip = ({ options, selected, onSelect, isObject }) => (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const key = isObject ? opt.key : opt;
        const label = isObject ? t(opt.labelKey) : opt;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, selected === key && styles.chipActive]}
            onPress={() => onSelect(key)}
          >
            <Text style={[styles.chipText, selected === key && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.stepTitle}>👤 {t('staff.personal_info')}</Text>
            <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={1} />
            <Input label={t('common.name')} value={form.full_name} onChangeText={v => set('full_name', v)} placeholder={t('staff.full_name_placeholder', 'Full name')} required error={errors.full_name} />
            <Input label={t('common.phone')} value={form.phone} onChangeText={v => set('phone', v)} type="phone" placeholder={t('staff.mobile_placeholder', '10-digit mobile number')} required error={errors.phone} maxLength={10} keyboardType="numeric" />
            <Input label={t('common.email')} value={form.email} onChangeText={v => set('email', v)} type="email" placeholder={t('staff.email_placeholder', 'Email address (optional)')} />
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>🪪 {t('staff.contact_info')}</Text>
            <Input label={t('common.age')} value={form.age} onChangeText={v => set('age', v)} type="number" placeholder={t('common.age')} required error={errors.age} />
            <Text style={styles.fieldLabel}>{t('common.gender')}</Text>
            <SelectChip options={GENDER_OPTIONS} selected={form.gender} onSelect={v => set('gender', v)} isObject={true} />
            <Text style={styles.fieldLabel}>{t('staff.blood_group', 'Blood Group')}</Text>
            <SelectChip options={BLOOD_GROUPS} selected={form.blood_group} onSelect={v => set('blood_group', v)} />
            <Text style={styles.fieldLabel}>{t('staff.member_type')}</Text>
            <SelectChip options={MEMBER_TYPES} selected={form.membership_type} onSelect={v => set('membership_type', v)} isObject={true} />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>🏠 {t('staff.address_info')}</Text>
            <Input label={t('common.address')} value={form.address} onChangeText={v => set('address', v)} type="multiline" placeholder={t('staff.house_no', 'House no., street, area')} required error={errors.address} />
            <Input label={t('staff.district', 'District')} value={form.district} onChangeText={v => set('district', v)} placeholder={t('staff.district', 'District')} />
            <Input label={t('staff.state', 'State')} value={form.state} onChangeText={v => set('state', v)} placeholder={t('staff.state', 'State')} />
            <Input label={t('staff.pincode', 'Pincode')} value={form.pincode} onChangeText={v => set('pincode', v)} type="number" placeholder={t('staff.pincode_placeholder', '6-digit pincode')} maxLength={6} />
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>📋 {t('staff.id_proof')}</Text>
            <Text style={styles.fieldLabel}>{t('staff.id_type', 'ID Type')}</Text>
            <SelectChip options={ID_TYPES} selected={form.id_type} onSelect={v => set('id_type', v)} isObject={true} />
            <Input label={t('staff.id_type', 'ID Type')} value={form.id_number} onChangeText={v => set('id_number', v)} placeholder={t('staff.enter_id', 'Enter ID number')} />
            <Text style={styles.fieldLabel}>{t('staff.upload_id_photo', 'Upload ID Photo (optional)')}</Text>
            <PhotoPicker photos={idPhotos} onPhotosChange={setIdPhotos} maxPhotos={1} />
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.stepTitle}>💳 {t('staff.payment_collection', 'Payment Collection')}</Text>
            <View style={{ backgroundColor: Colors.primaryLight, padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4 }}>{t('staff.registration_fee', 'Registration Fee')}</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>₹100</Text>
            </View>
            <Text style={styles.fieldLabel}>{t('staff.payment_method')}</Text>
            <View style={styles.paymentCardRow}>
              <TouchableOpacity
                style={[styles.paymentCard, form.payment_mode === 'Cash' && styles.paymentCardActive]}
                onPress={() => set('payment_mode', 'Cash')}
              >
                <Ionicons name="cash-outline" size={40} color={form.payment_mode === 'Cash' ? Colors.primary : Colors.gray500} />
                <Text style={[styles.paymentCardText, form.payment_mode === 'Cash' && styles.paymentCardTextActive]}>{t('staff.cash')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, form.payment_mode === 'UPI' && styles.paymentCardActive]}
                onPress={() => set('payment_mode', 'UPI')}
              >
                <Ionicons name="qr-code-outline" size={40} color={form.payment_mode === 'UPI' ? Colors.primary : Colors.gray500} />
                <Text style={[styles.paymentCardText, form.payment_mode === 'UPI' && styles.paymentCardTextActive]}>{t('staff.upi')}</Text>
              </TouchableOpacity>
            </View>

            {form.payment_mode === 'UPI' && (
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <View style={{ width: 200, height: 200, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="qr-code-outline" size={120} color={Colors.gray800} />
                  <Text style={{ color: Colors.gray600, marginTop: 4, fontWeight: '600' }}>{t('staff.scan_pay', 'Scan to Pay')}</Text>
                </View>
                <View style={{ width: '100%' }}>
                  <Input label={t('staff.txn_id', 'Transaction ID')} value={form.transaction_id} onChangeText={v => set('transaction_id', v)} placeholder={t('staff.enter_upi_txn', 'Enter UPI Transaction ID')} required error={errors.transaction_id} />
                </View>
              </View>
            )}
          </>
        );
      case 5:
        return (
          <>
            <Text style={styles.stepTitle}>🔐 {t('staff.temp_password')} & {t('staff.summary', 'Summary')}</Text>
            {isEdit ? (
              <Text style={styles.info}>{t('staff.leave_blank_pass', 'Leave blank to keep the current password.')}</Text>
            ) : (
              <Text style={styles.info}>{t('staff.set_temp_pass', 'Set or generate a temporary password. The member will use this to log in.')}</Text>
            )}

            {!isEdit && (
              <Button
                title={t('staff.generate_pass', 'Generate Random Password')}
                variant="outline"
                style={{ marginBottom: 16 }}
                onPress={() => {
                  const randomPass = Math.random().toString(36).slice(-6).toUpperCase();
                  set('temp_password', randomPass);
                }}
              />
            )}
            <Input label={t('staff.temp_password')} value={form.temp_password} onChangeText={v => set('temp_password', v)} type="password" placeholder={t('staff.min_6_chars', 'Min. 6 characters')} required={!isEdit} error={errors.temp_password} />

            {/* Review summary */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.summaryTitle}>{t('staff.review_summary', 'Review Summary')}</Text>
                <TouchableOpacity onPress={() => setStep(0)}>
                  <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 14 }}>{t('staff.edit_details', 'Edit Details')}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 8 }}>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('common.name')}:</Text><Text style={styles.summaryVal}>{form.full_name || '-'}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('common.phone')}:</Text><Text style={styles.summaryVal}>{form.phone || '-'}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('common.email')}:</Text><Text style={styles.summaryVal}>{form.email || '-'}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('common.age')}/{t('common.gender')}:</Text><Text style={styles.summaryVal}>{form.age || '-'} / {t(`common.${form.gender.toLowerCase()}`, form.gender)}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('staff.blood_group', 'Blood Group')}:</Text><Text style={styles.summaryVal}>{form.blood_group || '-'}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('staff.member_type')}:</Text><Text style={styles.summaryVal}>{form.membership_type}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('common.address')}:</Text><Text style={styles.summaryVal}>{form.address || '-'}, {form.district}, {form.state} {form.pincode}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('staff.id_type', 'ID Type')}:</Text><Text style={styles.summaryVal}>{form.id_type || '-'}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.summaryKey}>{t('staff.id_type', 'ID Number')}:</Text><Text style={styles.summaryVal}>{form.id_number || '-'}</Text></View>
              </View>
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.gray300 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  {t('staff.payment_method')}: <Text style={{ color: Colors.success }}>₹100 ({t(`staff.${form.payment_mode.toLowerCase()}`, form.payment_mode)})</Text>
                </Text>
              </View>
            </View>
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Progress header */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>{isEdit ? t('staff.edit_member', 'Edit Member') : t('staff.member_registration')}</Text>
          <Text style={styles.progressStep}>{t('staff.step')} {step + 1} {t('staff.of')} {TOTAL_STEPS}</Text>
        </View>
        <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <StepDots total={TOTAL_STEPS} current={step} />
        <View style={styles.content}>{renderStep()}</View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Button title={t('common.back')} onPress={() => setStep(s => s - 1)} variant="outline" style={styles.footerBtn} />
        )}
        <Button
          title={step === TOTAL_STEPS - 1 ? (isEdit ? t('staff.update_member', 'Update Member') : t('staff.register_member', 'Register Member')) : t('common.next')}
          onPress={nextStep}
          loading={loading}
          style={styles.footerBtn}
          variant={step === TOTAL_STEPS - 1 ? 'success' : 'primary'}
        />
      </View>

      {/* Success Modal */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="checkmark-circle" size={50} color={Colors.success} />
            </View>
            <Text style={styles.modalTitle}>{t('staff.member_registered_title', 'Member Registered!')}</Text>
            <Text style={styles.modalSub}>{t('staff.member_registered_sub', 'Member added! Registration details sent to member via Trust WhatsApp.')}</Text>

            <View style={styles.credentialsBox}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>{t('member.member_id', 'Member ID')}</Text>
                <Text style={styles.credValue}>{successData?.member_id}</Text>
              </View>
              <View style={styles.credDivider} />
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>{t('auth.password', 'Password')}</Text>
                <Text style={styles.credValue}>{successData?.password}</Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <Button
                title={t('staff.copy_details', 'Copy Details')}
                icon={<Ionicons name="copy-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />}
                style={styles.copyBtn}
                variant="outline"
                onPress={async () => {
                  const msg = `Member ID: ${successData?.member_id}\nPassword: ${successData?.password}`;
                  await Clipboard.setStringAsync(msg);
                  Toast.show({ type: 'success', text1: t('staff.copied_clipboard', 'Copied to clipboard!') });
                }}
              />
              <Button
                title={t('common.done', 'Done')}
                style={styles.shareBtn}
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
  progressBar: {
    backgroundColor: Colors.primary, paddingTop: 50,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute', bottom: 0, left: 0,
    height: 4, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  backBtn: { marginRight: 12 },
  progressInfo: { flex: 1 },
  progressTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  progressStep: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  scroll: { padding: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray300 },
  dotActive: { backgroundColor: Colors.primary, width: 20 },
  dotDone: { backgroundColor: Colors.success },
  content: {},
  stepTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: Colors.gray700, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.gray300,
    backgroundColor: Colors.white,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  info: { fontSize: 13, color: Colors.gray500, marginBottom: 16, lineHeight: 20 },
  summaryCard: {
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 16, marginTop: 12,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 10 },
  summaryRow: { fontSize: 13, color: Colors.gray700, marginBottom: 4 },
  summaryKey: { fontWeight: '600', color: Colors.gray800 },
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200,
  },
  footerBtn: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' },
  modalIconBg: { marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: 14, color: Colors.gray600, textAlign: 'center', marginBottom: 20 },
  credentialsBox: { backgroundColor: Colors.gray100, width: '100%', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.gray200 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credDivider: { height: 1, backgroundColor: Colors.gray300, marginVertical: 12 },
  credLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  credValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  actionButtonsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  copyBtn: { flex: 1 },
  shareBtn: { flex: 1, backgroundColor: '#25D366' }, // WhatsApp green
  closeBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  closeBtnText: { color: Colors.gray600, fontSize: 15, fontWeight: '600' },
  paymentCardRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  paymentCard: { flex: 1, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.gray200, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  paymentCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  paymentCardText: { marginTop: 8, fontSize: 16, fontWeight: '600', color: Colors.gray600 },
  paymentCardTextActive: { color: Colors.primary },
  paymentIcon: { width: 40, height: 40, resizeMode: 'contain' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.gray200 },
  summaryVal: { flex: 1, textAlign: 'right', color: Colors.textPrimary, fontWeight: '500', fontSize: 13 },
});

export default AddMemberScreen;
