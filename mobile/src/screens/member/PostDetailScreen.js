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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading post details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Author Header Card */}
          <View style={styles.authorCard}>
            <View style={styles.authorLeft}>
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
                  <Ionicons name="checkmark-circle" size={15} color="#0284c7" />
                </View>
                <Text style={styles.authorSub}>
                  Member: @{post.author?.username} • {formatTime(post.created_at)}
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            {post.status === 'FORWARDED_TO_FAO' ? (
              <View style={[styles.statusBadge, styles.statusBadgeForwarded]}>
                <Ionicons name="shield-checkmark" size={12} color="#059669" />
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
          </View>

          {/* 2. Assessment Request Tracking Banner (if forwarded) */}
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

          {/* 3. Photos Carousel / Image Section */}
          {images.length > 0 && (
            <View style={styles.imageBannerWrapper}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={SCREEN_WIDTH - 32}
                snapToAlignment="center"
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
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
                    style={{ width: SCREEN_WIDTH - 32 }}
                  >
                    <Image
                      source={{ uri: imgItem.resolvedUrl }}
                      style={styles.cardBannerImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Photo Counter Badge */}
              {images.length > 1 && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>
                    {activePhotoIndex + 1} / {images.length}
                  </Text>
                </View>
              )}

              {/* Dots */}
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
          )}

          {/* 4. Full Problem Description Card */}
          <View style={styles.detailCard}>
            <Text style={styles.sectionLabel}>Problem / Assistance Needed</Text>
            <Text style={styles.descriptionFull}>{post.description}</Text>
          </View>

          {/* 5. Address & Location Card */}
          {Boolean(post.address) && (
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>Location / Address</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={18} color="#0284c7" />
                <Text style={styles.infoValue}>{formatDistrictKerala(post.address)}</Text>
              </View>
            </View>
          )}

          {/* 6. Contact Information Card */}
          {Boolean(post.contact_number) && (
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>Contact Information</Text>
              <View style={styles.contactRow}>
                <View style={styles.contactPhone}>
                  <Ionicons name="location-sharp" size={16} color="#0284c7" />
                  <Text style={styles.phoneText}>{formatDistrictKerala(post.address)}</Text>
                </View>
                <View style={styles.contactButtons}>
                  <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
                    <Ionicons name="call" size={13} color="#ffffff" />
                    <Text style={styles.callBtnText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
                    <Ionicons name="logo-whatsapp" size={14} color="#ffffff" />
                    <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* 7. Engagement Actions (Like, Share) */}
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

            
          </View>

          {/* 8. Live Comments Section */}
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

            {/* Add Comment Input */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a supportive comment..."
                placeholderTextColor="#94A3B8"
                value={commentText}
                onChangeText={setCommentText}
                multiline
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
          </View>
        </ScrollView>
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

      {/* Share Options ActionSheet */}
      {Boolean(post) && (
        <ActionSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          title="Share Community Issue & Photos"
          options={[
            {
              label: 'Share to WhatsApp (Photos & Details)',
              icon: 'logo-whatsapp',
              onPress: handleShareWhatsApp,
            },
            {
              label: `Share Photo File ${(post?.images?.length || 0) > 1 ? `(${activePhotoIndex + 1}/${post.images.length})` : ''} + Caption`,
              icon: 'image-outline',
              onPress: handleSharePhotoFile,
            },
            {
              label: 'Share via Other Apps (System Share)',
              icon: 'share-social-outline',
              onPress: handleShareAll,
            },
            {
              label: 'Copy Full Details & Photo Links',
              icon: 'copy-outline',
              onPress: handleCopyDetails,
            },
          ]}
        />
      )}

      <Toast />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  shareHeaderBtn: { padding: 4 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  scrollContent: { padding: 16, gap: 14 },

  authorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#0284c7' },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#0284c7', fontSize: 16, fontWeight: '800' },
  authorTextWrap: { flex: 1 },
  authorName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  authorSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeOpen: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  statusBadgeForwarded: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  trackingBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  trackingTitle: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  trackingDesc: { fontSize: 12, color: '#047857', lineHeight: 18, marginBottom: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#A7F3D0' },
  refLabel: { fontSize: 11, fontWeight: '700', color: '#047857' },
  refVal: { fontSize: 12, fontWeight: '800', color: '#065F46' },

  imageBannerWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardBannerImage: { width: SCREEN_WIDTH - 32, aspectRatio: 4 / 3, backgroundColor: '#F1F5F9' },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  dotsWrap: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  activeDot: { width: 18, height: 7, borderRadius: 3.5, backgroundColor: '#0284c7' },

  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  descriptionFull: { fontSize: 15, fontWeight: '500', color: '#1E293B', lineHeight: 23 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1, lineHeight: 20 },

  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  contactPhone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  contactButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  callBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  whatsappBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  actionBarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 10,
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
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  likedText: { color: '#EF4444' },

  commentsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
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
});

export default PostDetailScreen;
