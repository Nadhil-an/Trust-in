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
  Share,
  Animated,
  Modal,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
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
  const [isLiked, setIsLiked] = useState(Boolean(post.is_liked_by_me));
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [cardWidth, setCardWidth] = useState(SCREEN_WIDTH - 24);
  const [expanded, setExpanded] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [isFollowing, setIsFollowing] = useState(
    Boolean(post.is_following_author || post.author?.is_following)
  );

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartPopScale = useRef(new Animated.Value(0)).current;
  const heartPopOpacity = useRef(new Animated.Value(1)).current;
  const isLikingRef = useRef(false);
  const lastTapRef = useRef(0);
  const navigation = useNavigation();

  // Custom Video Player state (Hides native forward, backward, and pause controls during playback)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const videoRef = useRef(null);

  const togglePlayVideo = async () => {
    if (!videoRef.current) return;
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setIsVideoPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsVideoPlaying(true);
      }
    } catch (_) {}
  };

  const handleOpenDetail = () => {
    navigation.navigate('PostDetail', { post, postId: post.id });
  };

  const handleOpenAuthorProfile = () => {
    if (post.author?.id) {
      navigation.navigate('MemberProfile', {
        userId: post.author.id,
        authorId: post.author.id,
        user: post.author,
      });
    } else {
      handleOpenDetail();
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUserId) {
      navigation.navigate('Auth');
      return;
    }
    if (isAuthor || !post.author?.id) return;

    const nextState = !isFollowing;
    setIsFollowing(nextState);

    try {
      const res = await memberPostsApi.toggleFollow(post.author.id);
      if (res.data && typeof res.data.is_following === 'boolean') {
        setIsFollowing(res.data.is_following);
      }
    } catch (_) {
      setIsFollowing(!nextState);
    }
  };

  useEffect(() => {
    setIsLiked(Boolean(post.is_liked_by_me));
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
    setIsFollowing(Boolean(post.is_following_author || post.author?.is_following));
  }, [post.is_liked_by_me, post.likes_count, post.comments_count, post.is_following_author, post.author?.is_following]);

  const images = (post.images || [])
    .map((img) => ({
      ...img,
      resolvedUrl: resolveImageUrl(img.image),
    }))
    .filter((img) => Boolean(img.resolvedUrl));

  const isAuthor = String(post.author?.id) === String(currentUserId);
  const authorName = post.author?.full_name || post.author?.username || 'Community Member';
  const authorPhotoUrl = resolveImageUrl(post.author?.photo);
  const districtName = formatDistrictKerala(post.address);
  const isCharity = (post.post_type || '').toUpperCase() === 'CHARITY';

  const handleDonate = () => {
    if (!currentUserId) {
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('Donate', {
      postId: post.id,
      postAuthor: authorName,
      initialNote: `Donation for community cause by ${authorName}`,
    });
  };

  // Like Toggle with spring pop
  const handleLike = async () => {
    if (!currentUserId) {
      navigation.navigate('Auth');
      return;
    }
    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);

    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.35, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();

    if (isLikingRef.current) return;
    isLikingRef.current = true;

    try {
      const res = await memberPostsApi.toggleLike(post.id);
      if (res.data && typeof res.data.is_liked === 'boolean') {
        setIsLiked(res.data.is_liked);
        setLikesCount(res.data.likes_count);
      }
    } catch (_) {
      setIsLiked(!nextLiked);
      setLikesCount(likesCount);
    } finally {
      isLikingRef.current = false;
    }
  };

  // Double tap to like on image (Instagram behavior)
  const handleImageDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!currentUserId) {
        navigation.navigate('Auth');
        lastTapRef.current = 0;
        return;
      }
      if (!isLiked) {
        handleLike();
      }
      setShowHeartPop(true);
      heartPopScale.setValue(0);
      heartPopOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartPopScale, { toValue: 1.25, friction: 3, useNativeDriver: true }),
        Animated.timing(heartPopOpacity, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }),
      ]).start(() => {
        setShowHeartPop(false);
      });
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0) {
          handleOpenDetail();
          lastTapRef.current = 0;
        }
      }, 300);
    }
  };

  // Native App Share
  const handleShare = async () => {
    try {
      const desc = post.description || '';
      const shareMessage = `Sree Lakshmi Trust • Community Post\n\nBy: ${authorName} (${districtName})\n\n"${desc}"\n\nView and support on the Sree Lakshmi Trust App.`;
      await Share.share({
        message: shareMessage,
        title: 'Community Post',
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const handleCall = () => {
    if (post.contact_number) {
      Linking.openURL(`tel:${post.contact_number}`);
    } else {
      Toast.show({ type: 'info', text1: 'Contact Number', text2: 'No direct phone provided' });
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
    } else {
      Toast.show({ type: 'info', text1: 'WhatsApp', text2: 'No contact number provided' });
    }
  };

  const handleDelete = () => {
    setOptionsModalVisible(false);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await memberPostsApi.deletePost(post.id);
      setDeleteModalVisible(false);
      setIsDeleting(false);
      if (onPostDeleted) onPostDeleted(post.id);
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Post removed successfully' });
    } catch (_) {
      setIsDeleting(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete post. Please try again.',
      });
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      const days = Math.floor(diff / 86400);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const isLongDesc = (post.description || '').length > 95;

  return (
    <View
      style={styles.instagramCard}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - cardWidth) > 1) {
          setCardWidth(w);
        }
      }}
    >
      {Boolean(post.description?.includes('OFFICIAL TRUST APPRECIATION') || post.post_type === 'OFFICIAL' && post.title?.toLowerCase().includes('appreciation')) && (
        <View style={styles.appreciationBanner}>
          <Text style={styles.appreciationBannerText}>🏆 OFFICIAL TRUST APPRECIATION & RECOGNITION</Text>
        </View>
      )}

      {/* ── 1. Top Post Header (Profile Avatar, Name, Location, Follow Button, Options Menu) ── */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={handleOpenAuthorProfile}
          activeOpacity={0.8}
        >
          {authorPhotoUrl ? (
            <Image source={{ uri: authorPhotoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {(authorName[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.authorTextCol}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorUsername} numberOfLines={1}>
                {authorName}
              </Text>
              <Ionicons name="checkmark-circle" size={13} color="#0284c7" style={{ marginLeft: 3 }} />
            </View>

            {/* Subtitle with Location */}
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitleText} numberOfLines={1}>
                {districtName}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Right side: Follow Button + 3-dots options icon */}
        <View style={styles.headerRightActions}>
          {!isAuthor && post.author?.id && (
            <TouchableOpacity
              style={[
                styles.headerFollowBtn,
                isFollowing ? styles.headerFollowingBtn : styles.headerFollowBtnActive,
              ]}
              onPress={handleToggleFollow}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.headerFollowBtnText,
                  isFollowing && styles.headerFollowingBtnText,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}

          {post.status && post.status !== 'APPROVED' ? (
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              marginRight: 6,
              backgroundColor:
                (post.status === 'PENDING_APPROVAL' || post.status === 'OPEN') ? '#FEF3C7' :
                post.status === 'REJECTED' ? '#FEE2E2' : '#DBEAFE',
            }}>
              <Text style={{
                fontSize: 10.5,
                fontWeight: '700',
                color:
                  (post.status === 'PENDING_APPROVAL' || post.status === 'OPEN') ? '#B45309' :
                  post.status === 'REJECTED' ? '#DC2626' : '#1E40AF',
              }}>
                {(post.status === 'PENDING_APPROVAL' || post.status === 'OPEN') ? 'Under Review ⏳' :
                 post.status === 'REJECTED' ? 'Rejected ⚠️' : 'With FAO 🚀'}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.headerMenuBtn}
            onPress={() => setOptionsModalVisible(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. Post Media / Video or Image (Full Width with Double Tap to Like) ──────────── */}
      {post.video ? (
        <View style={styles.mediaContainer}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={togglePlayVideo}
            style={{ width: '100%', height: 380, position: 'relative' }}
          >
            <Video
              ref={videoRef}
              source={{ uri: resolveImageUrl(post.video) }}
              style={styles.postVideo}
              useNativeControls={false}
              resizeMode={ResizeMode ? ResizeMode.COVER : 'cover'}
              isLooping
              isMuted={isVideoMuted}
              shouldPlay={isVideoPlaying}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setIsVideoPlaying(Boolean(status.isPlaying));
                }
              }}
            />

            {/* When playing: forward, backward, and pause buttons are completely hidden! When paused: show elegant play button */}
            {!isVideoPlaying && (
              <View style={styles.videoPlayOverlay} pointerEvents="none">
                <View style={styles.videoPlayBtn}>
                  <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </View>
              </View>
            )}

            {/* Mute / Unmute Button in corner */}
            <TouchableOpacity
              style={styles.videoMuteBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                setIsVideoMuted(!isVideoMuted);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isVideoMuted ? 'volume-mute' : 'volume-high'}
                size={16}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      ) : images.length > 0 ? (
        <View style={styles.mediaContainer}>
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
              <TouchableWithoutFeedback
                key={imgItem.id || idx}
                onPress={handleImageDoubleTap}
              >
                <View style={{ width: cardWidth, position: 'relative' }}>
                  <Image
                    source={{ uri: imgItem.resolvedUrl }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </View>
              </TouchableWithoutFeedback>
            ))}
          </ScrollView>

          {/* Floating Heart Pop Animation on Double Tap */}
          {showHeartPop && (
            <Animated.View
              style={[
                styles.floatingHeartWrap,
                {
                  opacity: heartPopOpacity,
                  transform: [{ scale: heartPopScale }],
                },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="heart" size={88} color="#FFFFFF" style={styles.floatingHeartShadow} />
            </Animated.View>
          )}

          {/* Top-Right Page Counter (e.g. 1/3) */}
          {images.length > 1 && (
            <View style={styles.imageCounterBadge}>
              <Text style={styles.imageCounterText}>
                {currentPhotoIdx + 1}/{images.length}
              </Text>
            </View>
          )}

          {/* Bottom Dots Indicator */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.indicatorDot,
                    i === currentPhotoIdx && styles.indicatorDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* ── 3. Action Bar (Likes, Comments, Share on Left | Donate Now on Right) ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeftGroup}>
          {/* Like Heart Button with Like Count */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={25}
                color={isLiked ? '#EF4444' : '#0F172A'}
              />
            </Animated.View>
            {likesCount > 0 && (
              <Text style={[styles.actionCountText, isLiked && styles.likedCountText]}>
                {likesCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comment Bubble Button with Comment Count */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => onOpenComments && onOpenComments(post.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbubble-outline" size={23} color="#0F172A" />
            {commentsCount > 0 && (
              <Text style={styles.actionCountText}>
                {commentsCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Share Button (Paper Airplane) */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={handleShare}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="paper-plane-outline" size={23} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Right side of Action Bar: Charity Badge placed right above Donate Now Button */}
        {isCharity && (
          <View style={styles.charityActionCol}>
            <TouchableOpacity
              style={styles.charityBadgeAbove}
              onPress={handleDonate}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={11} color="#E11D48" />
              <Text style={styles.charityBadgeText}>Charity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.donateNowBtn}
              onPress={handleDonate}
              activeOpacity={0.85}
            >
              <Ionicons name="heart" size={13} color="#FFFFFF" />
              <Text style={styles.donateNowBtnText}>Donate Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 4. Description / Caption Section (Under Action Buttons) ────────────── */}
      <View style={styles.captionSection}>
        {/* Caption Row: "Description: " in bold + Description text */}
        {Boolean(post.description) && (
          <View style={styles.captionRow}>
            <Text style={styles.captionText}>
              <Text
                style={styles.captionLabel}
                onPress={handleOpenDetail}
              >
                Description:{' '}
              </Text>
              {isLongDesc && !expanded
                ? `${post.description.slice(0, 95)}...`
                : post.description}
              {isLongDesc && (
                <Text
                  style={styles.moreToggleText}
                  onPress={() => setExpanded(!expanded)}
                >
                  {expanded ? '  less' : '  more'}
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* View All Comments Link */}
        {commentsCount > 0 && (
          <TouchableOpacity
            style={styles.viewCommentsRow}
            onPress={() => onOpenComments && onOpenComments(post.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewCommentsText}>
              View all {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bottom Footer Row: Left Meta (Timestamp, Status) */}
        <View style={styles.cardBottomRow}>
          <View style={styles.footerMetaRow}>
            <Text style={styles.timestampText}>{formatTime(post.created_at)}</Text>
            {post.status === 'FORWARDED_TO_FAO' && (
              <>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={[styles.metaStatusText, { color: '#059669' }]}>
                  In Assessment
                </Text>
              </>
            )}
            {post.status === 'RESOLVED' && (
              <>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={[styles.metaStatusText, { color: '#7E22CE' }]}>
                  Resolved
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── 5. Options Menu Bottom Sheet Modal ──────────────────────────────────── */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionsBackdrop}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.optionsSheet}>
            <View style={styles.sheetHandle} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsModalVisible(false);
                handleShare();
              }}
            >
              <Ionicons name="share-social-outline" size={20} color="#0F172A" />
              <Text style={styles.optionItemText}>Share Post</Text>
            </TouchableOpacity>

            {Boolean(post.contact_number) && (
              <>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsModalVisible(false);
                    handleCall();
                  }}
                >
                  <Ionicons name="call-outline" size={20} color="#0284c7" />
                  <Text style={styles.optionItemText}>Call Contact</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsModalVisible(false);
                    handleWhatsApp();
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                  <Text style={[styles.optionItemText, { color: '#16A34A' }]}>WhatsApp Message</Text>
                </TouchableOpacity>
              </>
            )}

            {isAuthor && onEditPost && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setOptionsModalVisible(false);
                  onEditPost(post);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#0284c7" />
                <Text style={styles.optionItemText}>Edit Post</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.optionItemText, { color: '#EF4444', fontWeight: '600' }]}>Delete Post</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.cancelOptionItem]}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.cancelOptionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── 6. Delete Confirmation Modal ────────────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteDialogCard}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>

            <Text style={styles.deleteTitle}>Delete Post?</Text>
            <Text style={styles.deleteMessage}>
              Are you sure you want to delete this post? This cannot be undone.
            </Text>

            <View style={styles.deleteActionsRow}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  instagramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  appreciationBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  appreciationBannerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },

  // 1. Header Styles
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: '800',
  },
  authorTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerFollowBtn: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFollowBtnActive: {
    backgroundColor: '#0284c7',
  },
  headerFollowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerFollowingBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  headerFollowingBtnText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  headerMenuBtn: {
    padding: 6,
    borderRadius: 8,
  },

  // 2. Media / Image Styles
  mediaContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  postVideo: {
    width: '100%',
    height: 380,
    backgroundColor: '#000000',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  videoPlayBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  videoMuteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1, // Standard Instagram 1:1 square
    backgroundColor: '#0F172A',
  },
  floatingHeartWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  floatingHeartShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  imageCounterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  indicatorDotActive: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7',
  },

  // 3. Action Bar Styles (Instagram Like, Comment, Repost, Share)
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  actionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  actionCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 1,
  },
  likedCountText: {
    color: '#EF4444',
  },

  // 4. Caption & Description Styles (Under Action Buttons)
  captionSection: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  captionRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  captionText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  captionAuthor: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 13,
  },
  captionLabel: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 13,
  },
  moreToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  viewCommentsRow: {
    marginTop: 3,
    marginBottom: 4,
  },
  viewCommentsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  charityActionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  charityBadgeAbove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  charityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  charityBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E11D48',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  donateNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  donateNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  timestampText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  metaDivider: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  metaPlaceText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metaStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // 5. Options Menu Bottom Sheet
  optionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  cancelOptionItem: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },

  // 6. Delete Dialog Styles
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteDialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  deleteIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEE2E2',
    borderWidth: 4,
    borderColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  deleteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
