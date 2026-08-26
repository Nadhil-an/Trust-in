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
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { attendanceApi } from '../../api';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AttendanceScreen({ navigation, route }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [todayAtt, setTodayAtt] = useState(null);
  const [records, setRecords] = useState([]);
  const [officerName, setOfficerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const loadAttendance = useCallback(async () => {
    try {
      const res = await attendanceApi.myAttendance();
      setTodayAtt(res.data.today);
      setRecords(res.data.monthly_records || []);
      setOfficerName(res.data.officer_name || '');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load attendance records' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleAction = async (action) => {
    setSubmitting(true);
    try {
      if (action === 'check_in') {
        await attendanceApi.checkIn();
        Toast.show({ type: 'success', text1: 'Checked In', text2: 'Checked in successfully for today!' });
      } else {
        await attendanceApi.checkOut();
        Toast.show({ type: 'success', text1: 'Checked Out', text2: 'Checked out successfully!' });
      }
      loadAttendance();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record attendance' });
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;
  const leaveCount = records.filter(r => r.status === 'LEAVE').length;

  const renderRecord = ({ item }) => {
    const isPresent = item.status === 'PRESENT';
    return (
      <View style={styles.recordCard}>
        <View style={styles.recordLeft}>
          <Text style={styles.recordDate}>{item.date}</Text>
          <Text style={styles.recordTime}>
            In: {item.check_in ? item.check_in.substring(0, 5) : '--:--'} | Out: {item.check_out ? item.check_out.substring(0, 5) : '--:--'}
          </Text>
        </View>

        <View style={[styles.badge, isPresent ? styles.badgeGreen : styles.badgeRed]}>
          <Text style={[styles.badgeText, isPresent ? styles.textGreen : styles.textRed]}>
            {item.status}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top || Platform.OS === 'ios' ? 40 : 20, paddingBottom: 10 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Attendance</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAttendance} />}
          ListHeaderComponent={
            <View>
              {/* Today's Action Card */}
              <View style={styles.todayCard}>
                <View style={styles.todayHeader}>
                  <View>
                    <Text style={styles.todayTitle}>Today's Attendance</Text>
                    <Text style={{ fontSize: 10, color: Colors.primary, fontWeight: '700', marginTop: 2 }}>
                      ⏰ Resets Daily at 8:00 AM
                    </Text>
                  </View>
                  <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK IN</Text>
                    <Text style={styles.timeVal}>
                      {todayAtt && todayAtt.check_in ? todayAtt.check_in.substring(0, 5) : '--:--'}
                    </Text>
                  </View>

                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK OUT</Text>
                    <Text style={styles.timeVal}>
                      {todayAtt && todayAtt.check_out ? todayAtt.check_out.substring(0, 5) : '--:--'}
                    </Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.btnRow}>
                  {(!todayAtt || !todayAtt.check_in) ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.checkInBtn]}
                      disabled={submitting}
                      onPress={() => handleAction('check_in')}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                          <Text style={styles.actionBtnText}>Check In Now</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.checkOutBtn, todayAtt.check_out && { backgroundColor: '#94a3b8' }]}
                      disabled={submitting || !!todayAtt.check_out}
                      onPress={() => handleAction('check_out')}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                          <Text style={styles.actionBtnText}>
                            {todayAtt.check_out ? 'Checked Out' : 'Check Out Now'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Monthly Stats */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.statNum, { color: '#16a34a' }]}>{presentCount}</Text>
                  <Text style={styles.statLabel}>Present</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[styles.statNum, { color: '#dc2626' }]}>{absentCount}</Text>
                  <Text style={styles.statLabel}>Absent</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.statNum, { color: '#d97706' }]}>{leaveCount}</Text>
                  <Text style={styles.statLabel}>Leave</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Monthly Log History</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No attendance logs for this month</Text>
            </View>
          }
        />
      )}

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffAttendance"
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
  listContainer: {
    padding: 16,
  },
  todayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  todayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  todayDate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  timeBox: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  timeVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  btnRow: {
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  checkInBtn: {
    backgroundColor: '#16a34a',
  },
  checkOutBtn: {
    backgroundColor: Colors.primary,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  recordCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordLeft: {
    flex: 1,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  recordTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
  },
  badgeRed: {
    backgroundColor: '#fee2e2',
  },
  textGreen: {
    color: '#16a34a',
    fontWeight: '700',
    fontSize: 11,
  },
  textRed: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 11,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
