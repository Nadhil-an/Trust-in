import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal, TextInput, Image
} from 'react-native'; 
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { isValidPhone, isValidEmail } from '../../utils/validators';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Button, Input, PhotoPicker, ActionSheet } from '../../components/shared';
import { membersApi, staffApi, notifyApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

const MEMBER_TYPES = ['General', 'Donor', 'Volunteer', 'Beneficiary', 'Life Member', 'Honorary'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ID_TYPES = ['Aadhaar Card', 'Voter ID', 'Passport', 'Driving Licence', 'PAN Card', 'Ration Card'];
const PAYMENT_METHODS = ['Cash', 'GPay'];

const FORM_BLUE = '#1A74EE';
const FORM_BLUE_LIGHT = '#E8F1FD';

// Custom Select Field Component matching the new design
const SelectField = ({ label, icon, value, placeholder, onPress, required, error }) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.inputLabel}>
      {label} {required && <Text style={{ color: Colors.error }}>*</Text>}
    </Text>
    <TouchableOpacity
      style={[styles.selectBox, error && styles.inputError]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.selectContent}>
        {icon && <Ionicons name={icon} size={20} color={Colors.gray500} style={styles.selectIcon} />}
        <Text style={[styles.selectText, !value && { color: Colors.gray400 }]}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={20} color={Colors.gray500} />
    </TouchableOpacity>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

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
  const TOTAL_STEPS = 3;

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [idPhotos, setIdPhotos] = useState([]);

  // ActionSheet states
  const [sheet, setSheet] = useState({ visible: false, title: '', options: [] });

  const [form, setForm] = useState({
    full_name: editItem?.full_name || '',
    phone: editItem?.phone || '',
    email: editItem?.email || '',
    age: editItem?.age?.toString() || '',
    gender: editItem?.gender || '',
    address: editItem?.address || '',
    district: editItem?.district || 'Kozhikode',
    state: editItem?.state || 'Kerala',
    pincode: editItem?.pincode || '',
    membership_type: editItem?.membership_type || '',
    blood_group: editItem?.blood_group || '',
    id_type: editItem?.id_type || '',
    id_number: editItem?.id_number || '',
    payment_mode: editItem?.payment_mode || 'Cash',
    amount: '100', // Fixed at 100
    payment_date: new Date().toISOString().split('T')[0],
    transaction_id: editItem?.transaction_id || '',
    notes: '',
    temp_password: '',
    voucher_id: '',
  });

  const [errors, setErrors] = useState({});
  const [successData, setSuccessData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [receiptImageUri, setReceiptImageUri] = useState(null);

  // Status: null (not checked) | 'checking' | true (has WA) | false (no WA) | 'unverified' (gateway offline)
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const whatsappTimer = useRef(null);

  // Silent background WhatsApp check — debounced 1.5s after user stops typing
  useEffect(() => {
    if (!form.phone || form.phone.length < 10) {
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
          setWhatsappStatus(true);
        } else if (status === false) {
          setWhatsappStatus(false);
        } else {
          setWhatsappStatus('unverified');
        }
      } catch {
        setWhatsappStatus('unverified');
      }
    }, 1500);
    return () => clearTimeout(whatsappTimer.current);
  }, [form.phone]);

  useEffect(() => {
    if (editItem) {
      setForm({
        full_name: editItem.full_name || '', phone: editItem.phone || '', email: editItem.email || '',
        age: editItem.age?.toString() || '', gender: editItem.gender || '',
        address: editItem.address || '', district: editItem.district || 'Kozhikode', state: editItem.state || 'Kerala', pincode: editItem.pincode || '',
        membership_type: editItem.membership_type || '', blood_group: editItem.blood_group || '',
        id_type: editItem.id_type || '', id_number: editItem.id_number || '',
        payment_mode: editItem.payment_mode || 'Cash', amount: '100', payment_date: new Date().toISOString().split('T')[0],
        transaction_id: editItem.transaction_id || '', notes: '', temp_password: '',
        voucher_id: editItem.reference_number || editItem.receipt_number || '',
      });
    }
  }, [editItem]);

  const user = useAuthStore(s => s.user);
  const [voucher, setVoucher] = useState(null);

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

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const openSheet = (title, items, key) => {
    setSheet({
      visible: true,
      title,
      options: items.map(item => ({
        label: item,
        onPress: () => set(key, item)
      }))
    });
  };

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.full_name.trim()) errs.full_name = t('common.required');
      if (!form.phone.trim()) errs.phone = t('common.required');
      else if (!isValidPhone(form.phone)) errs.phone = 'Invalid 10-digit phone number';
      const needsPhoto = whatsappStatus === false || whatsappStatus === 'unverified';
      if (needsPhoto && !receiptImageUri) errs.receiptImage = 'Photo of receipt is required when WhatsApp receipt cannot be sent';
      if (form.email && !isValidEmail(form.email)) errs.email = 'Invalid email address';
      if (!form.age) errs.age = t('common.required');
      if (!form.gender) errs.gender = t('common.required');
      if (!form.address.trim()) errs.address = t('common.required');
      if (!form.district.trim()) errs.district = t('common.required');
      if (!form.state.trim()) errs.state = t('common.required');
      if (!form.pincode.trim()) errs.pincode = t('common.required');
    }
    
    if (step === 1) {
      if (!form.membership_type) errs.membership_type = t('common.required');
    }

    if (step === 2) {
      if (!form.payment_mode) errs.payment_mode = t('common.required');
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.receiptImage) {
        Alert.alert('Receipt Required', errs.receiptImage);
      } else {
        Toast.show({ type: 'error', text1: 'Please fix the highlighted errors' });
      }
      return false;
    }
    return true;
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

  const nextStep = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      setShowPreview(true);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // ── Day-closed guard removed to allow rollover to next day ─────────────────────────────────────────

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
        if (form[key] !== '' && form[key] !== null && 
            !['id_type', 'id_number', 'temp_password', 'age', 'payment_mode', 'transaction_id', 'amount', 'payment_date', 'notes', 'voucher_id', 'phone'].includes(key)) {
          let value = form[key];
          if (key === 'gender') value = genderMap[value] || value;
          if (key === 'membership_type') value = membershipMap[value] || 'GENERAL';
          formData.append(key, value);
        }
      });

      // Append payment details to formData if collected
      const mappedPaymentMode = form.payment_mode === 'GPay' ? 'UPI' : 'CASH';
      if (form.payment_mode) formData.append('payment_mode', mappedPaymentMode);
      if (form.payment_mode === 'GPay' && form.transaction_id) formData.append('transaction_id', form.transaction_id);
      if (form.voucher_id) formData.append('voucher_id', form.voucher_id);

      if (form.age) {
        const currentYear = new Date().getFullYear();
        const dobYear = currentYear - parseInt(form.age, 10);
        formData.append('date_of_birth', `${dobYear}-01-01`);
      }

      if (form.phone) {
        formData.append('phone', form.phone);
      }

      if (receiptImageUri) {
        formData.append('document', { uri: receiptImageUri, type: 'image/jpeg', name: 'receipt.jpg' });
      }

      if (photos.length > 0) {
        formData.append('photo', { uri: photos[0].uri, type: 'image/jpeg', name: 'photo.jpg' });
      }

      if (isEdit) {
        await membersApi.update(editItem.id, formData);
        Toast.show({ type: 'success', text1: 'Member Updated!' });
        setShowPreview(false);
        navigation.goBack();
      } else {
        const res = await membersApi.create(formData);
        if (voucher && user?.id) {
          await staffApi.vouchers.increment(user.id).catch(() => {});
        }
        setShowPreview(false);
        setSuccessData({
          member_id: res.data.member_id,
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

  const SectionHeader = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionIconBg}>
        <Ionicons name={icon} size={16} color={FORM_BLUE} />
      </View>
    </View>
  );

  const renderStep = () => {
    switch(step) {
      case 0:
        return (
          <>
            <SectionHeader title={t('staff.personal_info')} icon="person-outline" />
            <View style={styles.card}>
              <Text style={styles.inputLabel}>{t('staff.add_photo', 'Add Photo')}</Text>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={styles.photoUploadBox}>
                  <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={1} customIcon="camera" customLabel="Add Photo" />
                </View>
                <Text style={styles.photoHint}>Upload a clear member photo</Text>
              </View>

              <Input label={t('staff.full_name')} value={form.full_name} onChangeText={v => set('full_name', v)} placeholder={t('staff.full_name_placeholder')} required error={errors.full_name} icon="person-outline" />
              
              <Text style={styles.inputLabel}>{t('staff.phone_whatsapp')} <Text style={{ color: Colors.error }}>*</Text></Text>
              <View style={[styles.phoneInputWrapper, errors.phone && styles.inputError]}>
                <Ionicons name="call-outline" size={20} color="#64748B" style={styles.phoneInputIcon} />
                <TextInput
                  style={styles.phoneInput}
                  value={form.phone}
                  onChangeText={v => set('phone', v)}
                  placeholder={t('staff.phone_placeholder')}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={10}
                />
                {form.phone.length === 10 && (
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
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              
              {whatsappStatus === false && (
                <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 4, marginLeft: 4 }}>
                  ⚠️ This number is not registered on WhatsApp. A receipt photo is required.
                </Text>
              )}
              {whatsappStatus === 'unverified' && (
                <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4, marginLeft: 4 }}>
                  ⚠️ WhatsApp status could not be verified. Please capture a receipt photo as proof.
                </Text>
              )}

              {(whatsappStatus === false || whatsappStatus === 'unverified') && (
                <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', marginTop: 16 }}>
                  <Text style={{ fontSize: 13, color: '#991B1B', marginBottom: 10, fontWeight: '600' }}>
                    {whatsappStatus === 'unverified'
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
                  {errors.receiptImage ? <Text style={styles.errorText}>{errors.receiptImage}</Text> : null}
                </View>
              )}

              <Input label={t('staff.email')} value={form.email} onChangeText={v => set('email', v)} type="email" placeholder={t('staff.email')} error={errors.email} icon="mail-outline" />
              <Input label={t('staff.age')} value={form.age} onChangeText={v => set('age', v)} type="number" placeholder={t('staff.age')} required error={errors.age} icon="calendar-outline" />
              <SelectField label={t('staff.gender')} icon="male-female-outline" value={form.gender} placeholder={t('staff.gender')} onPress={() => openSheet(t('staff.gender'), GENDER_OPTIONS, 'gender')} required error={errors.gender} />
              <Input label={t('staff.address')} value={form.address} onChangeText={v => set('address', v)} placeholder={t('staff.address')} required error={errors.address} icon="home-outline" />
              <Input label={t('staff.district')} value={form.district} onChangeText={v => set('district', v)} placeholder={t('staff.district')} required error={errors.district} icon="location-outline" />
              <Input label={t('staff.state')} value={form.state} onChangeText={v => set('state', v)} placeholder={t('staff.state')} required error={errors.state} icon="map-outline" />
              <Input label={t('staff.pincode')} value={form.pincode} onChangeText={v => set('pincode', v)} type="number" placeholder={t('staff.pincode')} required error={errors.pincode} maxLength={6} icon="mail-unread-outline" />
            </View>
          </>
        );
      case 1:
        return (
          <>
            <SectionHeader title={t('staff.membership_details', '2. Membership Details')} icon="id-card-outline" />
            <View style={styles.card}>
              <SelectField label={t('staff.blood_group', 'Blood Group')} icon="water-outline" value={form.blood_group} placeholder={t('staff.blood_group', 'Select blood group')} onPress={() => openSheet(t('staff.blood_group', 'Select Blood Group'), BLOOD_GROUPS, 'blood_group')} />
              <SelectField label={t('staff.membership_type', 'Membership Type')} icon="star-outline" value={form.membership_type} placeholder={t('staff.membership_type', 'Select membership type')} onPress={() => openSheet(t('staff.membership_type', 'Select Membership Type'), MEMBER_TYPES, 'membership_type')} required error={errors.membership_type} />
              <SelectField label={t('staff.id_proof_type', 'ID Proof Type')} icon="card-outline" value={form.id_type} placeholder={t('staff.id_proof_type', 'Select ID proof type')} onPress={() => openSheet(t('staff.id_proof_type', 'Select ID Proof Type'), ID_TYPES, 'id_type')} />
              <Text style={styles.inputLabel}>{t('staff.upload_id', 'Upload ID Proof')}</Text>
              <View style={styles.idUploadBox}>
                <PhotoPicker photos={idPhotos} onPhotosChange={setIdPhotos} maxPhotos={1} customIcon="cloud-upload-outline" customLabel={t('staff.upload_id', 'Upload Document')} />
                <Text style={styles.photoHint}>JPG, PNG, PDF (Max 5MB)</Text>
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <SectionHeader title={t('staff.payment_collection', '3. Payment Collection')} icon="wallet-outline" />
            <View style={styles.card}>
              <Text style={styles.inputLabel}>{t('staff.payment_method')} <Text style={{ color: Colors.error }}>*</Text></Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={[styles.paymentBtn, form.payment_mode === 'Cash' && styles.paymentBtnActive]}
                  onPress={() => { set('payment_mode', 'Cash'); setErrors(e => ({ ...e, payment_mode: '' })); }}
                  activeOpacity={0.8}
                >
                  <Image source={require('../../../assets/cash.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.paymentBtn, form.payment_mode === 'GPay' && styles.paymentBtnActive]}
                  onPress={() => { set('payment_mode', 'GPay'); setErrors(e => ({ ...e, payment_mode: '' })); }}
                  activeOpacity={0.8}
                >
                  <Image source={require('../../../assets/gpay.png')} style={{ width: 54, height: 32 }} resizeMode="contain" />
                </TouchableOpacity>
              </View>
              {errors.payment_mode ? <Text style={styles.errorText}>{errors.payment_mode}</Text> : null}

              <Input label={t('staff.amount')} value={form.amount} editable={false} placeholder={t('staff.amount')} required icon="cash-outline" />
              <Input label={t('staff.payment_date', 'Payment Date')} value={form.payment_date} editable={false} placeholder={t('staff.payment_date', 'Payment Date')} required icon="calendar-outline" />
              
              {form.payment_mode !== 'Cash' && (
                <Input label={t('staff.transaction_id', 'Transaction ID / Reference')} value={form.transaction_id} onChangeText={v => set('transaction_id', v)} placeholder={t('staff.transaction_id', 'Transaction ID')} error={errors.transaction_id} icon="receipt-outline" />
              )}
              
              <Input label={t('staff.notes', 'Notes')} value={form.notes} onChangeText={v => set('notes', v)} placeholder={t('staff.notes', 'Notes')} type="multiline" icon="document-text-outline" />
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.flex}>
      
      {/* Progress header */}
      <View style={styles.progressBar}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>{isEdit ? 'Edit Member' : 'Add Member'}</Text>
          <Text style={styles.progressStep}>Step {step + 1} of {TOTAL_STEPS}</Text>
        </View>
        <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <StepDots total={TOTAL_STEPS} current={step} />
        
        {voucher && (
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
                  placeholder="Enter ID"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>
        )}

        {renderStep()}

        {/* Footer Buttons */}
        <View style={styles.footerRow}>
          {step > 0 && (
            <Button 
              title="Back" 
              onPress={() => setStep(s => s - 1)} 
              variant="outline" 
              style={{ flex: 1, marginRight: 12, borderColor: FORM_BLUE }} 
              textStyle={{ color: FORM_BLUE }}
            />
          )}
          <Button 
            title={step === TOTAL_STEPS - 1 ? "Preview & Save" : "Next"} 
            onPress={nextStep} 
            style={{ flex: 2, backgroundColor: FORM_BLUE }} 
          />
        </View>

      </KeyboardAwareScrollView>

      {/* Action Sheet for SelectFields */}
      <ActionSheet 
        visible={sheet.visible} 
        onClose={() => setSheet(s => ({ ...s, visible: false }))} 
        title={sheet.title} 
        options={sheet.options} 
      />

      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Preview Details</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Ionicons name="close" size={24} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              <View style={styles.previewBox}>
                <Text style={styles.previewSectionTitle}>Personal Info</Text>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Name:</Text><Text style={styles.previewVal}>{form.full_name}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Phone:</Text><Text style={styles.previewVal}>{form.phone}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Email:</Text><Text style={styles.previewVal}>{form.email || '-'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Age:</Text><Text style={styles.previewVal}>{form.age || '-'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Gender:</Text><Text style={styles.previewVal}>{form.gender || '-'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Address:</Text><Text style={styles.previewVal}>{form.address}, {form.district}, {form.state} - {form.pincode}</Text></View>
                
                <Text style={styles.previewSectionTitle}>Membership</Text>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Type:</Text><Text style={styles.previewVal}>{form.membership_type}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Blood Group:</Text><Text style={styles.previewVal}>{form.blood_group || '-'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>ID Proof:</Text><Text style={styles.previewVal}>{form.id_type || '-'}</Text></View>
                
                <Text style={styles.previewSectionTitle}>Payment</Text>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Method:</Text><Text style={styles.previewVal}>{form.payment_mode || 'Cash'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Amount:</Text><Text style={styles.previewVal}>₹{form.amount}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Txn ID:</Text><Text style={styles.previewVal}>{form.transaction_id || '-'}</Text></View>
              </View>
            </KeyboardAwareScrollView>
            <View style={{ width: '100%', marginTop: 20 }}>
              <Button title="Confirm & Save Member" onPress={handleSubmit} loading={loading} style={{ backgroundColor: FORM_BLUE }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!successData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto' }]}>
            <View style={styles.modalIconBg}>
              <Ionicons name="checkmark-circle" size={50} color={Colors.success} />
            </View>
            <Text style={styles.modalTitle}>Member Registered!</Text>
            <Text style={styles.modalSub}>Member added successfully. Registration details sent to member via Trust WhatsApp.</Text>

            <View style={styles.credentialsBox}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Member ID</Text>
                <Text style={styles.credValue}>{successData?.member_id}</Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <Button
                title="Copy Details"
                icon={<Ionicons name="copy-outline" size={18} color={FORM_BLUE} style={{ marginRight: 6 }} />}
                style={[styles.copyBtn, { borderColor: FORM_BLUE }]}
                textStyle={{ color: FORM_BLUE }}
                variant="outline"
                onPress={async () => {
                  const msg = `Member ID: ${successData?.member_id}\nName: ${successData?.name}`;
                  await Clipboard.setStringAsync(msg);
                  Toast.show({ type: 'success', text1: 'Copied to clipboard!' });
                }}
              />
              <Button
                title="Done"
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
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.gray100 }, 
  
  progressBar: {
    backgroundColor: FORM_BLUE, paddingTop: 50,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute', bottom: 0, left: 0,
    height: 4, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  headerBackBtn: { marginRight: 12 },
  progressInfo: { flex: 1 },
  progressTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  progressStep: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  scroll: { padding: 16, paddingBottom: 40 },
  
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray300 },
  dotActive: { backgroundColor: FORM_BLUE, width: 20 },
  dotDone: { backgroundColor: Colors.success },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, marginTop: 8
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FORM_BLUE },
  sectionIconBg: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: FORM_BLUE_LIGHT,
    justifyContent: 'center', alignItems: 'center'
  },
  
  card: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: Colors.gray200,
  },
  
  inputWrapper: { marginBottom: 16 },
  phoneInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gray300, borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: Colors.white,
    marginBottom: 16, height: 48
  },
  phoneInputIcon: { marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 15, color: Colors.textPrimary, height: '100%' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  selectBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gray300, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.white
  },
  selectContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectIcon: { marginRight: 8 },
  selectText: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  
  paymentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: FORM_BLUE, backgroundColor: Colors.white
  },
  paymentBtnActive: { backgroundColor: FORM_BLUE },
  paymentBtnText: { fontSize: 15, fontWeight: '600', color: FORM_BLUE },
  paymentBtnTextActive: { color: Colors.white },
  
  photoUploadBox: {
    width: 140, height: 140, borderRadius: 12, borderWidth: 1, borderColor: FORM_BLUE_LIGHT,
    borderStyle: 'dashed', backgroundColor: Colors.gray50, justifyContent: 'center', alignItems: 'center',
  },
  idUploadBox: {
    width: '100%', height: 120, borderRadius: 12, borderWidth: 1, borderColor: FORM_BLUE_LIGHT,
    borderStyle: 'dashed', backgroundColor: Colors.gray50, justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  photoHint: { fontSize: 12, color: Colors.gray500, textAlign: 'center' },
  
  footerRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center', justifyContent: 'space-between' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, width: '100%', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 16 },
  modalIconBg: { marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: 14, color: Colors.gray600, textAlign: 'center', marginBottom: 20 },
  
  previewBox: { width: '100%', backgroundColor: Colors.gray50, borderRadius: 12, padding: 16 },
  previewSectionTitle: { fontSize: 14, fontWeight: '700', color: FORM_BLUE, marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray200, paddingBottom: 4 },
  previewLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewKey: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  previewVal: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  
  credentialsBox: { backgroundColor: Colors.gray100, width: '100%', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.gray200 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credDivider: { height: 1, backgroundColor: Colors.gray300, marginVertical: 12 },
  credLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  credValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  actionButtonsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  copyBtn: { flex: 1 },
  shareBtn: { flex: 1, backgroundColor: FORM_BLUE },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: -4 },
  checkboxLabel: { marginLeft: 10, fontSize: 13, color: Colors.gray600 },
});

export default AddMemberScreen;
