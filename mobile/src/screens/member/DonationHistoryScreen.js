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
import { donationApi, authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const DonationHistoryScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const [userProfile, setUserProfile] = useState(user);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCash, setTotalCash] = useState(0);
  const [totalOnline, setTotalOnline] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donations, setDonations] = useState([]);
  const [selectedDonation, setSelectedDonation] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setUserProfile(res.data);
        useAuthStore.getState().updateUser(res.data);
      }
    } catch (_) {}
  };

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
                <Ionicons name="flower-outline" size={20} color="#64748b" />
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
              <Text style={styles.cardActivateBtnText}>Activate Membership (₹{monthlyFee}/mo)</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
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
                  {isExpired ? 'Renew Subscription' : 'Renew Payment Early'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
