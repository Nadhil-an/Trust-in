// screens/staff/HomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { staffApi, notifyApi, eventsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import Toast from 'react-native-toast-message';
import BirthdayPopup from '../../components/BirthdayPopup';
import SideDrawer from '../../components/SideDrawer';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useOfflineStore } from '../../store/offlineStore';
import { OfflineBar } from '../../components/shared';
import { verifyAttendanceMarked } from '../../utils/attendanceGuard';

const { width } = Dimensions.get('window');

// ── Components ──────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon, onPress }) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.statIconWrap}>
      <Ionicons name={icon} size={22} color="#1689D8" />
    </View>
    <Text style={styles.statTitle} numberOfLines={2}>{title}</Text>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
  </TouchableOpacity>
);

const QuickActionCard = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={28} color="#1689D8" style={{ marginBottom: 10 }} />
    <Text style={styles.qaTitle} numberOfLines={2}>{title}</Text>
  </TouchableOpacity>
);

// ── Main Screen ─────────────────────────────────────────────────────────

const StaffHomeScreen = ({ navigation, route }) => {
  const { user } = useAuthStore();
  const { queue: offlineQueue } = useOfflineStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  usePushNotifications(); // Registers token in background

  const [stats, setStats] = useState({});
  const [topStaff, setTopStaff] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const offlineDonationItems = React.useMemo(() => {
    return (offlineQueue || []).filter(item => item?.url?.includes('donations') && item?.data);
  }, [offlineQueue]);

  const offlineDonationsTotal = React.useMemo(() => {
    return offlineDonationItems.reduce((sum, item) => sum + (Number(item?.data?.amount) || 0), 0);
  }, [offlineDonationItems]);

  const offlineCashTotal = React.useMemo(() => {
    return offlineDonationItems.filter(item => (item?.data?.payment_method || '').toUpperCase() === 'CASH').reduce((sum, item) => sum + (Number(item?.data?.amount) || 0), 0);
  }, [offlineDonationItems]);

  const offlineBankTotal = React.useMemo(() => {
    return offlineDonationItems.filter(item => (item?.data?.payment_method || '').toUpperCase() !== 'CASH').reduce((sum, item) => sum + (Number(item?.data?.amount) || 0), 0);
  }, [offlineDonationItems]);

  const displayTotalDonations = (stats?.donations || 0) + offlineDonationsTotal;
  const displayCashDonations = (stats?.cash_donations || 0) + offlineCashTotal;
  const displayBankDonations = (stats?.bank_donations || 0) + offlineBankTotal;
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };
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
  
  const sliderRef = React.useRef(null);

  // Auto-slide carousel infinitely to the right
  useEffect(() => {
    let currentSlide = 0;
    const interval = setInterval(() => {
      currentSlide += 1;
      
      // When we reach slide 15 (which is the start of the 6th set, meaning it's the 'greeting' card),
      // we silently reset to 0 (the first 'greeting' card) and animate to 1 immediately.
      if (currentSlide >= 15) {
        sliderRef.current?.scrollTo({ x: 0, animated: false });
        currentSlide = 1;
        setTimeout(() => {
          sliderRef.current?.scrollTo({ x: currentSlide * (width - 36), animated: true });
        }, 50);
      } else {
        sliderRef.current?.scrollTo({ x: currentSlide * (width - 36), animated: true });
      }
    }, 4000); // Slides every 4 seconds
    return () => clearInterval(interval);
  }, []);

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
      let todayList = (res.data?.today || []).map(p => ({ ...p, when: 'today' }));
      const tomorrowList = (res.data?.tomorrow || []).map(p => ({ ...p, when: 'tomorrow' }));
      
      // Check if logged-in user's birthday is today
      const userDob = user?.date_of_birth || user?.dob;
      if (userDob) {
        const parts = userDob.split('-');
        if (parts.length === 3) {
          const dobMonth = parseInt(parts[1], 10);
          const dobDay = parseInt(parts[2], 10);
          const now = new Date();
          if (now.getMonth() + 1 === dobMonth && now.getDate() === dobDay) {
            const exists = todayList.some(p => p.name === user.full_name);
            if (!exists) {
              todayList.unshift({
                id: 'my-bday',
                name: user?.full_name || 'You',
                designation: 'Special Birthday Wish 🎉',
                when: 'today',
                isCurrentUser: true,
              });
            }
          }
        }
      }

      const all = [...todayList, ...tomorrowList];
      if (all.length > 0) {
        setBirthdays(all);
        const todayStr = new Date().toISOString().split('T')[0];
        const lastShownDate = await AsyncStorage.getItem('@bday_popup_shown_date');
        if (lastShownDate !== todayStr) {
          setBdayVisible(true);
          await AsyncStorage.setItem('@bday_popup_shown_date', todayStr);
        }
      }
    } catch (_) {
      const userDob = user?.date_of_birth || user?.dob;
      if (userDob) {
        const parts = userDob.split('-');
        if (parts.length === 3) {
          const dobMonth = parseInt(parts[1], 10);
          const dobDay = parseInt(parts[2], 10);
          const now = new Date();
          if (now.getMonth() + 1 === dobMonth && now.getDate() === dobDay) {
            setBirthdays([{
              id: 'my-bday',
              name: user?.full_name || 'You',
              designation: 'Special Birthday Wish 🎉',
              when: 'today',
              isCurrentUser: true,
            }]);
            const todayStr = new Date().toISOString().split('T')[0];
            const lastShownDate = await AsyncStorage.getItem('@bday_popup_shown_date');
            if (lastShownDate !== todayStr) {
              setBdayVisible(true);
              await AsyncStorage.setItem('@bday_popup_shown_date', todayStr);
            }
          }
        }
      }
    }
  }, [user]);

  const isUserBirthday = React.useMemo(() => {
    const userDob = user?.date_of_birth || user?.dob;
    if (!userDob) return false;
    const parts = userDob.split('-');
    if (parts.length !== 3) return false;
    const dobMonth = parseInt(parts[1], 10);
    const dobDay = parseInt(parts[2], 10);
    const now = new Date();
    return now.getMonth() + 1 === dobMonth && now.getDate() === dobDay;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchUnreadCount();
      // Only fetch birthdays once or occasionally; it's fine here, or move it out if needed.
      setTimeout(() => fetchBirthdays(), 1200);
    }, [fetchBirthdays])
  );

  const fetchUnreadCount = async () => {
    try {
      const res = await notifyApi.unreadCount();
      setUnreadCount(res.data?.count || 0);
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const res = await staffApi.todayStats();
      if(res.data) setStats(res.data);
      
      try {
        const lbRes = await staffApi.leaderboard({ limit: 3 });
        if(lbRes.data) setTopStaff(lbRes.data);
      } catch (err) {}

      try {
        const evRes = await eventsApi.list();
        if(evRes.data && evRes.data.results) {
          const upcoming = evRes.data.results.filter(e => e.category === 'Upcoming' || !e.category);
          setUpcomingEvents(upcoming.slice(0, 2));
        }
      } catch (err) {}
    } catch (_) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    await fetchUnreadCount();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Sticky Top App Bar */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10, paddingHorizontal: 18 }]}>
        <TouchableOpacity style={styles.menuIconContainer} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu" size={30} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellContainer} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={26} color="#1E293B" />
            {unreadCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.avatarWrap, isUserBirthday && { position: 'relative' }]} 
            activeOpacity={0.8} 
            onPress={() => {
              if (isUserBirthday) {
                setBdayVisible(true);
              } else {
                navigation.navigate('Profile');
              }
            }}
          >
            {isUserBirthday && (
              <View style={styles.birthdayHatBadge}>
                <Text style={{ fontSize: 16 }}>👑</Text>
              </View>
            )}

            {user?.avatar ? (
              <Image 
                source={{ uri: user.avatar }} 
                style={[
                  { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#0284C7' },
                  isUserBirthday && { borderColor: '#F59E0B', borderWidth: 2.5 }
                ]} 
              />
            ) : (
              <View style={[
                styles.defaultAvatarCircle,
                isUserBirthday && { borderColor: '#F59E0B', borderWidth: 2.5, backgroundColor: '#FEF3C7' }
              ]}>
                <Ionicons name="person" size={20} color={isUserBirthday ? '#D97706' : '#0284C7'} />
              </View>
            )}

            {isUserBirthday && (
              <View style={styles.birthdayCakeBadge}>
                <Text style={{ fontSize: 11 }}>🎂</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <OfflineBar />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1689D8" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* Top Carousel */}
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {Array(10).fill(['greeting', 'collection', 'leaderboard']).flat().map((type, index) => {
              if (type === 'greeting') {
                return (
                  <View key={index} style={{ width: width - 36 }}>
                    <LinearGradient colors={['#E6F0FE', '#E6F0FE']} style={[styles.greetingCard, { marginBottom: 0 }]}>
                      <View style={styles.greetingTextWrap}>
                        <Text style={styles.goodMorning}>{t(`staff.${new Date().getHours() < 12 ? 'good_morning' : new Date().getHours() < 17 ? 'good_afternoon' : 'good_evening'}`, getGreeting())}</Text>
                        <Text style={styles.staffMemberText}>{user?.full_name || user?.username || 'Staff Member'}!</Text>
                        <Text style={styles.greetingSubtitle}>{t('staff.welcome_back', "Welcome back! Let's continue\nmaking a difference today.")}</Text>
                      </View>
                      <View style={styles.weatherIconWrap}>
                        <Ionicons name="partly-sunny" size={60} color="#FDB813" style={styles.sunIcon} />
                        <Ionicons name="cloud" size={40} color="#60A5FA" style={styles.cloudIcon} />
                      </View>
                    </LinearGradient>
                  </View>
                );
              } else if (type === 'collection') {
                return (
                  <TouchableOpacity 
                    key={index}
                    activeOpacity={0.9} 
                    style={{ width: width - 36 }}
                    onPress={() => navigation.navigate('StaffDonationsList')}
                  >
                    <View style={styles.collectionCard}>
                      <View style={styles.collHeader}>
                        <View>
                          <Text style={styles.collTitle}>{t('staff.collection_today', 'Collection Today')}</Text>
                          <Text style={styles.collSubtitle}>{t('staff.track_today_collection', "Track today's total collection")}</Text>
                        </View>
                        <View style={styles.collIconWrap}>
                          <Ionicons name="wallet-outline" size={24} color="#1689D8" />
                        </View>
                      </View>

                      <View style={styles.collTotalBox}>
                        <View style={styles.collTotalIcon}>
                          <Ionicons name="bag-handle" size={20} color="#FFF" />
                          <View style={styles.rupeeCircle}>
                            <Text style={styles.rupeeText}>₹</Text>
                          </View>
                        </View>
                        <View>
                          <Text style={styles.collTotalLabel}>{t('staff.total_collection', 'Total Collection')}</Text>
                          <Text style={styles.collTotalVal}>
                            ₹ {displayTotalDonations.toLocaleString()}
                            {offlineDonationsTotal > 0 && <Text style={{ fontSize: 11, color: '#F59E0B' }}> (₹{offlineDonationsTotal} offline)</Text>}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.collRow}>
                        <View style={styles.collThirdBox}>
                          <View style={[styles.collThirdIcon, { backgroundColor: '#DCFCE7' }]}>
                            <Ionicons name="cash-outline" size={14} color="#16A34A" />
                          </View>
                          <Text style={styles.collThirdLabel}>{t('staff.in_cash', 'In Cash')}</Text>
                          <Text style={styles.collThirdVal}>₹{displayCashDonations.toLocaleString()}</Text>
                        </View>
                        
                        <View style={styles.collThirdBox}>
                          <View style={[styles.collThirdIcon, { backgroundColor: '#E0F2FE' }]}>
                            <Ionicons name="card-outline" size={14} color="#0284C7" />
                          </View>
                          <Text style={styles.collThirdLabel}>{t('staff.in_bank', 'In Bank')}</Text>
                          <Text style={styles.collThirdVal}>₹{displayBankDonations.toLocaleString()}</Text>
                        </View>

                        <View style={styles.collThirdBox}>
                          <View style={[styles.collThirdIcon, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="people-outline" size={14} color="#D97706" />
                          </View>
                          <Text style={styles.collThirdLabel}>{t('staff.members', 'Members')}</Text>
                          <Text style={styles.collThirdVal}>₹{(stats?.membership_amount || 0).toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              } else {
                return (
                  <TouchableOpacity 
                    key={index}
                    activeOpacity={0.9} 
                    style={{ width: width - 36 }}
                    onPress={() => navigation.navigate('StaffLeaderboard')}
                  >
                    <View style={styles.lbCard}>
                      <View style={styles.lbHeader}>
                        <Text style={styles.lbTitle}>{t('staff.todays_leaderboard', "Today's Collection Leaderboard")}</Text>
                        <TouchableOpacity style={styles.lbViewAllWrap} onPress={() => navigation.navigate('StaffLeaderboard')}>
                          <Text style={styles.lbViewAll}>{t('common.view_all', 'View All')}</Text>
                          <Ionicons name="chevron-forward" size={14} color="#0284C7" />
                        </TouchableOpacity>
                      </View>
                      
                      {topStaff.length === 0 ? (
                        <View style={styles.lbEmpty}>
                          <Ionicons name="trophy-outline" size={28} color="#94A3B8" />
                          <Text style={styles.lbEmptyText}>No collections recorded today</Text>
                        </View>
                      ) : (
                        <View style={styles.lbContentBox}>
                          {topStaff.slice(0, 3).map((staff, i) => (
                            <View key={staff.staff_id || i} style={[styles.lbRowItem, i < Math.min(topStaff.length, 3) - 1 && styles.lbRowBorder]}>
                              <Text style={styles.lbRank}>{staff.rank}</Text>
                              {staff.photo_url ? (
                                <Image source={{ uri: staff.photo_url }} style={styles.lbPhoto} />
                              ) : (
                                <View style={styles.lbPhotoPlaceholder}>
                                  <Ionicons name="person" size={16} color="#64748B" />
                                </View>
                              )}
                              <View style={styles.lbInfo}>
                                <Text style={styles.lbName} numberOfLines={1}>{staff.name}</Text>
                                <Text style={styles.lbStaffId}>Staff ID: {staff.staff_uid || 'N/A'}</Text>
                              </View>
                              <Text style={styles.lbAmount}>₹ {staff.amount.toLocaleString('en-IN')}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Info Pill at Bottom */}
                      <View style={styles.lbInfoPill}>
                        <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
                        <Text style={styles.lbInfoPillText}>Leaderboard updates at the end of each day</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
            })}
          </ScrollView>
        </View>

        {/* Today's Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('staff.todays_overview', "Today's Overview")}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title={t('staff.members_added')}
            value={(stats?.members || 0).toString()}
            icon="person-add-outline"
            onPress={() => navigation.navigate('StaffMembersList')}
          />
          <StatCard
            title={t('staff.donation_collected')}
            value={`₹ ${displayTotalDonations.toLocaleString()}`}
            icon="heart-outline"
            onPress={() => navigation.navigate('StaffDonationsList')}
          />
          <StatCard
            title={t('staff.assessments_submitted', 'Assessments Submitted')}
            value={(stats?.assessments || 0).toString()}
            icon="document-text-outline"
            onPress={() => navigation.navigate('StaffAssessmentsList')}
          />
          <StatCard
            title={t('staff.attendance_marked', 'Attendance Marked')}
            value={`${stats?.attendancePercentage || 0}%`}
            icon="calendar-outline"
            onPress={() => navigation.navigate('StaffAttendance', { fromDashboard: true })}
          />
        </View>

        {/* Quick Actions */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>{t('staff.quick_actions', 'Quick Actions')}</Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickActionCard
            title={t('staff.add_members', 'Add Members')}
            icon="person-add"
            onPress={async () => {
              const ok = await verifyAttendanceMarked(navigation, 'add members');
              if (ok) navigation.navigate('AddMember');
            }}
          />
          <QuickActionCard
            title={t('staff.collection_donation', 'Collection Donation')}
            icon="heart"
            onPress={async () => {
              const ok = await verifyAttendanceMarked(navigation, 'collect donations');
              if (ok) navigation.navigate('CollectDonation');
            }}
          />
          <QuickActionCard
            title={t('staff.new_assessment', 'New Assessment')}
            icon="document-text"
            onPress={async () => {
              const ok = await verifyAttendanceMarked(navigation, 'perform new assessments');
              if (ok) navigation.navigate('NewAssessment');
            }}
          />
          <QuickActionCard
            title={t('nav.attendance', 'Attendance')}
            icon="calendar"
            onPress={() => navigation.navigate('StaffAttendance', { fromDashboard: true })}
          />
          <QuickActionCard
            title={t('common.history', 'History')}
            icon="time-outline"
            onPress={() => navigation.navigate('StaffDonationsList')}
          />
          <QuickActionCard
            title={t('staff.leaderboard', 'Leaderboard')}
            icon="trophy-outline"
            onPress={() => navigation.navigate('StaffLeaderboard')}
          />
        </View>

        {/* Together We Can Card */}
        <LinearGradient colors={['#F0F7FF', '#E1EFFF']} style={styles.togetherCard}>
          <View style={styles.togetherTextWrap}>
            <Text style={styles.togetherTitle}>{t('staff.together_we_can', 'Together We Can')}</Text>
            <Text style={styles.togetherSubtitle}>{t('staff.together_subtitle', "Every small effort counts towards\na better tomorrow.")}</Text>
          </View>
          <Ionicons name="heart" size={48} color="#93C5FD" style={styles.togetherIcon} />
        </LinearGradient>

        <View style={[styles.sectionHeader, { marginTop: 10 }]}>
          <Text style={styles.sectionTitle}>{t('events.upcoming_events', 'Upcoming Events')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Events')}>
            <Text style={styles.viewAllText}>{t('common.see_all', 'View All')}</Text>
          </TouchableOpacity>
        </View>

        {upcomingEvents.length === 0 ? (
          <View style={[styles.eventCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 24, marginBottom: 20 }]}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>{t('events.no_events', 'No upcoming events at the moment.')}</Text>
          </View>
        ) : (
          upcomingEvents.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.eventCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EventDetail', { event: item })}
            >
              <Image source={{ uri: item.image }} style={styles.eventImage} resizeMode="cover" />
              <View style={styles.eventContent}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDesc} numberOfLines={2}>
                  {item.short_description || item.description}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '500' }}>{item.date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={12} color="#0284c7" />
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '500' }}>{item.location}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>

      <BirthdayPopup
        visible={bdayVisible}
        birthdays={birthdays}
        onClose={() => setBdayVisible(false)}
      />

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
  container: { flex: 1, backgroundColor: '#F8FBFF' },
  scroll: { paddingBottom: 110, paddingHorizontal: 18, paddingTop: 10 },
  
  /* Header */
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F1F5F9', // Darker white
    paddingBottom: 10,
    zIndex: 10,
  },
  menuIconContainer: {
    padding: 2,
  },
  headerRight: {
    flexDirection: 'row', alignItems: 'center',
  },
  bellContainer: {
    marginRight: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: 2, right: 3,
    backgroundColor: '#EF4444',
    width: 8, height: 8,
    borderRadius: 4,
  },
  avatarWrap: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Greeting Card */
  greetingCard: {
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    height: 245,
  },
  greetingTextWrap: {
    flex: 1,
  },
  goodMorning: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 2,
  },
  staffMemberText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  weatherIconWrap: {
    position: 'relative',
    width: 70, height: 70,
    justifyContent: 'center', alignItems: 'center',
  },
  sunIcon: {
    position: 'absolute', top: -5, right: 10,
  },
  cloudIcon: {
    position: 'absolute', bottom: 5, right: -5,
  },

  /* Notification Banner */
  notificationBanner: {
    backgroundColor: '#1689D8',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  bellIconCircle: {
    marginRight: 12,
  },
  notificationBannerText: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: '#E0F2FE',
    fontSize: 11,
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#1689D8' },

  /* Stats Cards */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    width: (width - 36 - 24) / 4, // 4 columns, minus padding and gaps
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  statIconWrap: {
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    height: 28, // Fix height for 2 lines
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Quick Actions Grid */
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickAction: {
    width: (width - 36 - 24) / 3, // 3 columns
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  qaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    height: 32, // Allow 2 lines
  },

  /* Together We Can Card */
  togetherCard: {
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  togetherTextWrap: {
    flex: 1,
  },
  togetherTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  togetherSubtitle: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  togetherIcon: {
    opacity: 0.8,
  },

  /* Events Card */
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  eventThumb: { width: 90, height: 80, borderRadius: 10 },
  eventInfo: { flex: 1, justifyContent: 'center' },
  eventCardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  eventCardDesc: { fontSize: 11, color: '#64748B', marginBottom: 8 },
  eventMetaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventMetaText: { fontSize: 10, color: '#64748B', fontWeight: '500' },

  /* Collection Card UI */
  collectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    height: 245,
    justifyContent: 'space-between',
  },
  collHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  collTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  collSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  collIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center' },
  
  collTotalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  collTotalIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F2FE',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative'
  },
  rupeeCircle: {
    position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
  },
  rupeeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  collTotalLabel: { fontSize: 11, color: '#475569', fontWeight: '600' },
  collTotalVal: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 1 },

  collRow: { flexDirection: 'row', gap: 8 },
  collThirdBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',
  },
  collThirdIcon: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  collThirdLabel: { fontSize: 10, color: '#475569', fontWeight: '600' },
  collThirdVal: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginTop: 2 },

  /* Leaderboard Card UI */
  lbCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    height: 245,
    justifyContent: 'space-between',
  },
  lbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 14,
  },
  eventImage: {
    width: '100%',
    aspectRatio: 3/2,
    backgroundColor: '#f1f5f9',
  },
  eventContent: {
    padding: 14,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  eventDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  lbTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  lbViewAllWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lbViewAll: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    marginRight: 2,
  },
  lbContentBox: {
    backgroundColor: '#F4F8FE',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#EAF2FE',
    marginBottom: 10,
  },
  lbRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lbRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  lbRank: {
    width: 24,
    fontSize: 15,
    fontWeight: '800',
    color: '#0284C7',
    textAlign: 'center',
    marginRight: 8,
  },
  lbPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  lbPhotoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  lbInfo: {
    flex: 1,
  },
  lbName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  lbStaffId: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  lbAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  lbInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  lbInfoPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0369A1',
    marginLeft: 6,
  },
  lbEmpty: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  lbEmptyText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  /* Special Birthday Profile Badges */
  birthdayHatBadge: {
    position: 'absolute',
    top: -14,
    left: 8,
    zIndex: 10,
  },
  birthdayCakeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F43F5E',
    zIndex: 10,
  },
  defaultAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
});

export default StaffHomeScreen;
