// screens/manager/ManagerHomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/Colors';
import { assessmentApi, notifyApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';

// ── Priority Badge ───────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  const { t } = useTranslation();
  const config = {
    CRITICAL: { color: '#DC2626', bg: '#FEF2F2', label: t('dashboard.critical_caps', 'CRITICAL') },
    URGENT:   { color: '#D97706', bg: '#FFFBEB', label: t('dashboard.urgent_caps', 'URGENT') },
    HIGH:     { color: '#7C3AED', bg: '#F5F3FF', label: t('dashboard.high_caps', 'HIGH') },
    NORMAL:   { color: '#16B978', bg: '#ECFDF5', label: t('dashboard.normal_caps', 'NORMAL') },
  };
  const c = config[priority] || config.NORMAL;
  return (
    <View style={[styles.priorityBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.priorityText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
};

// ── Pipeline Stat Card ───────────────────────────────────────────────
const PipelineCard = ({ label, value, icon, color, bg, onPress }) => (
  <TouchableOpacity style={[styles.pipeCard, { borderLeftColor: color, backgroundColor: bg }]} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.pipeIconWrap, { backgroundColor: color }]}>
      <Ionicons name={icon} size={18} color="#fff" />
    </View>
    <Text style={[styles.pipeValue, { color }]}>{value ?? 0}</Text>
    <Text style={styles.pipeLabel}>{label}</Text>
  </TouchableOpacity>
);

// ── Recent Assessment Row ────────────────────────────────────────────
const AssessmentRow = ({ item, onPress }) => {
  const { t } = useTranslation();
  const statusColors = {
    SUBMITTED:      { color: Colors.primary, bg: Colors.primaryLight, label: t('status.pending', 'Pending') },
    WITH_FAO:       { color: Colors.primary, bg: Colors.primaryLight, label: t('status.with_fao', 'With FAO') },
    WITH_ACO:       { color: Colors.primary, bg: Colors.primaryLight, label: t('status.with_aco', 'With ACO') },
    WITH_GEO:       { color: Colors.primary, bg: Colors.primaryLight, label: t('status.with_geo', 'With GEO') },
    UNDER_REVIEW:   { color: Colors.primary, bg: Colors.primaryLight, label: t('status.under_review', 'Under Review') },
    APPROVED:       { color: '#16B978', bg: '#ECFDF5', label: t('status.approved', 'Approved') },
    REJECTED:       { color: '#EF4444', bg: '#FEF2F2', label: t('status.rejected', 'Rejected') },
    CASHIER_PENDING:{ color: Colors.primary, bg: Colors.primaryLight, label: t('status.cashier', 'Cashier') },
    COMPLETED:      { color: '#10B981', bg: '#D1FAE5', label: t('status.completed', 'Completed') },
    ON_HOLD:        { color: '#9CA3AF', bg: '#F3F4F6', label: t('status.on_hold', 'On Hold') },
  };
  const sc = statusColors[item.status] || { color: Colors.gray500, bg: Colors.gray100, label: item.status };
  const date = new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <TouchableOpacity style={styles.assRow} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.assLeft}>
        <Text style={styles.assName} numberOfLines={1}>{item.beneficiary_name}</Text>
        <Text style={styles.assNum}>{item.request_number} • {date}</Text>
      </View>
      <View style={styles.assRight}>
        <PriorityBadge priority={item.priority} />
        <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusChipText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


// ── Main Screen ──────────────────────────────────────────────────────
const ManagerHomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const [dashboard, setDashboard] = useState(null);
  const [recentList, setRecentList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useNotificationSocket((data) => {
    if (data.type === 'notification') {
      Toast.show({ type: 'info', text1: data.title, text2: data.message });
      setUnreadCount(prev => prev + 1);
    } else if (data.type === 'DASHBOARD_REFRESH') {
      fetchDashboard(false);
      fetchUnreadCount();
    }
  });

  const fetchDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await assessmentApi.stats({ role: 'MANAGER' });
      setDashboard(res.data);
      setRecentList(res.data.recent_requests || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: t('manager.load_failed', 'Failed to load dashboard') });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await notifyApi.unreadCount();
      setUnreadCount(res.data.count);
    } catch (_) {}
  };

  useEffect(() => {
    fetchDashboard();
    fetchUnreadCount();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard(false);
    await fetchUnreadCount();
    setRefreshing(false);
  }, []);

  const req = dashboard?.requests || {};
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
              <Ionicons name="menu" size={26} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>{t('dashboard.greeting_good_day', 'Good day, 👋')}</Text>
              <Text style={styles.userName}>{user?.full_name || user?.username}</Text>
              <Text style={styles.roleTag}>{t('role.manager', 'MANAGER')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {/* Date */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t('manager.pipeline_title', 'Assessment Pipeline')}</Text>
            <View style={styles.dateChip}>
              <Ionicons name="calendar-outline" size={13} color={Colors.gray600} />
              <Text style={styles.dateText}>{today}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 30 }} />
          ) : (
            <>
              {/* Pipeline Row 1 */}
              <View style={styles.pipeRow}>
                <PipelineCard
                  label={t('status.pending', 'Pending Review')} value={req.pending} icon="time-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
                <PipelineCard
                  label={t('status.with_fao', 'With FAO')} value={req.with_fao} icon="walk-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
              </View>
              {/* Pipeline Row 2 */}
              <View style={styles.pipeRow}>
                <PipelineCard
                  label={t('status.with_aco', 'With ACO')} value={req.with_aco} icon="calculator-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
                <PipelineCard
                  label={t('status.with_geo', 'With GEO')} value={req.with_geo} icon="shield-checkmark-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
              </View>
              {/* Pipeline Row 3 */}
              <View style={styles.pipeRow}>
                <PipelineCard
                  label={t('status.under_review', 'Under Review')} value={req.under_review} icon="eye-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
                <PipelineCard
                  label={t('status.approved', 'Approved')} value={req.approved} icon="checkmark-circle-outline"
                  color="#16B978" bg="#ECFDF5"
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
              </View>
              {/* Pipeline Row 4 */}
              <View style={styles.pipeRow}>
                <PipelineCard
                  label={t('status.cashier', 'Cashier Pending')} value={req.cashier_pending} icon="cash-outline"
                  color={Colors.primary} bg={Colors.primaryLight}
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
                <PipelineCard
                  label={t('status.completed', 'Completed')} value={req.completed} icon="trophy-outline"
                  color="#10B981" bg="#D1FAE5"
                  onPress={() => navigation.navigate('StaffAssessmentsList')}
                />
              </View>

              {/* Total Banner */}
              <TouchableOpacity
                style={styles.totalBanner}
                onPress={() => navigation.navigate('StaffAssessmentsList')}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.totalLabel}>{t('manager.total_assessments', 'Total Assessments')}</Text>
                  <Text style={styles.totalNote}>{t('manager.tap_to_view_all', 'Tap to view all')}</Text>
                </View>
                <View style={styles.totalRight}>
                  <Text style={styles.totalValue}>{req.total ?? 0}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Recent Assessments */}
              {recentList.length > 0 && (
                <>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>{t('manager.recent_assessments', 'Recent Assessments')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('StaffAssessmentsList')}>
                      <Text style={styles.seeAll}>{t('manager.see_all', 'See All')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recentCard}>
                    {recentList.map((item, idx) => (
                      <View key={item.id}>
                        <AssessmentRow
                          item={item}
                          onPress={() => navigation.navigate('AssessmentDetail', { id: item.id })}
                        />
                        {idx < recentList.length - 1 && <View style={styles.divider} />}
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
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

export default ManagerHomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  scroll: { paddingBottom: 100 },

  header: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 24,
    paddingBottom: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  menuIconContainer: { paddingRight: 12, paddingTop: 2 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  roleTag: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 1 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  body: { paddingHorizontal: 16, paddingTop: 24 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  dateText: { fontSize: 12, color: Colors.gray600 },

  pipeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  pipeCard: {
    flex: 1, padding: 16, borderRadius: 16, borderLeftWidth: 4,
    alignItems: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  pipeIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pipeValue: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  pipeLabel: { fontSize: 12, color: Colors.gray600, fontWeight: '500' },

  totalBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 18, padding: 20, marginBottom: 28,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  totalNote: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#fff' },

  recentCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  assRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  assLeft: { flex: 1, marginRight: 10 },
  assName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  assNum: { fontSize: 12, color: Colors.gray500 },
  assRight: { alignItems: 'flex-end', gap: 5 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusChipText: { fontSize: 11, fontWeight: '600' },
});
