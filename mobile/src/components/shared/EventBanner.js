// components/shared/EventBanner.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EventBanner = ({
  events: eventsProp,
  navigation,
  autoPlayInterval = 4000,
  noEventsText,
}) => {
  const [internalEvents, setInternalEvents] = useState([]);
  const [loading, setLoading] = useState(eventsProp === undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 36);

  const scrollRef = useRef(null);
  const timerRef = useRef(null);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (eventsProp !== undefined) {
      setInternalEvents(eventsProp || []);
      setLoading(false);
    } else {
      fetchEvents();
    }
  }, [eventsProp]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await eventsApi.list();
      if (res.data && res.data.results) {
        const upcoming = res.data.results.filter(
          (e) => e.category === 'Upcoming' || !e.category
        );
        setInternalEvents(upcoming.length > 0 ? upcoming : res.data.results);
      } else if (Array.isArray(res.data)) {
        setInternalEvents(res.data);
      }
    } catch (_) {
      // Silently catch error
    } finally {
      setLoading(false);
    }
  };

  const events = eventsProp !== undefined ? eventsProp : internalEvents;
  const displayEvents = events.length > 1 ? [...events, events[0]] : events;

  // Auto-scroll timer - ALWAYS moves from right to left only (seamless infinite loop)
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!events || events.length <= 1) return;

    timerRef.current = setInterval(() => {
      const nextIndex = currentIndexRef.current + 1;
      if (scrollRef.current && containerWidth > 0) {
        scrollRef.current.scrollTo({
          x: nextIndex * containerWidth,
          animated: true,
        });
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex % events.length);

        // When reaching cloned first card, seamlessly reset offset to 0 without animation
        if (nextIndex >= events.length) {
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({
                x: 0,
                animated: false,
              });
              currentIndexRef.current = 0;
              setCurrentIndex(0);
            }
          }, 350);
        }
      }
    }, autoPlayInterval);
  }, [events, containerWidth, autoPlayInterval]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const onMomentumScrollEnd = (e) => {
    const offset = e.nativeEvent.contentOffset.x;
    let newIdx = Math.round(offset / (containerWidth || 1));
    if (newIdx >= events.length) {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: 0, animated: false });
      }
      newIdx = 0;
    }
    currentIndexRef.current = newIdx;
    setCurrentIndex(newIdx);
    startTimer();
  };

  const onScrollBeginDrag = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const goToSlide = (index) => {
    if (scrollRef.current && containerWidth > 0) {
      scrollRef.current.scrollTo({
        x: index * containerWidth,
        animated: true,
      });
      currentIndexRef.current = index;
      setCurrentIndex(index);
      startTimer();
    }
  };

  const onLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  if (loading) {
    return (
      <View style={[styles.emptyCard, { paddingVertical: 30 }]}>
        <ActivityIndicator size="small" color="#0284c7" />
      </View>
    );
  }

  if (!events || events.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>
          {noEventsText || 'No upcoming events at the moment.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.carouselWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={containerWidth}
          snapToAlignment="center"
          bounces={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollBeginDrag={onScrollBeginDrag}
        >
          {displayEvents.map((item, index) => {
            const displayIdx = index % events.length;
            return (
            <View key={`${item.id || displayIdx}-${index}`} style={{ width: containerWidth }}>
              <TouchableOpacity
                style={styles.eventCard}
                activeOpacity={0.9}
                onPress={() => navigation?.navigate('EventDetail', { event: item })}
              >
                <View style={styles.imageWrapper}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.eventImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.eventImage, styles.placeholderImage]}>
                      <Ionicons name="calendar" size={44} color="#93C5FD" />
                    </View>
                  )}
                  {events.length > 1 && (
                    <View style={styles.counterBadge}>
                      <Text style={styles.counterText}>
                        {displayIdx + 1} / {events.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {Boolean(item.short_description || item.description) && (
                    <Text style={styles.eventDesc} numberOfLines={2}>
                      {item.short_description || item.description}
                    </Text>
                  )}

                  <View style={styles.metaRow}>
                    {Boolean(item.date) && (
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                        <Text style={styles.metaText}>{item.date}</Text>
                      </View>
                    )}
                    {Boolean(item.location) && (
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={12} color="#0284c7" />
                        <Text style={styles.metaText}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
          })}
        </ScrollView>
      </View>

      {/* Modern pagination dot indicators */}
      {events.length > 1 && (
        <View style={styles.dotsContainer}>
          {events.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <View
                style={[
                  styles.dot,
                  i === currentIndex && styles.activeDot,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 6,
  },
  carouselWrapper: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 14,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 0,
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  eventImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: '#f1f5f9',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  counterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  eventContent: {
    padding: 14,
    minHeight: 85,
    justifyContent: 'center',
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
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  activeDot: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
});

export default EventBanner;
