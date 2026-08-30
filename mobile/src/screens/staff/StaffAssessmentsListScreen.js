// screens/staff/StaffAssessmentsListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Alert, RefreshControl, TextInput, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { assessmentApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/authStore';

const StaffAssessmentsListScreen = ({ navigation }) => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assessmentToView, setAssessmentToView] = useState(null);
  const user = useAuthStore(state => state.user);

  useNotificationSocket((data) => {
    if (data.type === 'DASHBOARD_REFRESH') {
      fetchAssessments(false);
    }
  });

  const fetchAssessments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await assessmentApi.list({ limit: 100 }); 
      setAssessments(res.data.results || res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load assessments' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAssessments(true);
    });
    return unsubscribe;
  }, [navigation]);

  const handleDelete = (assessment) => {
    Alert.alert(
      'Delete Assessment',
      `Are you sure you want to delete assessment ${assessment.request_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await assessmentApi.delete(assessment.id);
              Toast.show({ type: 'success', text1: 'Assessment deleted' });
              fetchAssessments(false);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete assessment. It might have already progressed to next stages.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setAssessmentToView(item)}
    >
      <View style={styles.cardInfo}>
        <View style={[styles.iconWrap, { backgroundColor: '#F3E8FF' }]}>
          <Ionicons name="clipboard" size={20} color="#9333EA" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name}>{item.beneficiary_name}</Text>
          <Text style={styles.details}>{item.request_number} • {item.status}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={[styles.priorityBadge, 
          item.priority === 'CRITICAL' ? { backgroundColor: '#FEE2E2' } : 
          item.priority === 'URGENT' ? { backgroundColor: '#FEF3C7' } : 
          { backgroundColor: '#E0F2FE' }]}>
          <Text style={[styles.priorityText, 
            item.priority === 'CRITICAL' ? { color: '#DC2626' } : 
            item.priority === 'URGENT' ? { color: '#D97706' } : 
            { color: '#0369A1' }]}>
            {item.priority || 'NORMAL'}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('NewAssessment', { editItem: item })}
          >
            <Ionicons name="pencil" size={18} color={Colors.info} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.errorLight }]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const groupDataByDate = (data) => {
    const grouped = data.reduce((acc, item) => {
      const dateStr = item.created_at || item.joining_date || item.date;
      const dateObj = new Date(dateStr);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      if (!acc[formattedDate]) {
        acc[formattedDate] = [];
      }
      acc[formattedDate].push(item);
      return acc;
    }, {});

    const sections = Object.keys(grouped).map(date => ({
      title: date,
      data: grouped[date].reverse()
    }));

    sections.sort((a, b) => {
      const [dayA, monthA, yearA] = a.title.split('/');
      const [dayB, monthB, yearB] = b.title.split('/');
      return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
    });

    return sections;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assessments Submitted</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assessments..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <SectionList
        sections={groupDataByDate(assessments.filter(a => 
          a.beneficiary_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          a.request_number?.toLowerCase().includes(searchQuery.toLowerCase())
        ))}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAssessments(false); }} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color={Colors.gray400} />
              <Text style={styles.emptyText}>You haven't submitted any assessments yet.</Text>
            </View>
          )
        }
      />

      {/* Assessment Details Preview Modal */}
      <Modal visible={!!assessmentToView} transparent animationType="fade" onRequestClose={() => setAssessmentToView(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewHeaderTitle}>Preview Details</Text>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setAssessmentToView(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {assessmentToView && (
              <ScrollView style={styles.previewScrollContainer} showsVerticalScrollIndicator={false}>
                {/* Section 1: Request Info */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Request Info</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Req No:</Text>
                    <Text style={styles.previewValue}>{assessmentToView.request_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Name:</Text>
                    <Text style={styles.previewValue}>{assessmentToView.beneficiary_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Category:</Text>
                    <Text style={styles.previewValue}>{assessmentToView.category || assessmentToView.issue_category || 'N/A'}</Text>
                  </View>
                </View>

                {/* Section 2: Assessment Details */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Assessment Details</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Priority:</Text>
                    <Text style={styles.previewValue}>{assessmentToView.priority || assessmentToView.urgency_level || 'N/A'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Status:</Text>
                    <Text style={[styles.previewValue, { color: Colors.primary }]}>{assessmentToView.status || 'N/A'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Amount Req:</Text>
                    <Text style={styles.previewValue}>{assessmentToView.amount_requested ? `₹${assessmentToView.amount_requested}` : 'N/A'}</Text>
                  </View>
                  <View style={[styles.previewRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={[styles.previewLabel, { width: '100%', marginBottom: 4 }]}>Description:</Text>
                    <Text style={[styles.previewValue, { textAlign: 'left', fontWeight: '400', color: Colors.gray700 }]}>
                      {assessmentToView.description || assessmentToView.problem_description || 'N/A'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.previewSubmitBtn} onPress={() => setAssessmentToView(null)}>
              <Text style={styles.previewSubmitBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray800 },
  headerRight: { width: 32 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: Colors.textPrimary },
  listContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  textWrap: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  details: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  date: { fontSize: 12, color: Colors.gray500 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-end' },
  priorityText: { fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 10, paddingLeft: 8 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2FE',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.gray500, marginTop: 12, fontSize: 15 },
  sectionHeader: { backgroundColor: '#F7F9FC', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  overviewHeader: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 16 },
  overviewDetails: { marginBottom: 24, maxHeight: 400 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  overviewLabel: { fontSize: 14, color: Colors.gray600, flex: 1 },
  overviewValue: { fontSize: 14, fontWeight: '600', color: Colors.gray800, flex: 2, textAlign: 'right' },
  closeBtn: { padding: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },

  /* Preview Modal Styling */
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  previewCloseBtn: {
    padding: 4,
  },
  previewScrollContainer: {
    marginBottom: 16,
  },
  previewSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  previewSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
    marginBottom: 6,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    width: '35%',
  },
  previewValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  previewSubmitBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default StaffAssessmentsListScreen;
