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
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
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
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [isCheckInExpanded, setIsCheckInExpanded] = useState(false);
  const [isCheckOutExpanded, setIsCheckOutExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const baseUrl = Config.API_BASE_URL.replace('/api', '');
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  const handleTakePhoto = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPerm.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Camera permission is required' });
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.5,
    });
    if (!photo.canceled) {
      setPendingPhoto(photo.assets[0]);
    }
  };

  const handleGetLocation = async () => {
    const locPerm = await Location.requestForegroundPermissionsAsync();
    if (locPerm.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location permission is required' });
      return;
    }
    setSubmitting(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      let locationString = '';
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        locationString = [place.name, place.street, place.district, place.city, place.region].filter(Boolean).join(', ');
      } else {
        locationString = `Lat: ${location.coords.latitude}, Lng: ${location.coords.longitude}`;
      }
      setPendingLocation(locationString);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Failed to get current location' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAction = async (action) => {
    if (!pendingPhoto || !pendingLocation) {
      Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please take a photo and share location first.' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('action', action);
      formData.append('location', pendingLocation);
      formData.append('photo', {
        uri: pendingPhoto.uri,
        type: pendingPhoto.mimeType || 'image/jpeg',
        name: `attendance_${action}_selfie.jpg`,
      });

      if (action === 'check_in') {
        await attendanceApi.checkIn(formData);
        Toast.show({ type: 'success', text1: 'Checked In', text2: 'Checked in successfully for today!' });
      } else {
        await attendanceApi.checkOut(formData);
        Toast.show({ type: 'success', text1: 'Checked Out', text2: 'Checked out successfully!' });
      }
      setPendingPhoto(null);
      setPendingLocation(null);
      loadAttendance();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record attendance' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentHour = new Date().getHours();
  const isBefore8AM = currentHour < 8;

  const isCheckedOut = !!(todayAtt && todayAtt.check_out);
  const isCheckedIn = !!(todayAtt && todayAtt.check_in && !todayAtt.check_out);

  const checkInDisplay = (todayAtt && todayAtt.check_in) ? todayAtt.check_in.substring(0, 5) : '--:--';
  const checkOutDisplay = (todayAtt && todayAtt.check_out) ? todayAtt.check_out.substring(0, 5) : '--:--';

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
          <ActivityIndicator size="large" color={'#1A74EE'} />
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
                    <Text style={{ fontSize: 10, color: '#1A74EE', fontWeight: '700', marginTop: 2 }}>
                      ⏰ Resets Daily at 8:00 AM
                    </Text>
                  </View>
                  <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK IN</Text>
                    <Text style={styles.timeVal}>{checkInDisplay}</Text>
                  </View>

                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>CHECK OUT</Text>
                    <Text style={styles.timeVal}>{checkOutDisplay}</Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.btnRow}>
                  {isCheckedOut ? (
                    <View style={styles.captureSection}>
                      <TouchableOpacity 
                        style={styles.serverInfoBox} 
                        onPress={() => setIsCheckInExpanded(!isCheckInExpanded)}
                      >
                        <View style={styles.serverInfoHeader}>
                          <Text style={styles.serverInfoLabel}>Check In Info</Text>
                          <Ionicons name={isCheckInExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
                        </View>
                        {isCheckInExpanded && (
                          <View style={styles.serverInfoContent}>
                            {todayAtt?.check_in_photo && (
                              <Image source={{ uri: getImageUrl(todayAtt.check_in_photo) }} style={styles.serverImage} />
                            )}
                            {todayAtt?.check_in_location && (
                              <Text style={styles.serverLocation}>{todayAtt.check_in_location}</Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.serverInfoBox, { marginTop: 12 }]} 
                        onPress={() => setIsCheckOutExpanded(!isCheckOutExpanded)}
                      >
                        <View style={styles.serverInfoHeader}>
                          <Text style={styles.serverInfoLabel}>Check Out Info</Text>
                          <Ionicons name={isCheckOutExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
                        </View>
                        {isCheckOutExpanded && (
                          <View style={styles.serverInfoContent}>
                            {todayAtt?.check_out_photo && (
                              <Image source={{ uri: getImageUrl(todayAtt.check_out_photo) }} style={styles.serverImage} />
                            )}
                            {todayAtt?.check_out_location && (
                              <Text style={styles.serverLocation}>{todayAtt.check_out_location}</Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#94a3b8', marginTop: 16 }]}
                        disabled={true}
                      >
                        <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                        <Text style={styles.actionBtnText}>Checked Out</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isCheckedIn ? (
                    <View style={styles.captureSection}>
                      <TouchableOpacity 
                        style={styles.serverInfoBox} 
                        onPress={() => setIsCheckInExpanded(!isCheckInExpanded)}
                      >
                        <View style={styles.serverInfoHeader}>
                          <Text style={styles.serverInfoLabel}>Check In Info</Text>
                          <Ionicons name={isCheckInExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
                        </View>
                        {isCheckInExpanded && (
                          <View style={styles.serverInfoContent}>
                            {todayAtt?.check_in_photo && (
                              <Image source={{ uri: getImageUrl(todayAtt.check_in_photo) }} style={styles.serverImage} />
                            )}
                            {todayAtt?.check_in_location && (
                              <Text style={styles.serverLocation}>{todayAtt.check_in_location}</Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>

                      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Complete Check Out</Text>
                      
                      <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                        <Ionicons name="camera" size={20} color="#1A74EE" />
                        <Text style={styles.captureBtnText}>{pendingPhoto ? 'Retake Photo' : 'Take Photo'}</Text>
                      </TouchableOpacity>
                      
                      {pendingPhoto && (
                        <Image source={{ uri: pendingPhoto.uri }} style={styles.previewImage} />
                      )}

                      <TouchableOpacity style={styles.captureBtn} onPress={handleGetLocation}>
                        <Ionicons name="location" size={20} color="#1A74EE" />
                        <Text style={styles.captureBtnText}>{pendingLocation ? 'Update Location' : 'Share Location'}</Text>
                      </TouchableOpacity>

                      {pendingLocation && (
                        <Text style={styles.previewLocation}>{pendingLocation}</Text>
                      )}

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.checkOutBtn, (!pendingPhoto || !pendingLocation) && { opacity: 0.5 }]}
                        disabled={submitting || !pendingPhoto || !pendingLocation}
                        onPress={() => handleSubmitAction('check_out')}
                      >
                        {submitting ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                            <Text style={styles.actionBtnText}>Check Out Now</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : isBefore8AM ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#94a3b8' }]}
                      disabled={true}
                    >
                      <Ionicons name="time-outline" size={20} color="#ffffff" />
                      <Text style={styles.actionBtnText}>Check-In Opens at 8:00 AM</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.captureSection}>
                      <Text style={styles.sectionLabel}>Complete Check In</Text>
                      
                      <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                        <Ionicons name="camera" size={20} color="#1A74EE" />
                        <Text style={styles.captureBtnText}>{pendingPhoto ? 'Retake Photo' : 'Take Photo'}</Text>
                      </TouchableOpacity>
                      
                      {pendingPhoto && (
                        <Image source={{ uri: pendingPhoto.uri }} style={styles.previewImage} />
                      )}

                      <TouchableOpacity style={styles.captureBtn} onPress={handleGetLocation}>
                        <Ionicons name="location" size={20} color="#1A74EE" />
                        <Text style={styles.captureBtnText}>{pendingLocation ? 'Update Location' : 'Share Location'}</Text>
                      </TouchableOpacity>

                      {pendingLocation && (
                        <Text style={styles.previewLocation}>{pendingLocation}</Text>
                      )}

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.checkInBtn, (!pendingPhoto || !pendingLocation) && { opacity: 0.5 }]}
                        disabled={submitting || !pendingPhoto || !pendingLocation}
                        onPress={() => handleSubmitAction('check_in')}
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
                    </View>
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
    backgroundColor: '#1A74EE',
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
    color: '#1A74EE',
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
    backgroundColor: '#1A74EE',
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
  captureSection: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A74EE',
    backgroundColor: '#eff6ff',
    gap: 8,
    marginBottom: 12,
  },
  captureBtnText: {
    color: '#1A74EE',
    fontSize: 14,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  previewLocation: {
    fontSize: 13,
    color: '#334155',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  serverInfoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  serverInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverInfoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  serverInfoContent: {
    marginTop: 12,
  },
  serverImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  serverLocation: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
});
