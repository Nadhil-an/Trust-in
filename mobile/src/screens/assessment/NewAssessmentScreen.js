// screens/assessment/NewAssessmentScreen.js — Condensed 3-step wizard
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, TextInput, Modal,
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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

const FORM_BLUE = '#1A74EE';
const FORM_BLUE_LIGHT = '#E8F1FD';

// ── Urgency options ────────────────────────────────────────────────────────
const URGENCY_OPTIONS = [
  { key: 'NORMAL',   labelKey: 'common.normal',   descKey: 'assessment.urgency_normal',        icon: 'time',    color: FORM_BLUE },
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
  const soundRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceUri, setVoiceUri] = useState(null);

  const startRecording = async () => {
    try {
      if (voiceUri) { setVoiceUri(null); }
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
      const uri = recordingRef.current?.getURI();
      setVoiceUri(uri);
      setIsRecording(false);
    } catch (e) {
      setIsRecording(false);
    }
  };

  const playVoice = async () => {
    if (!voiceUri) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: voiceUri });
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) setIsPlaying(false);
      });
      await sound.playAsync();
    } catch (e) {
      setIsPlaying(false);
    }
  };

  const stopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
    }
  };

  return { isRecording, isPlaying, voiceUri, startRecording, stopRecording, playVoice, stopPlaying, setVoiceUri };
};

