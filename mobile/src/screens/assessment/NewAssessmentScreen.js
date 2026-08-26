// screens/assessment/NewAssessmentScreen.js — 6-step wizard with voice, location & custom categories
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, TextInput, Modal, Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { isValidPhone, isPositiveNumber } from '../../utils/validators';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { Colors } from '../../constants/Colors';
import { Button, Input, PhotoPicker, Card } from '../../components/shared';
import { assessmentApi, membersApi } from '../../api';
import { useOfflineStore } from '../../store/offlineStore';
import Toast from 'react-native-toast-message';

// ── Urgency options ────────────────────────────────────────────────────────
const URGENCY_OPTIONS = [
  { key: 'NORMAL',   labelKey: 'common.normal',   descKey: 'assessment.urgency_normal',        icon: 'time',    color: Colors.info },
  { key: 'URGENT',   labelKey: 'common.urgent',   descKey: 'assessment.urgency_urgent',   icon: 'alert',   color: Colors.warning },
  { key: 'CRITICAL', labelKey: 'common.critical', descKey: 'assessment.urgency_critical',     icon: 'warning', color: Colors.error },
];

// ── Default categories (shown as chips) ────────────────────────────────────
const BUILT_IN_CATEGORIES = [
  { key: 'MEDICAL',       labelKey: 'assessment.categories.medical', icon: '🏥' },
  { key: 'EDUCATION',     labelKey: 'assessment.categories.education', icon: '🎓' },
  { key: 'FOOD',          labelKey: 'assessment.categories.food', icon: '🍚' },
  { key: 'HOUSING',       labelKey: 'assessment.categories.housing', icon: '🏠' },
  { key: 'LIVELIHOOD',    labelKey: 'assessment.categories.livelihood', icon: '💼' },
  { key: 'DISABILITY',    labelKey: 'assessment.categories.disability', icon: '♿' },
  { key: 'ELDERLY',       labelKey: 'assessment.categories.elderly', icon: '👴' },
  { key: 'CHILD_WELFARE', labelKey: 'assessment.categories.child', icon: '👶' },
  { key: 'WOMEN_WELFARE', labelKey: 'assessment.categories.women', icon: '👩' },
  { key: 'OTHER',         labelKey: 'assessment.categories.other', icon: '📋' },
];

// ── Voice recording helper ─────────────────────────────────────────────────
const useVoiceRecorder = () => {
  const recordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Microphone access is required.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      await recordingRef.current?.stopAndUnloadAsync();
      setIsRecording(false);
      // In a production app you'd send the audio to a speech-to-text API.
      // For now we append a note so the officer knows there's an audio attachment.
      setTranscript('[🎤 Voice note recorded — attach transcription here]');
    } catch (e) {
      setIsRecording(false);
    }
  };

  return { isRecording, transcript, startRecording, stopRecording };
};

