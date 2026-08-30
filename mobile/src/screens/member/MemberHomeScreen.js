import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { eventsApi } from '../../api';
import SideDrawer from '../../components/SideDrawer';

const MemberHomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Time-based greeting helper
  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning,', icon: 'sunny-outline' };
    if (hour < 17) return { text: 'Good Afternoon,', icon: 'partly-sunny-outline' };
    if (hour < 21) return { text: 'Good Evening,', icon: 'cloudy-night-outline' };
    return { text: 'Good Night,', icon: 'moon-outline' };
  };

  const greeting = getGreetingData();
  const memberName = user?.full_name || '';
  const memberId = user?.username || '';

  const fetchUpcomingEvents = async () => {
    try {
      const res = await eventsApi.list();
      if (res.data && res.data.results) {
        const upcoming = res.data.results.filter(e => e.category === 'Upcoming' || !e.category);
        setUpcomingEvents(upcoming.slice(0, 2));
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchUpcomingEvents();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUpcomingEvents();
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerVisible(true)}>
          <Ionicons name="menu-outline" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.brandTitleContainer}>
          <Text style={styles.brandTitle}>SREELAKSHMI</Text>
          <Text style={styles.brandSub}>CHARITABLE TRUST</Text>
        </View>

        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={18} color="#0284c7" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Greeting Card */}
        <View style={styles.greetingCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingTitle}>{greeting.text}</Text>
            <Text style={styles.memberName}>{memberName}</Text>
            <Text style={styles.greetingMessage}>
              Wishing you a beautiful day filled with kindness & positivity! 💙
            </Text>
          </View>
          <View style={styles.weatherIconCircle}>
            <Ionicons name={greeting.icon} size={32} color="#0284c7" />
          </View>
        </View>

        {/* Prominent Digital Membership Card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MembershipCard')}
        >
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
                <Text style={styles.memberIdLabel}>MEMBER ID</Text>
                <Text style={styles.memberIdValue}>{memberId}</Text>
              </View>
            </View>

            <View style={styles.cardCenter}>
              <Text style={styles.cardTitle}>MEMBERSHIP CARD</Text>
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.footerLabel}>Member Since</Text>
                <Text style={styles.footerValue}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A'}</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.footerLabel}>Valid Upto</Text>
                <Text style={styles.footerValue}>{user?.valid_upto ? new Date(user.valid_upto).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick-Action Grid (4 equal rounded cards) */}
        <View style={styles.actionGrid}>
          {/* 1. My Donation */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('DonationHistory')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="heart" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>My Donation</Text>
            <Text style={styles.actionSub}>View your donation history</Text>
          </TouchableOpacity>

          {/* 2. Report a Problem */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ReportProblem')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="warning" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>Report a Problem</Text>
            <Text style={styles.actionSub}>Help us improve by reporting issues</Text>
          </TouchableOpacity>

          {/* 3. Events */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Events')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="calendar" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>Events</Text>
            <Text style={styles.actionSub}>View upcoming events & activities</Text>
          </TouchableOpacity>

          {/* 4. My Profile */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="person" size={24} color="#0284c7" />
            </View>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionSub}>View and manage your profile</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Events Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Events')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {upcomingEvents.length === 0 ? (
          <View style={[styles.eventCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 24 }]}>
            <Text style={{ color: Colors.gray500, fontSize: 13 }}>No upcoming events at the moment.</Text>
          </View>
        ) : (
          upcomingEvents.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.eventCard, { marginBottom: 14 }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EventDetail', { event: item })}
            >
              <Image source={{ uri: item.image }} style={{ width: '100%', aspectRatio: 3/2, backgroundColor: '#f1f5f9' }} resizeMode="cover" />
              <View style={{ padding: 14 }}>
                <Text style={styles.eventCardTitle}>{item.title}</Text>
                <Text style={styles.eventCardDesc} numberOfLines={2}>
                  {item.short_description || item.description}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                    <Text style={{ fontSize: 10, color: Colors.gray600, fontWeight: '500' }}>{item.date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={12} color="#0284c7" />
                    <Text style={{ fontSize: 10, color: Colors.gray600, fontWeight: '500' }}>{item.location}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Side Drawer Component */}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  iconBtn: { padding: 4 },
  brandTitleContainer: { alignItems: 'center' },
  brandTitle: { fontSize: 13, fontWeight: '900', color: '#0284c7', letterSpacing: 1 },
  brandSub: { fontSize: 9, fontWeight: '700', color: Colors.gray600, letterSpacing: 0.5 },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarBtn: { padding: 2 },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
  },

  scroll: { padding: 16, gap: 16 },

  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  greetingTitle: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  memberName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginVertical: 2 },
  greetingMessage: { fontSize: 12, color: Colors.gray600, marginTop: 4, lineHeight: 16 },
  weatherIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  membershipCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  trustLogoTitle: { fontSize: 7, fontWeight: '900', color: '#0284c7' },
  trustLogoSub: { fontSize: 5, fontWeight: '700', color: Colors.gray600 },
  memberIdContainer: { alignItems: 'flex-end' },
  memberIdLabel: { fontSize: 8, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' },
  memberIdValue: { fontSize: 12, fontWeight: '800', color: Colors.white },

  cardCenter: { alignItems: 'center', marginVertical: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: Colors.white, letterSpacing: 2 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' },
  footerValue: { fontSize: 13, fontWeight: '800', color: Colors.white, marginTop: 1 },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 11, color: Colors.gray500, leading: 14 },

  sectionHeader: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#0284c7' },

  eventCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  eventThumb: { width: 90, height: 80, borderRadius: 10 },
  eventInfo: { flex: 1, justifyContent: 'center' },
  eventCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  eventCardDesc: { fontSize: 11, color: Colors.gray500, marginBottom: 8 },
  eventMetaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventMetaText: { fontSize: 10, color: Colors.gray500, fontWeight: '500' },
});

export default MemberHomeScreen;
