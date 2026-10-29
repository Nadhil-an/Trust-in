import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { rewardsApi } from '../../api';
import Toast from 'react-native-toast-message';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DEFAULT_OFFERS = [
  {
    id: 'default-petrol',
    offer_key: 'PETROL',
    title: 'Petrol Allowance',
    reward_value: 100,
    cooldown_days: 20,
    cooldown_independent: true,
    min_badge_name: 'Bronze',
    status: 'AVAILABLE',
    description: '₹100 worth of petrol fuel allowance. 1 qualifying offer per 20-day period with independent cooldown.',
  },
  {
    id: 'default-recharge',
    offer_key: 'RECHARGE',
    title: 'Mobile Recharge',
    reward_value: 399,
    cooldown_days: 30,
    cooldown_independent: false,
    min_badge_name: 'Silver',
    status: 'AVAILABLE',
    description: 'Free mobile recharge voucher worth ₹399. 1 offer per active monthly cycle.',
  },
  {
    id: 'default-tour',
    offer_key: 'TOUR',
    title: 'Tour Allowance',
    reward_value: 3000,
    cooldown_days: 30,
    cooldown_independent: false,
    min_badge_name: 'Gold',
    status: 'AVAILABLE',
    description: '₹3,000 tour allowance contribution for community travel and pilgrimages.',
  },
];

const DEFAULT_TIERS = [
  { tier_key: 'BRONZE', name: 'Bronze', icon: '🥉', color: '#CD7F32', min_subscription: 100, min_services: 2 },
  { tier_key: 'SILVER', name: 'Silver', icon: '🥈', color: '#94A3B8', min_subscription: 300, min_services: 4 },
  { tier_key: 'GOLD', name: 'Gold', icon: '🥇', color: '#F59E0B', min_subscription: 500, min_services: 6 },
  { tier_key: 'YELLOW', name: 'Yellow Badge', icon: '🟡', color: '#EAB308', min_subscription: 1000, min_services: 8 },
  { tier_key: 'PLATINUM', name: 'Platinum', icon: '💎', color: '#6366F1', min_subscription: 2000, min_services: 10 },
];

