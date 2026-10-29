// components/feed/PomPosterCard.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Share,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { resolveImageUrl } from '../../utils/imageUrl';
import { pomApi } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_THEMES = {
  EMERGENCY_BLOOD: {
    label: 'Emergency & Blood Request',
    icon: 'water',
    bannerBg: '#B91C1C',
    bannerText: '#FFFFFF',
    borderCol: '#EF4444',
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
  },
  DISASTER_RELIEF: {
    label: 'Disaster Relief Help',
    icon: 'warning',
    bannerBg: '#C2410C',
    bannerText: '#FFFFFF',
    borderCol: '#F97316',
    badgeBg: '#FFEDD5',
    badgeText: '#9A3412',
  },
  COMMUNITY_SUPPORT: {
    label: 'Community Support',
    icon: 'people',
    bannerBg: '#1D4ED8',
    bannerText: '#FFFFFF',
    borderCol: '#3B82F6',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
  },
  EDUCATION: {
    label: 'Education Assistance',
    icon: 'school',
    bannerBg: '#D97706',
    bannerText: '#FFFFFF',
    borderCol: '#F59E0B',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
  },
  CIVIC: {
    label: 'Civic & Infrastructure',
    icon: 'construct',
    bannerBg: '#0F766E',
    bannerText: '#FFFFFF',
    borderCol: '#14B8A6',
    badgeBg: '#CCFBF1',
    badgeText: '#115E59',
  },
  GENERAL: {
    label: 'Public Cooperation Appeal',
    icon: 'megaphone',
    bannerBg: '#1B2F6B',
    bannerText: '#FFFFFF',
    borderCol: '#3B82F6',
    badgeBg: '#EEF1FA',
    badgeText: '#1B2F6B',
  },
};

