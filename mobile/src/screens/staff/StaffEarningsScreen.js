import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { staffApi } from '../../api';
import Toast from 'react-native-toast-message';

export default function StaffEarningsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    donation_bonus: 0,
    membership_bonus: 0,
    total_bonus: 0,
    total_paid_out: 0,
    available_balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'DONATION' | 'MEMBERSHIP'

  const fetchEarningsData = async () => {
    try {
      const res = await staffApi.bonusTransactions();
      if (res?.data) {
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        setTransactions(res.data.transactions || []);
      }
    } catch (err) {
      console.warn('Failed to load earnings data:', err);
      Toast.show({
        type: 'error',
        text1: 'Could not load earnings',
        text2: 'Please check your connection and try again.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEarningsData();
  }, []);

  const filteredTransactions = transactions.filter((t) => {
    const type = (t.bonus_type || '').toUpperCase();
    if (activeFilter === 'DONATION') {
      return type.includes('DONATION');
    }
    if (activeFilter === 'MEMBERSHIP') {
      return type.includes('MEMBER') || type.includes('REFERRAL');
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings & Commission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0284C7"
            colors={['#0284C7']}
          />
        }
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading bonus & earnings...</Text>
          </View>
        ) : (
          <>
            {/* Primary Hero Balance Card */}
            <LinearGradient
              colors={['#0284C7', '#0369A1', '#075985']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroHeader}>
                <View style={styles.heroIconCircle}>
                  <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>LIVE SALARY BONUS</Text>
                </View>
              </View>

              <Text style={styles.heroLabel}>Total Accumulated Bonus</Text>
              <Text style={styles.heroAmount}>
                ₹ {(summary?.total_bonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroFooterRow}>
                <View style={styles.heroFooterItem}>
                  <Text style={styles.heroFooterLabel}>Available Payout</Text>
                  <Text style={styles.heroFooterVal}>
                    ₹ {(summary?.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.heroFooterItemRight}>
                  <Text style={styles.heroFooterLabel}>Paid via Salary</Text>
                  <Text style={styles.heroFooterVal}>
                    ₹ {(summary?.total_paid_out || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Separate Bonus Categories (Separately Tracked) */}
            <Text style={styles.sectionTitle}>Bonus Breakdown</Text>
            <View style={styles.breakdownRow}>
              {/* 1. Donation Bonus Card */}
              <View style={[styles.breakdownCard, { borderColor: '#BBF7D0' }]}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="heart" size={18} color="#16A34A" />
                </View>
                <Text style={styles.cardTypeTitle}>Donation Bonus</Text>
                <Text style={styles.cardRule}>10% on every ₹1,000</Text>
                <Text style={[styles.cardAmount, { color: '#16A34A' }]}>
                  ₹ {(summary?.donation_bonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.cardFootnote}>Separately credited</Text>
              </View>

              {/* 2. Membership Bonus Card */}
              <View style={[styles.breakdownCard, { borderColor: '#BAE6FD' }]}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="people" size={18} color="#0284C7" />
                </View>
                <Text style={styles.cardTypeTitle}>Member Bonus</Text>
                <Text style={styles.cardRule}>30% (₹30) per ₹100</Text>
                <Text style={[styles.cardAmount, { color: '#0284C7' }]}>
                  ₹ {(summary?.membership_bonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.cardFootnote}>One-time new registration</Text>
              </View>
            </View>

            {/* Salary Integration Notice */}
            <View style={styles.salaryPolicyCard}>
              <Ionicons name="information-circle-outline" size={20} color="#0369A1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.salaryPolicyTitle}>Monthly Salary Credit</Text>
                <Text style={styles.salaryPolicyDesc}>
                  Your accumulated eligible bonus will be automatically added to your monthly salary slip during payroll processing.
                </Text>
              </View>
            </View>

            {/* Transactions Section */}
            <View style={styles.historyHeaderRow}>
              <Text style={styles.sectionTitle}>Transaction History</Text>
              <Text style={styles.txnCountText}>{filteredTransactions.length} items</Text>
            </View>

            {/* Filter Pills */}
            <View style={styles.filterRow}>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'DONATION', label: 'Donation (10%)' },
                { key: 'MEMBERSHIP', label: 'Membership (30%)' },
              ].map((pill) => (
                <TouchableOpacity
                  key={pill.key}
                  style={[
                    styles.filterPill,
                    activeFilter === pill.key && styles.filterPillActive,
                  ]}
                  onPress={() => setActiveFilter(pill.key)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      activeFilter === pill.key && styles.filterPillTextActive,
                    ]}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Bonus Transactions Yet</Text>
                <Text style={styles.emptySub}>
                  Collect donations or register new members to automatically earn bonuses!
                </Text>
              </View>
            ) : (
              <View style={styles.transactionsList}>
                {filteredTransactions.map((t, idx) => {
                  const isDonation = t.bonus_type === 'DONATION_BONUS';
                  const isReferral = t.bonus_type === 'REFERRAL_BONUS';
                  return (
                    <View
                      key={t.id || idx}
                      style={[
                        styles.transactionRow,
                        idx < filteredTransactions.length - 1 && styles.transactionBorder,
                      ]}
                    >
                      <View
                        style={[
                          styles.txIconBox,
                          {
                            backgroundColor: isDonation
                              ? '#DCFCE7'
                              : isReferral
                              ? '#E0F2FE'
                              : '#E0F2FE',
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            isDonation
                              ? 'heart'
                              : isReferral
                              ? 'share-social'
                              : 'person-add'
                          }
                          size={18}
                          color={
                            isDonation
                              ? '#16A34A'
                              : isReferral
                              ? '#0284C7'
                              : '#0284C7'
                          }
                        />
                      </View>

                      <View style={styles.txInfo}>
                        <View style={styles.txHeaderLine}>
                          <Text style={styles.txTypeLabel}>
                            {isDonation
                              ? 'Donation Bonus (10%)'
                              : isReferral
                              ? 'Referral Bonus (30%)'
                              : 'Membership Bonus (30%)'}
                          </Text>
                          <Text style={styles.txAmountText}>
                            +₹ {Number(t.amount || 0).toFixed(2)}
                          </Text>
                        </View>

                        <Text style={styles.txDesc} numberOfLines={2}>
                          {t.description || (t.member_name ? `Member: ${t.member_name}` : 'Bonus credit')}
                        </Text>

                        <View style={styles.txMetaRow}>
                          <Text style={styles.txDate}>{t.created_at || 'Recently'}</Text>
                          {Boolean(t.income_id) && (
                            <Text style={styles.txReceiptPill}>
                              Receipt: {t.income_id}
                            </Text>
                          )}
                          {Boolean(t.member_id) && (
                            <Text style={styles.txMemberPill}>
                              ID: {t.member_id}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Hero Card
  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: '600',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginVertical: 14,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroFooterItem: {
    flex: 1,
  },
  heroFooterItemRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  heroFooterLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 2,
  },
  heroFooterVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Breakdown Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  breakdownCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardTypeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  cardRule: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardFootnote: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4,
  },

  // Salary Notice
  salaryPolicyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 20,
  },
  salaryPolicyTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 2,
  },
  salaryPolicyDesc: {
    fontSize: 11,
    color: '#0284C7',
    lineHeight: 16,
  },

  // History Section
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txnCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Transactions List
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  transactionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  txInfo: {
    flex: 1,
  },
  txHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  txTypeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  txDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 4,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  txDate: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  txReceiptPill: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  txMemberPill: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});

