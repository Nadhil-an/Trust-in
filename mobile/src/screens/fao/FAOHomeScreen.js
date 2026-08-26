// screens/fao/FAOHomeScreen.js — Enhanced with real-time sync & animations
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
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

const FAOHomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, critical: 0, urgent: 0, reviewed_today: 0 });
  const [pendingCases, setPendingCases] = useState([]);
  const [completedCases, setCompletedCases] = useState([]);
  const [rejectedCases, setRejectedCases] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Animated header collapse
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({ inputRange: [0, 80], outputRange: [130, 70], extrapolate: 'clamp' });
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' });
  const titleScale = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.85], extrapolate: 'clamp' });

  // Pulse animation for critical cases
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes, completedRes, rejectedRes] = await Promise.all([
        assessmentApi.stats({ role: 'FAO' }),
        assessmentApi.list({ status: 'WITH_FAO' }),
        assessmentApi.list({ fao_tab: 'completed' }),
        assessmentApi.list({ fao_tab: 'rejected' }),
      ]);
      setStats(statsRes.data);
      setPendingCases(pendingRes.data.results || pendingRes.data || []);
      setCompletedCases(completedRes.data.results || completedRes.data || []);
      setRejectedCases(rejectedRes.data.results || rejectedRes.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { 
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

  // Real-time WebSocket — new cases arrive instantly
  useNotificationSocket(useCallback((msg) => {
    if (msg.type === 'ASSESSMENT_ASSIGNED' || msg.type === 'notification') {
      fetchData();
      Toast.show({
        type: 'info',
        text1: t('fao.new_assignment_title', '📋 New Assessment Assigned'),
        text2: msg.message || t('fao.new_assignment_desc', 'A new case has been assigned to you'),
      });
    }
  }, [fetchData, t]));

  let cases = [];
  if (activeTab === 'pending') cases = pendingCases;
  else if (activeTab === 'completed') cases = completedCases;
  else if (activeTab === 'rejected') cases = rejectedCases;

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {/* Animated Collapsing Header */}
      <Animated.View style={[styles.header, { height: headerHeight, paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Animated.View style={{ opacity: headerOpacity, transform: [{ scale: titleScale }], marginLeft: 10 }}>
            <Text style={styles.greeting}>{t('dashboard.greeting_good_day', 'Good day,')}</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
          </Animated.View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>FAO</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
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
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard title={t('dashboard.pending', 'Pending')} value={stats.pending} icon="time" color={Colors.primary} bg={Colors.primaryLight} />
          <StatCard title={t('dashboard.critical', 'Critical')} value={stats.critical} icon="warning" color={Colors.error} bg={Colors.errorLight} />
          <StatCard title={t('dashboard.done_today', 'Done Today')} value={stats.reviewed_today} icon="checkmark-circle" color={Colors.success} bg={Colors.successLight} />
        </View>

        {/* Cases */}
        <Text style={styles.sectionTitle}>
          <Ionicons name={activeTab === 'pending' ? "clipboard" : "file-tray-full"} size={18} color={Colors.textPrimary} />{' '}
          {activeTab === 'pending' ? t('fao.my_inbox', 'My Inbox') : activeTab === 'completed' ? 'Completed Cases' : 'Rejected Cases'} ({cases.length})
        </Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]} onPress={() => setActiveTab('pending')}>
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'completed' && styles.tabButtonActive]} onPress={() => setActiveTab('completed')}>
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'rejected' && styles.tabButtonActive]} onPress={() => setActiveTab('rejected')}>
            <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>Rejected</Text>
          </TouchableOpacity>
        </View>

        {cases.length === 0 ? (
          <Card padding={40} style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle" size={52} color={Colors.primary} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? t('fao.all_caught_up', 'All Caught Up!') : 'No Cases Found'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? t('fao.no_pending', 'No pending assessments in your inbox.') : `No ${activeTab} assessments.`}
            </Text>
          </Card>
        ) : (
          cases.map((c, idx) => {
            const isCritical = c.priority === 'CRITICAL';
            return (
              <Animated.View key={c.id} style={isCritical && activeTab === 'pending' ? { transform: [{ scale: pulseAnim }] } : {}}>
                <TouchableOpacity
                  style={[styles.caseCard, isCritical && activeTab === 'pending' && styles.criticalCard]}
                  onPress={() => navigation.navigate('FAOReport', { assessmentId: c.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.caseHeader}>
                    <View style={styles.caseNumRow}>
                      <Text style={styles.caseNum}>{c.request_number}</Text>
                      {isCritical && (
                        <View style={styles.criticalPill}>
                          <Ionicons name="warning" size={10} color={Colors.white} />
                          <Text style={styles.criticalPillText}>{t('dashboard.critical_caps', 'CRITICAL')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.timeAgo}>
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </Text>
                  </View>

                  <Text style={styles.caseName}>{c.beneficiary_name}</Text>
                  <Text style={styles.caseAddr} numberOfLines={1}>
                    <Ionicons name="location" size={12} color={Colors.gray500} /> {c.beneficiary_address}
                  </Text>

                  <View style={styles.caseFooter}>
                    <View style={[styles.catChip, { backgroundColor: Colors.primaryLight }]}>
                      <Text style={[styles.catChipText, { color: Colors.primary }]}>
                        {c.category?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <Text style={styles.caseSource}>{t('dashboard.via', 'via')} {c.source || 'STAFF'}</Text>
                    {activeTab !== 'pending' && (
                       <Text style={{ fontSize: 12, fontWeight: '700', color: activeTab === 'completed' ? Colors.success : Colors.error }}>
                         Edit Report →
                       </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
      </Animated.ScrollView>

      {/* Side Navigation Drawer */}
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
  userName: { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  menuIconContainer: { paddingRight: 5, paddingVertical: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  roleText: { fontSize: 11, fontWeight: '900', color: Colors.white, letterSpacing: 1 },
  profileBtn: {},
  scroll: { padding: 16, paddingTop: 20, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  tabContainer: {
    flexDirection: 'row', backgroundColor: Colors.gray100, borderRadius: 10,
    padding: 4, marginTop: 12, marginBottom: 8,
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray500 },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  emptyCard: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.primary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { color: Colors.gray500, marginTop: 4, fontSize: 13, textAlign: 'center' },
  caseCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  criticalCard: {
    borderLeftColor: Colors.error,
    backgroundColor: Colors.errorLight + '15',
    shadowColor: Colors.error, shadowOpacity: 0.15,
  },
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  caseNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caseNum: { fontSize: 12, fontWeight: '700', color: Colors.gray500 },
  criticalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  criticalPillText: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  timeAgo: { fontSize: 11, color: Colors.gray400 },
  caseName: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  caseAddr: { fontSize: 13, color: Colors.gray600, marginBottom: 12, lineHeight: 18 },
  caseFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 12, gap: 8 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catChipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  caseSource: { flex: 1, fontSize: 12, color: Colors.gray400, fontStyle: 'italic' },
});

export default FAOHomeScreen;
