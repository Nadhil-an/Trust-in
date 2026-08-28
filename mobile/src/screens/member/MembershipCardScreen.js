import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';

const MembershipCardScreen = ({ navigation }) => {
  const { user } = useAuthStore();

  const memberId = user?.username || '';
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A';
  const validUpto = user?.valid_upto ? new Date(user.valid_upto).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : 'N/A';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Membership Card</Text>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Digital Membership Card */}
        <View style={[styles.membershipCard, { backgroundColor: '#0284c7' }]}>
          <View style={styles.cardTopRow}>
            {/* Trust Logo Placeholder */}
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={24} color="#0284c7" />
              <View style={styles.logoTextContainer}>
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

          <View style={styles.cardWaveDecoration} />

          <View style={styles.cardFooterRow}>
            <View>
              <Text style={styles.footerLabel}>Member Since</Text>
              <Text style={styles.footerValue}>{memberSince}</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.footerLabel}>Valid Upto</Text>
              <Text style={styles.footerValue}>{validUpto}</Text>
            </View>
          </View>
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <View style={styles.qrBox}>
            <Ionicons name="qr-code-outline" size={150} color={Colors.textPrimary} />
          </View>
          <Text style={styles.qrText}>Scan this QR code to verify your membership.</Text>
          <Text style={styles.appreciationText}>Thank you for being a part of our mission.</Text>
        </View>

        {/* Motivational Charity Quote Card */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteIconCircle}>
            <Ionicons name="heart" size={24} color="#0284c7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteText}>“Kindness makes a lasting difference.”</Text>
            <Text style={styles.quoteAuthor}>— Sreelakshmi Charitable Trust</Text>
          </View>
        </View>
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
  moreBtn: { padding: 4 },
  scroll: { padding: 16, gap: 20, alignItems: 'center' },

  membershipCard: {
    width: '100%',
    borderRadius: 18,
    padding: 20,
    minHeight: 210,
    justifyContent: 'space-between',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'flex-start',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    gap: 6,
  },
  logoTextContainer: { justifyContent: 'center' },
  trustLogoTitle: { fontSize: 8, fontWeight: '900', color: '#0284c7', letterSpacing: 0.5 },
  trustLogoSub: { fontSize: 6, fontWeight: '700', color: Colors.gray600 },
  memberIdContainer: { alignItems: 'flex-end' },
  memberIdLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700', letterSpacing: 0.5 },
  memberIdValue: { fontSize: 13, fontWeight: '800', color: Colors.white },

  cardCenter: { alignItems: 'center', marginVertical: 14 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.white, letterSpacing: 2.5 },

  cardWaveDecoration: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    right: -20,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 40,
    transform: [{ rotate: '-8deg' }],
  },

  cardFooterRow: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'flex-end',
  },
  footerLabel: { fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' },
  footerValue: { fontSize: 14, fontWeight: '800', color: Colors.white, marginTop: 2 },

  qrSection: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  qrBox: {
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: 16,
  },
  qrText: { fontSize: 13, fontWeight: '600', color: Colors.gray700, textAlign: 'center' },
  appreciationText: { fontSize: 12, color: Colors.gray500, textAlign: 'center', marginTop: 4 },

  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 14,
  },
  quoteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteText: { fontSize: 14, fontWeight: '700', color: '#0369a1', fontStyle: 'italic' },
  quoteAuthor: { fontSize: 11, color: '#075985', marginTop: 4, fontWeight: '500' },
});

export default MembershipCardScreen;
