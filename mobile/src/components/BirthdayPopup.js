// src/components/BirthdayPopup.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ── Single confetti piece ───────────────────────────────────────
const ConfettiPiece = ({ index }) => {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8'];
  const color = colors[index % colors.length];
  const startX = (Math.random() * width);
  const endX = startX + (Math.random() * 100 - 50);
  const duration = 1800 + Math.random() * 1200;
  const delay = Math.random() * 800;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, { toValue: height * 0.7, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: endX - startX, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(duration * 0.7),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const rotateInterpolate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const shape = index % 3 === 0 ? 'circle' : index % 3 === 1 ? 'square' : 'triangle';

  return (
    <Animated.View style={{
      position: 'absolute',
      left: startX,
      top: 0,
      opacity,
      transform: [{ translateY }, { translateX }, { rotate: rotateInterpolate }],
    }}>
      {shape === 'circle' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      {shape === 'square' && <View style={{ width: 7, height: 7, backgroundColor: color, borderRadius: 1 }} />}
      {shape === 'triangle' && <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />}
    </Animated.View>
  );
};

// ── Bouncing cake icon ──────────────────────────────────────────
const BouncingCake = () => {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -12, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Text style={{ fontSize: 72 }}>🎂</Text>
    </Animated.View>
  );
};

// ── Shimmer text ────────────────────────────────────────────────
const ShimmerText = ({ children, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const colorInterpolate = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['#FFD700', '#FF6B6B', '#FFD700'] });

  return (
    <Animated.Text style={[style, { color: colorInterpolate }]}>
      {children}
    </Animated.Text>
  );
};

// ── Card scale-in ───────────────────────────────────────────────
const ScaleIn = ({ children, delay = 0 }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {children}
    </Animated.View>
  );
};

// ── Single birthday person card ─────────────────────────────────
const PersonCard = ({ person, index }) => (
  <ScaleIn delay={200 + index * 100}>
    <View style={styles.personCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{person.name?.charAt(0) || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.personName}>{person.name}</Text>
        <Text style={styles.personDesig}>{person.designation}</Text>
        {person.age && <Text style={styles.personAge}>Turning {person.age} today 🎉</Text>}
      </View>
      <Text style={{ fontSize: 24 }}>🎁</Text>
    </View>
  </ScaleIn>
);

// ── Main Birthday Popup ─────────────────────────────────────────
export default function BirthdayPopup({ visible, birthdays = [], onClose }) {
  const today = birthdays.filter(b => b.when === 'today');
  const tomorrow = birthdays.filter(b => b.when === 'tomorrow');
  const currentUserObj = today.find(b => b.isCurrentUser);
  const hasBirthdays = today.length > 0;

  const wishes = currentUserObj 
    ? [`Dear ${currentUserObj.name}, Sree Lakshmi Charitable Trust wishes you a joyous and blessed Birthday filled with happiness & prosperity! 💖🎂`]
    : [
        "May your day be as bright as your smile! ✨",
        "Wishing you joy, laughter, and amazing memories! 🎊",
        "Another year wiser, another year better! 🌟",
        "May all your birthday dreams come true! 🌈",
        "Here's to a wonderful journey ahead! 🥂",
      ];
  const wish = wishes[Math.floor(Math.random() * wishes.length)];

  if (!visible || (!hasBirthdays && tomorrow.length === 0)) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Confetti Rain */}
        {hasBirthdays && Array.from({ length: 30 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}

        <ScaleIn>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <BouncingCake />
              <ShimmerText style={styles.title}>
                {currentUserObj ? `🎉 Happy Birthday, ${currentUserObj.name}! 🎉` : (hasBirthdays ? '🎉 Happy Birthday! 🎉' : '🔔 Birthday Tomorrow!')}
              </ShimmerText>
              {hasBirthdays && (
                <Text style={styles.subtitle}>{wish}</Text>
              )}
            </View>

            {/* Today's birthdays */}
            {today.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>🎂 Today's Birthday Stars</Text>
                </View>
                {today.map((p, i) => <PersonCard key={p.id} person={p} index={i} />)}
              </View>
            )}

            {/* Tomorrow's birthdays */}
            {tomorrow.length > 0 && (
              <View style={styles.section}>
                <View style={[styles.sectionLabel, { backgroundColor: '#FFF9C4' }]}>
                  <Text style={[styles.sectionLabelText, { color: '#B45309' }]}>⏰ Birthday Tomorrow</Text>
                </View>
                {tomorrow.map((p, i) => (
                  <ScaleIn key={p.id} delay={300 + i * 100}>
                    <View style={[styles.personCard, { backgroundColor: '#FFFDE7' }]}>
                      <View style={[styles.avatar, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.avatarText, { color: '#D97706' }]}>{p.name?.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.personName}>{p.name}</Text>
                        <Text style={styles.personDesig}>{p.designation}</Text>
                      </View>
                      <Text style={{ fontSize: 22 }}>🎈</Text>
                    </View>
                  </ScaleIn>
                ))}
              </View>
            )}

            {/* Close button */}
            <ScaleIn delay={600}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>
                  {hasBirthdays ? '🎉 Celebrate!' : '✓ Got it!'}
                </Text>
              </TouchableOpacity>
            </ScaleIn>

            {/* Small dismiss */}
            <TouchableOpacity onPress={onClose} style={styles.dismissLink}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </ScaleIn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  card: {
    width: width - 36, maxHeight: height * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 28, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3, shadowRadius: 30, elevation: 20,
  },
  header: {
    backgroundColor: '#FFF0F5',
    padding: 28, alignItems: 'center', gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#FFD6E7',
  },
  title: {
    fontSize: 24, fontWeight: '900', textAlign: 'center',
    letterSpacing: -0.5, marginTop: 8,
  },
  subtitle: {
    fontSize: 13, color: '#6B7280', textAlign: 'center',
    lineHeight: 20, marginTop: 4,
  },
  section: { padding: 16, gap: 10 },
  sectionLabel: {
    backgroundColor: '#FFF0F5', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, marginBottom: 6,
  },
  sectionLabelText: {
    fontSize: 12, fontWeight: '700', color: '#BE185D', textTransform: 'uppercase', letterSpacing: .5,
  },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#F3F4F6',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF0F5',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#BE185D' },
  personName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  personDesig: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  personAge: { fontSize: 11, color: '#DB2777', fontWeight: '600', marginTop: 2 },
  closeBtn: {
    margin: 16, marginTop: 8,
    backgroundColor: '#DB2777',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  dismissLink: { alignItems: 'center', paddingBottom: 16 },
  dismissText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
});