// ── Main component ─────────────────────────────────────────────────────────
const NewAssessmentScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const { isOnline, addToQueue } = useOfflineStore();
  const { isRecording, transcript, startRecording, stopRecording } = useVoiceRecorder();

  const [step, setStep]                       = useState(0);
  const [loading, setLoading]                 = useState(false);
  const [photos, setPhotos]                   = useState([]);
  const [memberSearch, setMemberSearch]       = useState('');
  const [foundMember, setFoundMember]         = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);       // user-added
  const [addCatModal, setAddCatModal]         = useState(false);       // modal flag
  const [newCatName, setNewCatName]           = useState('');
  const [submitStatus, setSubmitStatus]       = useState(null);

  const [form, setForm] = useState({
    beneficiary_name: editItem?.beneficiary_name || '', beneficiary_age: editItem?.beneficiary_age?.toString() || '', beneficiary_phone: editItem?.beneficiary_phone || '',
    beneficiary_address: editItem?.beneficiary_address || '', location_text: editItem?.location_text || '', latitude: editItem?.latitude || null, longitude: editItem?.longitude || null,
    category: editItem?.category || '', custom_category: '', description: editItem?.description || '',
    priority: editItem?.priority || 'NORMAL', member: editItem?.member || null,
    source: editItem?.source || route?.params?.source || 'STAFF',
  });
  const [errors, setErrors] = useState({});
  const TOTAL_STEPS = 6;

  // Append voice transcript to description when it arrives
  useEffect(() => {
    if (transcript) {
      setForm(f => ({ ...f, description: f.description ? f.description + '\n\n' + transcript : transcript }));
    }
  }, [transcript]);

  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories];

  const setF = (key, val) => { setForm(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  // ── GPS location → readable address ──────────────────────────────────────
  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location access is required to auto-fill address.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      // Reverse-geocode to get human-readable address
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [place.name, place.street, place.district, place.city, place.region, place.country].filter(Boolean);
      const readableAddress = parts.join(', ');

      setForm(f => ({
        ...f,
        latitude,
        longitude,
        location_text: readableAddress,
        beneficiary_address: f.beneficiary_address || readableAddress,
      }));
      Toast.show({ type: 'success', text1: '📍 Location captured', text2: readableAddress });
    } catch (e) {
      Alert.alert('Error', 'Could not get location. Please enter address manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Add new custom category ───────────────────────────────────────────────
  const addCustomCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    const key = name.toUpperCase().replace(/\s+/g, '_');
    if (allCategories.find(c => c.key === key)) {
      Alert.alert('Duplicate', 'A category with that name already exists.'); return;
    }
    const newCat = { key, label: `📌 ${name}`, custom: true };
    setCustomCategories(prev => [...prev, newCat]);
    setF('category', key);
    setNewCatName('');
    setAddCatModal(false);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.beneficiary_name.trim()) errs.beneficiary_name = t('common.required');
      if (!form.beneficiary_phone.trim()) errs.beneficiary_phone = t('common.required');
      else if (!isValidPhone(form.beneficiary_phone)) errs.beneficiary_phone = t('errors.invalid_phone_msg', 'Enter a valid 10-digit phone number');
      if (!form.beneficiary_address.trim()) errs.beneficiary_address = t('common.required');
      if (form.beneficiary_age && !isPositiveNumber(form.beneficiary_age)) errs.beneficiary_age = t('errors.invalid_age', 'Enter a valid age');
    }
    if (step === 1 && !form.category) errs.category = t('assessment.select_category', 'Please select a category');
    if (step === 2 && (!form.description.trim() || form.description.length < 20))
      errs.description = t('assessment.description_min', 'Please provide more details (at least 20 characters)');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleSubmit();
  };

  const searchMember = async () => {
    if (!memberSearch.trim()) return;
    try {
      const res = await membersApi.search(memberSearch);
      const members = res.data.results || res.data;
      if (members.length > 0) {
        const m = members[0];
        setFoundMember(m);
        setF('member', m.id);
        setF('beneficiary_name', m.full_name);
        setF('beneficiary_phone', m.phone || '');
        setF('beneficiary_address', m.address || '');
      } else {
        Alert.alert('Not found', 'No member found. Please enter details manually below.');
      }
    } catch (_) {}
  };

  const handleSubmit = async () => {
    setLoading(true);
    const formData = new FormData();
    Object.keys(form).forEach(key => {
      if (form[key] !== '' && form[key] !== null) {
        if (key === 'category') {
          const isBuiltIn = BUILT_IN_CATEGORIES.find(c => c.key === form[key]);
          formData.append(key, isBuiltIn ? form[key] : 'OTHER');
          
          if (!isBuiltIn) {
            const customCat = customCategories.find(c => c.key === form[key]);
            if (customCat && !form.description.includes('Custom Category')) {
              formData.set('description', `[Custom Category: ${customCat.label.replace('📌 ', '')}]\n\n${form.description}`);
            }
          }
        } else {
          formData.append(key, form[key]);
        }
      }
    });
    if (photos.length > 0) {
      formData.append('document', { uri: photos[0].uri, type: 'image/jpeg', name: `document_${Date.now()}.jpg` });
    }
    
    try {
      if (!isOnline && !isEdit) {
        await addToQueue({ method: 'POST', url: '/manager/requests/', data: { ...form, _offline: true } });
        Toast.show({ type: 'success', text1: 'Saved Offline', text2: 'Will submit when connected.' });
        navigation.goBack();
        return;
      }
      
      if (isEdit) {
        await assessmentApi.update(editItem.id, formData);
        setSubmitStatus({ type: 'success', message: 'Assessment Updated!', data: { request_number: editItem.request_number } });
      } else {
        const res = await assessmentApi.create(formData);
        setSubmitStatus({
          type: 'success',
          message: t('assessment.submitted_success'),
          data: res.data
        });
      }
    } catch (err) {
      console.error("Submit Error:", err.response?.data || err.message);
      const errMsg = err.response?.data?.detail || (err.response?.data ? JSON.stringify(err.response.data) : err.message) || t('common.error');
      setSubmitStatus({ type: 'error', message: errMsg });
    } finally { setLoading(false); }
  };

  // ── Step renderers ────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {

      // ── Step 0: Beneficiary Info ──────────────────────────────────────────
      case 0:
        return (
          <>
            <Text style={styles.stepTitle}>{isEdit ? t('assessment.edit_beneficiary', 'Edit Beneficiary') : t('assessment.beneficiary_info')}</Text>

            <Input label={t('assessment.beneficiary_name')} value={form.beneficiary_name}
              onChangeText={v => setF('beneficiary_name', v)} placeholder={t('assessment.beneficiary_name')}
              required error={errors.beneficiary_name} />
            <View style={styles.row2}>
              <View style={styles.half}>
                <Input label={t('assessment.beneficiary_age')} value={form.beneficiary_age}
                  onChangeText={v => setF('beneficiary_age', v)} type="number" placeholder={t('common.age')} />
              </View>
              <View style={styles.half}>
                <Input label={t('assessment.beneficiary_phone')} value={form.beneficiary_phone}
                  onChangeText={v => setF('beneficiary_phone', v)} type="phone" placeholder={t('common.phone')}
                  required error={errors.beneficiary_phone} maxLength={10} keyboardType="numeric" />
              </View>
            </View>

            {/* Address with GPS button */}
            <View style={styles.addressRow}>
              <View style={{ flex: 1 }}>
                <Input label={t('assessment.beneficiary_address')} value={form.beneficiary_address}
                  onChangeText={v => setF('beneficiary_address', v)} type="multiline"
                  placeholder={t('common.address')} required error={errors.beneficiary_address} />
              </View>
              <TouchableOpacity style={styles.gpsBtn} onPress={fetchLocation} disabled={locationLoading}>
                <Ionicons name={locationLoading ? 'hourglass' : 'locate'} size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Readable location text (from GPS) */}
            {form.location_text ? (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color={Colors.primary} />
                <Text style={styles.locationText} numberOfLines={2}>{form.location_text}</Text>
              </View>
            ) : null}
          </>
        );

      // ── Step 1: Category ─────────────────────────────────────────────────
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>📂 {t('assessment.step2')}</Text>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
            <View style={styles.categoryGrid}>
              {allCategories.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryBtn, form.category === cat.key && styles.categoryActive,
                    cat.custom && styles.categoryCustom]}
                  onPress={() => setF('category', cat.key)}
                >
                  <Text style={[styles.categoryLabel, form.category === cat.key && styles.categoryLabelActive]}>
                    {cat.custom ? cat.label : `${cat.icon} ${t(cat.labelKey)}`}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Add New Category button */}
              <TouchableOpacity style={styles.addCategoryBtn} onPress={() => setAddCatModal(true)}>
                <Ionicons name="add-circle" size={16} color={Colors.primary} />
                <Text style={styles.addCategoryLabel}>{t('common.add_new', 'Add New')}</Text>
              </TouchableOpacity>
            </View>

            {form.category === 'OTHER' && (
              <Input label={t('assessment.specify_category', 'Specify Category')} value={form.custom_category}
                onChangeText={v => setF('custom_category', v)} placeholder={t('assessment.enter_category_name', 'Enter category name')} />
            )}
          </>
        );

      // ── Step 2: Description + Voice ─────────────────────────────────────
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>📝 {t('assessment.step3')}</Text>

            {/* Voice recording button */}
            <TouchableOpacity
              style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <View style={[styles.voiceIconWrap, isRecording && styles.voiceIconActive]}>
                <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={24}
                  color={isRecording ? Colors.error : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceBtnTitle, isRecording && { color: Colors.error }]}>
                  {isRecording ? t('assessment.recording_stop', '🔴 Recording… Tap to stop') : t('assessment.describe_voice', '🎤 Describe problem by voice')}
                </Text>
                <Text style={styles.voiceBtnSub}>
                  {isRecording ? t('assessment.speak_clearly', 'Speak clearly into the mic') : t('assessment.voice_note_added', 'Your voice note will be added to the description')}
                </Text>
              </View>
            </TouchableOpacity>

            <Input
              label={t('assessment.problem_desc')}
              value={form.description}
              onChangeText={v => setF('description', v)}
              type="multiline"
              placeholder={t('assessment.problem_placeholder')}
              required
              error={errors.description}
            />
            <Text style={styles.charCount}>{form.description.length} {t('fao_report.characters')}</Text>
          </>
        );

      // ── Step 3: Photos ────────────────────────────────────────────────────
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>📷 {t('assessment.step4')}</Text>
            <Text style={styles.hint}>{t('assessment.photos_hint')}</Text>
            <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={5} />
          </>
        );

      // ── Step 4: Urgency ───────────────────────────────────────────────────
      case 4:
        return (
          <>
            <Text style={styles.stepTitle}>⚠️ {t('assessment.step5')}</Text>
            {URGENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.urgencyBtn, form.priority === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                onPress={() => setF('priority', opt.key)}
              >
                <View style={[styles.urgencyIcon, { backgroundColor: opt.color + '20' }]}>
                  <Ionicons name={opt.icon} size={22} color={opt.color} />
                </View>
                <View style={styles.urgencyText}>
                  <Text style={[styles.urgencyLabel, { color: opt.color }]}>{t(opt.labelKey)}</Text>
                  <Text style={styles.urgencyDesc}>{t(opt.descKey).split(' — ')[1] || t(opt.descKey)}</Text>
                </View>
                {form.priority === opt.key && <Ionicons name="checkmark-circle" size={22} color={opt.color} />}
              </TouchableOpacity>
            ))}
          </>
        );

      // ── Step 5: Review & Submit ───────────────────────────────────────────
      case 5:
        return (
          <>
            <Text style={styles.stepTitle}>✅ {t('assessment.step6')}</Text>
            <Card padding={16}>
              <InfoRow label={t('assessment.beneficiary_name').split("'")[0]} value={form.beneficiary_name || foundMember?.full_name} />
              <InfoRow label={t('common.phone')}       value={form.beneficiary_phone} />
              <InfoRow label={t('common.address')}     value={form.beneficiary_address} />
              {form.location_text ? (
                <InfoRow label={t('fao_report.visit_location', 'Location')} value={form.location_text} />
              ) : null}
              <InfoRow label={t('common.category')}    value={allCategories.find(c => c.key === form.category)?.label || form.category} />
              <InfoRow label={t('common.urgency')}     value={form.priority} />
              <InfoRow label={t('common.photos')}      value={`${photos.length} uploaded`} />
              <InfoRow label={t('assessment.problem_desc')} value={form.description.slice(0, 80) + (form.description.length > 80 ? '...' : '')} />
            </Card>
            <Text style={styles.submitNote}>{t('assessment.submitted_to_fao')}</Text>
          </>
        );

      default: return null;
    }
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header with progress bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('assessment.new_title')}</Text>
            <Text style={styles.headerSub}>{t('staff.step')} {step + 1} {t('staff.of')} {TOTAL_STEPS}</Text>
          </View>
          <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>

        {/* Step dots */}
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && <Button title={t('common.back')} onPress={() => setStep(s => s - 1)} variant="outline" style={styles.footerBtn} />}
          <Button
            title={step === TOTAL_STEPS - 1 ? t('assessment.submit_assessment') : t('common.next')}
            onPress={nextStep}
            loading={loading}
            style={styles.footerBtn}
            variant={step === TOTAL_STEPS - 1 ? 'success' : 'primary'}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Add New Category Modal */}
      <Modal visible={addCatModal} transparent animationType="slide" onRequestClose={() => setAddCatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>➕ Add New Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Mental Health, Flood Relief..."
              placeholderTextColor={Colors.gray400}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
              onSubmitEditing={addCustomCategory}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnOutline]} onPress={() => { setAddCatModal(false); setNewCatName(''); }}>
                <Text style={styles.modalBtnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={addCustomCategory}>
                <Text style={styles.modalBtnText}>Add Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Submission Status Modal */}
      <Modal visible={!!submitStatus} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }}>
            {submitStatus?.type === 'success' ? (
              <Ionicons name="checkmark-circle" size={60} color={Colors.success} style={{ marginBottom: 16 }} />
            ) : (
              <Ionicons name="alert-circle" size={60} color={Colors.error} style={{ marginBottom: 16 }} />
            )}
            
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
              {submitStatus?.type === 'success' ? 'Success!' : 'Error'}
            </Text>
            
            <Text style={{ fontSize: 15, color: Colors.gray600, textAlign: 'center', marginBottom: 4 }}>
              {submitStatus?.message}
            </Text>
            
            {submitStatus?.type === 'success' && submitStatus?.data?.request_number && (
              <Text style={{ fontSize: 13, color: Colors.gray500, textAlign: 'center', marginTop: 8 }}>
                Case No: {submitStatus.data.request_number}
              </Text>
            )}
            
            <View style={{ width: '100%', marginTop: 24 }}>
              <Button 
                title="OK" 
                variant={submitStatus?.type === 'success' ? 'success' : 'primary'}
                onPress={() => {
                  const wasSuccess = submitStatus?.type === 'success';
                  setSubmitStatus(null);
                  if (wasSuccess) {
                    navigation.goBack();
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ── Info row helper ────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoKey}>{label}</Text>
    <Text style={styles.infoValue}>{value || '-'}</Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.warning, paddingTop: 50, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  progressFill: { position: 'absolute', bottom: 0, left: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: Colors.white },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray300 },
  dotActive: { backgroundColor: Colors.warning, width: 20 },
  dotDone: { backgroundColor: Colors.success },
  scroll: { padding: 20 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  searchCard: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  searchInput: { flex: 1, marginBottom: 0 },
  searchBtn: { width: 46, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.successLight, borderRadius: 8, padding: 8, marginTop: 8 },
  memberChipText: { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600' },
  orText: { textAlign: 'center', color: Colors.gray400, fontSize: 13, marginBottom: 16, marginTop: 4 },
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: Colors.gray700, marginBottom: 8 },
  // Location
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gpsBtn: { width: 46, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  locationBadge: { backgroundColor: Colors.primaryLight || '#E8F4FD', borderRadius: 10, padding: 10, marginBottom: 12, gap: 4 },
  locationText: { fontSize: 13, color: Colors.primary, fontWeight: '500', flex: 1 },
  locationCoords: { fontSize: 11, color: Colors.gray500, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  // Categories
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white },
  categoryActive: { borderColor: Colors.warning, backgroundColor: Colors.warningLight },
  categoryCustom: { borderColor: Colors.primary, borderStyle: 'dashed' },
  categoryLabel: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  categoryLabelActive: { color: Colors.warning, fontWeight: '700' },
  addCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: '#F0F8FF' },
  addCategoryLabel: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  // Voice
  voiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white, marginBottom: 16 },
  voiceBtnActive: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  voiceIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF6FF', alignItems: 'center', justifyContent: 'center' },
  voiceIconActive: { backgroundColor: '#FFE8E8' },
  voiceBtnTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  voiceBtnSub: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  charCount: { fontSize: 12, color: Colors.gray400, textAlign: 'right', marginTop: -8, marginBottom: 8 },
  hint: { fontSize: 13, color: Colors.gray500, marginBottom: 12 },
  urgencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: Colors.white },
  urgencyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  urgencyText: { flex: 1 },
  urgencyLabel: { fontSize: 15, fontWeight: '700' },
  urgencyDesc: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  infoKey: { width: 100, fontSize: 13, color: Colors.gray500, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  submitNote: { fontSize: 13, color: Colors.gray500, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  errorText: { color: Colors.error, fontSize: 12, marginBottom: 8 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
  footerBtn: { flex: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  modalInput: { borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  modalBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.gray300 },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  modalBtnOutlineText: { fontSize: 15, fontWeight: '700', color: Colors.gray600 },
});

export default NewAssessmentScreen;
