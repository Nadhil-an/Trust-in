// components/shared/EventBanner.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { eventsApi } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

const typeConfig = {
  UPCOMING: { color: Colors.primary, bg: Colors.primaryLight, icon: 'calendar' },
  COMPLETED: { color: Colors.success, bg: Colors.successLight, icon: 'checkmark-circle' },
  ANNOUNCEMENT: { color: Colors.warning, bg: Colors.warningLight, icon: 'megaphone' },
  DRIVE: { color: Colors.purple, bg: Colors.purpleLight, icon: 'heart' },
};

const EventBanner = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (events.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % events.length;
          scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
          return next;
        });
      }, 4000);
    }
    return () => clearInterval(timerRef.current);
  }, [events]);

  const fetchEvents = async () => {
    try {
      const res = await eventsApi.list();
      setEvents(res.data.results || res.data || []);
    } catch (_) {
      // Silently fail — banner is optional
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (events.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setCurrentIndex(idx);
        }}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH}
      >
        {events.map((event, index) => {
          const config = typeConfig[event.type] || typeConfig.ANNOUNCEMENT;
          return (
            <View key={event.id || index} style={[styles.card, { width: CARD_WIDTH, backgroundColor: config.bg }]}>
              <View style={styles.cardContent}>
                <View style={[styles.iconCircle, { backgroundColor: config.color }]}>
                  <Ionicons name={config.icon} size={20} color={Colors.white} />
                </View>
                <View style={styles.textArea}>
                  <View style={styles.typeRow}>
                    <View style={[styles.typePill, { backgroundColor: config.color }]}>
                      <Text style={styles.typeText}>{event.type || 'ANNOUNCEMENT'}</Text>
                    </View>
                    {event.date && (
                      <Text style={[styles.date, { color: config.color }]}>
                        <Ionicons name="calendar-outline" size={11} /> {event.date}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.title, { color: config.color }]} numberOfLines={1}>{event.title}</Text>
                  {event.description && (
                    <Text style={styles.desc} numberOfLines={2}>{event.description}</Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {/* Dot indicators */}
      {events.length > 1 && (
        <View style={styles.dots}>
          {events.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  loading: { height: 80, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: 0,
    borderRadius: 16,
    padding: 14,
    minHeight: 90,
  },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textArea: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typeText: { fontSize: 10, color: Colors.white, fontWeight: '700', textTransform: 'uppercase' },
  date: { fontSize: 11 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  desc: { fontSize: 12, color: Colors.gray600, lineHeight: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gray300 },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
});

export default EventBanner;
