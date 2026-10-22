import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { memberPostsApi } from '../../api';
import { resolveImageUrl } from '../../utils/imageUrl';
import { formatDistrictKerala } from '../../utils/location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostCard({
  post,
  currentUserId,
  onOpenComments,
  onPostDeleted,
  onEditPost,
}) {
  const [isLiked, setIsLiked] = useState(post.is_liked_by_me || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [cardWidth, setCardWidth] = useState(SCREEN_WIDTH - 32);
  const [expanded, setExpanded] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLikingRef = useRef(false);
  const navigation = useNavigation();

  const handleOpenDetail = () => {
    navigation.navigate('PostDetail', { post, postId: post.id });
  };

  useEffect(() => {
    setIsLiked(Boolean(post.is_liked_by_me));
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
  }, [post.is_liked_by_me, post.likes_count, post.comments_count]);

  const images = (post.images || []).map((img) => ({
    ...img,
    resolvedUrl: resolveImageUrl(img.image),
  })).filter(img => Boolean(img.resolvedUrl));

  const isAuthor = String(post.author?.id) === String(currentUserId);

  const handleLike = async () => {
    // 1. Instant zero-delay feedback
    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);

    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    // 2. Spring pop animation on the heart icon
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.35, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();

    // 3. Prevent rapid concurrent click issues
    if (isLikingRef.current) return;
    isLikingRef.current = true;

    try {
      const res = await memberPostsApi.toggleLike(post.id);
      if (res.data && typeof res.data.is_liked === 'boolean') {
        setIsLiked(res.data.is_liked);
        setLikesCount(res.data.likes_count);
      }
    } catch (_) {
      // Revert if network fails
      setIsLiked(!nextLiked);
      setLikesCount(likesCount);
    } finally {
      isLikingRef.current = false;
    }
  };

  const handleCall = () => {
    if (post.contact_number) {
      Linking.openURL(`tel:${post.contact_number}`);
    }
  };

  const handleWhatsApp = () => {
    if (post.contact_number) {
      const cleanPhone = post.contact_number.replace(/\D/g, '');
      Linking.openURL(
        `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(
          `Hello, I saw your community post on Sree Lakshmi Trust: "${post.description?.slice(0, 60)}..."`
        )}`
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await memberPostsApi.deletePost(post.id);
              if (onPostDeleted) onPostDeleted(post.id);
            } catch (_) {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const authorPhotoUrl = resolveImageUrl(post.author?.photo);

  return (
    <View
      style={styles.eventLikeCard}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - cardWidth) > 1) {
          setCardWidth(w);
        }
      }}
    >
      {/* ── 1. Top Author Header (Placed above image/picture) ────────────────── */}
      <View style={styles.topAuthorHeader}>
        <TouchableOpacity style={styles.authorLeft} activeOpacity={0.8} onPress={handleOpenDetail}>
          {authorPhotoUrl ? (
            <Image source={{ uri: authorPhotoUrl }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(post.author?.full_name || post.author?.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.authorTextWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.author?.full_name || post.author?.username || 'Community Member'}
              </Text>
              <Ionicons name="checkmark-circle" size={14} color="#0284c7" />
            </View>
            <Text style={styles.authorTime}>{formatTime(post.created_at)}</Text>
          </View>
        </TouchableOpacity>

        {/* Status Badge & Action Menu */}
        <View style={styles.headerRightWrap}>
          {post.status === 'FORWARDED_TO_FAO' ? (
            <View style={[styles.statusBadge, styles.statusBadgeForwarded]}>
              <Ionicons name="shield-checkmark" size={11} color="#059669" />
              <Text style={[styles.statusBadgeText, { color: '#059669' }]}>In Assessment</Text>
            </View>
          ) : post.status === 'RESOLVED' ? (
            <View style={[styles.statusBadge, { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }]}>
              <Text style={[styles.statusBadgeText, { color: '#7E22CE' }]}>Resolved</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusBadgeOpen]}>
              <Text style={[styles.statusBadgeText, { color: '#0284C7' }]}>Open</Text>
            </View>
          )}

          {isAuthor && (
            <View style={styles.authorActionsRow}>
              {onEditPost && (
                <TouchableOpacity
                  onPress={() => onEditPost(post)}
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="create-outline" size={17} color="#0284c7" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.iconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── 2. Image Banner (Event Card Style) ─────────────────────────────── */}
      {images.length > 0 && (
        <View style={styles.imageBannerWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            snapToAlignment="center"
            bounces={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth || 1));
              if (idx >= 0 && idx < images.length) {
                setCurrentPhotoIdx(idx);
              }
            }}
          >
            {images.map((imgItem, idx) => (
              <TouchableOpacity
                key={imgItem.id || idx}
                activeOpacity={0.95}
                onPress={handleOpenDetail}
                style={{ width: cardWidth }}
              >
                <Image
                  source={{ uri: imgItem.resolvedUrl }}
                  style={styles.cardBannerImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Top-Right Counter Badge (Identical to Event Card: e.g. 2 / 2) */}
          {images.length > 1 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentPhotoIdx + 1} / {images.length}
              </Text>
            </View>
          )}

          {/* Dots Indicator */}
          {images.length > 1 && (
            <View style={styles.dotsWrap}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentPhotoIdx && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── 3. Card Content (Title/Description, Meta, Action Buttons) ──────── */}
      <View style={styles.cardContent}>

        {/* Problem Description (Event Card Title Style) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenDetail}
          style={styles.descriptionWrap}
        >
          <Text
            style={styles.descriptionText}
            numberOfLines={expanded ? undefined : 3}
          >
            {post.description}
          </Text>
          {post.description && post.description.length > 100 && (
            <Text style={styles.moreLink}>View full details ➜</Text>
          )}
        </TouchableOpacity>

        {/* Contact & Location Bar: District, Kerala (Number is NOT directly exposed) */}
        <View style={styles.contactBar}>
          <View style={[styles.contactPhoneWrap, { flex: 1, marginRight: 8 }]}>
            <Ionicons name="location-sharp" size={13} color="#0284c7" />
            <Text style={styles.contactPhoneText} numberOfLines={1}>
              {formatDistrictKerala(post.address)}
            </Text>
          </View>
          {Boolean(post.contact_number) && (
            <View style={styles.contactBtnGroup}>
              <TouchableOpacity style={styles.contactPill} onPress={handleCall} activeOpacity={0.8}>
                <Ionicons name="call" size={11} color="#0284c7" />
                <Text style={styles.contactPillText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactPill, styles.whatsappPill]} onPress={handleWhatsApp} activeOpacity={0.8}>
                <Ionicons name="logo-whatsapp" size={11} color="#16A34A" />
                <Text style={[styles.contactPillText, { color: '#16A34A' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 3. Bottom Action Bar: Like, Comment, Share ───────────────────── */}
        <View style={styles.actionBar}>
          {/* Like Button (Immediate Red Pill when Liked) */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn, isLiked && styles.likeBtnActive]}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? '#EF4444' : '#64748B'}
              />
            </Animated.View>
            <Text style={[styles.actionBtnText, isLiked && styles.likedText]}>
              {likesCount > 0 ? `${likesCount} Likes` : 'Like'}
            </Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onOpenComments && onOpenComments(post.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={19} color="#475569" />
            <Text style={styles.actionBtnText}>
              {commentsCount > 0 ? `${commentsCount} Comments` : 'Comment'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eventLikeCard: {
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
    marginBottom: 16,
  },

  // Image Banner (Identical to Event Card Banner)
  imageBannerWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  cardBannerImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: '#F1F5F9',
  },
  counterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dotsWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  activeDot: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7',
  },

  // Card Content
  cardContent: {
    padding: 14,
  },
  topAuthorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  authorTextWrap: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  authorTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeOpen: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  statusBadgeForwarded: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },

  // Problem Description (Bold, Prominent like Event Card Title)
  descriptionWrap: {
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 21,
  },
  moreLink: {
    color: '#0284c7',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 3,
  },

  // Meta Info (Calendar & Location Pins)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
    paddingTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // Contact quick bar
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactPhoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  contactBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  contactPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  whatsappPill: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  // Action Buttons Bar (Like, Comment, Share)
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 2,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  likeBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  likeBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  likedText: {
    color: '#EF4444',
    fontWeight: '700',
  },
});
