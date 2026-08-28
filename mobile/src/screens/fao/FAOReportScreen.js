// screens/fao/FAOReportScreen.js — Full field assessment report form
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import {
  Button, Input, PhotoPicker, Card, EligibilityToggle, Badge,
} from '../../components/shared';
import { faoApi, assessmentApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { isValidPhone } from '../../utils/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Collapsible Section ────────────────────────────────────────────
const Section = ({ title, icon, color = Colors.primary, children, required, filled, isSaved, onSave, onEdit }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(heightAnim, {
      toValue: open ? 0 : 1,
      useNativeDriver: true,
    }).start();
    setOpen(!open);
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {required && !filled && <Text style={styles.sectionRequired}>{t('fao_report.required')}</Text>}
        </View>
        {filled && <Ionicons name="checkmark-circle" size={20} color={Colors.success} />}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray400} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
      {open && (
        <View style={styles.sectionBody}>
          <View pointerEvents={isSaved ? "none" : "auto"} style={{ opacity: isSaved ? 0.7 : 1 }}>
            {children}
          </View>
          {(onSave || onEdit) && (
            <View style={styles.sectionFooter}>
              {isSaved ? (
                <TouchableOpacity style={[styles.sectionBtn, styles.sectionBtnOutline, { borderColor: color }]} onPress={onEdit}>
                  <Text style={[styles.sectionBtnText, { color }]}>{t('fao_report.edit_section')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.sectionBtn, { backgroundColor: color }]} onPress={onSave}>
                  <Text style={[styles.sectionBtnText, { color: '#fff' }]}>{t('fao_report.submit_section')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const FAOReportScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { assessmentId } = route.params;
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [savedSections, setSavedSections] = useState({});

  const [form, setForm] = useState({
    // Beneficiary verification
    beneficiary_verified_name: '',
    beneficiary_verified_address: '',
    beneficiary_verified_phone: '',
    address_corrections: '',
    // Ex-ward member
    ex_ward_member_name: '',
    ex_ward_member_position: '',
    ex_ward_member_report: '',
    // Current ward member
    current_ward_member_name: '',
    current_ward_member_position: '',
    current_ward_member_report: '',
    // Neighbours
    neighbour_1_name: '',
    neighbour_1_relationship: '',
    neighbour_1_statement: '',
    neighbour_2_name: '',
    neighbour_2_relationship: '',
    neighbour_2_statement: '',
    // Officer findings
    officer_findings: '',
    visit_location_lat: null,
    visit_location_lng: null,
    visit_location_text: '',
    // Decision
    category_confirmed: '',
    urgency_assessment: 'NORMAL',
    eligibility: 'PENDING',
    eligibility_reason: '',
  });

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Load existing report or assessment data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await assessmentApi.get(assessmentId);
        setAssessment(res.data);

        // Try to load local draft first
        let draft = null;
        try {
          const draftStr = await AsyncStorage.getItem(`FAO_DRAFT_${assessmentId}`);
          if (draftStr) {
            draft = JSON.parse(draftStr);
          }
        } catch (e) {
          console.error('Failed to load draft', e);
        }

        // Try to load existing FAO report from server
        let backendReport = null;
        try {
          const reportRes = await faoApi.getReport(assessmentId);
          backendReport = reportRes.data;
        } catch (_) { /* No existing report, that's fine */ }

        setForm(prev => {
          const newForm = { ...prev };
          // Base data from assessment
          newForm.beneficiary_verified_name = res.data.beneficiary_name || '';
          newForm.beneficiary_verified_address = res.data.beneficiary_address || '';
          newForm.beneficiary_verified_phone = res.data.beneficiary_phone || '';
          newForm.category_confirmed = res.data.category || '';
          // Merge Backend Report if any
          if (backendReport) {
            Object.assign(newForm, backendReport);
          }
          // Merge Draft (takes highest priority)
          if (draft) {
            Object.assign(newForm, draft);
          }
          return newForm;
        });

        // Try to load saved sections draft
        try {
          const sectionsStr = await AsyncStorage.getItem(`FAO_DRAFT_SECTIONS_${assessmentId}`);
          if (sectionsStr) {
            setSavedSections(JSON.parse(sectionsStr));
          }
        } catch (e) {
          console.error('Failed to load sections draft', e);
        }
      } catch (err) {
        Alert.alert(t('common.error'), t('fao_report.could_not_load'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  // Auto-save draft
  useEffect(() => {
    // Only save if not loading and not submitting
    if (loading || submitting || !assessmentId) return;

    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(`FAO_DRAFT_${assessmentId}`, JSON.stringify(form));
        await AsyncStorage.setItem(`FAO_DRAFT_SECTIONS_${assessmentId}`, JSON.stringify(savedSections));
      } catch (e) {
        console.error('Failed to save draft', e);
      }
    };

    const timer = setTimeout(saveDraft, 1000); // Debounce save
    return () => clearTimeout(timer);
  }, [form, savedSections, loading, submitting, assessmentId]);

  const fetchLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('fao_report.permission_denied'), t('fao_report.location_access_req'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [place.name, place.street, place.district, place.city, place.region].filter(Boolean);
      const text = parts.join(', ');
      setF('visit_location_lat', latitude);
      setF('visit_location_lng', longitude);
      setF('visit_location_text', text);
      Toast.show({ type: 'success', text1: t('fao_report.location_captured'), text2: text });
    } catch (e) {
      Alert.alert(t('common.error'), t('fao_report.error_get_location'));
    } finally {
      setLocLoading(false);
    }
  };

  // Validation
  const validate = () => {
    if (form.beneficiary_verified_phone && !isValidPhone(form.beneficiary_verified_phone)) {
      Alert.alert(t('fao_report.invalid_phone'), t('fao_report.invalid_phone_msg'));
      return false;
    }
    if (!form.officer_findings.trim()) {
      Alert.alert(t('fao_report.required_alert'), t('fao_report.officer_findings_req'));
      return false;
    }
    if (form.eligibility === 'PENDING') {
      Alert.alert(t('fao_report.required_alert'), t('fao_report.eligibility_req'));
      return false;
    }
    if (!form.eligibility_reason.trim()) {
      Alert.alert(t('fao_report.required_alert'), t('fao_report.eligibility_reason_req'));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = { ...form, uploaded_photos: photos };
      await faoApi.submitReport(assessmentId, payload);
      
      // Clear draft on successful submission
      try {
        await AsyncStorage.removeItem(`FAO_DRAFT_${assessmentId}`);
        await AsyncStorage.removeItem(`FAO_DRAFT_SECTIONS_${assessmentId}`);
      } catch (e) {}

      const msg = form.eligibility === 'ELIGIBLE'
        ? t('fao_report.case_eligible_msg')
        : t('fao_report.case_not_eligible_msg');
      Toast.show({ type: 'success', text1: t('fao_report.fao_report_submitted'), text2: msg });
      navigation.goBack();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Submission failed.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const isBeneficiaryFilled = form.beneficiary_verified_name && form.beneficiary_verified_address;
  const isExWardFilled = form.ex_ward_member_name && form.ex_ward_member_report;
  const isCurrentWardFilled = form.current_ward_member_name && form.current_ward_member_report;
  const isNeighboursFilled = form.neighbour_1_name && form.neighbour_1_statement;
  const isOfficerFilled = form.officer_findings.length >= 20;
  const isDecisionFilled = form.eligibility !== 'PENDING' && form.eligibility_reason;

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('fao_report.loading_assessment')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('fao_report.title')}</Text>
          <Text style={styles.headerSub}>{assessment?.request_number}</Text>
        </View>
        <Badge status={assessment?.priority} size="sm" />
      </View>

      {/* Beneficiary summary bar */}
      {assessment && (
        <View style={styles.beneficiaryBar}>
          <Ionicons name="person-circle" size={32} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bName}>{assessment.beneficiary_name}</Text>
            <Text style={styles.bAddr} numberOfLines={1}>{assessment.beneficiary_address}</Text>
          </View>
          <View style={[styles.catChip, { backgroundColor: Colors.primaryLight }]}>
            <Text style={styles.catChipText}>{assessment.category?.replace('_', ' ')}</Text>
          </View>
        </View>
      )}

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20}
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Beneficiary Verification */}
        <Section
          title={t('fao_report.beneficiary_verification')}
          icon="person-circle"
          color={Colors.primary}
          required
          filled={isBeneficiaryFilled}
          isSaved={savedSections.beneficiary}
          onSave={() => setSavedSections(s => ({ ...s, beneficiary: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, beneficiary: false }))}
        >
          <Input
            label={t('fao_report.verified_full_name')}
            value={form.beneficiary_verified_name}
            onChangeText={v => setF('beneficiary_verified_name', v)}
            placeholder={t('fao_report.verified_full_name_ph')}
            required
          />
          <Input
            label={t('fao_report.verified_phone')}
            value={form.beneficiary_verified_phone}
            onChangeText={v => setF('beneficiary_verified_phone', v)}
            type="phone"
            placeholder={t('fao_report.verified_phone_ph')}
            maxLength={10}
            keyboardType="numeric"
          />
          <Input
            label={t('fao_report.verified_address')}
            value={form.beneficiary_verified_address}
            onChangeText={v => setF('beneficiary_verified_address', v)}
            type="multiline"
            placeholder={t('fao_report.verified_address_ph')}
            required
          />
          <Input
            label={t('fao_report.address_corrections')}
            value={form.address_corrections}
            onChangeText={v => setF('address_corrections', v)}
            type="multiline"
            placeholder={t('fao_report.address_corrections_ph')}
          />
        </Section>

        {/* ── Section 2: Ex-Ward Member Report */}
        <Section
          title={t('fao_report.ex_ward_member_report')}
          icon="ribbon"
          color={Colors.info}
          required
          filled={isExWardFilled}
          isSaved={savedSections.exWard}
          onSave={() => setSavedSections(s => ({ ...s, exWard: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, exWard: false }))}
        >
          <Input
            label={t('fao_report.ex_ward_member_name')}
            value={form.ex_ward_member_name}
            onChangeText={v => setF('ex_ward_member_name', v)}
            placeholder={t('fao_report.ex_ward_member_name_ph')}
          />
          <Input
            label={t('fao_report.position_role')}
            value={form.ex_ward_member_position}
            onChangeText={v => setF('ex_ward_member_position', v)}
            placeholder={t('fao_report.ex_ward_position_ph')}
          />
          <Input
            label={t('fao_report.statement_report')}
            value={form.ex_ward_member_report}
            onChangeText={v => setF('ex_ward_member_report', v)}
            type="multiline"
            placeholder={t('fao_report.ex_ward_statement_ph')}
            required
          />
        </Section>

        {/* ── Section 3: Current Ward Member Report */}
        <Section
          title={t('fao_report.current_ward_member_report')}
          icon="business"
          color={Colors.purple}
          required
          filled={isCurrentWardFilled}
          isSaved={savedSections.currentWard}
          onSave={() => setSavedSections(s => ({ ...s, currentWard: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, currentWard: false }))}
        >
          <Input
            label={t('fao_report.current_ward_member_name')}
            value={form.current_ward_member_name}
            onChangeText={v => setF('current_ward_member_name', v)}
            placeholder={t('fao_report.current_ward_member_name_ph')}
          />
          <Input
            label={t('fao_report.position_role')}
            value={form.current_ward_member_position}
            onChangeText={v => setF('current_ward_member_position', v)}
            placeholder={t('fao_report.current_ward_position_ph')}
          />
          <Input
            label={t('fao_report.statement_report')}
            value={form.current_ward_member_report}
            onChangeText={v => setF('current_ward_member_report', v)}
            type="multiline"
            placeholder={t('fao_report.current_ward_statement_ph')}
            required
          />
        </Section>

        {/* ── Section 4: Neighbour Statements */}
        <Section
          title={t('fao_report.neighbour_statements')}
          icon="people"
          color={Colors.orange}
          required
          filled={isNeighboursFilled}
          isSaved={savedSections.neighbours}
          onSave={() => setSavedSections(s => ({ ...s, neighbours: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, neighbours: false }))}
        >
          <Text style={styles.neighbourTitle}>{t('fao_report.neighbour_1')}</Text>
          <Input
            label={t('common.name')}
            value={form.neighbour_1_name}
            onChangeText={v => setF('neighbour_1_name', v)}
            placeholder={t('fao_report.neighbour_name_ph1')}
            required
          />
          <Input
            label={t('fao_report.relationship')}
            value={form.neighbour_1_relationship}
            onChangeText={v => setF('neighbour_1_relationship', v)}
            placeholder={t('fao_report.relationship_ph1')}
          />
          <Input
            label={t('fao_report.statement_report')}
            value={form.neighbour_1_statement}
            onChangeText={v => setF('neighbour_1_statement', v)}
            type="multiline"
            placeholder={t('fao_report.statement_ph1')}
            required
          />

          <View style={styles.divider} />

          <Text style={styles.neighbourTitle}>{t('fao_report.neighbour_2')}</Text>
          <Input
            label={t('common.name')}
            value={form.neighbour_2_name}
            onChangeText={v => setF('neighbour_2_name', v)}
            placeholder={t('fao_report.neighbour_name_ph2')}
          />
          <Input
            label={t('fao_report.relationship')}
            value={form.neighbour_2_relationship}
            onChangeText={v => setF('neighbour_2_relationship', v)}
            placeholder={t('fao_report.relationship_ph2')}
          />
          <Input
            label={t('fao_report.statement_report')}
            value={form.neighbour_2_statement}
            onChangeText={v => setF('neighbour_2_statement', v)}
            type="multiline"
            placeholder={t('fao_report.statement_ph2')}
          />
        </Section>

        {/* ── Section 5: Officer Findings + Photos */}
        <Section
          title={t('fao_report.officers_own_findings')}
          icon="clipboard"
          color={Colors.primary}
          required
          filled={isOfficerFilled}
          isSaved={savedSections.officer}
          onSave={() => setSavedSections(s => ({ ...s, officer: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, officer: false }))}
        >
          {/* GPS Location */}
          <View style={styles.locationRow}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('fao_report.visit_location')}
                value={form.visit_location_text}
                onChangeText={v => setF('visit_location_text', v)}
                placeholder={t('fao_report.visit_location_ph')}
              />
            </View>
            <TouchableOpacity style={styles.gpsBtn} onPress={fetchLocation} disabled={locLoading}>
              <Ionicons name={locLoading ? 'hourglass' : 'locate'} size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>

          {form.visit_location_lat && (
            <View style={styles.coordBadge}>
              <Ionicons name="location" size={12} color={Colors.primary} />
              <Text style={styles.coordText}>
                {form.visit_location_lat.toFixed(5)}°N, {form.visit_location_lng.toFixed(5)}°E
              </Text>
            </View>
          )}

          <Input
            label={t('fao_report.officers_findings')}
            value={form.officer_findings}
            onChangeText={v => setF('officer_findings', v)}
            type="multiline"
            placeholder={t('fao_report.officers_findings_ph')}
            required
          />
          <Text style={styles.charCount}>{form.officer_findings.length} {t('fao_report.characters')}</Text>

          <Text style={styles.photoLabel}>{t('fao_report.field_visit_photos')}</Text>
          <Text style={styles.photoHint}>{t('fao_report.field_visit_photos_hint')}</Text>
          <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={10} />
        </Section>

        {/* ── Section 6: Assessment Decision */}
        <Section
          title={t('fao_report.assessment_decision')}
          icon="shield-checkmark"
          color={Colors.success}
          required
          filled={isDecisionFilled}
          isSaved={savedSections.decision}
          onSave={() => setSavedSections(s => ({ ...s, decision: true }))}
          onEdit={() => setSavedSections(s => ({ ...s, decision: false }))}
        >
          <Text style={styles.fieldLabel}>{t('fao_report.urgency_level')}</Text>
          <View style={styles.urgencyRow}>
            {['NORMAL', 'URGENT', 'CRITICAL'].map(u => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.urgencyChip,
                  form.urgency_assessment === u && styles.urgencyChipActive,
                  u === 'CRITICAL' && form.urgency_assessment === u && { backgroundColor: Colors.error, borderColor: Colors.error },
                  u === 'URGENT' && form.urgency_assessment === u && { backgroundColor: Colors.primary, borderColor: Colors.warning },
                  u === 'NORMAL' && form.urgency_assessment === u && { backgroundColor: Colors.success, borderColor: Colors.success },
                ]}
                onPress={() => setF('urgency_assessment', u)}
              >
                <Text style={[
                  styles.urgencyChipText,
                  form.urgency_assessment === u && { color: Colors.white }
                ]}>
                {t(`status.${u}`)}
              </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('fao_report.category_confirmation')}</Text>
          <View style={styles.categoryGrid}>
            {['MEDICAL', 'HOUSING', 'EDUCATION', 'FOOD', 'DISABILITY', 'ELDERLY', 'CHILD_WELFARE', 'WOMEN_WELFARE', 'LIVELIHOOD', 'OTHER'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, form.category_confirmed === cat && styles.catBtnActive]}
                onPress={() => setF('category_confirmed', cat)}
              >
                <Text style={[styles.catBtnText, form.category_confirmed === cat && styles.catBtnTextActive]}>
                  {t(`assessment.categories.${cat === 'CHILD_WELFARE' ? 'child' : cat === 'WOMEN_WELFARE' ? 'women' : cat.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: 16 }}>
            <EligibilityToggle
              value={form.eligibility}
              onChange={v => setF('eligibility', v)}
            />
          </View>

          <Input
            label={t('fao_report.reason_justification')}
            value={form.eligibility_reason}
            onChangeText={v => setF('eligibility_reason', v)}
            type="multiline"
            placeholder={t('fao_report.reason_justification_ph')}
            required
          />
        </Section>

        {/* Submit */}
        <View style={styles.submitArea}>
          <Button
            title={submitting ? t('fao_report.submitting_report') : t('fao_report.submit_fao_report')}
            onPress={handleSubmit}
            loading={submitting}
            variant={form.eligibility === 'NOT_ELIGIBLE' ? 'danger' : 'success'}
          />
          <Text style={styles.submitNote}>
            {form.eligibility === 'ELIGIBLE'
              ? t('fao_report.submit_note_eligible')
              : form.eligibility === 'NOT_ELIGIBLE'
              ? t('fao_report.submit_note_not_eligible')
              : t('fao_report.submit_note_pending')}
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.gray500 },

  header: {
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  beneficiaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  bName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  bAddr: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catChipText: { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },

  scroll: { padding: 16, paddingBottom: 40 },

  section: {
    backgroundColor: Colors.white, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionRequired: { fontSize: 11, color: Colors.error, marginTop: 2 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 12 },
  sectionBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionBtnOutline: { borderWidth: 1.5, backgroundColor: 'transparent' },
  sectionBtnText: { fontSize: 14, fontWeight: '700' },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray700, marginBottom: 10 },
  charCount: { fontSize: 11, color: Colors.gray400, textAlign: 'right', marginTop: -8, marginBottom: 8 },
  photoLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray700, marginBottom: 4 },
  photoHint: { fontSize: 12, color: Colors.gray500, marginBottom: 12 },

  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: 16 },
  neighbourTitle: { fontSize: 14, fontWeight: '700', color: Colors.orange, marginBottom: 12 },

  locationRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  gpsBtn: {
    width: 46, height: 50, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  coordBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 8, padding: 8, marginBottom: 12,
  },
  coordText: { fontSize: 11, color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  urgencyRow: { flexDirection: 'row', gap: 10 },
  urgencyChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.gray200, alignItems: 'center',
  },
  urgencyChipActive: { borderColor: Colors.success },
  urgencyChipText: { fontSize: 12, fontWeight: '700', color: Colors.gray600 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white,
  },
  catBtnActive: { borderColor: Colors.warning, backgroundColor: Colors.primaryLight },
  catBtnText: { fontSize: 12, fontWeight: '500', color: Colors.gray700 },
  catBtnTextActive: { color: Colors.warning, fontWeight: '700' },

  submitArea: { marginTop: 8, gap: 12 },
  submitNote: { fontSize: 12, color: Colors.gray500, textAlign: 'center', lineHeight: 18 },
});

export default FAOReportScreen;