// ── Main component ─────────────────────────────────────────────────────────
const NewAssessmentScreen = ({ navigation, route }) => {
  const editItem = route?.params?.editItem;
  const isEdit = !!editItem;
  const { t } = useTranslation();
  const { isOnline, addToQueue } = useOfflineStore();
  const { isRecording, isPlaying, voiceUri, startRecording, stopRecording, playVoice, stopPlaying, setVoiceUri } = useVoiceRecorder();

  const [step, setStep]                       = useState(0);
  const [loading, setLoading]                 = useState(false);
  const [photos, setPhotos]                   = useState([]);
  const [memberSearch, setMemberSearch]       = useState('');
  const [foundMember, setFoundMember]         = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);       
  const [addCatModal, setAddCatModal]         = useState(false);       
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
  const TOTAL_STEPS = 3; // 0: Info, 1: Details, 2: Review



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
    if (step === 1) {
      if (!form.category) errs.category = t('assessment.select_category', 'Please select a category');
      if (!form.description.trim() && !voiceUri)
        errs.description = t('common.required');
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
    if (voiceUri) {
      formData.append('voice_note', { uri: voiceUri, type: 'audio/m4a', name: `voice_${Date.now()}.m4a` });
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
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>1. Personal Information</Text>
                <View style={styles.sectionIconBg}>
                  <Ionicons name="person-outline" size={16} color={FORM_BLUE} />
                </View>
              </View>

              <Input label="Name" value={form.beneficiary_name}
                onChangeText={v => setF('beneficiary_name', v)} placeholder="Enter full name"
                required error={errors.beneficiary_name} icon="person-outline" />
                
              <Input label="Age" value={form.beneficiary_age}
                  onChangeText={v => setF('beneficiary_age', v)} type="number" placeholder="Enter age" icon="calendar-outline" />

              <Input label="Phone Number" value={form.beneficiary_phone}
                  onChangeText={v => setF('beneficiary_phone', v)} type="phone" placeholder="Enter phone number"
                  required error={errors.beneficiary_phone} maxLength={10} keyboardType="numeric" icon="call-outline" />

              <Text style={styles.fieldLabel}>Address <Text style={{ color: Colors.error }}>*</Text></Text>
              <View style={styles.addressRow}>
                <View style={{ flex: 1 }}>
                  <Input value={form.beneficiary_address}
                    onChangeText={v => setF('beneficiary_address', v)} type="multiline"
                    placeholder="Enter full address" error={errors.beneficiary_address} icon="home-outline" />
                </View>
                <TouchableOpacity style={styles.gpsBtn} onPress={fetchLocation} disabled={locationLoading}>
                  <Ionicons name={locationLoading ? 'hourglass' : 'locate'} size={24} color={Colors.white} />
                </TouchableOpacity>
              </View>

              {form.location_text ? (
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={16} color={FORM_BLUE} />
                  <Text style={styles.locationText} numberOfLines={2}>{form.location_text}</Text>
                </View>
              ) : null}
            </View>
          </>
        );

      // ── Step 1: Assessment Details ───────────────────────────────────────
      case 1:
        return (
          <>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>2. Issue Details</Text>
                <View style={styles.sectionIconBg}>
                  <Ionicons name="document-text-outline" size={16} color={FORM_BLUE} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Issue Category <Text style={{ color: Colors.error }}>*</Text></Text>
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

                <TouchableOpacity style={styles.addCategoryBtn} onPress={() => setAddCatModal(true)}>
                  <Ionicons name="add-circle" size={16} color={FORM_BLUE} />
                  <Text style={styles.addCategoryLabel}>Add New</Text>
                </TouchableOpacity>
              </View>

              {form.category === 'OTHER' && (
                <Input label="Specify Category" value={form.custom_category}
                  onChangeText={v => setF('custom_category', v)} placeholder="Enter category name" />
              )}

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Problem Description {!voiceUri && <Text style={{ color: Colors.error }}>*</Text>}</Text>
              
              {/* Voice recording button */}
              {voiceUri ? (
                <View style={[styles.voiceBtn, { borderColor: Colors.success, backgroundColor: '#F0FFF4' }]}>
                  <TouchableOpacity
                    style={[styles.voiceIconWrap, { backgroundColor: '#C6F6D5' }]}
                    onPress={isPlaying ? stopPlaying : playVoice}
                  >
                    <Ionicons name={isPlaying ? 'stop' : 'play'} size={24} color={Colors.success} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.voiceBtnTitle, { color: Colors.success }]}>
                      {isPlaying ? 'Playing Voice Note...' : 'Voice Note Recorded'}
                    </Text>
                    <Text style={styles.voiceBtnSub}>
                      Tap play to listen.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setVoiceUri(null)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                  activeOpacity={0.8}
                >
                  <View style={[styles.voiceIconWrap, isRecording && styles.voiceIconActive]}>
                    <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={24}
                      color={isRecording ? Colors.error : FORM_BLUE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.voiceBtnTitle, isRecording && { color: Colors.error }]}>
                      {isRecording ? '🔴 Recording… Tap to stop' : '🎤 Describe problem by voice'}
                    </Text>
                    <Text style={styles.voiceBtnSub}>
                      {isRecording ? 'Speak clearly into the mic' : 'Your voice note will be added to the description'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <Input
                value={form.description}
                onChangeText={v => setF('description', v)}
                type="multiline"
                placeholder="Type detailed description here..."
                error={errors.description}
              />
              <Text style={styles.charCount}>{form.description.length} {t('fao_report.characters')}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Upload Photos</Text>
              <View style={styles.idUploadBox}>
                <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={5} customIcon="cloud-upload-outline" customLabel="Upload Photos" />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Urgency Level</Text>
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
            </View>
          </>
        );

      // ── Step 2: Review & Submit ───────────────────────────────────────────
      case 2:
        return (
          <>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>3. Review & Submit</Text>
                <View style={styles.sectionIconBg}>
                  <Ionicons name="checkmark-outline" size={16} color={FORM_BLUE} />
                </View>
              </View>
              
              <View style={styles.previewBox}>
                <Text style={styles.previewSectionTitle}>Personal Info</Text>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Name:</Text><Text style={styles.previewVal}>{form.beneficiary_name}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Age:</Text><Text style={styles.previewVal}>{form.beneficiary_age || '-'}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Phone:</Text><Text style={styles.previewVal}>{form.beneficiary_phone}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Address:</Text><Text style={styles.previewVal}>{form.beneficiary_address}</Text></View>
                
                <Text style={styles.previewSectionTitle}>Assessment Details</Text>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Category:</Text><Text style={styles.previewVal}>{allCategories.find(c => c.key === form.category)?.label || form.category}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Urgency:</Text><Text style={styles.previewVal}>{form.priority}</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Photos:</Text><Text style={styles.previewVal}>{photos.length} uploaded</Text></View>
                <View style={styles.previewLine}><Text style={styles.previewKey}>Description:</Text><Text style={styles.previewVal}>{form.description.slice(0, 50)}{form.description.length > 50 ? '...' : ''}</Text></View>
              </View>
              <Text style={styles.submitNote}>By submitting, this request will be forwarded to Field Assessment Officers for review.</Text>
            </View>
          </>
        );

      default: return null;
    }
  };

  return (
    <>
      <View style={styles.flex}>
        {/* Header with progress bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={{ padding: 4, marginRight: 8 }}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Assessment' : 'New Assessment'}</Text>
            <Text style={styles.headerSub}>Step {step + 1} of {TOTAL_STEPS}</Text>
          </View>
          <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>

        {/* Step dots */}
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>

        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {renderStep()}
        </KeyboardAwareScrollView>

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
            title={step === TOTAL_STEPS - 1 ? 'Submit Assessment' : 'Next'}
            onPress={nextStep}
            loading={loading}
            style={{ flex: 2, backgroundColor: FORM_BLUE }}
          />
        </View>
      </View>

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
                style={{ backgroundColor: FORM_BLUE }}
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

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.gray100 },
  header: {
    backgroundColor: FORM_BLUE, paddingTop: 50, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  progressFill: { position: 'absolute', bottom: 0, left: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: Colors.gray100 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray300 },
  dotActive: { backgroundColor: FORM_BLUE, width: 20 },
  dotDone: { backgroundColor: Colors.success },
  scroll: { padding: 16, paddingBottom: 40 },
  
  card: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: Colors.gray200,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, marginTop: 4
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FORM_BLUE },
  sectionIconBg: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: FORM_BLUE_LIGHT,
    justifyContent: 'center', alignItems: 'center'
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gpsBtn: { width: 52, height: 52, borderRadius: 12, backgroundColor: FORM_BLUE, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: FORM_BLUE_LIGHT, borderRadius: 10, padding: 12, marginBottom: 8, gap: 8 },
  locationText: { fontSize: 13, color: FORM_BLUE, fontWeight: '500', flex: 1 },
  
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white },
  categoryActive: { borderColor: FORM_BLUE, backgroundColor: FORM_BLUE_LIGHT },
  categoryCustom: { borderColor: FORM_BLUE, borderStyle: 'dashed' },
  categoryLabel: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  categoryLabelActive: { color: FORM_BLUE, fontWeight: '700' },
  addCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: FORM_BLUE, borderStyle: 'dashed', backgroundColor: FORM_BLUE_LIGHT },
  addCategoryLabel: { fontSize: 13, fontWeight: '600', color: FORM_BLUE },
  
  voiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white, marginBottom: 16 },
  voiceBtnActive: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  voiceIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: FORM_BLUE_LIGHT, alignItems: 'center', justifyContent: 'center' },
  voiceIconActive: { backgroundColor: '#FFE8E8' },
  voiceBtnTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  voiceBtnSub: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  charCount: { fontSize: 12, color: Colors.gray400, textAlign: 'right', marginTop: -8, marginBottom: 8 },
  
  idUploadBox: {
    width: '100%', height: 120, borderRadius: 12, borderWidth: 1, borderColor: FORM_BLUE_LIGHT,
    borderStyle: 'dashed', backgroundColor: Colors.gray50, justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  
  urgencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: Colors.white },
  urgencyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  urgencyText: { flex: 1 },
  urgencyLabel: { fontSize: 15, fontWeight: '700' },
  urgencyDesc: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  
  previewBox: { width: '100%', backgroundColor: Colors.gray50, borderRadius: 12, padding: 16 },
  previewSectionTitle: { fontSize: 14, fontWeight: '700', color: FORM_BLUE, marginTop: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray200, paddingBottom: 6 },
  previewLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  previewKey: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  previewVal: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  submitNote: { fontSize: 13, color: Colors.gray500, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  
  errorText: { color: Colors.error, fontSize: 12, marginBottom: 8 },
  footerRow: { flexDirection: 'row', padding: 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  modalInput: { borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: FORM_BLUE, alignItems: 'center' },
  modalBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.gray300 },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  modalBtnOutlineText: { fontSize: 15, fontWeight: '700', color: Colors.gray600 },
});

export default NewAssessmentScreen;
