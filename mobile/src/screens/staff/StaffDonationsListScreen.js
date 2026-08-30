// screens/staff/StaffDonationsListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Modal, RefreshControl, TextInput, ActivityIndicator, ScrollView, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { donationApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import { useTranslation } from 'react-i18next';

const StaffDonationsListScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [donationDetails, setDonationDetails] = useState(null);

  // Get today's ISO date string
  const getTodayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

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

  useNotificationSocket((data) => {
    if (data.type === 'DASHBOARD_REFRESH') {
      fetchDonations(false);
    }
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDonations(true);
    });
    return unsubscribe;
  }, [navigation]);

  // Check if a donation is a "next-day rollover" item:
  // created today, but assigned to a future date
  const isNextDayRollover = (item) => {
    const todayIso = getTodayIso();
    const createdDate = (item.created_at || '').substring(0, 10);
    const itemDate = item.date;
    return createdDate === todayIso && itemDate > todayIso;
  };

  const renderItem = ({ item }) => {
    const isRollover = isNextDayRollover(item);
    return (
      <TouchableOpacity 
        style={[styles.card, isRollover && styles.cardRollover]}
        onPress={() => setDonationDetails(item)}
        activeOpacity={0.8}
      >
        {/* Tomorrow banner for rolled-over items */}
        {isRollover && (
          <View style={styles.rolloverBanner}>
            <Ionicons name="calendar-outline" size={12} color="#92400E" />
            <Text style={styles.rolloverBannerText}>📅 This amount will only count for tomorrow</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <View style={styles.cardInfo}>
            <View style={[styles.iconWrap, { 
              backgroundColor: isRollover ? '#FEF3C7' : (item.source === 'MEMBERSHIP' ? '#E0F2FE' : '#ECFDF5'),
            }]}>
              <Ionicons 
                name={item.source === 'MEMBERSHIP' ? 'people' : 'cash'} 
                size={20} 
                color={isRollover ? '#D97706' : (item.source === 'MEMBERSHIP' ? '#0284C7' : Colors.success)} 
              />
            </View>
            <View style={styles.textWrap}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={[styles.name, isRollover && styles.nameRollover]} numberOfLines={1}>{item.donor_name}</Text>
                {item.reference_number ? (
                  <View style={[styles.voucherBadge, isRollover && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                    <Ionicons name="ticket" size={12} color={isRollover ? '#B45309' : '#4338CA'} />
                    <Text style={[styles.voucherBadgeText, isRollover && { color: '#B45309' }]}>{item.reference_number}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Text style={[styles.details, { marginBottom: 0 }, isRollover && { color: '#92400E' }]}>₹{item.amount} • </Text>
                {item.payment_method === 'UPI' || item.payment_method === 'GPay' ? (
                  <Image source={require('../../../assets/gpay.png')} style={{ width: 44, height: 20, marginLeft: 2, opacity: isRollover ? 0.6 : 1 }} resizeMode="contain" />
                ) : item.payment_method === 'CASH' || item.payment_method === 'Cash' ? (
                  <Image source={require('../../../assets/cash.png')} style={{ width: 36, height: 20, marginLeft: 2, opacity: isRollover ? 0.6 : 1 }} resizeMode="contain" />
                ) : (
                  <Text style={[styles.details, { marginBottom: 0 }]}>{item.payment_method}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={[styles.badge, { backgroundColor: isRollover ? '#FEF3C7' : (item.source === 'MEMBERSHIP' ? '#E0F2FE' : '#ECFDF5') }]}>
                  <Text style={[styles.badgeText, { color: isRollover ? '#B45309' : (item.source === 'MEMBERSHIP' ? '#0284C7' : Colors.success) }]}>
                    {item.source === 'MEMBERSHIP' ? 'Membership' : 'Donation'}
                  </Text>
                </View>
                <Text style={[styles.date, { marginLeft: 6 }]}>
                  {new Date(item.created_at || item.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => navigation.navigate('CollectDonation', { editItem: item })}
            >
              <Ionicons name="pencil" size={18} color={isRollover ? '#B45309' : Colors.info} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Group by CREATION date so rolled-over items still appear under today's section
  const groupDataByDate = (data) => {
    const grouped = data.reduce((acc, item) => {
      const dateStr = item.created_at || item.joining_date || item.date;
      const dateObj = new Date(dateStr);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      if (!acc[formattedDate]) acc[formattedDate] = [];
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

  // Today totals: only items whose date IS today (excludes rolled-over items)
  const todayIso = getTodayIso();
  const todayItems = donations.filter(d => d.date === todayIso);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.history') || 'Transactions History'}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('common.search') ? `${t('common.search')}...` : 'Search transactions...'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Pills */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['ALL', 'DONATIONS', 'MEMBERSHIPS', 'CASH', 'GPAY/BANK'].map(f => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                {f === 'ALL' ? t('common.all') : f === 'DONATIONS' ? (t('nav.donations') || 'Donations') : f === 'MEMBERSHIPS' ? (t('nav.members') || 'Memberships') : f === 'CASH' ? t('staff.cash') : 'GPay/Bank'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Today's Summary — ONLY counts items whose date is today */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>{t('staff.today_total') || "Today's Collection Summary"}</Text>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.summaryLabel}>{t('common.total')}</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>
              ₹{todayItems.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.summaryLabel}>{t('staff.cash')}</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              ₹{todayItems.filter(d => d.payment_method?.toUpperCase() === 'CASH').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.summaryLabel}>Bank/GPay</Text>
            <Text style={[styles.summaryValue, { color: Colors.error }]}>
              ₹{todayItems.filter(d => d.payment_method?.toUpperCase() !== 'CASH').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)}
            </Text>
          </View>
        </View>
      </View>

      <SectionList
        sections={groupDataByDate(donations.filter(d => {
          if (searchQuery && !d.donor_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !d.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
          if (activeFilter === 'DONATIONS' && d.source !== 'DONATION') return false;
          if (activeFilter === 'MEMBERSHIPS' && d.source !== 'MEMBERSHIP') return false;
          if (activeFilter === 'CASH' && d.payment_method?.toUpperCase() !== 'CASH') return false;
          if (activeFilter === 'GPAY/BANK' && d.payment_method?.toUpperCase() === 'CASH') return false;
          return true;
        }))}
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
              <Text style={styles.emptyText}>No transactions found.</Text>
            </View>
          )
        }
      />

      {/* Transaction Details Preview Modal */}
      <Modal visible={!!donationDetails} transparent animationType="fade" onRequestClose={() => setDonationDetails(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewHeaderTitle}>Preview Details</Text>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setDonationDetails(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {donationDetails && (
              <ScrollView style={styles.previewScrollContainer} showsVerticalScrollIndicator={false}>
                {/* Rollover info banner inside modal */}
                {isNextDayRollover(donationDetails) && (
                  <View style={styles.rolloverDetailBanner}>
                    <Ionicons name="information-circle" size={16} color="#92400E" />
                    <Text style={styles.rolloverDetailBannerText}>
                      Submitted after your day was closed. This will be counted under{' '}
                      {new Date(donationDetails.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
                    </Text>
                  </View>
                )}

                {/* Section 1: Donor Info */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Donor Info</Text>
                  <View style={styles.previewDivider} />
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Name:</Text>
                    <Text style={styles.previewValue}>{donationDetails.donor_name}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Phone:</Text>
                    <Text style={styles.previewValue}>{donationDetails.donor_phone || '-'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Category:</Text>
                    <Text style={styles.previewValue}>{donationDetails.source === 'MEMBERSHIP' ? 'Membership' : 'Donation'}</Text>
                  </View>
                </View>

                {/* Section 2: Payment Details */}
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Payment Details</Text>
                  <View style={styles.previewDivider} />
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Amount:</Text>
                    <Text style={[styles.previewValue, { color: Colors.primary, fontSize: 15 }]}>₹{donationDetails.amount}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Method:</Text>
                    <Text style={styles.previewValue}>{donationDetails.payment_method}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Receipt No:</Text>
                    <Text style={styles.previewValue}>{donationDetails.receipt_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Counts For:</Text>
                    <Text style={[styles.previewValue, { color: isNextDayRollover(donationDetails) ? '#B45309' : Colors.primary }]}>
                      {new Date((donationDetails.date || '') + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.previewSubmitBtn} onPress={() => setDonationDetails(null)}>
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
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  filterTextActive: { color: Colors.white },
  summaryContainer: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray800, marginBottom: 10 },
  summaryCards: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray600, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  listContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardRollover: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
    flexDirection: 'column',
    opacity: 0.92,
  },
  rolloverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
  },
  rolloverBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  textWrap: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2, flex: 1, paddingRight: 8 },
  nameRollover: { color: '#92400E' },
  voucherBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE', gap: 4
  },
  voucherBadgeText: { fontSize: 11, fontWeight: '700', color: '#4338CA' },
  details: { fontSize: 13, color: '#4B5563', marginBottom: 2 },
  date: { fontSize: 11, color: '#9CA3AF' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2FE',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.gray400, marginTop: 12, fontSize: 15 },
  sectionHeader: { backgroundColor: '#F7F9FC', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  rolloverDetailBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rolloverDetailBannerText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  previewCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%',
    maxWidth: 380, maxHeight: '85%', padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  previewCloseBtn: { padding: 4 },
  previewScrollContainer: { marginBottom: 16 },
  previewSectionBox: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12,
  },
  previewSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0284C7', marginBottom: 6 },
  previewDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  previewLabel: { fontSize: 13, color: '#64748B', fontWeight: '500', width: '35%' },
  previewValue: { fontSize: 13, color: '#0F172A', fontWeight: '700', textAlign: 'right', flex: 1 },
  previewSubmitBtn: { backgroundColor: '#0284C7', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewSubmitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default StaffDonationsListScreen;
