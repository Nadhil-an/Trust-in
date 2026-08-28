// screens/staff/StaffMembersListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Modal, RefreshControl, TextInput, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { membersApi, donationApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useNotificationSocket } from '../../hooks/useWebSocket';

const StaffMembersListScreen = ({ navigation }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [memberToView, setMemberToView] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [membershipsTotal, setMembershipsTotal] = useState(0);
  const [membershipsCash, setMembershipsCash] = useState(0);
  const [membershipsBank, setMembershipsBank] = useState(0);

  const fetchMembershipsIncome = async () => {
    try {
      const res = await donationApi.list({ limit: 100 });
      const incomes = res.data.results || res.data;
      
      const todayDateObj = new Date();
      const yyyy = todayDateObj.getFullYear();
      const mm = String(todayDateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(todayDateObj.getDate()).padStart(2, '0');
      const todayIso = `${yyyy}-${mm}-${dd}`;
      
      const todayMemberships = incomes.filter(i => 
        i.source === 'MEMBERSHIP' && (i.date === todayIso || i.created_at?.startsWith(todayIso))
      );
      
      setMembershipsTotal(todayMemberships.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0));
      setMembershipsCash(todayMemberships.filter(d => d.payment_method?.toUpperCase() === 'CASH').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0));
      setMembershipsBank(todayMemberships.filter(d => d.payment_method?.toUpperCase() !== 'CASH').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0));
    } catch (err) {
      console.log('Failed to fetch membership income', err);
    }
  };

  // Auto-refresh when WebSocket signals a change
  useNotificationSocket((data) => {
    if (data.type === 'DASHBOARD_REFRESH') {
      fetchMembers(false);
    }
  });

  const fetchMembers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      fetchMembershipsIncome();
      // By default, backend filters to only show members created by this staff user
      const res = await membersApi.list({ limit: 100 }); 
      setMembers(res.data.results || res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load members' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Refresh when screen comes into focus in case of edits
    const unsubscribe = navigation.addListener('focus', () => {
      fetchMembers(true);
    });
    return unsubscribe;
  }, [navigation]);

  const handleDelete = (member) => {
    setMemberToDelete(member);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    try {
      await membersApi.delete(memberToDelete.id);
      Toast.show({ type: 'success', text1: 'Member deleted' });
      fetchMembers(false);
      setMemberToDelete(null);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to delete member' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7} 
      onPress={() => setMemberToView(item)}
    >
      <View style={styles.cardInfo}>
        <View style={styles.iconWrap}>
          <Ionicons name="person" size={20} color={Colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.details}>{item.phone} • {item.membership_type}</Text>
          <Text style={styles.date}>Added on {new Date(item.created_at || item.joining_date).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => navigation.navigate('AddMember', { editItem: item })}
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
      data: grouped[date]
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
        <Text style={styles.headerTitle}>Members Added</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Today's Membership Collection Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Today's Membership Collections</Text>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.summaryLabel}>Total Today</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>₹{membershipsTotal}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.summaryLabel}>Cash</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{membershipsCash}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.summaryLabel}>Bank/UPI</Text>
            <Text style={[styles.summaryValue, { color: Colors.error }]}>₹{membershipsBank}</Text>
          </View>
        </View>
      </View>

      <SectionList
        sections={groupDataByDate(members.filter(m => 
          m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          m.phone?.includes(searchQuery)
        ))}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(false); }} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={Colors.gray400} />
              <Text style={styles.emptyText}>No members found.</Text>
            </View>
          )
        }
      />

      {/* Custom Styled Delete Confirmation Modal */}
      <Modal visible={!!memberToDelete} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.errorLight }]}>
                <Ionicons name="trash" size={28} color={Colors.error} />
              </View>
              <Text style={styles.alertTitle}>Delete Member</Text>
              <Text style={styles.alertSubtitle}>Are you sure you want to delete {memberToDelete?.full_name}?</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMemberToDelete(null)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmDelete} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.confirmBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Details Preview Modal */}
      <Modal visible={!!memberToView} transparent animationType="fade" onRequestClose={() => setMemberToView(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewHeaderTitle}>Preview Details</Text>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setMemberToView(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {memberToView && (
              <ScrollView style={styles.previewScrollContainer} showsVerticalScrollIndicator={false}>
                {/* Section 1: Personal Info */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Personal Info</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Name:</Text>
                    <Text style={styles.previewValue}>{memberToView.full_name}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Phone:</Text>
                    <Text style={styles.previewValue}>{memberToView.phone || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Email:</Text>
                    <Text style={styles.previewValue}>{memberToView.email || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Age:</Text>
                    <Text style={styles.previewValue}>{memberToView.age || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Gender:</Text>
                    <Text style={styles.previewValue}>{memberToView.gender || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Address:</Text>
                    <Text style={styles.previewValue}>{memberToView.address || '-'}</Text>
                  </View>
                </View>

                {/* Section 2: Membership */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Membership</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Type:</Text>
                    <Text style={styles.previewValue}>{memberToView.membership_type || 'Donor'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Blood Group:</Text>
                    <Text style={styles.previewValue}>{memberToView.blood_group || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>ID Proof:</Text>
                    <Text style={styles.previewValue}>{memberToView.id_proof_type || 'Aadhaar'}</Text>
                  </View>
                </View>

                {/* Section 3: Payment */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Payment</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Method:</Text>
                    <Text style={styles.previewValue}>{memberToView.payment_mode || 'Cash'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Amount:</Text>
                    <Text style={[styles.previewValue, { color: Colors.primary }]}>
                      ₹{Number(memberToView.amount || memberToView.membership_fee || memberToView.fee) || 100}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Txn ID:</Text>
                    <Text style={styles.previewValue}>{memberToView.transaction_id || '-'}</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.previewSubmitBtn} onPress={() => setMemberToView(null)}>
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
  summaryContainer: { paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray800, marginBottom: 12 },
  summaryCards: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray600, marginBottom: 4, textAlign: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
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
  textWrap: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  details: { fontSize: 13, color: '#4B5563', marginBottom: 2 },
  date: { fontSize: 11, color: '#9CA3AF' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2FE',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.gray500, marginTop: 12, fontSize: 15 },
  sectionHeader: { backgroundColor: '#F7F9FC', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  
  // Custom Modal Styles
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'stretch' },
  alertHeader: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  alertSubtitle: { fontSize: 15, color: Colors.gray600, textAlign: 'center', lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.gray800 },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  
  // Overview Modal Styles
  overviewHeader: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 16 },
  overviewDetails: { marginBottom: 24 },
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

export default StaffMembersListScreen;
