import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { donationApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const DonationHistoryScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const memberId = user?.username || '';
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCash, setTotalCash] = useState(0);
  const [totalOnline, setTotalOnline] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donations, setDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const res = await donationApi.list({ page_size: 1000 });
      const list = res.data?.results || res.data || [];
      setDonations(list);
      
      const computedTotal = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const computedCash = list.filter(item => item.payment_method === 'CASH').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const computedOnline = list.filter(item => item.payment_method !== 'CASH').reduce((sum, item) => sum + Number(item.amount || 0), 0);

      setTotalAmount(res.data?.total_amount !== undefined ? res.data.total_amount : computedTotal);
      setTotalCash(res.data?.total_cash !== undefined ? res.data.total_cash : computedCash);
      setTotalOnline(res.data?.total_online !== undefined ? res.data.total_online : computedOnline);
    } catch (error) {
      console.log('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDonations();
    }, [])
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Donation</Text>
        <TouchableOpacity
          style={styles.headerDonateBtn}
          onPress={() => navigation.navigate('Donate')}
          activeOpacity={0.85}
        >
          <Ionicons name="heart" size={14} color="#0284c7" />
          <Text style={styles.headerDonateBtnText}>+ Donate</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Prominent Digital Membership Card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MembershipCard')}
        >
          <View style={[styles.membershipCard, { backgroundColor: '#0284c7' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.logoBadge}>
                <Ionicons name="flower-outline" size={20} color="#0284c7" />
                <View>
                  <Text style={styles.trustLogoTitle}>SREELAKSHMI</Text>
                  <Text style={styles.trustLogoSub}>CHARITABLE TRUST</Text>
                </View>
              </View>

              <View style={styles.memberIdContainer}>
                <Text style={styles.memberIdLabel}>MEMBER ID</Text>
                <Text style={styles.memberIdValue}>{memberId}</Text>
              </View>
            </View>

            <View style={styles.cardCenter}>
              <Text style={styles.cardTitle}>MEMBERSHIP CARD</Text>
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.footerLabel}>Member Since</Text>
                <Text style={styles.footerValue}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A'}</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.footerLabel}>Valid Upto</Text>
                <Text style={styles.footerValue}>{user?.valid_upto ? new Date(user.valid_upto).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Donation & Monthly Autopay Hero Card */}
        <View style={styles.donateHeroCard}>
          <View style={styles.donateHeroLeft}>
            <View style={styles.donateHeroBadge}>
              <Ionicons name="sparkles" size={12} color="#0284c7" />
              <Text style={styles.donateHeroBadgeText}>PAYMENT GATEWAY & AUTOPAY</Text>
            </View>
            <Text style={styles.donateHeroTitle}>Support Our Mission</Text>
            <Text style={styles.donateHeroDesc}>
              Make an instant one-time donation or setup monthly recurring autopay.
            </Text>
            <View style={styles.donateHeroBtns}>
              <TouchableOpacity
                style={styles.donateBtnPrimary}
                onPress={() => navigation.navigate('Donate', { mode: 'ONETIME' })}
                activeOpacity={0.85}
              >
                <Ionicons name="heart" size={15} color={Colors.white} />
                <Text style={styles.donateBtnPrimaryText}>Donate Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.donateBtnSecondary}
                onPress={() => navigation.navigate('Donate', { mode: 'MONTHLY' })}
                activeOpacity={0.85}
              >
                <Ionicons name="repeat" size={15} color="#0284c7" />
                <Text style={styles.donateBtnSecondaryText}>Monthly Autopay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick-Action Grid (4 equal rounded cards) */}
        <View style={styles.actionGrid}>
          {/* 1. My Donation */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => fetchDonations()}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="heart" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>My Donation</Text>
            <Text style={styles.actionSub}>View your donation history</Text>
          </TouchableOpacity>

          {/* 2. Report a Problem */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ReportProblem')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="warning" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>Report a Problem</Text>
            <Text style={styles.actionSub}>Help us improve by reporting issues</Text>
          </TouchableOpacity>

          {/* 3. Events */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Events')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="calendar" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>Events</Text>
            <Text style={styles.actionSub}>View upcoming events & activities</Text>
          </TouchableOpacity>

          {/* 4. My Profile */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="person" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionSub}>View and manage your profile</Text>
          </TouchableOpacity>
        </View>

        {/* Total Donation Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="heart-dislike-outline" size={28} color="#0284c7" />
          </View>
          <Text style={styles.summaryLabel}>Total Donation</Text>
          <Text style={styles.summaryAmount}>₹{totalAmount.toLocaleString()}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, marginTop: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: Colors.gray600, fontWeight: '600' }}>Cash</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a' }}>₹{totalCash.toLocaleString()}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: Colors.gray600, fontWeight: '600' }}>Online</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0284c7' }}>₹{totalOnline.toLocaleString()}</Text>
            </View>
          </View>

          {/* Quick Donate / Autopay CTA */}
          <TouchableOpacity
            style={styles.summaryDonateCta}
            onPress={() => navigation.navigate('Donate')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
            <Text style={styles.summaryDonateCtaText}>Donate Online / Setup Autopay</Text>
          </TouchableOpacity>
        </View>

        {/* Section Header with Filter */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Donation History</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="funnel-outline" size={14} color="#0284c7" />
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {/* List of Donation History Rows */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.listContainer}>
            {donations.map((item) => (
              <TouchableOpacity key={item.id} style={styles.donationRow} activeOpacity={0.7} onPress={() => setSelectedDonation(item)}>
                <View style={styles.rowIconCircle}>
                  <Ionicons name={item.icon || 'gift-outline'} size={20} color="#0284c7" />
                </View>

                <View style={styles.rowDetails}>
                  <Text style={styles.rowCategory}>{item.category || item.source_name || 'General'}</Text>
                  <Text style={styles.rowDate}>{item.date || item.created_at || 'Recent'}</Text>
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>₹{(item.amount || 0).toLocaleString()}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Motivational Banner */}
        <View style={styles.bannerCard}>
          <Text style={styles.bannerText}>Your support brings hope and creates real change.</Text>
        </View>
      </ScrollView>

      {/* Donation Details Modal */}
      <Modal visible={!!selectedDonation} transparent animationType="fade" onRequestClose={() => setSelectedDonation(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewHeaderTitle}>Donation Details</Text>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setSelectedDonation(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedDonation && (
              <ScrollView style={styles.previewScrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.previewSectionBox}>
                  <Text style={styles.previewSectionTitle}>Information</Text>
                  <View style={styles.previewDivider} />
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Category:</Text>
                    <Text style={styles.previewValue}>{selectedDonation.category || selectedDonation.source_name || 'General'}</Text>
                  </View>
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Date:</Text>
                    <Text style={styles.previewValue}>{new Date(selectedDonation.date || selectedDonation.created_at || new Date()).toLocaleDateString('en-GB')}</Text>
                  </View>
                  
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Amount:</Text>
                    <Text style={[styles.previewValue, { color: '#16a34a', fontSize: 16 }]}>₹{(selectedDonation.amount || 0).toLocaleString()}</Text>
                  </View>

                  {selectedDonation.receipt_number ? (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Receipt No:</Text>
                      <Text style={styles.previewValue}>{selectedDonation.receipt_number}</Text>
                    </View>
                  ) : null}
                  
                  {selectedDonation.payment_method ? (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Method:</Text>
                      <Text style={styles.previewValue}>{selectedDonation.payment_method}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  headerDonateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  headerDonateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  scroll: { padding: 16, gap: 16 },

  summaryCard: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  summaryDonateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
    width: '100%',
    justifyContent: 'center',
  },
  summaryDonateCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  summaryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  summaryAmount: { fontSize: 32, fontWeight: '900', color: '#0369a1', marginVertical: 4 },
  summarySub: { fontSize: 12, color: '#0284c7', fontWeight: '500' },

  sectionHeader: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },

  listContainer: { gap: 10 },
  donationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowDetails: { flex: 1 },
  rowCategory: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowDate: { fontSize: 11, color: Colors.gray400, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: '#16a34a' },

  bannerCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  bannerText: { fontSize: 12, color: '#0369a1', fontWeight: '600', textAlign: 'center' },
  
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

  membershipCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  trustLogoTitle: { fontSize: 7, fontWeight: '900', color: '#0284c7' },
  trustLogoSub: { fontSize: 5, fontWeight: '700', color: Colors.gray600 },
  memberIdContainer: { alignItems: 'flex-end' },
  memberIdLabel: { fontSize: 8, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' },
  memberIdValue: { fontSize: 12, fontWeight: '800', color: Colors.white },

  cardCenter: { alignItems: 'center', marginVertical: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: Colors.white, letterSpacing: 2 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' },
  footerValue: { fontSize: 13, fontWeight: '800', color: Colors.white, marginTop: 1 },

  donateHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  donateHeroLeft: { flex: 1 },
  donateHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  donateHeroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  donateHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  donateHeroDesc: {
    fontSize: 12,
    color: Colors.gray600,
    lineHeight: 17,
    marginBottom: 12,
  },
  donateHeroBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  donateBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  donateBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  donateBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  donateBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 11, color: Colors.gray500 },
});

export default DonationHistoryScreen;
