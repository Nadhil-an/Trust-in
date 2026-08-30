import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { eventsApi } from '../../api';

const sampleEvents = [];

const EventsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [events, setEvents] = useState(sampleEvents);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventsApi.list();
      if (res.data && res.data.results && res.data.results.length > 0) {
        setEvents(res.data.results);
      }
    } catch (error) {
      console.log('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = events.filter(e => {
    if (activeTab === 'All') return true;
    return (e.category || 'Upcoming').toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['Upcoming', 'Past', 'All'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={Colors.gray400} />
            <Text style={styles.emptyText}>No {activeTab} events found</Text>
          </View>
        ) : (
          filteredEvents.map((item) => (
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

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color="#0284c7" />
                    <Text style={styles.metaText}>{item.date}</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color="#0284c7" />
                    <Text style={styles.metaText}>{item.location}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View All Events</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: {
    backgroundColor: '#0284c7',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray600 },
  tabTextActive: { color: Colors.white, fontWeight: '700' },

  scroll: { padding: 16, gap: 16 },

  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  eventImage: {
    width: '100%',
    aspectRatio: 3/2,
    backgroundColor: '#f1f5f9',
  },
  eventContent: { padding: 14 },
  eventTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  eventDesc: { fontSize: 12, color: Colors.gray600, lineHeight: 17, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: Colors.gray500, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', marginVertical: 40 },
  emptyText: { marginTop: 10, color: Colors.gray400, fontSize: 14 },

  viewAllBtn: {
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllText: { fontSize: 14, fontWeight: '700', color: '#0284c7' },
});

export default EventsScreen;
