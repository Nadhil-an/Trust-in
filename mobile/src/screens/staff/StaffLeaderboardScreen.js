import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import { staffApi } from '../../api';
import Toast from 'react-native-toast-message';

const StaffLeaderboardScreen = ({ navigation }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDateIso = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateDisplay = (d) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const fetchLeaderboard = async (dateObj = filterDate, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const iso = formatDateIso(dateObj);
      const res = await staffApi.leaderboard({ date: iso });
      setLeaderboard(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load leaderboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(filterDate, true);
  }, [filterDate]);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFilterDate(selectedDate);
    }
  };

  const setQuickDate = (type) => {
    const d = new Date();
    if (type === 'YESTERDAY') {
      d.setDate(d.getDate() - 1);
    }
    setFilterDate(d);
  };

  const renderItem = ({ item, index }) => {
    return (
      <View style={[styles.card, index === 0 && styles.topCard]}>
        <Text style={styles.rankText}>{item.rank}</Text>
        <View style={styles.photoContainer}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.idText}>Staff ID: ST{String(item.staff_id).substring(0, 3).toUpperCase()}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>₹ {item.amount.toLocaleString('en-IN')}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.mainTitle}>Collection Leaderboard</Text>

        {/* Date Filter Bar */}
        <View style={styles.filterBar}>
          <TouchableOpacity 
            style={[styles.dateChip, formatDateDisplay(filterDate) === 'Today' && styles.dateChipActive]}
            onPress={() => setQuickDate('TODAY')}
          >
            <Text style={[styles.dateChipText, formatDateDisplay(filterDate) === 'Today' && styles.dateChipTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.dateChip, formatDateDisplay(filterDate) === 'Yesterday' && styles.dateChipActive]}
            onPress={() => setQuickDate('YESTERDAY')}
          >
            <Text style={[styles.dateChipText, formatDateDisplay(filterDate) === 'Yesterday' && styles.dateChipTextActive]}>
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.calendarBtn, !['Today', 'Yesterday'].includes(formatDateDisplay(filterDate)) && styles.calendarBtnActive]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={16} color={!['Today', 'Yesterday'].includes(formatDateDisplay(filterDate)) ? '#FFFFFF' : '#0284C7'} />
            <Text style={[styles.calendarBtnText, !['Today', 'Yesterday'].includes(formatDateDisplay(filterDate)) && styles.calendarBtnTextActive]}>
              {['Today', 'Yesterday'].includes(formatDateDisplay(filterDate)) ? 'Select Date' : formatDateDisplay(filterDate)}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={filterDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={onDateChange}
          />
        )}
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.staff_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeaderboard(filterDate, false); }} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={Colors.gray400} />
              <Text style={styles.emptyText}>No collections recorded for {formatDateDisplay(filterDate)}.</Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && leaderboard.length > 0 && (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={20} color="#0284C7" />
              <Text style={styles.infoText}>Leaderboard results for {formatDateDisplay(filterDate)}.</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray800 },
  headerRight: { width: 32 },
  titleContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  mainTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0'
  },
  dateChipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  dateChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  dateChipTextActive: { color: '#FFFFFF' },

  calendarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#BAE6FD'
  },
  calendarBtnActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  calendarBtnText: { fontSize: 12, fontWeight: '600', color: '#0284C7' },
  calendarBtnTextActive: { color: '#FFFFFF' },

  listContainer: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F8FE',
    padding: 16, marginBottom: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#EAF2FE'
  },
  topCard: { borderColor: '#BAE6FD', backgroundColor: '#F0F7FF' },
  rankText: { width: 28, fontSize: 18, fontWeight: '800', color: '#0284C7', textAlign: 'center', marginRight: 10 },
  photoContainer: { marginRight: 14 },
  photo: { width: 44, height: 44, borderRadius: 22 },
  photoPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  idText: { fontSize: 12, color: '#64748B' },
  amountContainer: { paddingLeft: 12 },
  amountText: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF5FF',
    padding: 14, borderRadius: 12, marginTop: 12,
  },
  infoText: { marginLeft: 8, fontSize: 13, color: '#0369A1', fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#64748B' }
});

export default StaffLeaderboardScreen;
