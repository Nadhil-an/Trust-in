import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { donationApi, authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';

const DonationHistoryScreen = ({ navigation }) => {
  useNotificationSocket((data) => {
    if (data?.type === 'DASHBOARD_REFRESH' || data?.type === 'dashboard_refresh') {
      fetchDonations();
      fetchProfile();
    }
  });
  const { user, isAuthenticated } = useAuthStore();
  const [userProfile, setUserProfile] = useState(user);

  const fetchProfile = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setUserProfile(res.data);
        useAuthStore.getState().updateUser(res.data);
      }
    } catch (_) {}
  };
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCash, setTotalCash] = useState(0);
  const [totalOnline, setTotalOnline] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donations, setDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);

  const fetchDonations = async () => {
    if (!isAuthenticated) return;
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
      fetchProfile();
    }, [])
  );

  const activeUser = userProfile || user;
  const memberId = activeUser?.member_id || activeUser?.username || '';
  const memberName = activeUser?.member_name || activeUser?.full_name || '';
  const isPaidMember = Boolean(activeUser?.is_paid_member);
  const hasActiveSubscription = Boolean(activeUser?.has_active_subscription);
  const subscriptionStatus = activeUser?.subscription_status || (hasActiveSubscription ? 'ACTIVE' : 'NOT_SUBSCRIBED');
  const isNotSubscribed = subscriptionStatus === 'NOT_SUBSCRIBED' || (!hasActiveSubscription && !isPaidMember);
  const isExpiringSoon = subscriptionStatus === 'EXPIRING_SOON';
  const isExpired = Boolean(activeUser?.is_subscription_expired) || subscriptionStatus === 'EXPIRED';
  const memberSince = activeUser?.member_since && activeUser?.member_since !== 'N/A'
    ? activeUser.member_since
    : activeUser?.date_joined
      ? new Date(activeUser.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'N/A';
  const validUpto = activeUser?.valid_upto || 'N/A';
  const monthlyFee = activeUser?.monthly_fee || 100;

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Donation</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Centered Guest Card */}
        <View style={styles.guestBody}>
          <View style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <Ionicons name="heart-outline" size={40} color="#0284c7" />
            </View>

            <View style={styles.trustBadge}>
              <Text style={styles.trustBadgeText}>SREE LAKSHMI CHARITABLE TRUST</Text>
            </View>

            <Text style={styles.guestTitle}>Donation History & Receipts</Text>

            <Text style={styles.guestSubtitle}>
              Sign in to view your past donations, download 80G tax exemption receipts, and track your contribution history.
            </Text>

            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Auth')}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
              <Text style={styles.guestPrimaryBtnText}>Login to Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Signup')}
            >
              <Ionicons name="person-add-outline" size={18} color="#0284c7" />
              <Text style={styles.guestSecondaryBtnText}>Sign Up as Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              fetchDonations();
              fetchProfile();
            }}
            tintColor="#0284c7"
            colors={['#0284c7']}
          />
        }
      >
        {/* 1. Total Donation Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="heart" size={26} color="#0284c7" />
          </View>
          <Text style={styles.summaryLabel}>Total Donation</Text>
          <Text style={styles.summaryAmount}>₹{totalAmount.toLocaleString()}</Text>

          {/* Quick Donate / Autopay CTA */}
          <TouchableOpacity
            style={[styles.summaryDonateCta, { marginTop: 14 }]}
            onPress={() => navigation.navigate('Donate')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
            <Text style={styles.summaryDonateCtaText}>Donate Online / Setup Autopay</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Donation & Monthly Autopay Hero Card (Support Our Mission) */}
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

        {/* 3. Prominent Digital Membership Card */}
        {isNotSubscribed ? (
          <View style={[styles.membershipCard, styles.lockedMembershipCard]}>
            <View style={styles.cardHeader}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../../assets/android-icon-foreground.png')}
                  style={styles.trustLogoImg}
                  resizeMode="contain"
                />
                <View>
                  <Text style={[styles.trustLogoTitle, { color: '#475569' }]}>SREELAKSHMI</Text>
                  <Text style={styles.trustLogoSub}>CHARITABLE TRUST</Text>
                </View>
              </View>

              <View style={styles.inactiveBadge}>
                <Ionicons name="lock-closed" size={11} color="#b45309" />
                <Text style={styles.inactiveBadgeText}>MEMBERSHIP INACTIVE</Text>
              </View>
            </View>

            <View style={styles.lockedCardBody}>
              <View style={styles.lockedIconRing}>
                <Ionicons name="shield-outline" size={30} color="#94a3b8" />
                <Ionicons name="lock-closed" size={15} color="#d97706" style={styles.lockOverlayIcon} />
              </View>
              <Text style={styles.lockedTitle}>DIGITAL ID CARD LOCKED</Text>
              <Text style={styles.lockedSub}>
                Membership subscription is required to unlock your official verified Trust digital ID card, member ID, and privileges.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cardActivateBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MembershipPayment')}
            >
              <Ionicons name="card-outline" size={16} color="#ffffff" />
              <Text style={styles.cardActivateBtnText}>{`Activate Membership (₹${monthlyFee}/mo)`}</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('MembershipCard')}
          >
            <View style={[styles.membershipCard, { backgroundColor: '#0284c7' }]}>
              <View style={styles.cardHeader}>
                <View style={styles.logoBadge}>
                  <Image
                    source={require('../../../assets/android-icon-foreground.png')}
                    style={styles.trustLogoImg}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.trustLogoTitle}>SREELAKSHMI</Text>
                    <Text style={styles.trustLogoSub}>CHARITABLE TRUST</Text>
                  </View>
                </View>

                <View style={styles.memberIdContainer}>
                  <Text style={styles.memberNameText} numberOfLines={1}>{memberName || 'Member'}</Text>
                  <View style={styles.memberIdRow}>
                    <Text style={styles.memberIdLabel}>ID: </Text>
                    <Text style={styles.memberIdValue}>{memberId}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardCenter}>
                <Text style={styles.cardTitle}>MEMBERSHIP CARD</Text>
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerLabel}>Member Since</Text>
                  <Text style={styles.footerValue}>{memberSince}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.footerLabel}>Valid Upto</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={styles.footerValue}>{validUpto}</Text>
                    {isExpired ? (
                      <View style={styles.expiredBadge}>
                        <Text style={styles.expiredBadgeText}>EXPIRED</Text>
                      </View>
                    ) : isExpiringSoon ? (
                      <View style={[styles.expiredBadge, { backgroundColor: '#ffedd5' }]}>
                        <Text style={[styles.expiredBadgeText, { color: '#ea580c' }]}>EXPIRING</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {(isExpired || isExpiringSoon) && (
                <TouchableOpacity
                  style={styles.cardRenewBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('MembershipPayment')}
                >
                  <Ionicons name="refresh" size={14} color="#0284c7" />
                  <Text style={styles.cardRenewBtnText}>
                    {isExpired ? `Renew Subscription (₹${monthlyFee}/mo)` : `Renew Payment Early (₹${monthlyFee}/mo)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Donation History</Text>
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

  lockedMembershipCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    shadowColor: '#64748b',
    shadowOpacity: 0.1,
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  lockedCardBody: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  lockedIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  lockOverlayIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  lockedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  lockedSub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardActivateBtn: {
    marginTop: 4,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActivateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  memberNameText: { fontSize: 13, fontWeight: '800', color: Colors.white, textAlign: 'right' },
  memberIdRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  expiredBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
  expiredBadgeText: { fontSize: 8, fontWeight: '900', color: '#dc2626', letterSpacing: 0.5 },
  cardRenewBtn: {
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRenewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
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
  trustLogoImg: {
    width: 22,
    height: 22,
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
  guestBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  guestCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  guestIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trustBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  trustBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  guestPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  guestPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  guestSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    marginTop: 10,
  },
  guestSecondaryBtnText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default DonationHistoryScreen;
