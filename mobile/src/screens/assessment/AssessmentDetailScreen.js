// screens/assessment/AssessmentDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Dimensions, Alert, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Header, Card, Badge, Button, CaseTimeline, CommentThread, ActionSheet } from '../../components/shared';
import PipelineBar from '../../components/shared/PipelineBar';
import { assessmentApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';


const { width } = Dimensions.get('window');

const AssessmentDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const { t } = useTranslation();
  const { isStaff, isFAO, isACO, isGEO, isManager } = useAuthStore();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionOptions, setActionOptions] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await assessmentApi.get(id);
      setData(res.data);
      setupActions(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load case details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action, actionData = {}) => {
    setActionLoading(true);
    try {
      await assessmentApi.action(id, action, actionData);
      await fetchData(); // Refresh data
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const setupActions = (caseData) => {
    const opts = [];
    const status = caseData.status;

    if (isFAO() && status === 'WITH_FAO') {
      opts.push({ label: 'Forward to ACO', icon: 'calculator', onPress: () => performAction('FORWARD_TO_ACO') });
      opts.push({ label: 'Return to Staff', icon: 'return-up-back', onPress: () => performAction('RETURN_TO_STAFF', { comment: 'Needs more info' }) });
      opts.push({ label: 'Reject Case', icon: 'close-circle', destructive: true, onPress: () => performAction('REJECT') });
      opts.push({ label: 'Mark as Urgent', icon: 'alert', onPress: () => performAction('MARK_URGENT') });
    } else if (isACO() && status === 'WITH_ACO') {
      // Typically ACO actions involve forms (handled via navigation in real app)
      opts.push({ label: 'Submit Calculation & Forward', icon: 'document-text', onPress: () => performAction('SUBMIT_CALCULATION') });
      opts.push({ label: 'Return to FAO', icon: 'return-up-back', onPress: () => performAction('RETURN_TO_FAO') });
    } else if (isGEO() && status === 'WITH_GEO') {
      opts.push({ label: 'Forward to Manager', icon: 'briefcase', onPress: () => performAction('FORWARD_TO_MANAGER') });
      opts.push({ label: 'Return for Enquiry', icon: 'help-circle', onPress: () => performAction('FURTHER_ENQUIRY') });
    } else if (isManager() && status === 'WITH_MANAGER') {
      opts.push({ label: 'Approve', icon: 'checkmark-circle', onPress: () => performAction('APPROVE') });
      opts.push({ label: 'Approve Partially', icon: 'checkmark-done', onPress: () => performAction('APPROVE_PARTIAL') });
      opts.push({ label: 'Reject', icon: 'close-circle', destructive: true, onPress: () => performAction('REJECT') });
    }

    setActionOptions(opts);
  };

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Header
        title={data.case_number}
        subtitle={format(new Date(data.created_at), 'dd MMM yyyy')}
        showBack
        rightComponent={
          actionOptions.length > 0 && (
            <TouchableOpacity onPress={() => setActionSheetVisible(true)}>
              <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
            </TouchableOpacity>
          )
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Pipeline / Progress */}
        <Card style={styles.section} padding={8}>
          <PipelineBar status={data.status} />
        </Card>

        {/* Header Info */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.beneficiaryName}>{data.beneficiary_name}</Text>
            <Text style={styles.category}>{data.category.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <Badge status={data.urgency} size="lg" />
        </View>

        {/* Details Card */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <LinkableRow
            icon="call" label="Phone" value={data.beneficiary_phone}
            onPress={() => data.beneficiary_phone && Linking.openURL(`tel:${data.beneficiary_phone}`)}
          />
          <LinkableRow
            icon="location" label="Address" value={data.beneficiary_address}
            onPress={() => {
              const addr = encodeURIComponent(data.beneficiary_address || '');
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${addr}`);
            }}
          />
          {data.beneficiary_age && <InfoRow icon="person" label="Age" value={data.beneficiary_age} />}
          <View style={styles.descBox}>
            <Text style={styles.descTitle}>Problem Description</Text>
            <Text style={styles.descText}>{data.description}</Text>
          </View>
        </Card>

        {/* Photos */}
        {data.photos && data.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({data.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {data.photos.map((p, i) => (
                <Image key={i} source={{ uri: p.image || p }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Calculation Summary (if ACO done) */}
        {data.calculation && (
          <Card style={[styles.section, { backgroundColor: Colors.orangeLight }]}>
            <Text style={[styles.sectionTitle, { color: Colors.orange }]}>ACO Assessment</Text>
            <InfoRow icon="cash" label="Est. Cost" value={`₹${data.calculation.estimated_cost}`} />
            <InfoRow icon="checkmark-circle" label="Recommended" value={`₹${data.calculation.recommended_amount}`} />
            <InfoRow icon="document-text" label="Note" value={data.calculation.justification} />
          </Card>
        )}

        {/* Comments & Timeline */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Discussion & Activity</Text>
        <Card style={styles.section} padding={0}>
          <View style={styles.tabContainer}>
            <CommentThread assessmentId={id} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Timeline</Text>
        <Card style={styles.section}>
           <CaseTimeline history={data.history} />
        </Card>
      </ScrollView>

      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        title="Case Actions"
        options={actionOptions}
      />
    </View>
  );
};

// Plain info row
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={Colors.gray500} style={styles.infoIcon} />
    <Text style={styles.infoKey}>{label}</Text>
    <Text style={styles.infoValue}>{value || '-'}</Text>
  </View>
);

// Tappable info row — opens phone/maps links
const LinkableRow = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={16} color={Colors.primary} style={styles.infoIcon} />
    <Text style={styles.infoKey}>{label}</Text>
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={[styles.infoValue, styles.linkValue]} numberOfLines={2}>{value || '-'}</Text>
      {value ? <Ionicons name="open-outline" size={14} color={Colors.primary} /> : null}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  beneficiaryName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  category: { fontSize: 12, color: Colors.gray500, marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoIcon: { width: 24 },
  infoKey: { width: 80, fontSize: 13, color: Colors.gray500 },
  infoValue: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  linkValue: { color: Colors.primary, textDecorationLine: 'underline' },
  descBox: { backgroundColor: Colors.gray50, padding: 12, borderRadius: 10, marginTop: 8 },
  descTitle: { fontSize: 12, fontWeight: '600', color: Colors.gray600, marginBottom: 6 },
  descText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  photo: { width: width * 0.4, height: width * 0.4, borderRadius: 12, marginRight: 10, backgroundColor: Colors.gray200 },
  tabContainer: { height: 400 }, // Fixed height for comment thread area inside scrollview
});

export default AssessmentDetailScreen;
