// screens/staff/HomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Dimensions, Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { staffApi, notifyApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import Toast from 'react-native-toast-message';
import BirthdayPopup from '../../components/BirthdayPopup';
import SideDrawer from '../../components/SideDrawer';

const { width } = Dimensions.get('window');


// ── Components ──────────────────────────────────────────────────────────

const StatCardPremium = ({ title, value, icon, color, bg, onPress }) => (
  <TouchableOpacity style={[styles.statCard, { borderColor: `${color}20` }]} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.statCardHeader}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Ionicons name="ellipsis-horizontal" size={16} color={Colors.gray400} />
    </View>
    <View style={styles.statCardBody}>
      <Text style={[styles.statValue, { color: color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
    {/* Decorative Trend Line (SVG mock using border) */}
    <View style={styles.trendLineContainer}>
      <View style={[styles.trendLine, { borderColor: `${color}40` }]} />
    </View>
  </TouchableOpacity>
);

const QuickActionPremium = ({ icon, title, subtitle, color, bg, onPress }) => (
  <TouchableOpacity style={[styles.quickAction, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.qaLeft}>
      <View style={[styles.qaIconWrap, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color={Colors.white} />
      </View>
      <View style={styles.qaTextWrap}>
        <Text style={styles.qaTitle}>{title}</Text>
        <Text style={styles.qaSubtitle}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.qaArrow}>
      <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
    </View>
  </TouchableOpacity>
);

// ── Main Screen ─────────────────────────────────────────────────────────

const StaffHomeScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.openDrawer === true) {
        setDrawerVisible(true);
        navigation.setParams({ openDrawer: undefined });
      } else if (route?.params?.openDrawer === false) {
        setDrawerVisible(false);
        navigation.setParams({ openDrawer: undefined });
      }
    }, [route?.params?.openDrawer, navigation])
  );
  const [stats, setStats] = useState({ members: 0, donations: 0, assessments: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [birthdays, setBirthdays] = useState([]);
  const [bdayVisible, setBdayVisible] = useState(false);

  useNotificationSocket((data) => {
    if (data.type === 'notification') {
      Toast.show({ type: 'info', text1: data.title, text2: data.message });
      setUnreadCount(prev => prev + 1);
    } else if (data.type === 'DASHBOARD_REFRESH') {
      fetchStats();
      fetchUnreadCount();
    }
  });

  const fetchBirthdays = useCallback(async () => {
    try {
      const res = await staffApi.birthdayAlerts();
      const todayList = (res.data.today || []).map(p => ({ ...p, when: 'today' }));
      const tomorrowList = (res.data.tomorrow || []).map(p => ({ ...p, when: 'tomorrow' }));
      const all = [...todayList, ...tomorrowList];
      if (all.length > 0) {
        setBirthdays(all);
        setBdayVisible(true);
      }
    } catch (_) {}
  }, []);

  useEffect(() => { 
    fetchStats(); 
    fetchUnreadCount();
    // Slight delay so app settles before showing popup
    setTimeout(() => fetchBirthdays(), 1200);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await notifyApi.unreadCount();
      setUnreadCount(res.data.count);
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const res = await staffApi.todayStats();
      setStats(res.data);
    } catch (_) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    await fetchUnreadCount();
    setRefreshing(false);
  }, []);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header Gradient Section */}
        <View style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
              <Ionicons name="menu" size={26} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={styles.greeting}>{t('dashboard.greeting_good_day', 'Good morning, 👋')}</Text>
              <Text style={styles.userName}>{user?.full_name || user?.username || 'Sample STAFF'}</Text>
              <Text style={styles.role}>{user?.role || 'STAFF'}</Text>
            </View>
            <TouchableOpacity style={styles.bellContainer} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={24} color={Colors.gray800} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>


        {/* Content Body */}
        <View style={styles.bodyContent}>
          
          {/* Today's Overview */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('staff.home_title', 'Today’s Overview')}</Text>
            <View style={styles.dateSelector}>
              <Ionicons name="calendar-outline" size={14} color={Colors.gray600} />
              <Text style={styles.dateText}>{today}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCardPremium
              title={t('staff.members_added', 'Members Added')}
              value={stats.members}
              icon="people"
              color={Colors.primary}
              bg={Colors.primaryLight}
              onPress={() => navigation.navigate('StaffMembersList')}
            />
            <StatCardPremium
              title={t('staff.donations_collected', 'Donations Collected')}
              value={`₹${(stats.donations || 0).toLocaleString()}`}
              icon="cash"
              color="#16B978"
              bg="#ECFDF5"
              onPress={() => navigation.navigate('StaffDonationsList')}
            />
            <StatCardPremium
              title={t('staff.assessments_submitted', 'Assessments Submitted')}
              value={stats.assessments}
              icon="clipboard"
              color="#F59E0B"
              bg="#FFFBEB"
              onPress={() => navigation.navigate('StaffAssessmentsList')}
            />
          </View>

          {/* Quick Actions */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>{t('staff.quick_actions', 'Quick Actions')}</Text>
          </View>

          <View style={styles.quickGrid}>
            <QuickActionPremium
              title={t('staff.add_member', 'Add Member')}
              subtitle={t('staff.register_new', 'Register a new member')}
              icon="person-add"
              color={Colors.primary}
              bg="#F8FAFC"
              onPress={() => navigation.navigate('AddMember')}
            />
            <QuickActionPremium
              title={t('staff.collect_donation', 'Collect Donation')}
              subtitle={t('staff.record_donation', 'Record a new donation')}
              icon="cash"
              color="#16B978"
              bg="#F8FAFC"
              onPress={() => navigation.navigate('CollectDonation')}
            />
            <QuickActionPremium
              title={t('staff.new_assessment', 'New Assessment')}
              subtitle={t('staff.create_assessment', 'Create a new assessment')}
              icon="clipboard"
              color="#F59E0B"
              bg="#F8FAFC"
              onPress={() => navigation.navigate('NewAssessment')}
            />
            <QuickActionPremium
              title={t('staff.attendance', 'Mark Attendance')}
              subtitle={t('staff.check_in_out', 'Check in / out attendance')}
              icon="calendar-number"
              color="#8B5CF6"
              bg="#F8FAFC"
              onPress={() => navigation.navigate('StaffAttendance', { fromDashboard: true })}
            />
          </View>

          {/* My Assessments Wide Card */}
          <TouchableOpacity style={styles.wideCard} onPress={() => navigation.navigate('StaffAssessmentsList')} activeOpacity={0.8}>
            <View style={styles.wideCardContent}>
              <View style={styles.wideCardIcon}>
                <Ionicons name="document-text" size={32} color={Colors.primary} />
                <View style={styles.wideCardCheck}>
                  <Ionicons name="checkmark" size={12} color={Colors.white} />
                </View>
              </View>
              <View style={styles.wideCardText}>
                <Text style={styles.wideCardTitle}>{t('staff.my_assessments', 'My Assessments')}</Text>
                <Text style={styles.wideCardSubtitle}>{t('staff.my_assessments_desc', 'View and manage all your assessments in one place')}</Text>
              </View>
              <View style={styles.qaArrow}>
                <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
              </View>
            </View>
          </TouchableOpacity>

        </View>
        </ScrollView>

      {/* 🎂 Birthday Popup */}
      <BirthdayPopup
        visible={bdayVisible}
        birthdays={birthdays}
        onClose={() => setBdayVisible(false)}
      />

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
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  scroll: { paddingBottom: 100 }, // space for bottom nav
  
  /* Header */
  headerGradient: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 22,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  menuIconContainer: {
    paddingRight: 10,
    paddingVertical: 2,
  },
  userInfo: { flex: 1 },

  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 1, letterSpacing: -0.4 },
  role: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  
  bellContainer: {
    width: 42, height: 42,
    backgroundColor: Colors.white,
    borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#FF3B30',
    width: 18, height: 18,
    borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },

  /* Body */
  bodyContent: { paddingHorizontal: 20, marginTop: -15 },
  
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, marginTop: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: -0.3 },
  dateSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  dateText: { fontSize: 12, fontWeight: '600', color: Colors.gray600 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: '#2F80ED' },

  /* Stats Cards */
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
    overflow: 'hidden',
  },
  statCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 12,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  statCardBody: { alignItems: 'center', paddingBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  statTitle: { fontSize: 10, color: '#6B7280', fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  trendLineContainer: { position: 'absolute', bottom: -5, left: -5, right: -5, height: 20 },
  trendLine: { borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.5, marginTop: 10 },

  /* Quick Actions Grid */
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  quickAction: {
    width: (width - 52) / 2, // 2 columns, minus padding/gap
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
  },
  qaLeft: { flex: 1 },
  qaIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  qaTextWrap: { paddingRight: 4 },
  qaTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  qaSubtitle: { fontSize: 10, color: '#6B7280', lineHeight: 14 },
  qaArrow: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    alignSelf: 'flex-end',
  },

  /* Wide Card */
  wideCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginTop: 24,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    overflow: 'hidden',
  },
  wideCardContent: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
  },
  wideCardIcon: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  wideCardCheck: {
    position: 'absolute', bottom: 0, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#16B978',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  wideCardText: { flex: 1 },
  wideCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  wideCardSubtitle: { fontSize: 11, color: '#6B7280', lineHeight: 16 },

});

export default StaffHomeScreen;
