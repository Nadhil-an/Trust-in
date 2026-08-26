// screens/staff/StaffDonationsListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Modal, RefreshControl, TextInput, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { donationApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useNotificationSocket } from '../../hooks/useWebSocket';

const StaffDonationsListScreen = ({ navigation }) => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [donationToDelete, setDonationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [donationDetails, setDonationDetails] = useState(null);

  useNotificationSocket((data) => {
    if (data.type === 'DASHBOARD_REFRESH') {
      fetchDonations(false);
    }
  });

  const fetchDonations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await donationApi.list({ limit: 100 }); 
      setDonations(res.data.results || res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load donations' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDonations(true);
    });
    return unsubscribe;
  }, [navigation]);

  const handleDelete = (donation) => {
    setDonationToDelete(donation);
  };

  const confirmDelete = async () => {
    if (!donationToDelete) return;
    setIsDeleting(true);
    try {
      await donationApi.delete(donationToDelete.id);
      Toast.show({ type: 'success', text1: 'Donation deleted' });
      fetchDonations(false);
      setDonationToDelete(null);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to delete donation' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setDonationDetails(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardInfo}>
        <View style={styles.iconWrap}>
          <Ionicons name="cash" size={20} color={Colors.success} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name}>{item.donor_name}</Text>
          <Text style={styles.details}>₹{item.amount} • {item.payment_method}</Text>
          <Text style={styles.date}>{item.receipt_number} • {new Date(item.date || item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => navigation.navigate('CollectDonation', { editItem: item })}
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
        <Text style={styles.headerTitle}>Donations Collected</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search donations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <SectionList
        sections={groupDataByDate(donations.filter(d => 
          d.donor_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          d.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase())
        ))}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDonations(false); }} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="cash-outline" size={48} color={Colors.gray400} />
              <Text style={styles.emptyText}>No donations found.</Text>
            </View>
          )
        }
      />

      {/* Donation Details Modal */}
      <Modal visible={!!donationDetails} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="document-text" size={28} color={Colors.success} />
              </View>
              <Text style={styles.alertTitle}>Donation Details</Text>
            </View>

            {donationDetails && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Donor Name</Text>
                  <Text style={styles.detailValue}>{donationDetails.donor_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={[styles.detailValue, { color: Colors.success, fontWeight: '700' }]}>
                    ₹{donationDetails.amount}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method</Text>
                  <Text style={styles.detailValue}>{donationDetails.payment_method}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Receipt Number</Text>
                  <Text style={styles.detailValue}>{donationDetails.receipt_number || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(donationDetails.date || donationDetails.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.okBtn} onPress={() => setDonationDetails(null)}>
              <Text style={styles.okBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!donationToDelete} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.errorLight }]}>
                <Ionicons name="trash" size={28} color={Colors.error} />
              </View>
              <Text style={styles.alertTitle}>Delete Donation</Text>
              <Text style={styles.alertSubtitle}>
                Are you sure you want to delete this ₹{donationToDelete?.amount} donation from {donationToDelete?.donor_name}?
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDonationToDelete(null)} disabled={isDeleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmDelete} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.confirmBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
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
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  textWrap: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  details: { fontSize: 13, color: '#059669', fontWeight: '600', marginBottom: 2 },
  date: { fontSize: 11, color: '#9CA3AF' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2FE',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.gray500, marginTop: 12, fontSize: 15 },
  sectionHeader: { backgroundColor: '#F7F9FC', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  
  // Custom Modal Styles
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'stretch' },
  alertHeader: { alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  alertSubtitle: { fontSize: 15, color: Colors.gray600, textAlign: 'center', lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.gray100, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.gray800 },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  
  // Details Modal Specific
  detailsContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailLabel: { fontSize: 13, color: Colors.gray500 },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  okBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  okBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});

export default StaffDonationsListScreen;
