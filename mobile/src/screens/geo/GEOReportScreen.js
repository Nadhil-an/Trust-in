// screens/geo/GEOReportScreen.js — Advanced verification report
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { Button, Input, PhotoPicker, Card, Badge } from '../../components/shared';
import { geoApi, assessmentApi } from '../../api';

const RECOMMENDATIONS = [
  {
    key: 'APPROVE_AS_IS',
    label: 'Approve As-Is',
    icon: 'checkmark-circle',
    color: Colors.success,
    desc: 'Verified — approve ACO recommendation without changes',
  },
  {
    key: 'APPROVE_WITH_CHANGES',
    label: 'Approve with Changes',
    icon: 'checkmark-done',
    color: Colors.warning,
    desc: 'Approve but with a different recommended amount',
  },
  {
    key: 'FURTHER_REVIEW',
    label: 'Needs Further Review',
    icon: 'help-circle',
    color: Colors.purple,
    desc: 'Mark for additional investigation',
  },
  {
    key: 'REJECT',
    label: 'Reject',
    icon: 'close-circle',
    color: Colors.error,
    desc: 'Reject the application — this will notify the Manager',
  },
];

// ── Summary Panel ─────────────────────────────────────────────────
const SummaryPanel = ({ assessment }) => {
  const fao = assessment?.fao_report_summary;
  const aco = assessment?.aco_calculation_summary;

  return (
    <View style={styles.summaryContainer}>
      {fao && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>📋 FAO Report</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Eligibility</Text>
            <View style={[styles.pill, { backgroundColor: fao.eligibility === 'ELIGIBLE' ? Colors.successLight : Colors.errorLight }]}>
              <Text style={[styles.pillText, { color: fao.eligibility === 'ELIGIBLE' ? Colors.success : Colors.error }]}>
                {fao.eligibility}
              </Text>
            </View>
          </View>
          {fao.urgency_assessment && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>FAO Urgency</Text>
              <Text style={styles.summaryValue}>{fao.urgency_assessment}</Text>
            </View>
          )}
          {fao.officer_findings && (
            <Text style={styles.summaryExcerpt} numberOfLines={2}>{fao.officer_findings}</Text>
          )}
        </View>
      )}

      {aco && (
        <View style={[styles.summaryCard, { borderLeftColor: Colors.orange }]}>
          <Text style={styles.summaryCardTitle}>🧮 ACO Calculation</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Estimated</Text>
            <Text style={[styles.summaryValue, { fontWeight: '800' }]}>₹{aco.total_estimated_cost}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Recommended</Text>
            <Text style={[styles.summaryValue, { color: Colors.orange, fontWeight: '800', fontSize: 15 }]}>
              ₹{aco.recommended_amount}
            </Text>
          </View>
          {aco.justification && (
            <Text style={styles.summaryExcerpt} numberOfLines={2}>{aco.justification}</Text>
          )}
        </View>
      )}
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const GEOReportScreen = ({ route, navigation }) => {
  const { assessmentId } = route.params;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [photos, setPhotos] = useState([]);

  const [form, setForm] = useState({
    verification_findings: '',
    discrepancies_found: '',
    field_notes: '',
    visit_location_lat: null,
    visit_location_lng: null,
    visit_location_text: '',
    recommendation: '',
    recommended_amount_override: '',
    recommendation_justification: '',
  });

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await assessmentApi.get(assessmentId);
        setAssessment(res.data);
        // Load existing GEO report if present
        try {
          const geoRes = await geoApi.getReport(assessmentId);
          const r = geoRes.data;
          setForm(prev => ({
            ...prev,
            verification_findings: r.verification_findings || '',
            discrepancies_found: r.discrepancies_found || '',
            field_notes: r.field_notes || '',
            visit_location_text: r.visit_location_text || '',
            recommendation: r.recommendation || '',
            recommended_amount_override: r.recommended_amount_override ? String(r.recommended_amount_override) : '',
            recommendation_justification: r.recommendation_justification || '',
          }));
        } catch (_) { /* No existing report */ }
      } catch (err) {
        Alert.alert('Error', 'Could not load assessment.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  const fetchLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [place.name, place.street, place.district, place.city].filter(Boolean);
      const text = parts.join(', ');
      setF('visit_location_lat', latitude);
      setF('visit_location_lng', longitude);
      setF('visit_location_text', text);
      Toast.show({ type: 'success', text1: '📍 Location captured', text2: text });
    } catch (e) {
      Alert.alert('Error', 'Could not get location.');
    } finally {
      setLocLoading(false);
    }
  };

  const validate = () => {
    if (!form.verification_findings.trim()) {
      Alert.alert('Required', 'Please fill in your verification findings.');
      return false;
    }
    if (!form.recommendation) {
      Alert.alert('Required', 'Please select a recommendation.');
      return false;
    }
    if (!form.recommendation_justification.trim()) {
      Alert.alert('Required', 'Please provide justification for your recommendation.');
      return false;
    }
    if (form.recommendation === 'APPROVE_WITH_CHANGES' && !form.recommended_amount_override) {
      Alert.alert('Required', 'Please enter the revised recommended amount.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        recommended_amount_override: form.recommended_amount_override
          ? parseFloat(form.recommended_amount_override)
          : null,
        uploaded_photos: photos,
      };
      await geoApi.submitReport(assessmentId, payload);
      const recLabel = RECOMMENDATIONS.find(r => r.key === form.recommendation)?.label || form.recommendation;
      Toast.show({
        type: 'success',
        text1: 'GEO Report Submitted ✅',
        text2: `Recommendation: ${recLabel} — Manager notified`,
      });
      navigation.goBack();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Submission failed.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={Colors.purple} />
        <Text style={styles.loadingText}>Loading Case...</Text>
      </View>
    );
  }

  const selectedRec = RECOMMENDATIONS.find(r => r.key === form.recommendation);

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
          <Text style={styles.headerTitle}>Verification Report</Text>
          <Text style={styles.headerSub}>{assessment?.request_number}</Text>
        </View>
        <Badge status={assessment?.priority} size="sm" />
      </View>

      {/* Beneficiary bar */}
      <View style={styles.beneficiaryBar}>
        <Ionicons name="person-circle" size={28} color={Colors.purple} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bName}>{assessment?.beneficiary_name}</Text>
          <Text style={styles.bAddr} numberOfLines={1}>{assessment?.beneficiary_address}</Text>
        </View>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* FAO & ACO Summary */}
        <SummaryPanel assessment={assessment} />

        {/* ── Section: Field Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.purple + '20' }]}>
              <Ionicons name="search" size={18} color={Colors.purple} />
            </View>
            <Text style={styles.sectionTitle}>Field Verification</Text>
          </View>
          <View style={styles.sectionBody}>
            {/* GPS Location */}
            <View style={styles.locationRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Visit Location"
                  value={form.visit_location_text}
                  onChangeText={v => setF('visit_location_text', v)}
                  placeholder="Location where verification was done"
                />
              </View>
              <TouchableOpacity style={styles.gpsBtn} onPress={fetchLocation} disabled={locLoading}>
                <Ionicons name={locLoading ? 'hourglass' : 'locate'} size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <Input
              label="Verification Findings *"
              value={form.verification_findings}
              onChangeText={v => setF('verification_findings', v)}
              type="multiline"
              placeholder="Describe your findings during the verification visit — what you observed, who you spoke to, what documents you checked..."
              required
            />
            <Input
              label="Discrepancies Found"
              value={form.discrepancies_found}
              onChangeText={v => setF('discrepancies_found', v)}
              type="multiline"
              placeholder="Any discrepancies between FAO report and your own findings (leave blank if none)..."
            />
            <Input
              label="Field Notes"
              value={form.field_notes}
              onChangeText={v => setF('field_notes', v)}
              type="multiline"
              placeholder="Any additional notes..."
            />

            <Text style={styles.photoLabel}>📷 Verification Photos</Text>
            <PhotoPicker photos={photos} onPhotosChange={setPhotos} maxPhotos={8} />
          </View>
        </View>

        {/* ── Section: GEO Recommendation */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Your Recommendation *</Text>
            {form.recommendation && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} style={{ marginLeft: 'auto', marginRight: 4 }} />
            )}
          </View>
          <View style={styles.sectionBody}>
            {RECOMMENDATIONS.map(rec => (
              <TouchableOpacity
                key={rec.key}
                style={[
                  styles.recBtn,
                  form.recommendation === rec.key && {
                    borderColor: rec.color,
                    backgroundColor: rec.color + '10',
                  }
                ]}
                onPress={() => setF('recommendation', rec.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.recIcon, { backgroundColor: rec.color + '20' }]}>
                  <Ionicons name={rec.icon} size={22} color={rec.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recLabel, form.recommendation === rec.key && { color: rec.color }]}>
                    {rec.label}
                  </Text>
                  <Text style={styles.recDesc}>{rec.desc}</Text>
                </View>
                {form.recommendation === rec.key && (
                  <Ionicons name="checkmark-circle" size={20} color={rec.color} />
                )}
              </TouchableOpacity>
            ))}

            {/* Override amount if Approve with Changes */}
            {form.recommendation === 'APPROVE_WITH_CHANGES' && (
              <View style={styles.overrideCard}>
                <Ionicons name="pencil" size={16} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Input
                    label="Revised Recommended Amount (₹) *"
                    value={form.recommended_amount_override}
                    onChangeText={v => setF('recommended_amount_override', v)}
                    keyboardType="decimal-pad"
                    placeholder="Enter revised amount"
                    required
                  />
                </View>
              </View>
            )}

            <Input
              label="Justification *"
              value={form.recommendation_justification}
              onChangeText={v => setF('recommendation_justification', v)}
              type="multiline"
              placeholder="Explain the basis for your recommendation..."
              required
            />
          </View>
        </View>

        {/* Submit */}
        <View style={styles.submitArea}>
          <Button
            title={submitting ? 'Submitting...' : 'Submit GEO Report'}
            onPress={handleSubmit}
            loading={submitting}
            variant={form.recommendation === 'REJECT' ? 'danger' : 'primary'}
          />
          {selectedRec && (
            <View style={[styles.submitBanner, { backgroundColor: selectedRec.color + '15' }]}>
              <Ionicons name={selectedRec.icon} size={16} color={selectedRec.color} />
              <Text style={[styles.submitBannerText, { color: selectedRec.color }]}>
                {selectedRec.desc} — Manager will be notified immediately.
              </Text>
            </View>
          )}
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
    backgroundColor: Colors.purple, paddingHorizontal: 16, paddingBottom: 16,
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

  summaryContainer: { gap: 10, marginBottom: 12, marginTop: 8 },
  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.warning,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  summaryCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.gray700, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  summaryKey: { fontSize: 12, color: Colors.gray500, width: 90 },
  summaryValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  summaryExcerpt: { fontSize: 12, color: Colors.gray600, lineHeight: 18, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40 },

  section: {
    backgroundColor: Colors.white, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },

  locationRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  gpsBtn: {
    width: 46, height: 50, borderRadius: 12, backgroundColor: Colors.purple,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  photoLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray700, marginBottom: 8, marginTop: 4 },

  recBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: 14,
    padding: 14, marginBottom: 10, backgroundColor: Colors.white,
  },
  recIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  recDesc: { fontSize: 12, color: Colors.gray500 },

  overrideCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.warningLight, borderRadius: 12, padding: 12, marginBottom: 12,
  },

  submitArea: { marginTop: 8, gap: 10 },
  submitBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 12,
  },
  submitBannerText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});

export default GEOReportScreen;
