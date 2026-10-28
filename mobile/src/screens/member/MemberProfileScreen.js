import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Linking,
  Share,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { memberPostsApi, authApi } from '../../api';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { resolveImageUrl } from '../../utils/imageUrl';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 4) / 3;

export default function MemberProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser, isAuthenticated, updateUser } = useAuthStore();

  const targetUserId = route.params?.userId || route.params?.authorId || currentUser?.id;
  const initialUser = route.params?.user || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'videos'
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingLoading, setFollowingLoading] = useState(false);

  const isMe = Boolean(
    currentUser && targetUserId && String(currentUser.id) === String(targetUserId)
  );

  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState('followers'); // 'followers' | 'following'
  const [followList, setFollowList] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followSearchText, setFollowSearchText] = useState('');
  const [followMap, setFollowMap] = useState({});
  const [followBtnLoading, setFollowBtnLoading] = useState({});

  // ── Edit Profile Modal State & Handlers ──
  const [editModal, setEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    avatar: '',
  });

  const openEditModal = () => {
    setEditForm({
      full_name: profileData?.full_name || currentUser?.full_name || '',
      phone: profileData?.phone || currentUser?.phone || '',
      email: profileData?.email || currentUser?.email || '',
      address: profileData?.address || currentUser?.address || '',
      date_of_birth: profileData?.date_of_birth || currentUser?.date_of_birth || currentUser?.dob || '',
      avatar: profileData?.photo || currentUser?.photo || currentUser?.avatar || '',
    });
    setEditModal(true);
  };

  const openPhotoPickerOptions = () => {
    setPhotoModalVisible(true);
  };

  const takeCameraPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Camera permission required to take photo.' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditForm((prev) => ({ ...prev, avatar: result.assets[0].uri }));
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Camera error' });
    }
  };

  const pickGalleryImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Gallery permission required to upload photo.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditForm((prev) => ({ ...prev, avatar: result.assets[0].uri }));
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Image selection error' });
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      return Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter your full name' });
    }

    setEditLoading(true);
    try {
      const updatedUser = {
        ...currentUser,
        full_name: editForm.full_name,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        date_of_birth: editForm.date_of_birth,
        dob: editForm.date_of_birth,
        avatar: editForm.avatar,
      };

      await updateUser(updatedUser);

      try {
        const formData = new FormData();
        formData.append('full_name', editForm.full_name);
        if (editForm.phone) formData.append('phone', editForm.phone);
        if (editForm.email) formData.append('email', editForm.email);
        if (editForm.address) formData.append('address', editForm.address);
        if (editForm.date_of_birth) formData.append('date_of_birth', editForm.date_of_birth);

        if (editForm.avatar && !editForm.avatar.startsWith('http')) {
          const avatarName = editForm.avatar.split('/').pop() || 'avatar.jpg';
          formData.append('photo', {
            uri: editForm.avatar,
            name: avatarName,
            type: 'image/jpeg',
          });
        }

        const res = await authApi.updateProfile(formData);

        if (res.data) {
          const finalUser = {
            ...updatedUser,
            avatar: res.data.photo || updatedUser.avatar,
            photo: res.data.photo || updatedUser.photo,
          };
          await updateUser(finalUser);
          setProfileData((prev) => ({
            ...prev,
            ...finalUser,
            full_name: editForm.full_name,
            phone: editForm.phone,
            email: editForm.email,
            address: editForm.address,
            date_of_birth: editForm.date_of_birth,
            photo: res.data.photo || prev?.photo || editForm.avatar,
          }));
        } else {
          setProfileData((prev) => ({
            ...prev,
            ...updatedUser,
            full_name: editForm.full_name,
            phone: editForm.phone,
            email: editForm.email,
            address: editForm.address,
            date_of_birth: editForm.date_of_birth,
            photo: editForm.avatar || prev?.photo,
          }));
        }

        Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Changes saved successfully!' });
        setEditModal(false);
      } catch (err) {
        setProfileData((prev) => ({
          ...prev,
          full_name: editForm.full_name,
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
          date_of_birth: editForm.date_of_birth,
          photo: editForm.avatar || prev?.photo,
        }));
        Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Local profile updated successfully!' });
        setEditModal(false);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to update profile' });
    } finally {
      setEditLoading(false);
    }
  };

  const openFollowModal = (tab = 'followers') => {
    setFollowModalTab(tab);
    setFollowSearchText('');
    setFollowModalVisible(true);
    loadFollowList(tab, '');
  };

  const loadFollowList = async (tab, query = '') => {
    if (!targetUserId) return;
    setFollowListLoading(true);
    try {
      const apiCall = tab === 'followers' ? memberPostsApi.getFollowers : memberPostsApi.getFollowing;
      const res = await apiCall(targetUserId, query ? { q: query } : {});
      const list = Array.isArray(res.data) ? res.data : [];
      setFollowList(list);

      setFollowMap((prev) => {
        const next = { ...prev };
        list.forEach((u) => {
          next[u.id] = Boolean(u.is_following);
        });
        return next;
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load list',
        text2: err.response?.data?.error || 'Failed to fetch users',
      });
      setFollowList([]);
    } finally {
      setFollowListLoading(false);
    }
  };

  const switchFollowTab = (tab) => {
    if (tab === followModalTab) return;
    setFollowModalTab(tab);
    setFollowSearchText('');
    loadFollowList(tab, '');
  };

  const handleToggleFollowInList = async (item) => {
    if (!isAuthenticated) {
      setFollowModalVisible(false);
      navigation.navigate('Auth');
      return;
    }
    const currentFollow = followMap[item.id] !== undefined ? followMap[item.id] : item.is_following;
    const nextFollow = !currentFollow;

    setFollowMap((prev) => ({ ...prev, [item.id]: nextFollow }));
    setFollowBtnLoading((prev) => ({ ...prev, [item.id]: true }));

    if (isMe) {
      setFollowingCount((prev) => (nextFollow ? prev + 1 : Math.max(0, prev - 1)));
    }

    try {
      await memberPostsApi.toggleFollow(item.id);
    } catch (_) {
      setFollowMap((prev) => ({ ...prev, [item.id]: currentFollow }));
      if (isMe) {
        setFollowingCount((prev) => (currentFollow ? prev + 1 : Math.max(0, prev - 1)));
      }
      Toast.show({ type: 'error', text1: 'Action failed', text2: 'Could not update follow status' });
    } finally {
      setFollowBtnLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSelectMember = (item) => {
    setFollowModalVisible(false);
    if (String(item.id) === String(targetUserId)) return;
    navigation.push('MemberProfile', { userId: item.id, user: item });
  };

  const filteredFollowList = followList.filter((item) => {
    if (!followSearchText.trim()) return true;
    const q = followSearchText.toLowerCase();
    return (
      (item.full_name && item.full_name.toLowerCase().includes(q)) ||
      (item.username && item.username.toLowerCase().includes(q)) ||
      (item.district && item.district.toLowerCase().includes(q))
    );
  });

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await memberPostsApi.getMemberProfile(targetUserId);
      const data = res.data;
      if (data) {
        setProfileData(data.user);
        setPosts(data.posts || []);
        setIsFollowing(Boolean(data.user?.is_following));
        setFollowersCount(data.user?.followers_count || 0);
        setFollowingCount(data.user?.following_count || 0);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load profile',
        text2: err.response?.data?.error || 'Could not fetch member details',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      fetchProfile(true);
    } else {
      setLoading(false);
    }
  }, [targetUserId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile(false);
  }, [targetUserId]);

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    if (isMe) return;

    const nextState = !isFollowing;
    const nextCount = nextState ? followersCount + 1 : Math.max(0, followersCount - 1);

    // Optimistic UI update
    setIsFollowing(nextState);
    setFollowersCount(nextCount);
    setFollowingLoading(true);

    try {
      const res = await memberPostsApi.toggleFollow(targetUserId);
      if (res.data) {
        setIsFollowing(Boolean(res.data.is_following));
        if (typeof res.data.followers_count === 'number') {
          setFollowersCount(res.data.followers_count);
        }
        if (typeof res.data.following_count === 'number') {
          setFollowingCount(res.data.following_count);
        }
      }
    } catch (_) {
      // Rollback on error
      setIsFollowing(!nextState);
      setFollowersCount(followersCount);
      Toast.show({ type: 'error', text1: 'Action failed', text2: 'Could not update follow status' });
    } finally {
      setFollowingLoading(false);
    }
  };

  const handleShareProfile = async () => {
    const username = profileData?.username || initialUser?.username || 'member';
    const fullName = profileData?.full_name || initialUser?.full_name || '';
    try {
      await Share.share({
        message: `Check out ${fullName} (@${username}) on Sree Lakshmi Charitable Trust!`,
        title: `${fullName} • Member Profile`,
      });
    } catch (_) {}
  };

  const handleWhatsApp = () => {
    const phone = profileData?.phone || initialUser?.phone;
    if (phone) {
      const clean = phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=91${clean}`);
    } else {
      Toast.show({ type: 'info', text1: 'WhatsApp', text2: 'No contact number shared by this member' });
    }
  };

  const username = profileData?.username || initialUser?.username || 'Member Profile';
  const fullName = profileData?.full_name || initialUser?.full_name || username;
  const photoUrl = resolveImageUrl(profileData?.photo || initialUser?.photo);
  const district = profileData?.district || initialUser?.district || '';
  const postsCount = profileData?.posts_count ?? posts.length;

  const filteredPosts = activeTab === 'videos'
    ? posts.filter((p) => Boolean(p.video || p.media_type === 'VIDEO'))
    : posts;

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* ── Top Avatar & 3 Stats Row ── */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={isMe ? openEditModal : undefined} activeOpacity={isMe ? 0.8 : 1}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {(fullName[0] || username[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
          {isMe && (
            <View style={styles.avatarAddBadge}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{postsCount}</Text>
          <Text style={styles.statLabel}>posts</Text>
        </View>

        <TouchableOpacity
          style={styles.statCol}
          onPress={() => openFollowModal('followers')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{followersCount}</Text>
          <Text style={styles.statLabel}>followers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCol}
          onPress={() => openFollowModal('following')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{followingCount}</Text>
          <Text style={styles.statLabel}>following</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bio / Details Section ── */}
      <View style={styles.bioSection}>
        <View style={styles.nameRow}>
          <Text style={styles.bioName}>{fullName}</Text>
          <Ionicons name="checkmark-circle" size={15} color="#0284c7" style={{ marginLeft: 4 }} />
        </View>

        {Boolean(district) && (
          <View style={styles.bioSubRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.bioSubText}>{district}, Kerala</Text>
          </View>
        )}

        <Text style={styles.bioTagline}>
          Community Member • Sree Lakshmi Charitable Trust
        </Text>

        {!!profileData?.user?.badge_summary && (
          <View style={styles.badgeSummaryCard}>
            <View style={styles.badgeSummaryHeader}>
              <Text style={styles.badgeSummaryTitle}>🎖️ EARNED TRUST BADGES</Text>
            </View>
            <Text style={styles.badgeSummaryText}>{profileData.user.badge_summary}</Text>
          </View>
        )}
      </View>

      {/* ── Action Buttons Row ── */}
      <View style={styles.actionsRow}>
        {isMe ? (
          <>
            <TouchableOpacity
              style={[styles.btnAction, styles.btnSecondary]}
              onPress={openEditModal}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>Edit profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnAction, styles.btnSecondary]}
              onPress={handleShareProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>Share profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.btnAction,
                isFollowing ? styles.btnFollowing : styles.btnFollow,
              ]}
              onPress={handleToggleFollow}
              disabled={followingLoading}
              activeOpacity={0.8}
            >
              {followingLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? '#0F172A' : '#FFFFFF'} />
              ) : (
                <Text style={isFollowing ? styles.btnFollowingText : styles.btnFollowText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnAction, styles.btnSecondary]}
              onPress={handleShareProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>Share profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Tabs (Grid & Video Reels) ── */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'grid' && styles.tabButtonActive]}
          onPress={() => setActiveTab('grid')}
        >
          <Ionicons
            name="grid"
            size={22}
            color={activeTab === 'grid' ? '#0F172A' : '#94A3B8'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'videos' && styles.tabButtonActive]}
          onPress={() => setActiveTab('videos')}
        >
          <Ionicons
            name="play-circle-outline"
            size={24}
            color={activeTab === 'videos' ? '#0F172A' : '#94A3B8'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPostItem = ({ item }) => {
    const firstImg = (item.images && item.images.length > 0) ? item.images[0] : null;
    const imgUrl = firstImg ? resolveImageUrl(firstImg.image) : null;
    const isVideo = Boolean(item.video || item.media_type === 'VIDEO');
    const videoUrl = item.video ? resolveImageUrl(item.video) : null;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PostDetail', { post: item, postId: item.id })}
      >
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : isVideo && videoUrl ? (
          <Video
            source={{ uri: videoUrl }}
            style={styles.gridImage}
            resizeMode={ResizeMode ? ResizeMode.COVER : 'cover'}
            shouldPlay={false}
            positionMillis={100}
            isMuted={true}
          />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name={isVideo ? 'videocam' : 'document-text-outline'} size={28} color="#94A3B8" />
            <Text style={styles.gridPlaceholderText} numberOfLines={2}>
              {item.description || 'Community Post'}
            </Text>
          </View>
        )}

        {/* Video Reel play badge in top right (Instagram style) */}
        {isVideo && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={13} color="#FFFFFF" />
          </View>
        )}

        {/* Carousel multi-image icon in top right if multiple photos and not video */}
        {!isVideo && item.images && item.images.length > 1 && (
          <View style={styles.videoBadge}>
            <Ionicons name="copy-outline" size={12} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIllustrationBox}>
          <View style={styles.emptyCameraFrame}>
            <View style={styles.cameraNotch} />
            <View style={styles.cameraShutterOuter}>
              <View style={styles.cameraShutterInner} />
            </View>
            <View style={styles.cameraButtonDot} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>
          {activeTab === 'videos' ? 'No Videos Yet' : (isMe ? 'Create your first post' : 'No posts yet')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isMe
            ? 'When you share photos, community problems, or updates, they will appear on your profile.'
            : 'This member has not shared any posts in this section yet.'}
        </Text>
        {isMe && (
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => navigation.navigate('CreatePost')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyCreateBtnText}>Create Post</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!isAuthenticated && !targetUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.guestContainer}>
          <View style={styles.guestCard}>
            <Ionicons name="person-circle-outline" size={76} color="#0284c7" />
            <Text style={styles.guestTitle}>Welcome to Sree Lakshmi</Text>
            <Text style={styles.guestSubtitle}>Please login to access your member profile and community posts.</Text>
            <TouchableOpacity
              style={styles.guestLoginBtn}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.85}
            >
              <Text style={styles.guestLoginBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.85}
            >
              <Text style={styles.guestSecondaryBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top Navigation Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => navigation.navigate('CreatePost')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add" size={28} color="#0F172A" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.topBarRight}>
          {isMe && (
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => navigation.navigate('ProfileSettings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color="#0F172A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Profile Content & Grid List ── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          renderItem={renderPostItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Followers / Following List Modal ── */}
      <Modal
        visible={followModalVisible}
        animationType="slide"
        onRequestClose={() => setFollowModalVisible(false)}
      >
        <View style={[styles.followModalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Modal Header */}
          <View style={styles.followModalHeader}>
            <TouchableOpacity
              style={styles.followModalBackBtn}
              onPress={() => setFollowModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.followModalTabsRow}>
              <TouchableOpacity
                style={[styles.followModalTabBtn, followModalTab === 'followers' && styles.followModalTabBtnActive]}
                onPress={() => switchFollowTab('followers')}
                activeOpacity={0.7}
              >
                <Text style={[styles.followModalTabText, followModalTab === 'followers' && styles.followModalTabTextActive]}>
                  {followersCount} Followers
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.followModalTabBtn, followModalTab === 'following' && styles.followModalTabBtnActive]}
                onPress={() => switchFollowTab('following')}
                activeOpacity={0.7}
              >
                <Text style={[styles.followModalTabText, followModalTab === 'following' && styles.followModalTabTextActive]}>
                  {followingCount} Following
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {/* Search bar */}
          <View style={styles.followSearchContainer}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginLeft: 12, marginRight: 8 }} />
            <TextInput
              style={styles.followSearchInput}
              placeholder={`Search ${followModalTab}...`}
              placeholderTextColor="#94A3B8"
              value={followSearchText}
              onChangeText={setFollowSearchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Boolean(followSearchText) && (
              <TouchableOpacity
                onPress={() => setFollowSearchText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingRight: 10 }}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* User List */}
          {followListLoading ? (
            <View style={styles.followLoadingBox}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={styles.followLoadingText}>Loading {followModalTab}...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredFollowList}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.followListContent}
              renderItem={({ item }) => {
                const itemPhoto = resolveImageUrl(item.photo);
                const isItemFollowed = followMap[item.id] !== undefined ? followMap[item.id] : item.is_following;
                const isBtnLoading = Boolean(followBtnLoading[item.id]);

                return (
                  <TouchableOpacity
                    style={styles.followUserRow}
                    onPress={() => handleSelectMember(item)}
                    activeOpacity={0.7}
                  >
                    {itemPhoto ? (
                      <Image source={{ uri: itemPhoto }} style={styles.followUserAvatar} />
                    ) : (
                      <View style={styles.followUserFallback}>
                        <Text style={styles.followUserFallbackText}>
                          {(item.full_name?.[0] || item.username?.[0] || 'U').toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.followUserInfo}>
                      <Text style={styles.followUserName} numberOfLines={1}>
                        {item.full_name || item.username}
                      </Text>
                      <Text style={styles.followUserSub} numberOfLines={1}>
                        @{item.username}{item.district ? ` • ${item.district}` : ''}
                      </Text>
                    </View>

                    {!item.is_me && (
                      <TouchableOpacity
                        style={[
                          styles.followRowBtn,
                          isItemFollowed ? styles.followRowBtnFollowing : styles.followRowBtnFollow,
                        ]}
                        onPress={() => handleToggleFollowInList(item)}
                        disabled={isBtnLoading}
                        activeOpacity={0.8}
                      >
                        {isBtnLoading ? (
                          <ActivityIndicator size="small" color={isItemFollowed ? '#0F172A' : '#FFFFFF'} />
                        ) : (
                          <Text style={isItemFollowed ? styles.followRowBtnTextFollowing : styles.followRowBtnTextFollow}>
                            {isItemFollowed ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.followEmptyBox}>
                  <Ionicons
                    name={followModalTab === 'followers' ? 'people-outline' : 'person-add-outline'}
                    size={48}
                    color="#CBD5E1"
                  />
                  <Text style={styles.followEmptyTitle}>
                    {followSearchText
                      ? 'No members found'
                      : followModalTab === 'followers'
                      ? 'No followers yet'
                      : 'Not following anyone yet'}
                  </Text>
                  <Text style={styles.followEmptySub}>
                    {followSearchText
                      ? `No results matching "${followSearchText}"`
                      : followModalTab === 'followers'
                      ? 'When members follow this profile, they will appear here.'
                      : 'Explore other community members and follow them.'}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Photo Upload Avatar Picker */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={openPhotoPickerOptions} activeOpacity={0.8} style={styles.avatarPickerWrapper}>
                  {editForm.avatar ? (
                    <Image source={{ uri: editForm.avatar }} style={styles.avatarPickerImg} />
                  ) : (
                    <View style={styles.avatarPickerPlaceholder}>
                      <Ionicons name="person" size={44} color="#0284c7" />
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700', marginTop: 8 }}>
                  Tap to Take or Upload Photo
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.full_name}
                  onChangeText={v => setEditForm(p => ({ ...p, full_name: v }))}
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.phone}
                  onChangeText={v => setEditForm(p => ({ ...p, phone: v }))}
                  placeholder="Enter phone number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.email}
                  onChangeText={v => setEditForm(p => ({ ...p, email: v }))}
                  placeholder="Enter email address"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address / Location</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.address}
                  onChangeText={v => setEditForm(p => ({ ...p, address: v }))}
                  placeholder="Enter address or location"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.date_of_birth}
                  onChangeText={v => setEditForm(p => ({ ...p, date_of_birth: v }))}
                  placeholder="e.g. 1995-08-15"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveProfile} disabled={editLoading} activeOpacity={0.85}>
                {editLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Save Profile Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Photo Picker Options Modal ── */}
      <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
        <TouchableOpacity style={styles.photoModalOverlay} activeOpacity={1} onPress={() => setPhotoModalVisible(false)}>
          <View style={styles.photoModalContent}>
            <View style={styles.photoModalHeader}>
              <View style={styles.photoModalIconWrap}>
                <Ionicons name="camera" size={24} color="#0284c7" />
              </View>
              <Text style={styles.photoModalTitle}>Profile Photo</Text>
              <Text style={styles.photoModalSub}>Choose how you would like to set your profile picture</Text>
            </View>

            <View style={styles.photoOptionsList}>
              <TouchableOpacity style={styles.photoOptionCard} onPress={() => { setPhotoModalVisible(false); takeCameraPhoto(); }} activeOpacity={0.7}>
                <View style={[styles.photoOptionIconWrap, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="camera" size={22} color="#0284c7" />
                </View>
                <View style={styles.photoOptionTextWrap}>
                  <Text style={styles.photoOptionTitle}>Take Photo</Text>
                  <Text style={styles.photoOptionSub}>Use your camera to take a new picture</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoOptionCard} onPress={() => { setPhotoModalVisible(false); pickGalleryImage(); }} activeOpacity={0.7}>
                <View style={[styles.photoOptionIconWrap, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="images" size={22} color="#16a34a" />
                </View>
                <View style={styles.photoOptionTextWrap}>
                  <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
                  <Text style={styles.photoOptionSub}>Select an image from your photo library</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.photoModalCancelBtn} onPress={() => setPhotoModalVisible(false)} activeOpacity={0.8}>
              <Text style={styles.photoModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8', // Soothing modern off-white background
  },
  topBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarLeft: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topBarBtn: {
    padding: 6,
  },
  topBarUsername: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
    maxWidth: SCREEN_WIDTH - 140,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  listContent: {
    paddingBottom: 40,
    backgroundColor: '#F4F6F8',
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 18,
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  avatarFallbackText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0284c7',
  },
  avatarAddBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284c7',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  bioSection: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  bioName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  bioSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bioSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  bioTagline: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  badgeSummaryCard: {
    marginTop: 10,
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeSummaryTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#854D0E',
    letterSpacing: 0.5,
  },
  badgeSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#713F12',
    letterSpacing: 0.3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  btnAction: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  btnFollow: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  btnFollowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnFollowing: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnFollowingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tabButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#0F172A',
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    margin: 0.6,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  gridPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 4,
    padding: 3,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIllustrationBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyCameraFrame: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2.2,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  cameraNotch: {
    width: 14,
    height: 3,
    backgroundColor: '#0F172A',
    borderRadius: 1.5,
    position: 'absolute',
    top: 5,
  },
  cameraShutterOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  cameraShutterInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284c7',
  },
  cameraButtonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    position: 'absolute',
    bottom: 5,
  },
  emptyCreateBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  guestCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  guestLoginBtn: {
    width: '100%',
    backgroundColor: '#0284c7',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  guestLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  guestSecondaryBtn: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guestSecondaryBtnText: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: '600',
  },
  followModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  followModalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  followModalBackBtn: {
    padding: 6,
  },
  followModalTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  followModalTabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  followModalTabBtnActive: {
    borderBottomColor: '#0F172A',
  },
  followModalTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  followModalTabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  followSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    height: 40,
  },
  followSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  followLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  followLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  followListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  followUserAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  followUserFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  followUserFallbackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  followUserInfo: {
    flex: 1,
    marginRight: 10,
  },
  followUserName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  followUserSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  followRowBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRowBtnFollow: {
    backgroundColor: '#0284c7',
  },
  followRowBtnFollowing: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  followRowBtnTextFollow: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  followRowBtnTextFollowing: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  followEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  followEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  followEmptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  /* ── Edit Profile Modal Styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarPickerWrapper: {
    position: 'relative',
    width: 84,
    height: 84,
  },
  avatarPickerImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  avatarPickerPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284c7',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  saveSubmitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },

  /* ── Photo Picker Options Modal Styles ── */
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  photoModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  photoModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  photoModalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  photoOptionsList: {
    gap: 12,
    marginBottom: 16,
  },
  photoOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoOptionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  photoOptionTextWrap: {
    flex: 1,
  },
  photoOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  photoOptionSub: {
    fontSize: 12,
    color: '#64748B',
  },
  photoModalCancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  photoModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