export default function PomPosterCard({ item, onResponseSuccess }) {
  const [hasResponded, setHasResponded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [responseCount, setResponseCount] = useState(item?.responses_count || 0);

  // Increment view count on mount once
  useEffect(() => {
    if (item?.id) {
      pomApi.incrementView(item.id).catch(() => {});
    }
  }, [item?.id]);

  if (!item) return null;

  const theme = CATEGORY_THEMES[item.category] || CATEGORY_THEMES.GENERAL;
  const imageUrl = resolveImageUrl(item.image_url || item.image);

  const formatExpiry = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return dateStr;
    }
  };

  const handleCall = () => {
    const phone = item.contact_phone;
    if (!phone) {
      Toast.show({
        type: 'info',
        text1: 'No Phone Provided',
        text2: 'No direct contact phone number was listed for this notice.',
      });
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Unable to Call',
        text2: `Please dial manually: ${phone}`,
      });
    });
  };

  const handleShare = async () => {
    try {
      const message = `📢 *SREE LAKSHMI CHARITABLE TRUST - PUBLIC APPEAL*\n\n*${item.title}*\n\n${item.description}\n\n📍 Location: ${item.target_location || 'General'}\n📞 Contact: ${item.contact_person || 'Trust Coordinator'} (${item.contact_phone || 'N/A'})\n\nPlease share with friends & family to help!`;
      await Share.share({ message });
    } catch (_) {}
  };

  const handleRespond = async () => {
    if (hasResponded || isResponding) return;
    setIsResponding(true);
    try {
      await pomApi.respond(item.id);
      setHasResponded(true);
      setResponseCount((prev) => prev + 1);
      Toast.show({
        type: 'success',
        text1: 'Response Registered! 🙏',
        text2: 'Thank you for standing by to help with this appeal.',
      });
      if (onResponseSuccess) onResponseSuccess();
    } catch (err) {
      Toast.error({
        type: 'error',
        text1: 'Action Failed',
        text2: 'Unable to record response at this moment.',
      });
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <View style={[styles.posterContainer, { borderColor: theme.borderCol }]}>
      {/* ── Top Poster Header Ribbon ── */}
      <View style={[styles.headerRibbon, { backgroundColor: theme.bannerBg }]}>
        <View style={styles.headerLeft}>
          <Ionicons name={theme.icon} size={16} color="#FFFFFF" />
          <Text style={styles.headerTitle}>OFFICIAL PUBLIC APPEAL</Text>
        </View>
        {item.is_pinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={11} color="#FFFFFF" />
            <Text style={styles.pinnedBadgeText}>PINNED</Text>
          </View>
        )}
      </View>

      {/* ── Category & Expiry Info Row ── */}
      <View style={styles.metaRow}>
        <View style={[styles.categoryPill, { backgroundColor: theme.badgeBg }]}>
          <Text style={[styles.categoryText, { color: theme.badgeText }]}>
            {theme.label}
          </Text>
        </View>

        {item.expires_at && (
          <View style={styles.expiryPill}>
            <Ionicons name="time-outline" size={12} color="#B45309" />
            <Text style={styles.expiryText}>
              Active until {formatExpiry(item.expires_at)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Optional High-Impact Poster Image ── */}
      {Boolean(imageUrl) && (
        <View style={styles.posterImageWrap}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.posterImage}
            resizeMode="cover"
          />
        </View>
      )}

      {/* ── Poster Headline & Description ── */}
      <View style={styles.contentWrap}>
        <Text style={styles.posterTitle}>{item.title}</Text>
        <Text style={styles.posterDescription}>{item.description}</Text>
      </View>

      {/* ── Contact & Location Notice Box ── */}
      <View style={styles.noticeBox}>
        {Boolean(item.target_location) && (
          <View style={styles.noticeInfoRow}>
            <Ionicons name="location-sharp" size={15} color="#DC2626" />
            <Text style={styles.noticeInfoText}>
              <Text style={styles.noticeInfoLabel}>Location: </Text>
              {item.target_location}
            </Text>
          </View>
        )}

        {(Boolean(item.contact_person) || Boolean(item.contact_phone)) && (
          <View style={styles.noticeInfoRow}>
            <Ionicons name="person-circle-outline" size={15} color={Colors.primary} />
            <Text style={styles.noticeInfoText}>
              <Text style={styles.noticeInfoLabel}>Contact: </Text>
              {item.contact_person || 'Trust Coordinator'}
              {item.contact_phone ? ` • ${item.contact_phone}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* ── Action Bar: Call, Respond, Share (strictly NO delete) ── */}
      <View style={styles.actionBar}>
        {Boolean(item.contact_phone) && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={15} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call Contact</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.respondButton,
            hasResponded && styles.respondButtonSuccess,
          ]}
          onPress={handleRespond}
          disabled={hasResponded || isResponding}
          activeOpacity={0.85}
        >
          {isResponding ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons
                name={hasResponded ? 'checkmark-circle' : 'hand-left-outline'}
                size={15}
                color={hasResponded ? '#15803D' : Colors.primary}
              />
              <Text
                style={[
                  styles.respondButtonText,
                  hasResponded && styles.respondButtonTextSuccess,
                ]}
              >
                {hasResponded ? 'Supported' : 'I Can Help'} ({responseCount})
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={16} color={Colors.gray600} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  posterContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  pinnedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 4,
  },
  expiryText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#92400E',
  },
  posterImageWrap: {
    width: '100%',
    height: 170,
    marginTop: 10,
    backgroundColor: '#F3F4F6',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  contentWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  posterTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 6,
  },
  posterDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18.5,
  },
  noticeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginHorizontal: 14,
    marginTop: 10,
    gap: 6,
  },
  noticeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeInfoLabel: {
    fontWeight: '700',
    color: '#475569',
  },
  noticeInfoText: {
    fontSize: 12,
    color: '#1E293B',
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  callButton: {
    flex: 1,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  respondButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  respondButtonSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  respondButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  respondButtonTextSuccess: {
    color: '#15803D',
  },
  shareButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
