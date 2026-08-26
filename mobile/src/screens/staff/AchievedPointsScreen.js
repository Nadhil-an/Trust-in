import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { performancePointsApi } from '../../api';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AchievedPointsScreen({ navigation, route }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [data, setData] = useState({ leaderboard: [], best_performer: null, my_stats: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' or 'my_history'
  const insets = useSafeAreaInsets();

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Root');
    }
  };

  // Hardware Back Press -> Return controlled based on origin (Dashboard vs SideDrawer)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, route?.params?.fromDashboard])
  );

  const loadPointsData = useCallback(async () => {
    try {
      const res = await performancePointsApi.leaderboard();
      setData(res.data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load points data' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPointsData();
  }, [loadPointsData]);

  const bestPerformer = data.best_performer;
  const myStats = data.my_stats;

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top || Platform.OS === 'ios' ? 40 : 20, paddingBottom: 10 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achieved Points</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPointsData} />}
        >
          {/* Personal Points Summary Banner */}
          <View style={styles.myPointsBanner}>
            <Text style={styles.myPointsLabel}>MY ACHIEVED POINTS</Text>
            <View style={styles.myPointsRow}>
              <View style={styles.myPointsValBox}>
                <Text style={styles.myPointsVal}>⭐ {myStats ? myStats.month_points : 0}</Text>
                <Text style={styles.myPointsSub}>THIS MONTH</Text>
              </View>
              <View style={styles.vertDivider} />
              <View style={styles.myPointsValBox}>
                <Text style={styles.myPointsVal}>🏆 {myStats ? myStats.all_time_points : 0}</Text>
                <Text style={styles.myPointsSub}>ALL TIME</Text>
              </View>
            </View>
          </View>

          {/* Best Performer Showcase Card */}
          {bestPerformer ? (
            <View style={styles.bestCard}>
              <View style={styles.crownCircle}>
                <Text style={{ fontSize: 32 }}>👑</Text>
              </View>
              <Text style={styles.bestTag}>BEST PERFORMANCE OF THE MONTH</Text>
              <Text style={styles.bestName}>{bestPerformer.full_name}</Text>
              <Text style={styles.bestDesig}>
                {bestPerformer.designation} • ID: {bestPerformer.emp_code}
              </Text>
              <View style={styles.bestPtsBadge}>
                <Text style={styles.bestPtsText}>🏆 {bestPerformer.total_points} Points</Text>
              </View>
            </View>
          ) : null}

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'leaderboard' && styles.tabBtnActive]}
              onPress={() => setActiveTab('leaderboard')}
            >
              <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
                Leaderboard Rankings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'my_history' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my_history')}
            >
              <Text style={[styles.tabText, activeTab === 'my_history' && styles.tabTextActive]}>
                My Points Log
              </Text>
            </TouchableOpacity>
          </View>

          {/* Leaderboard View */}
          {activeTab === 'leaderboard' ? (
            <View style={styles.section}>
              {data.leaderboard.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No points awarded for this month yet.</Text>
                </View>
              ) : (
                data.leaderboard.map((item) => (
                  <View
                    key={item.employee_id}
                    style={[styles.rankRow, item.rank === 1 && styles.topRankRow]}
                  >
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankNum}>
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{item.full_name}</Text>
                      <Text style={styles.rankDesig}>{item.designation || 'Staff Member'}</Text>
                    </View>
                    <Text style={styles.rankPts}>⭐ {item.total_points} pts</Text>
                  </View>
                ))
              )}
            </View>
          ) : (
            /* My History View */
            <View style={styles.section}>
              {!myStats || !myStats.history || myStats.history.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No point awards recorded for your profile yet.</Text>
                </View>
              ) : (
                myStats.history.map((hist) => (
                  <View key={hist.id} style={styles.historyCard}>
                    <View style={styles.histHeader}>
                      <Text style={styles.histPts}>+ {hist.points} Points</Text>
                      <Text style={styles.histDate}>
                        {MONTH_NAMES[hist.month - 1]} {hist.year}
                      </Text>
                    </View>
                    {hist.reason ? <Text style={styles.histReason}>{hist.reason}</Text> : null}
                    <Text style={styles.histAwarded}>
                      Awarded by: {hist.awarded_by_name || 'HR Department'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffPoints"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    minHeight: 60,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
  },
  menuBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  myPointsBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 3,
  },
  myPointsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginBottom: 10,
  },
  myPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  myPointsValBox: {
    flex: 1,
    alignItems: 'center',
  },
  vertDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  myPointsVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  myPointsSub: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  bestCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  crownCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bestTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bestName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  bestDesig: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  bestPtsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  bestPtsText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  section: {
    marginBottom: 20,
  },
  rankRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topRankRow: {
    borderColor: '#818cf8',
    backgroundColor: '#f5f3ff',
  },
  rankBadge: {
    width: 36,
    alignItems: 'center',
  },
  rankNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  rankInfo: {
    flex: 1,
    marginLeft: 10,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  rankDesig: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  rankPts: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  histHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  histPts: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16a34a',
  },
  histDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  histReason: {
    fontSize: 13,
    color: '#334155',
    marginVertical: 4,
  },
  histAwarded: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
