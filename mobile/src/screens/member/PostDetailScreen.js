import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Share,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { memberPostsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { resolveImageUrl } from '../../utils/imageUrl';
import { formatDistrictKerala } from '../../utils/location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PostDetailScreen = ({ route, navigation }) => {
  const { user } = useAuthStore();
  const initialPost = route.params?.post || {};
  const postId = route.params?.postId || initialPost.id;

  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(!initialPost.description);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [viewerImage, setViewerImage] = useState(null);

  // Likes state
  const [isLiked, setIsLiked] = useState(Boolean(initialPost.is_liked_by_me));
  const [likesCount, setLikesCount] = useState(initialPost.likes_count || 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLikingRef = useRef(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const commentInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Options & Delete modal state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchPostDetails = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const res = await memberPostsApi.get(postId);
      if (res.data) {
        setPost(res.data);
        setIsLiked(Boolean(res.data.is_liked_by_me));
        setLikesCount(res.data.likes_count || 0);
      }
    } catch (err) {
      console.log('Error fetching post details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!postId) return;
    try {
      setLoadingComments(true);
      const res = await memberPostsApi.getComments(postId);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchPostDetails();
    fetchComments();
  }, [postId]);

  const images = (post.images || []).map((img) => ({
    ...img,
    resolvedUrl: resolveImageUrl(img.image),
  }));

  const authorPhotoUrl = resolveImageUrl(post.author?.photo);
  const isAuthor = String(post.author?.id) === String(user?.id);
  const isCharity = (post.post_type || '').toUpperCase() === 'CHARITY';

  // Derive prominent headline/title for the issue just like EventDetailScreen
  const descRaw = (post.description || '').trim();
  const descLines = descRaw.split('\n').filter((l) => l.trim().length > 0);
  const headline = descLines[0] && descLines[0].length <= 110
    ? descLines[0]
    : (descRaw.length > 80 ? descRaw.slice(0, 80) + '...' : descRaw);
  const titleText = post.title || headline || 'Community Assistance Request';
  const authorMemberId =
    post.author?.member_id ||
    (isAuthor && (user?.member_id || user?.username)) ||
    post.author?.username ||
    '';

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleLike = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
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

  const handleAddComment = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    const text = commentText.trim();
    if (!text || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await memberPostsApi.addComment(post.id, text);
      if (res.data) {
        setComments((prev) => [...prev, res.data]);
        setCommentText('');
        Toast.show({ type: 'success', text1: 'Comment added' });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to post comment' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentPress = () => {
    if (!useAuthStore.getState().isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    setShowCommentInput((prev) => {
      const next = true;
      setTimeout(() => {
        commentInputRef.current?.focus();
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return next;
    });
  };

  const handleCall = () => {
    if (!post.contact_number) return;
    Linking.openURL(`tel:${post.contact_number}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call from this device');
    });
  };

  const handleWhatsApp = () => {
    if (!post.contact_number) return;
    const cleanPhone = post.contact_number.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}&text=Hello, regarding your problem post on Sree Lakshmi Trust app: "${post.description?.slice(0, 60)}..."`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Not Installed', 'Please install WhatsApp or contact via direct call.');
    });
  };

  const handleShare = async () => {
    try {
      const authorName = post.author?.full_name || post.author?.username || 'Community Member';
      const districtName = formatDistrictKerala(post.address);
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
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Post removed successfully' });
      if (route.params?.onPostDeleted) {
        route.params.onPostDeleted(post.id);
      }
      navigation.goBack();
    } catch (_) {
      setIsDeleting(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete post. Please try again.',
      });
    }
  };

  const headerPaddingTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0284c7" translucent={true} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issue Details</Text>
        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setOptionsModalVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading post details...</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={Platform.OS === 'ios' ? 40 : 130}
          extraHeight={130}
          enableResetScrollToCoords={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Image / Video Container (Edge-to-Edge like EventDetailScreen) */}
          {post.video ? (
            <View style={styles.imageContainer}>
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={togglePlayVideo}
                style={{ width: SCREEN_WIDTH, height: 320, position: 'relative', backgroundColor: '#000000' }}
              >
                <Video
                  ref={videoRef}
                  source={{ uri: resolveImageUrl(post.video) }}
                  style={{ width: SCREEN_WIDTH, height: 320 }}
                  useNativeControls={false}
                  resizeMode={ResizeMode ? ResizeMode.CONTAIN : 'contain'}
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
                      <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
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
            <View style={styles.imageContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={SCREEN_WIDTH}
                snapToAlignment="center"
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  if (idx >= 0 && idx < images.length) {
                    setActivePhotoIndex(idx);
                  }
                }}
              >
                {images.map((imgItem, idx) => (
                  <TouchableOpacity
                    key={imgItem.id || idx}
                    activeOpacity={0.9}
                    onPress={() => setViewerImage(imgItem.resolvedUrl)}
                    style={{ width: SCREEN_WIDTH, height: '100%' }}
                  >
                    <Image
                      source={{ uri: imgItem.resolvedUrl }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {images.length > 1 && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>
                    {activePhotoIndex + 1} / {images.length}
                  </Text>
                </View>
              )}

              {images.length > 1 && (
                <View style={styles.dotsWrap}>
                  {images.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === activePhotoIndex && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.imagePlaceholderContainer}>
              <Ionicons name="document-text-outline" size={56} color="#BAE6FD" />
              <Text style={styles.imagePlaceholderText}>Community Help & Issue Request</Text>
            </View>
          )}

          {/* Floating Overlapping Card */}
          <View style={styles.card}>
            {/* About the Issue Header Row with parallel Place & Time on the right */}
            <View style={styles.aboutHeaderRow}>
              <Text style={styles.sectionTitle}>About the Issue</Text>
              <View style={styles.metaRightSide}>
                <View style={styles.metaRightItem}>
                  <Ionicons name="calendar-outline" size={13} color="#0284c7" />
                  <Text style={styles.metaTimeText}>{formatTime(post.created_at)}</Text>
                </View>
                {Boolean(post.address) && (
                  <View style={styles.metaRightItem}>
                    <Ionicons name="location-sharp" size={13} color="#0284c7" />
                    <Text style={styles.metaLocationText} numberOfLines={1}>
                      {post.address}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.descriptionText}>{post.description}</Text>

            {/* Reporter / Member Info Box (Styled exactly like EventDetail orgBox) */}
            <TouchableOpacity
              style={styles.orgBox}
              activeOpacity={0.8}
              onPress={() => {
                if (post.author?.id) {
                  navigation.navigate('MemberProfile', {
                    userId: post.author.id,
                    user: post.author,
                  });
                }
              }}
            >
              {authorPhotoUrl ? (
                <Image source={{ uri: authorPhotoUrl }} style={styles.authorAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(post.author?.full_name || post.author?.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.orgHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                    <Text style={styles.orgTitle} numberOfLines={1}>
                      {post.author?.full_name || post.author?.username || 'Community Member'}
                    </Text>
                    <Ionicons name="checkmark-circle" size={14} color="#0284c7" />
                  </View>

                  {/* Status Badge */}
                  {(post.status === 'PENDING_APPROVAL' || post.status === 'OPEN') ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>Under Review ⏳</Text>
                    </View>
                  ) : post.status === 'REJECTED' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>Rejected ⚠️</Text>
                    </View>
                  ) : post.status === 'FORWARDED_TO_FAO' ? (
                    <View style={[styles.statusBadge, styles.statusBadgeForwarded]}>
                      <Ionicons name="shield-checkmark" size={11} color="#059669" />
                      <Text style={[styles.statusBadgeText, { color: '#059669' }]}>In Assessment</Text>
                    </View>
                  ) : post.status === 'RESOLVED' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#7E22CE' }]}>Resolved</Text>
                    </View>
                  ) : isCharity ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                      <Ionicons name="heart" size={11} color="#E11D48" />
                      <Text style={[styles.statusBadgeText, { color: '#E11D48' }]}>Charity</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.orgSub}>
                  Member ID: {authorMemberId || 'N/A'} • Citizen Reporter
                </Text>
              </View>
            </TouchableOpacity>

            {/* Assessment Request Tracking Banner (if forwarded) */}
            {post.status === 'FORWARDED_TO_FAO' && (
              <View style={styles.trackingBanner}>
                <View style={styles.trackingHeader}>
                  <Ionicons name="shield-checkmark" size={18} color="#059669" />
                  <Text style={styles.trackingTitle}>Trust Verification in Progress</Text>
                </View>
                <Text style={styles.trackingDesc}>
                  This issue has been forwarded to the Field Assessment Officer (FAO) for physical verification and cost estimation.
                </Text>
                {Boolean(post.assessment_request_number) && (
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Request Reference:</Text>
                    <Text style={styles.refVal}>{post.assessment_request_number}</Text>
                  </View>
                )}
              </View>
            )}



            {/* Charity Donate Banner */}
            {isCharity && (
              <TouchableOpacity
                style={styles.charityDonateBanner}
                onPress={() => navigation.navigate('Donate', {
                  postId: post.id,
                  postAuthor: post.author?.full_name || post.author?.username || 'Community Member',
                  initialNote: `Donation for community cause by ${post.author?.full_name || post.author?.username || 'Community Member'}`,
                })}
                activeOpacity={0.88}
              >
                <View style={styles.charityDonateLeft}>
                  <View style={styles.charityDonateIconWrap}>
                    <Ionicons name="heart" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.charityDonateTitle}>Charity Support</Text>
                    <Text style={styles.charityDonateSub}>Tap to support this cause with a donation</Text>
                  </View>
                </View>
                <View style={styles.charityDonateBtn}>
                  <Text style={styles.charityDonateBtnText}>Donate Now</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            )}

            {/* Engagement Actions (Like & Comment) */}
            <View style={styles.actionBarCard}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.likeBtn, isLiked && styles.likeBtnActive]}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Ionicons
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isLiked ? '#EF4444' : '#64748B'}
                  />
                </Animated.View>
                <Text style={[styles.actionBtnText, isLiked && styles.likedText]}>
                  {likesCount > 0 ? `${likesCount} Likes` : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.commentBtn, showCommentInput && styles.commentBtnActive]}
                onPress={handleCommentPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showCommentInput ? 'chatbubble' : 'chatbubble-outline'}
                  size={19}
                  color={showCommentInput ? '#0284c7' : '#64748B'}
                />
                <Text style={[styles.actionBtnText, showCommentInput && styles.commentTextActive]}>
                  {comments.length > 0 ? `${comments.length} Comments` : 'Comment'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Compact Direct Call & WhatsApp Buttons (Phone number hidden from direct view) */}
            {Boolean(post.contact_number) && (
              <View style={styles.contactCompactRow}>
                <TouchableOpacity style={styles.compactCallBtn} onPress={handleCall} activeOpacity={0.85}>
                  <Ionicons name="call" size={13} color="#0284c7" />
                  <Text style={styles.compactCallBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactWhatsappBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
                  <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
                  <Text style={styles.compactWhatsappBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Live Comments Section */}
            <View style={styles.commentsSection}>
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
              </View>

              {loadingComments ? (
                <ActivityIndicator size="small" color="#0284c7" style={{ marginVertical: 16 }} />
              ) : comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-ellipses-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyCommentsText}>No comments yet. Be the first to reply!</Text>
                </View>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {(comment.user?.full_name || comment.user?.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentAuthor}>{comment.user?.full_name || comment.user?.username}</Text>
                        <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
                      </View>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  </View>
                ))
              )}

              {/* Add Comment Input — Displayed when clicking comment icon */}
              {showCommentInput ? (
                <View style={styles.inputWrap}>
                  <TextInput
                    ref={commentInputRef}
                    style={styles.commentInput}
                    placeholder="Write a supportive comment..."
                    placeholderTextColor="#94A3B8"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    autoFocus={true}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!commentText.trim() || submittingComment) && styles.sendBtnDisabled]}
                    onPress={handleAddComment}
                    disabled={!commentText.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={16} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addCommentTrigger}
                  onPress={handleCommentPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color="#0284c7" />
                  <Text style={styles.addCommentTriggerText}>Write a supportive comment...</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAwareScrollView>
      )}

      {/* Full Screen Image Lightbox Modal */}
      <Modal visible={Boolean(viewerImage)} transparent={true} animationType="fade">
        <SafeAreaView style={styles.viewerContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setViewerImage(null)}>
            <Ionicons name="close" size={30} color="#ffffff" />
          </TouchableOpacity>
          {viewerImage && (
            <Image source={{ uri: viewerImage }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </SafeAreaView>
      </Modal>

      {/* Options Menu Bottom Sheet Modal */}
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

      {/* Delete Confirmation Modal */}
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

      <Toast />
    </KeyboardAvoidingView>
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
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  scrollContent: { paddingBottom: 60 },

  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: '#000000',
    position: 'relative',
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
  heroImage: { width: '100%', height: '100%' },
  imagePlaceholderContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  counterBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  dotsWrap: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  activeDot: { width: 18, height: 7, borderRadius: 3.5, backgroundColor: '#0284c7' },

  // Floating Overlapping Sheet Card (Matches EventDetailScreen)
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metaRightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1,
  },
  metaRightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  metaLocationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    maxWidth: 140,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.gray700,
    lineHeight: 22,
  },

  // Reporter / Member Info Box (Styled like EventDetail orgBox)
  orgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  authorAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: '#0284c7' },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#0284c7', fontSize: 15, fontWeight: '800' },
  orgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orgTitle: { fontSize: 13, fontWeight: '700', color: '#0369a1' },
  orgSub: { fontSize: 11, color: Colors.gray500, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeOpen: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  statusBadgeForwarded: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  trackingBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 16,
  },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  trackingTitle: { fontSize: 13, fontWeight: '800', color: '#065F46' },
  trackingDesc: { fontSize: 12, color: '#047857', lineHeight: 18, marginBottom: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#A7F3D0' },
  refLabel: { fontSize: 11, fontWeight: '700', color: '#047857' },
  refVal: { fontSize: 12, fontWeight: '800', color: '#065F46' },


  // Engagement Actions Row (Like & Comment)
  charityDonateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  charityDonateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  charityDonateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charityDonateTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  charityDonateSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  charityDonateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  charityDonateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  likeBtn: { backgroundColor: '#F8FAFC' },
  likeBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  commentBtn: { backgroundColor: '#F8FAFC' },
  commentBtnActive: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },

  // Compact Call & WhatsApp Actions Row (No phone number shown directly)
  contactCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  compactCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 8,
    borderRadius: 8,
  },
  compactCallBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  compactWhatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 8,
    borderRadius: 8,
  },
  compactWhatsappBtnText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
  },
  likedText: { color: '#EF4444' },
  commentTextActive: { color: '#0284C7' },

  // Comments Section
  commentsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 10,
  },
  commentsHeader: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10, marginBottom: 12 },
  commentsTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  emptyComments: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  emptyCommentsText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#0284c7', fontSize: 12, fontWeight: '700' },
  commentBody: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  commentTime: { fontSize: 10, color: '#94A3B8' },
  commentText: { fontSize: 13, color: '#334155', lineHeight: 18 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#94A3B8', opacity: 0.5 },
  addCommentTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  addCommentTriggerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullScreenImage: { width: SCREEN_WIDTH, height: '80%' },
  headerMenuBtn: { padding: 4 },

  // Options Bottom Sheet Styles
  optionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 14,
  },
  optionItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  cancelOptionItem: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    justifyContent: 'center',
  },
  cancelOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },

  // Delete Dialog Styles
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

export default PostDetailScreen;
