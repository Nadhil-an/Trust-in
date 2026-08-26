// screens/aco/ACOHomeScreen.js — Enhanced with real-time sync & animations
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

const ACOHomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, forwarded_today: 0 });
  const [pendingCases, setPendingCases] = useState([]);
  const [completedCases, setCompletedCases] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [drawerVisible, setDrawerVisible] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({ inputRange: [0, 80], outputRange: [130, 70], extrapolate: 'clamp' });
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' });

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes, completedRes] = await Promise.all([
        assessmentApi.stats({ role: 'ACO' }),
        assessmentApi.list({ status: 'WITH_ACO' }),
        assessmentApi.list({ aco_tab: 'completed' }),
      ]);
      setStats(statsRes.data);
      setPendingCases(pendingRes.data.results || pendingRes.data || []);
      setCompletedCases(completedRes.data.results || completedRes.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { 
    // Refresh on focus to catch updates from the calculation screen
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    fetchData(); 
    return unsubscribe;
  }, [fetchData, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useNotificationSocket(useCallback((msg) => {
    if (msg.type === 'FAO_FORWARDED' || msg.type === 'notification') {
      fetchData();
      Toast.show({
        type: 'info',
        text1: t('aco.new_eligible_title', '🧮 New Eligible Case'),
        text2: msg.message || t('aco.new_eligible_desc', 'A new case needs cost estimation'),
      });
    }
  }, [fetchData, t]));

  const cases = activeTab === 'pending' ? pendingCases : completedCases;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { height: headerHeight, paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Animated.View style={{ opacity: headerOpacity, marginLeft: 10 }}>
            <Text style={styles.greeting}>{t('aco.dashboard_title', 'Assessment Calculation')}</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
          </Animated.View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>ACO</Text>
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
          <StatCard title={t('aco.needs_calculation', 'Needs Calculation')} value={stats.pending} icon="calculator" color={Colors.primary} bg={Colors.primaryLight} />
          <StatCard title={t('dashboard.done_today', 'Done Today')} value={stats.forwarded_today} icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending ({pendingCases.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'completed' && styles.tabButtonActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completed ({completedCases.length})</Text>
          </TouchableOpacity>
        </View>

        {cases.length === 0 ? (
          <Card padding={40} style={styles.emptyCard}>
            <Ionicons name="calculator-outline" size={52} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? t('aco.no_pending', 'No Pending Calculations') : 'No Completed Calculations'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? t('aco.no_pending_desc', 'Eligible assessments from FAO will appear here.') : 'Completed calculations will appear here.'}
            </Text>
          </Card>
        ) : (
          cases.map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.caseCard}
              onPress={() => navigation.navigate('ACOCalculation', { assessmentId: c.id, mode: activeTab === 'completed' ? 'edit' : 'create' })}
              activeOpacity={0.85}
            >
              <View style={styles.caseHeader}>
                <Text style={styles.caseNum}>{c.request_number}</Text>
                <Text style={styles.timeAgo}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</Text>
              </View>
              <Text style={styles.caseName}>{c.beneficiary_name}</Text>
              {c.fao_report_summary && (
                <View style={styles.faoSummary}>
                  <Ionicons name="clipboard-outline" size={12} color={Colors.primary} />
                  <Text style={styles.faoSummaryText}>
                    FAO: {c.fao_report_summary.eligibility} • {c.fao_report_summary.urgency_assessment}
                  </Text>
                </View>
              )}
              <View style={styles.caseFooter}>
                <View style={[styles.catChip, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.catChipText, { color: Colors.primary }]}>
                    {c.category?.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  {activeTab === 'completed' ? (
                    <Text style={styles.actionTextEdit}>Edit Calculation →</Text>
                  ) : (
                    <Text style={styles.actionText}>{t('aco.calculate_cost', 'Calculate Cost →')}</Text>
                  )}
                </View>
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
  tabContainer: {
    flexDirection: 'row', backgroundColor: Colors.gray100, borderRadius: 10,
    padding: 4, marginTop: 8, marginBottom: 8,
  },
  tabButton: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray500 },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
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
  caseName: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  faoSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10, alignSelf: 'flex-start',
  },
  faoSummaryText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  caseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 12 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catChipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  actionRow: { flex: 1 },
  actionText: { textAlign: 'right', fontSize: 13, fontWeight: '700', color: Colors.primary },
  actionTextEdit: { textAlign: 'right', fontSize: 13, fontWeight: '700', color: Colors.warning },
});

export default ACOHomeScreen;