export default function MemberRewardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [claimingOfferId, setClaimingOfferId] = useState(null);

  // Accordion Toggle States with animations
  const [offersExpanded, setOffersExpanded] = useState(true);
  const [roadmapExpanded, setRoadmapExpanded] = useState(false);
  const [achievementsExpanded, setAchievementsExpanded] = useState(true);

  const toggleOffers = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOffersExpanded((prev) => !prev);
  };

  const toggleRoadmap = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRoadmapExpanded((prev) => !prev);
  };

  const toggleAchievements = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAchievementsExpanded((prev) => !prev);
  };

  const fetchSummary = useCallback(async () => {
    try {
      const res = await rewardsApi.getSummary();
      setSummary(res.data);
    } catch (err) {
      console.log('Failed to load reward summary:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to load awards',
        text2: 'Could not fetch latest reward status.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  const handleClaimOffer = (offer) => {
    if (offer.status !== 'AVAILABLE') return;

    Alert.alert(
      `Claim ${offer.title}`,
      `Would you like to claim ₹${offer.reward_value} ${offer.title}?\n\nThis benefit will be recorded for Trust administration fulfillment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim Now',
          onPress: async () => {
            setClaimingOfferId(offer.id);
            try {
              const res = await rewardsApi.redeemOffer(offer.id);
              Toast.show({
                type: 'success',
                text1: 'Offer Claimed!',
                text2: res.data?.message || 'Your claim has been submitted to the Trust.',
              });
              if (res.data?.summary) {
                setSummary(res.data.summary);
              } else {
                fetchSummary();
              }
            } catch (err) {
              const msg = err?.response?.data?.error || err?.message || 'Could not claim offer';
              Alert.alert('Claim Error', msg);
            } finally {
              setClaimingOfferId(null);
            }
          },
        },
      ]
    );
  };

  const currentBadge = summary?.current_badge;
  const metrics = summary?.metrics;
  const cycle = summary?.cycle;
  const nextTier = summary?.next_tier;
  const offers = (summary?.offers && summary.offers.length > 0) ? summary.offers : DEFAULT_OFFERS;
  const tiers = (summary?.available_tiers && summary.available_tiers.length > 0) ? summary.available_tiers : DEFAULT_TIERS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Free Offers & Member Awards</Text>
          <Text style={styles.headerSubtitle}>Sree Lakshmi Charitable Trust</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Loading your awards & achievements...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />
          }
        >
          {/* ── 1. Hero Card: The Active Member Card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.verifiedTag}>
                <Ionicons name="checkmark-circle" size={14} color="#0284C7" />
                <Text style={styles.verifiedTagText}>Verified Account</Text>
              </View>
              <View style={[
                styles.badgePill,
                {
                  backgroundColor: currentBadge?.color ? `${currentBadge.color}25` : '#FEF3C7',
                  borderColor: currentBadge?.color || '#F59E0B',
                }
              ]}>
                <Text style={styles.badgePillIcon}>{currentBadge?.icon || '⭐'}</Text>
                <Text style={[styles.badgePillText, { color: currentBadge?.color || '#B45309' }]}>
                  {currentBadge?.name || 'Verified Member'}
                </Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroBadgeIcon}>{currentBadge?.icon || '🏅'}</Text>
              <Text style={styles.heroBadgeName}>{currentBadge?.name || 'Active Member'}</Text>
              <Text style={styles.heroBadgeDesc}>
                {currentBadge?.description || 'Participate in Trust activities and subscriptions to unlock higher badges.'}
              </Text>
            </View>

            {/* Cycle Details */}
            <View style={styles.cycleBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={15} color="#64748B" />
                <Text style={styles.cycleTitle}>
                  30-Day Reward Cycle #{cycle?.cycle_number || 1}
                </Text>
              </View>
              <View style={styles.cycleBadge}>
                <Ionicons name="time-outline" size={12} color="#0284C7" />
                <Text style={styles.cycleDaysText}>
                  {cycle?.days_remaining ?? 30} days left
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. "Free Offers for You" Section (Toggle Dropdown) ── */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              onPress={toggleOffers}
              style={styles.toggleHeaderRow}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="gift" size={20} color="#D97706" />
                <Text style={styles.sectionTitle}>Free Offers for You</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{offers.length} Offers</Text>
                </View>
                <Ionicons
                  name={offersExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            {offersExpanded ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.sectionSubtitle}>
                  Activate and claim your Trust benefits. Free offers are provided for verified community and staff members. Fulfillments are managed directly by Trust administration.
                </Text>

                <View style={{ marginTop: 12 }}>
                  {offers.map((offer) => {
                    const isAvailable = offer.status === 'AVAILABLE';
                    const isOnCooldown = offer.status === 'ON_COOLDOWN';
                    const isRedeemed = offer.status === 'REDEEMED';
                    const isClaiming = claimingOfferId === offer.id;

                    const isPetrol = offer.offer_key === 'PETROL';
                    const isRecharge = offer.offer_key === 'RECHARGE';

                    return (
                      <View
                        key={offer.id}
                        style={[
                          styles.offerCard,
                          isAvailable && styles.offerCardAvailable,
                        ]}
                      >
                        <View style={styles.offerTopRow}>
                          <View style={styles.offerIconWrap}>
                            <Text style={styles.offerEmojiIcon}>
                              {offer.icon || (isPetrol ? '⛽' : isRecharge ? '📱' : '✈️')}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.offerTitle}>{offer.title}</Text>
                              <View style={styles.rewardValueBadge}>
                                <Text style={styles.rewardValueText}>₹{offer.reward_value}</Text>
                              </View>
                            </View>
                            <Text style={styles.offerPolicy}>
                              {offer.cooldown_independent
                                ? '1 per 20 days • Independent cooldown'
                                : '1 per 30-day monthly reward cycle'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.offerDesc}>{offer.description}</Text>

                        <View style={styles.offerActionRow}>
                          <View style={styles.offerRequirementBadge}>
                            <Text style={styles.offerReqText}>
                              Requires {offer.min_badge_name || 'Verified Member'}
                            </Text>
                          </View>

                          {isAvailable ? (
                            <TouchableOpacity
                              style={styles.claimButton}
                              onPress={() => handleClaimOffer(offer)}
                              disabled={isClaiming}
                              activeOpacity={0.8}
                            >
                              {isClaiming ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.claimButtonText}>Claim Benefit</Text>
                              )}
                            </TouchableOpacity>
                          ) : isOnCooldown ? (
                            <View style={styles.cooldownBadge}>
                              <Ionicons name="time" size={13} color="#B45309" />
                              <Text style={styles.cooldownText}>
                                Available in {offer.days_to_cooldown}d
                              </Text>
                            </View>
                          ) : isRedeemed ? (
                            <View style={styles.redeemedBadge}>
                              <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                              <Text style={styles.redeemedText}>Claimed This Cycle</Text>
                            </View>
                          ) : (
                            <View style={styles.lockedBadge}>
                              <Ionicons name="lock-closed" size={13} color="#64748B" />
                              <Text style={styles.lockedText}>{offer.lock_reason || 'Locked'}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={toggleOffers} style={styles.collapsedSummaryRow} activeOpacity={0.7}>
                <Text style={styles.collapsedSummaryText} numberOfLines={1}>
                  ⛽ Petrol ₹100 • 📱 Recharge ₹399 • ✈️ Tour ₹3,000
                </Text>
                <Text style={styles.collapsedExpandHint}>Tap to view & claim offers →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── 3. "Trust Badge Roadmap" Section (Toggle Dropdown) ── */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              onPress={toggleRoadmap}
              style={styles.toggleHeaderRow}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="ribbon-outline" size={20} color="#0F172A" />
                <Text style={styles.sectionTitle}>Trust Badge Roadmap</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{tiers.length} Levels</Text>
                </View>
                <Ionicons
                  name={roadmapExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            {roadmapExpanded ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.sectionSubtitle}>
                  Achieve the thresholds below during your 30-day cycle to earn the corresponding badge.
                </Text>

                <View style={styles.tiersList}>
                  {tiers.map((t) => {
                    const isCurrent = currentBadge?.tier_key === t.tier_key;
                    return (
                      <View
                        key={t.tier_key}
                        style={[
                          styles.tierItem,
                          isCurrent && { borderColor: t.color || '#EAB308', backgroundColor: '#FEFCE8' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.tierName, { color: isCurrent ? t.color : '#0F172A' }]}>
                                {t.name}
                              </Text>
                              {isCurrent && (
                                <View style={[styles.activePill, { backgroundColor: t.color || '#EAB308' }]}>
                                  <Text style={styles.activePillText}>EARNED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.tierReqs}>
                              ₹{t.min_subscription} subscription • {t.min_services} self-service actions
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={toggleRoadmap} style={styles.collapsedSummaryRow} activeOpacity={0.7}>
                <Text style={styles.collapsedSummaryText} numberOfLines={1}>
                  🥉 Bronze • 🥈 Silver • 🥇 Gold • 🟡 Yellow • 💎 Platinum
                </Text>
                <Text style={styles.collapsedExpandHint}>Tap to view badge criteria →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── 4. "Current Cycle Achievements" Section (Toggle Dropdown) ── */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              onPress={toggleAchievements}
              style={styles.toggleHeaderRow}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="trending-up" size={20} color="#0D9488" />
                <Text style={styles.sectionTitle}>Current Cycle Achievements</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.countBadge, { backgroundColor: '#CCFBF1' }]}>
                  <Text style={[styles.countBadgeText, { color: '#0F766E' }]}>Live Progress</Text>
                </View>
                <Ionicons
                  name={achievementsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            {achievementsExpanded ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.sectionSubtitle}>
                  Badge qualification is derived from these two performance metrics during your active 30-day window.
                </Text>

                {/* Metric 1: Qualifying Subscription Amount */}
                <View style={styles.metricItem}>
                  <View style={styles.metricRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#CCFBF1' }]}>
                        <Ionicons name="wallet-outline" size={16} color="#0F766E" />
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.metricName}>Qualifying Subscription</Text>
                        <Text style={styles.metricSub}>Completed membership & donations</Text>
                      </View>
                    </View>
                    <Text style={[styles.metricNumbers, { color: '#0F766E' }]}>
                      ₹{metrics?.subscription_amount ?? 0} / ₹{metrics?.subscription_target ?? 100}
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${metrics?.subscription_progress ?? 0}%`,
                          backgroundColor: '#0D9488',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercentText}>{metrics?.subscription_progress ?? 0}% achieved</Text>
                </View>

                {/* Metric 2: Self-Service Count */}
                <View style={[styles.metricItem, { marginTop: 12 }]}>
                  <View style={styles.metricRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="checkbox-outline" size={16} color="#6D28D9" />
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.metricName}>Self-Service Activities</Text>
                        <Text style={styles.metricSub}>Problem reports, poll votes, tasks</Text>
                      </View>
                    </View>
                    <Text style={[styles.metricNumbers, { color: '#6D28D9' }]}>
                      {metrics?.self_service_count ?? 0} / {metrics?.self_service_target ?? 2} acts
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${metrics?.self_service_progress ?? 0}%`,
                          backgroundColor: '#6366F1',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercentText}>{metrics?.self_service_progress ?? 0}% achieved</Text>
                </View>

                {/* Next Tier Milestone Banner */}
                {Boolean(nextTier) && (
                  <View style={styles.milestoneBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16 }}>🎯</Text>
                      <Text style={styles.milestoneTitle}>Target {nextTier.name}</Text>
                    </View>
                    <Text style={styles.milestoneText}>
                      Add ₹{nextTier.needed_subscription} subscription and complete {nextTier.needed_services} more self-service activities to upgrade!
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity onPress={toggleAchievements} style={styles.collapsedSummaryRow} activeOpacity={0.7}>
                <Text style={styles.collapsedSummaryText} numberOfLines={1}>
                  Sub: ₹{metrics?.subscription_amount ?? 0} / ₹{metrics?.subscription_target ?? 100} • Acts: {metrics?.self_service_count ?? 0}/{metrics?.self_service_target ?? 2}
                </Text>
                <Text style={styles.collapsedExpandHint}>Tap to view progress graphs →</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  refreshButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    marginLeft: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgePillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroBody: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  heroBadgeIcon: {
    fontSize: 42,
    marginBottom: 4,
  },
  heroBadgeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroBadgeDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  cycleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  cycleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6,
  },
  cycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cycleDaysText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    marginLeft: 3,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 7,
  },
  staffBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  staffBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 15,
  },
  collapsedSummaryRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedSummaryText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    marginRight: 6,
  },
  collapsedExpandHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  metricItem: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  metricSub: {
    fontSize: 10,
    color: '#64748B',
  },
  metricNumbers: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'right',
  },
  milestoneBanner: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    borderRadius: 8,
    padding: 10,
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginLeft: 6,
  },
  milestoneText: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 15,
  },
  offerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  offerCardAvailable: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offerEmojiIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  offerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  rewardValueBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  rewardValueText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  offerPolicy: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  offerDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 6,
    lineHeight: 15,
  },
  offerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  offerRequirementBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offerReqText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  claimButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  claimButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cooldownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cooldownText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 3,
  },
  redeemedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  redeemedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    marginLeft: 3,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 3,
  },
  tiersList: {
    marginTop: 10,
    gap: 8,
  },
  tierItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierName: {
    fontSize: 12,
    fontWeight: '800',
  },
  tierReqs: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
