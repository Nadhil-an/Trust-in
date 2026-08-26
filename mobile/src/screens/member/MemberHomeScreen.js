// screens/member/MemberHomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { EventBanner, StatCard, Card, Badge } from '../../components/shared';
import { membershipApi, assessmentApi, donationApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';

const MemberHomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  
  const [refreshing, setRefreshing] = useState(false);
  const [memberStatus, setMemberStatus] = useState(null);
  const [myCases, setMyCases] = useState([]);
  const [donationsTotal, setDonationsTotal] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [mRes, aRes, dRes] = await Promise.all([
        membershipApi.status(),
        assessmentApi.list({ limit: 3, source: 'MEMBER' }),
        donationApi.myTotal()
      ]);
      setMemberStatus(mRes.data);
      setMyCases(aRes.data.results || aRes.data || []);
      setDonationsTotal(dRes.data.total_amount || 0);
    } catch (_) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handlePayMembership = () => {
    if (memberStatus?.is_paid) {
      Toast.show({ type: 'info', text1: 'Membership active', text2: 'No dues pending at the moment.' });
      return;
    }
    // Navigate to payment processing screen
    navigation.navigate('MembershipPayment');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.greetRow}>
            <Text style={styles.greeting}>{t('member.home_title')}</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
            <Text style={styles.memberId}>ID: {user?.username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-circle" size={40} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <EventBanner />

        {/* Membership Status Card */}
        <Card style={styles.membershipCard} padding={20}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{t('member.membership_card')}</Text>
              <Text style={styles.cardSub}>{memberStatus?.membership_type || 'General Member'}</Text>
            </View>
            <Badge
              status={memberStatus?.is_paid ? 'PAID' : 'DUE'}
              label={memberStatus?.is_paid ? t('member.paid') : t('member.due')}
              size="lg"
            />
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.label}>Valid Until</Text>
              <Text style={styles.value}>{memberStatus?.valid_until || '-'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.payBtn, memberStatus?.is_paid && styles.payBtnDisabled]}
              onPress={handlePayMembership}
              disabled={memberStatus?.is_paid}
            >
              <Text style={[styles.payBtnText, memberStatus?.is_paid && styles.payBtnTextDisabled]}>
                {t('member.pay_membership')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Action Grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('NewAssessment', { source: 'MEMBER' })}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="alert-circle" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.actionText}>{t('member.report_problem')}</Text>
          </TouchableOpacity>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('member.my_donations')}</Text>
            <Text style={styles.statValue}>₹{donationsTotal.toLocaleString()}</Text>
          </View>
        </View>

        {/* Recent Cases */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('member.my_cases')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyCases')}>
            <Text style={styles.seeAll}>{t('common.see_all')}</Text>
          </TouchableOpacity>
        </View>

        {myCases.length === 0 ? (
          <Card padding={24} style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color={Colors.gray300} />
            <Text style={styles.emptyText}>{t('member.no_cases')}</Text>
          </Card>
        ) : (
          myCases.map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.caseCard}
              onPress={() => navigation.navigate('AssessmentDetail', { id: c.id })}
            >
              <View style={styles.caseHeader}>
                <Text style={styles.caseNum}>{c.case_number}</Text>
                <Badge status={c.status} size="sm" />
              </View>
              <Text style={styles.caseTitle}>{c.beneficiary_name}</Text>
              <Text style={styles.caseCategory} numberOfLines={1}>
                {c.category.replace('_', ' ').toUpperCase()} • {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>

      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="Home"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10,
  },
  menuIconContainer: { paddingRight: 12, paddingVertical: 2 },
  greetRow: { flex: 1 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  memberId: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  profileBtn: { justifyContent: 'center' },
  scroll: { padding: 16, gap: 16 },
  
  membershipCard: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  cardSub: { fontSize: 13, color: Colors.gray500, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: 16 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  payBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8,
  },
  payBtnDisabled: { backgroundColor: Colors.gray200 },
  payBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  payBtnTextDisabled: { color: Colors.gray400 },

  actionGrid: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14,
    padding: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  
  statBox: {
    flex: 1, backgroundColor: Colors.successLight, borderRadius: 14,
    padding: 16, alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { fontSize: 13, color: Colors.success, fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.success },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  
  emptyCard: { alignItems: 'center', justifyContent: 'center', padding: 40, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.gray300 },
  emptyText: { color: Colors.gray500, marginTop: 12, fontSize: 14 },

  caseCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  caseNum: { fontSize: 12, fontWeight: '700', color: Colors.gray500 },
  caseTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  caseCategory: { fontSize: 12, color: Colors.gray500 },
});

export default MemberHomeScreen;
