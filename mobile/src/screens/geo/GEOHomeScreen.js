// screens/geo/GEOHomeScreen.js — Enhanced with real-time sync & animations
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/Colors';
import { Card, Badge, StatCard } from '../../components/shared';
import { assessmentApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';

const GEOHomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, forwarded_today: 0 });
  const [cases, setCases] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({ inputRange: [0, 80], outputRange: [130, 70], extrapolate: 'clamp' });
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' });

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        assessmentApi.stats({ role: 'GEO' }),
        assessmentApi.list({ status: 'WITH_GEO' }),
      ]);
      setStats(statsRes.data);
      setCases(listRes.data.results || listRes.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useNotificationSocket(useCallback((msg) => {
    if (msg.type === 'GEO_ASSIGNED' || msg.type === 'notification') {
      fetchData();
      Toast.show({
        type: 'info',
        text1: t('geo.new_verification_title', '🔍 New Verification Required'),
        text2: msg.message || t('geo.new_verification_desc', 'A new case needs your verification'),
      });
    }
  }, [fetchData, t]));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { height: headerHeight, paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Animated.View style={{ opacity: headerOpacity, marginLeft: 10 }}>
            <Text style={styles.greeting}>{t('geo.dashboard_title', 'Enquiry & Verification')}</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
          </Animated.View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>GEO</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-circle" size={38} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <StatCard title={t('geo.needs_verification', 'Needs Verification')} value={stats.pending} icon="search" color={Colors.primary} bg={Colors.primaryLight} />
          <StatCard title={t('dashboard.done_today', 'Done Today')} value={stats.forwarded_today} icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} />
        </View>

        <Text style={styles.sectionTitle}>{t('geo.cases_for_verification', 'Cases for Verification')} ({cases.length})</Text>

        {cases.length === 0 ? (
          <Card padding={40} style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={52} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>{t('geo.no_pending', 'No Pending Verifications')}</Text>
            <Text style={styles.emptyText}>{t('geo.no_pending_desc', 'Cases assigned for verification will appear here.')}</Text>
          </Card>
        ) : (
          cases.map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.caseCard}
              onPress={() => navigation.navigate('GEOReport', { assessmentId: c.id })}
              activeOpacity={0.85}
            >
              <View style={styles.caseHeader}>
                <Text style={styles.caseNum}>{c.request_number}</Text>
                <Text style={styles.timeAgo}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</Text>
              </View>
              <Text style={styles.caseName}>{c.beneficiary_name}</Text>

              {/* FAO + ACO summary chips */}
              <View style={styles.reportChips}>
                {c.fao_report_summary && (
                  <View style={styles.chip}>
                    <Ionicons name="clipboard" size={11} color={Colors.warning} />
                    <Text style={styles.chipText}>FAO: {c.fao_report_summary.eligibility}</Text>
                  </View>
                )}
                {c.aco_calculation_summary && (
                  <View style={[styles.chip, { backgroundColor: Colors.primaryLight }]}>
                    <Ionicons name="calculator" size={11} color={Colors.primary} />
                    <Text style={[styles.chipText, { color: Colors.primary }]}>
                      ₹{c.aco_calculation_summary.recommended_amount}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.caseFooter}>
                <View style={[styles.catChip, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.catChipText, { color: Colors.primary }]}>
                    {c.category?.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text style={styles.actionText}>{t('geo.verify_action', 'Verify & Report →')}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Animated.ScrollView>

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
  header: {
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.white },
  menuIconContainer: { paddingRight: 5, paddingVertical: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  roleText: { fontSize: 11, fontWeight: '900', color: Colors.white, letterSpacing: 1 },
  scroll: { padding: 16, paddingTop: 20, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyCard: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.gray300 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { color: Colors.gray500, marginTop: 4, fontSize: 13, textAlign: 'center' },
  caseCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  caseNum: { fontSize: 12, fontWeight: '700', color: Colors.gray500 },
  timeAgo: { fontSize: 11, color: Colors.gray400 },
  caseName: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  reportChips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  chipText: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  caseFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 12 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catChipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  actionText: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700', color: Colors.primary },
});

export default GEOHomeScreen;
