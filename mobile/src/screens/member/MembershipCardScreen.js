import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';

const MembershipCardScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const [userProfile, setUserProfile] = useState(user);

  useEffect(() => {
    authApi.getProfile()
      .then(res => {
        if (res.data) {
          setUserProfile(res.data);
          useAuthStore.getState().updateUser(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const activeUser = userProfile || user;
  const isPaidMember = Boolean(activeUser?.is_paid_member);
  const hasActiveSubscription = Boolean(activeUser?.has_active_subscription);
  const subscriptionStatus = activeUser?.subscription_status || (hasActiveSubscription ? 'ACTIVE' : 'NOT_SUBSCRIBED');
  const isNotSubscribed = subscriptionStatus === 'NOT_SUBSCRIBED' || (!hasActiveSubscription && !isPaidMember);
  const isExpiringSoon = subscriptionStatus === 'EXPIRING_SOON';
  const isExpired = Boolean(activeUser?.is_subscription_expired) || subscriptionStatus === 'EXPIRED';

  const memberId = activeUser?.member_id || activeUser?.username || '';
  const memberName = activeUser?.member_name || activeUser?.full_name || '';
  const memberSince = activeUser?.member_since && activeUser?.member_since !== 'N/A'
    ? activeUser.member_since
    : activeUser?.date_joined
      ? new Date(activeUser.date_joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'N/A';
  const validUpto = activeUser?.valid_upto || 'N/A';
  const monthlyFee = activeUser?.monthly_fee || 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Membership Card</Text>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => navigation.navigate('MembershipPayment')}
        >
          <Ionicons name="card-outline" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Digital Membership Card */}
        {isNotSubscribed ? (
          <View style={[styles.membershipCard, styles.lockedMembershipCard]}>
            <View style={styles.cardTopRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="flower-outline" size={24} color="#64748b" />
                <View style={styles.logoTextContainer}>
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
                <Ionicons name="shield-outline" size={38} color="#94a3b8" />
                <Ionicons name="lock-closed" size={18} color="#d97706" style={styles.lockOverlayIcon} />
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
              <Text style={styles.cardActivateBtnText}>Activate Membership (₹100)</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.membershipCard, { backgroundColor: '#0284c7' }]}>
            <View style={styles.cardTopRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="flower-outline" size={24} color="#0284c7" />
                <View style={styles.logoTextContainer}>
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

            <View style={styles.cardWaveDecoration} />

            <View style={styles.cardFooterRow}>
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
                  {isExpired ? Renew Subscription (₹/mo) : Renew Payment Early (₹/mo)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* QR Code Section */}
        {isNotSubscribed ? (
          <View style={styles.qrSection}>
            <View style={[styles.qrBox, styles.qrBoxLocked]}>
              <Ionicons name="lock-closed-outline" size={80} color="#94a3b8" />
              <Text style={styles.qrLockedLabel}>Verification Locked</Text>
            </View>
            <Text style={styles.qrText}>Official member verification QR code is locked.</Text>
            <Text style={styles.appreciationText}>
              Activate your monthly membership to generate your unique verification QR code.
            </Text>
            <TouchableOpacity
              style={styles.qrActivateBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MembershipPayment')}
            >
              <Text style={styles.qrActivateBtnText}>Activate Membership Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrSection}>
            <View style={styles.qrBox}>
              <Ionicons name="qr-code-outline" size={150} color={Colors.textPrimary} />
            </View>
            <Text style={styles.qrText}>Scan this QR code to verify your membership.</Text>
            <Text style={styles.appreciationText}>Thank you for being a part of our mission.</Text>
          </View>
        )}

        {/* Motivational Charity Quote Card */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteIconCircle}>
            <Ionicons name="heart" size={24} color="#0284c7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteText}>"Kindness makes a lasting difference."</Text>
            <Text style={styles.quoteAuthor}>— Sreelakshmi Charitable Trust</Text>
          </View>
        </View>
      </ScrollView>
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
  moreBtn: { padding: 4 },
  scroll: { padding: 16, gap: 20, alignItems: 'center' },

  membershipCard: {
    width: '100%',
    borderRadius: 18,
    padding: 20,
    minHeight: 210,
    justifyContent: 'space-between',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
  },
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
    marginVertical: 14,
    paddingHorizontal: 12,
  },
  lockedIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  lockOverlayIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  lockedSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
  },
  cardActivateBtn: {
    marginTop: 6,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  cardActivateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    gap: 6,
  },
  logoTextContainer: { justifyContent: 'center' },
  trustLogoTitle: { fontSize: 8, fontWeight: '900', color: '#0284c7', letterSpacing: 0.5 },
  trustLogoSub: { fontSize: 6, fontWeight: '700', color: Colors.gray600 },
  memberIdContainer: { alignItems: 'flex-end', maxWidth: 180 },
  memberNameText: { fontSize: 13, fontWeight: '800', color: Colors.white, textAlign: 'right' },
  memberIdRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  memberIdLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700', letterSpacing: 0.5 },
  memberIdValue: { fontSize: 13, fontWeight: '800', color: Colors.white },
  expiredBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
  expiredBadgeText: { fontSize: 8, fontWeight: '900', color: '#dc2626', letterSpacing: 0.5 },
  cardRenewBtn: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  cardRenewBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },

  cardCenter: { alignItems: 'center', marginVertical: 14 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.white, letterSpacing: 2.5 },

  cardWaveDecoration: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    right: -20,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 40,
    transform: [{ rotate: '-8deg' }],
  },

  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' },
  footerValue: { fontSize: 14, fontWeight: '800', color: Colors.white, marginTop: 2 },

  qrSection: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  qrBox: {
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: 16,
  },
  qrBoxLocked: {
    padding: 24,
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLockedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  qrActivateBtn: {
    marginTop: 14,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  qrActivateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  qrText: { fontSize: 13, fontWeight: '600', color: Colors.gray700, textAlign: 'center' },
  appreciationText: { fontSize: 12, color: Colors.gray500, textAlign: 'center', marginTop: 4 },

  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 14,
  },
  quoteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteText: { fontSize: 14, fontWeight: '700', color: '#0369a1', fontStyle: 'italic' },
  quoteAuthor: { fontSize: 11, color: '#075985', marginTop: 4, fontWeight: '500' },
});

export default MembershipCardScreen;
