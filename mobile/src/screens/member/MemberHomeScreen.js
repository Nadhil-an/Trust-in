import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { useNotificationSocket } from '../../hooks/useWebSocket';
import { authApi, eventsApi, memberPostsApi, pollsApi, pomApi } from '../../api';
import { resolveImageUrl } from '../../utils/imageUrl';
import PollCard from '../../components/feed/PollCard';
import PomPosterCard from '../../components/feed/PomPosterCard';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import { EventBanner } from '../../components/shared';
import PostCard from '../../components/feed/PostCard';
import CommentsModal from '../../components/feed/CommentsModal';

const MemberHomeScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuthStore();

  useNotificationSocket((data) => {
    if (data?.type === 'DASHBOARD_REFRESH' || data?.type === 'dashboard_refresh') {
      if (isAuthenticated) {
        authApi.getProfile()
          .then(res => {
            if (res.data) {
              useAuthStore.getState().updateUser(res.data);
            }
          })
          .catch(() => {});
      }
      fetchActivePolls();
      fetchPoms();
      fetchPosts();
      fetchStoryMembers();
    }
  });
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activePolls, setActivePolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [poms, setPoms] = useState([]);
  const [storyMembers, setStoryMembers] = useState([]);
  const [inFeedBannerDismissed, setInFeedBannerDismissed] = useState(false);
  const [showFloatingReminder, setShowFloatingReminder] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [userProfile, setUserProfile] = useState(user);

  useEffect(() => {
    setUserProfile(user);
  }, [user]);

  // Recurring 2-minute reminder over circle profiles for non-subscribed members (auto-disappears in 2 seconds)
  useEffect(() => {
    if (!isAuthenticated || !isNotSubscribed) {
      setShowFloatingReminder(false);
      return;
    }

    let hideTimeout = null;
    const interval = setInterval(() => {
      setShowFloatingReminder(true);
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setShowFloatingReminder(false);
      }, 2000); // Disappears within 2 seconds
    }, 120000); // Every 2 minutes

    return () => {
      clearInterval(interval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [isAuthenticated, isNotSubscribed]);

  const memberName = userProfile?.full_name || user?.full_name || '';
  const memberId = userProfile?.username || user?.username || '';

  const activeUser = userProfile || user;
  const isPaidMember = Boolean(activeUser?.is_paid_member);
  const hasActiveSubscription = Boolean(activeUser?.has_active_subscription);
  const subscriptionStatus = activeUser?.subscription_status || (hasActiveSubscription ? 'ACTIVE' : 'NOT_SUBSCRIBED');
  const isNotSubscribed = subscriptionStatus === 'NOT_SUBSCRIBED' || (!hasActiveSubscription && !isPaidMember);
  const daysLeftToExpire = activeUser?.days_left_to_expire;
  const isExpiringSoon = subscriptionStatus === 'EXPIRING_SOON' || (typeof daysLeftToExpire === 'number' && daysLeftToExpire <= 2 && daysLeftToExpire >= 0);
  const isExpired = Boolean(activeUser?.is_subscription_expired) || subscriptionStatus === 'EXPIRED';
  const validUpto = activeUser?.valid_upto || '';
  const monthlyFee = activeUser?.monthly_fee || 100;

  const showSubscriptionToastAlert = (profile) => {
    if (!isAuthenticated) return;
    const isPaid = Boolean(profile?.is_paid_member);
    const hasActive = Boolean(profile?.has_active_subscription);
    const status = profile?.subscription_status || (hasActive ? 'ACTIVE' : 'NOT_SUBSCRIBED');
    const daysLeft = profile?.days_left_to_expire;
    const vDate = profile?.valid_upto || '';

    if (status === 'NOT_SUBSCRIBED' || (!hasActive && !isPaid)) {
      Toast.show({
        type: 'info',
        text1: '⚠️ Trust Membership Required',
        text2: 'Tap here to activate monthly membership (₹100/mo) & unlock digital ID.',
        visibilityTime: 6000,
        onPress: () => navigation.navigate('MembershipPayment'),
      });
    } else if (status === 'EXPIRING_SOON' || (typeof daysLeft === 'number' && daysLeft <= 2 && daysLeft >= 0)) {
      const dayText = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'in 1 day' : ('in ' + daysLeft + ' days');
      Toast.show({
        type: 'error',
        text1: '⏰ Membership Expiring Soon',
        text2: 'Expires ' + dayText + ' (' + vDate + '). Tap here to renew payment.',
        visibilityTime: 6000,
        onPress: () => navigation.navigate('MembershipPayment'),
      });
    } else if (status === 'EXPIRED' || profile?.is_subscription_expired) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Membership Expired',
        text2: 'Your membership expired (' + vDate + '). Tap here to update payment.',
        visibilityTime: 6000,
        onPress: () => navigation.navigate('MembershipPayment'),
      });
    }
  };

  const fetchProfileAndCheck = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setUserProfile(res.data);
        useAuthStore.getState().updateUser(res.data);
        showSubscriptionToastAlert(res.data);
      }
    } catch (_) {
      if (user) {
        showSubscriptionToastAlert(user);
      }
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const res = await eventsApi.list();
      if (res.data && res.data.results) {
        const upcoming = res.data.results.filter(e => e.category === 'Upcoming' || !e.category);
        setUpcomingEvents(upcoming.length > 0 ? upcoming : res.data.results);
      }
    } catch (err) {}
  };

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('CreatePost');
  };

  const handleDonate = () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('Donate');
  };

  const handleMembershipPayment = () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('MembershipPayment');
  };

  const handleVoteSuccess = (updatedPoll) => {
    if (updatedPoll?.id) {
      setActivePolls((prev) =>
        prev.map((p) => (p.id === updatedPoll.id ? { ...p, ...updatedPoll } : p))
      );
    } else {
      fetchActivePolls();
    }
  };

  const fetchActivePolls = async () => {
    try {
      setPollsLoading(true);
      const res = await pollsApi.list({ status: 'ACTIVE' });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setActivePolls((prevList) => {
        return list.map((incoming) => {
          const current = prevList.find((p) => p.id === incoming.id);
          if (current?.my_voted_option_id && incoming.my_voted_option_id !== current.my_voted_option_id) {
            return {
              ...incoming,
              has_voted: true,
              my_voted_option_id: current.my_voted_option_id,
            };
          }
          return incoming;
        });
      });
    } catch (_) {}
    finally {
      setPollsLoading(false);
    }
  };

  const fetchPoms = async () => {
    try {
      const res = await pomApi.list({ status: 'PUBLISHED' });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setPoms(list);
    } catch (_) {}
  };

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      const res = await memberPostsApi.list();
      setPosts(res.data.results || res.data || []);
    } catch (_) {}
    finally {
      setPostsLoading(false);
    }
  };

  const fetchStoryMembers = async () => {
    try {
      const res = await memberPostsApi.getActiveMembers();
      const rawList = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const eligibleMembers = rawList.filter((m) => {
        const isMember = (m.role || '').toLowerCase() === 'member';
        const isActive = (m.status || '').toLowerCase() === 'active';
        return isMember && isActive;
      });
      setStoryMembers(eligibleMembers);
    } catch (_) {}
  };

  useEffect(() => {
    fetchUpcomingEvents();
    fetchPosts();
    fetchProfileAndCheck();
    fetchActivePolls();
    fetchPoms();
    fetchStoryMembers();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchProfileAndCheck();
      fetchActivePolls();
      fetchPoms();
      fetchStoryMembers();

      // Real-time polling timer: auto-updates vote counts and percentages live without manual refresh
      const liveTimer = setInterval(() => {
        fetchActivePolls();
      }, 12000);

      return () => clearInterval(liveTimer);
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUpcomingEvents(),
      fetchPosts(),
      fetchProfileAndCheck(),
      fetchActivePolls(),
      fetchPoms(),
      fetchStoryMembers(),
    ]);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const renderStoryItem = useCallback(({ item }) => {
    const photoUrl = resolveImageUrl(item.photo);
    return (
      <TouchableOpacity
        style={styles.storyItemWrap}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MemberProfile', { userId: item.id, user: item })}
      >
        <LinearGradient
          colors={['#CA1D7E', '#E052A0', '#F15C3C', '#FC8F44', '#FCC862']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.storyRingGradient}
        >
          <View style={styles.storyRingInner}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.storyImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.storyFallbackAvatar}>
                <Text style={styles.storyFallbackText}>
                  {(item.full_name?.[0] || item.username?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [navigation]);

  // Unified chronological feed combining Member Posts, Trust Appeals (POMs), and Polls in natural posting order
  const combinedFeed = useMemo(() => {
    const feedItems = [];

    (posts || []).forEach((p) => {
      feedItems.push({
        ...p,
        feedType: 'POST',
        _sortDate: new Date(p.created_at || 0).getTime(),
      });
    });

    (poms || []).forEach((pom) => {
      feedItems.push({
        ...pom,
        feedType: 'POM',
        _sortDate: new Date(pom.created_at || 0).getTime(),
      });
    });

    (activePolls || []).forEach((poll) => {
      feedItems.push({
        ...poll,
        feedType: 'POLL',
        _sortDate: new Date(poll.created_at || poll.start_time || 0).getTime(),
      });
    });

    feedItems.sort((a, b) => b._sortDate - a._sortDate);
    return feedItems;
  }, [posts, poms, activePolls]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation Header */}
      <View style={styles.topBar}>
        {/* Left: Menu Drawer button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setDrawerVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu-outline" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>



        {/* Right Icons: Search Icon (opens suggestions & search), Notification, Profile */}
        <View style={styles.rightIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('MemberSearch')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="search-outline" size={23} color={Colors.textPrimary} />
          </TouchableOpacity>

          {isAuthenticated ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginPillBtn}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.85}
            >
              <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
              <Text style={styles.loginPillBtnText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Hover / Attention Banner on App Open */}
        {isAuthenticated && isNotSubscribed && !inFeedBannerDismissed ? (
          <TouchableOpacity
            style={styles.notifBannerAmber}
            activeOpacity={0.88}
            onPress={handleMembershipPayment}
          >
            <View style={styles.notifBannerRow}>
              <View style={styles.notifIconBadgeAmber}>
                <Ionicons name="card-outline" size={20} color="#b45309" />
              </View>
              <View style={styles.notifBannerContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifBannerTitleAmber}>Trust Membership Required</Text>
                  <View style={styles.notifHeaderRight}>
                    <View style={styles.actionPillAmber}>
                      <Text style={styles.actionPillAmberText}>₹100/mo</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.notifCardCloseBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setInFeedBannerDismissed(true);
                      }}
                    >
                      <Ionicons name="close" size={16} color="#92400e" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.notifBannerDescAmber}>
                  You have not activated your monthly membership yet. Activate now to unlock your digital ID card, member voting, and full benefits.
                </Text>
                <View style={styles.notifBannerActionRow}>
                  <Text style={styles.notifBannerActionAmber}>Activate Membership Now</Text>
                  <Ionicons name="arrow-forward" size={13} color="#b45309" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : (isAuthenticated && isExpiringSoon && !inFeedBannerDismissed) ? (
          <TouchableOpacity
            style={styles.notifBannerOrange}
            activeOpacity={0.88}
            onPress={handleMembershipPayment}
          >
            <View style={styles.notifBannerRow}>
              <View style={styles.notifIconBadgeOrange}>
                <Ionicons name="time-outline" size={20} color="#c2410c" />
              </View>
              <View style={styles.notifBannerContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifBannerTitleOrange}>Membership Expiring Soon</Text>
                  <View style={styles.notifHeaderRight}>
                    <View style={styles.actionPillOrange}>
                      <Text style={styles.actionPillOrangeText}>
                        {daysLeftToExpire === 0 ? 'Today' : (daysLeftToExpire + 'd left')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.notifCardCloseBtnOrange}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setInFeedBannerDismissed(true);
                      }}
                    >
                      <Ionicons name="close" size={16} color="#c2410c" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.notifBannerDescOrange}>
                  Your Trust membership expires {daysLeftToExpire === 0 ? 'today' : daysLeftToExpire === 1 ? 'in 1 day' : ('in ' + daysLeftToExpire + ' days')} ({validUpto}). Please update your payment to maintain active privileges.
                </Text>
                <View style={styles.notifBannerActionRow}>
                  <Text style={styles.notifBannerActionOrange}>Renew Payment (₹{monthlyFee}/mo)</Text>
                  <Ionicons name="arrow-forward" size={13} color="#c2410c" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : (isAuthenticated && isExpired && !inFeedBannerDismissed) ? (
          <TouchableOpacity
            style={styles.notifBannerRed}
            activeOpacity={0.88}
            onPress={handleMembershipPayment}
          >
            <View style={styles.notifBannerRow}>
              <View style={styles.notifIconBadgeRed}>
                <Ionicons name="warning-outline" size={20} color="#b91c1c" />
              </View>
              <View style={styles.notifBannerContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifBannerTitleRed}>Membership Expired</Text>
                  <View style={styles.notifHeaderRight}>
                    <View style={styles.actionPillRed}>
                      <Text style={styles.actionPillRedText}>EXPIRED</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.notifCardCloseBtnRed}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setInFeedBannerDismissed(true);
                      }}
                    >
                      <Ionicons name="close" size={16} color="#b91c1c" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.notifBannerDescRed}>
                  Your membership expired on {validUpto || 'recently'}. Please renew your payment to restore your digital card & member benefits.
                </Text>
                <View style={styles.notifBannerActionRow}>
                  <Text style={styles.notifBannerActionRed}>Renew Membership (₹{monthlyFee}/mo)</Text>
                  <Ionicons name="arrow-forward" size={13} color="#b91c1c" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Active Member Profile Stories (Instagram-Style) */}
        <View style={styles.storiesContainerWrap}>
          {storyMembers.length > 0 && (
            <View style={styles.storiesSection}>
              <FlatList
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                data={storyMembers}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderStoryItem}
                contentContainerStyle={styles.storiesListContent}
              />
            </View>
          )}

          {/* Floating 2-minute reminder notification over circle profile stories (auto-disappears in 2s, has X button) */}
          {showFloatingReminder && isAuthenticated && isNotSubscribed && (
            <View style={styles.storiesOverlayNotification}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.floatingReminderCard}
                onPress={handleMembershipPayment}
              >
                <View style={styles.floatingReminderIconWrap}>
                  <Ionicons name="card-outline" size={18} color="#b45309" />
                </View>
                <View style={styles.floatingReminderTextWrap}>
                  <View style={styles.floatingReminderTitleRow}>
                    <Text style={styles.floatingReminderTitle}>Trust Membership Required</Text>
                    <View style={styles.floatingPill}>
                      <Text style={styles.floatingPillText}>₹100/mo</Text>
                    </View>
                  </View>
                  <Text style={styles.floatingReminderSubtitle} numberOfLines={1}>
                    Activate now to unlock your digital ID card & benefits
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.floatingCloseBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowFloatingReminder(false);
                  }}
                >
                  <Ionicons name="close" size={16} color="#78350f" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Unified Chronological Feed (Member Posts, Trust Appeals, Polls in Posting Order) ── */}
        {postsLoading && combinedFeed.length === 0 ? (
          <View style={styles.loadingFeedCard}>
            <Text style={styles.loadingFeedText}>Loading community feed...</Text>
          </View>
        ) : combinedFeed.length === 0 ? (
          <View style={styles.emptyFeedCard}>
            <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyFeedTitle}>No Community Posts Yet</Text>
            <Text style={styles.emptyFeedSub}>
              Be the first to share an issue, illness, or need assistance.
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={handleCreatePost}
            >
              <Text style={styles.emptyCreateBtnText}>+ Share Problem</Text>
            </TouchableOpacity>
          </View>
        ) : (
          combinedFeed.map((item) => {
            if (item.feedType === 'POM') {
              return (
                <PomPosterCard
                  key={`pom-${item.id}`}
                  item={item}
                  onResponseSuccess={fetchPoms}
                />
              );
            }
            if (item.feedType === 'POLL') {
              return (
                <PollCard
                  key={`poll-${item.id}`}
                  poll={item}
                  isAuthenticated={isAuthenticated}
                  navigation={navigation}
                  onVoteSuccess={handleVoteSuccess}
                />
              );
            }
            return (
              <PostCard
                key={`post-${item.id}`}
                post={item}
                currentUserId={user?.id}
                onOpenComments={(id) => {
                  setSelectedPostId(id);
                  setCommentsModalVisible(true);
                }}
                onPostDeleted={(deletedId) => {
                  setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                }}
              />
            );
          })
        )}

        {/* Upcoming Events Section (Placed below community feed) */}
        <View style={[styles.sectionHeader, { marginTop: 22, paddingTop: 14, marginBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => navigation.navigate('Events')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={13} color="#0284c7" />
          </TouchableOpacity>
        </View>

        <EventBanner
          events={upcomingEvents}
          navigation={navigation}
          autoPlayInterval={4000}
        />
      </ScrollView>

      {/* Comments Bottom Sheet Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentAdded={() => {
          fetchPosts();
        }}
      />

      {/* Side Drawer Component */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="Home"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Hover / Attention Banner Styles
  notifBannerAmber: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  notifBannerOrange: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fdba74',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  notifBannerRed: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  notifBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notifIconBadgeAmber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIconBadgeOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIconBadgeRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBannerContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  notifBannerTitleAmber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  notifBannerTitleOrange: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  notifBannerTitleRed: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991b1b',
  },
  actionPillAmber: {
    backgroundColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  actionPillAmberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  actionPillOrange: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  actionPillOrangeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  actionPillRed: {
    backgroundColor: '#fecaca',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  actionPillRedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c',
  },
  notifBannerDescAmber: {
    fontSize: 11,
    color: '#78350f',
    lineHeight: 16,
    marginBottom: 6,
  },
  notifBannerDescOrange: {
    fontSize: 11,
    color: '#7c2d12',
    lineHeight: 16,
    marginBottom: 6,
  },
  notifBannerDescRed: {
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 16,
    marginBottom: 6,
  },
  notifBannerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notifBannerActionAmber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  notifBannerActionOrange: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c2410c',
  },
  notifBannerActionRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
  },
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    position: 'relative',
    height: 56,
  },
  centerBrandContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  headerBrandSub: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  iconBtn: { padding: 4 },
  brandTitleContainer: { alignItems: 'center' },
  brandTitle: { fontSize: 13, fontWeight: '900', color: '#0284c7', letterSpacing: 1 },
  brandSub: { fontSize: 9, fontWeight: '700', color: Colors.gray600, letterSpacing: 0.5 },
    loginPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0284c7',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  loginPillBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarBtn: { padding: 2 },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
  },

  scroll: { padding: 16, gap: 16 },

  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  greetingTitle: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  memberName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginVertical: 2 },
  greetingMessage: { fontSize: 12, color: Colors.gray600, marginTop: 4, lineHeight: 16 },
  weatherIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  membershipCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  donateHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  donateHeroLeft: { flex: 1 },
  donateHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  donateHeroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  donateHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  donateHeroDesc: {
    fontSize: 12,
    color: Colors.gray600,
    lineHeight: 17,
    marginBottom: 12,
  },
  donateHeroBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  donateBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  donateBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  donateBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  donateBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  trustLogoTitle: { fontSize: 7, fontWeight: '900', color: '#0284c7' },
  trustLogoSub: { fontSize: 5, fontWeight: '700', color: Colors.gray600 },
  memberIdContainer: { alignItems: 'flex-end' },
  memberIdLabel: { fontSize: 8, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '700' },
  memberIdValue: { fontSize: 12, fontWeight: '800', color: Colors.white },

  cardCenter: { alignItems: 'center', marginVertical: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: Colors.white, letterSpacing: 2 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerLabel: { fontSize: 9, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' },
  footerValue: { fontSize: 13, fontWeight: '800', color: Colors.white, marginTop: 1 },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 11, color: Colors.gray500, leading: 14 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  viewAllText: { fontSize: 12.5, fontWeight: '700', color: '#0284c7' },

  eventCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  eventThumb: { width: 90, height: 80, borderRadius: 10 },
  eventInfo: { flex: 1, justifyContent: 'center' },
  eventCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  eventCardDesc: { fontSize: 11, color: Colors.gray500, marginBottom: 8 },
  eventMetaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventMetaText: { fontSize: 10, color: Colors.gray500, fontWeight: '500' },

  pollsSectionContainer: {
    marginBottom: 8,
  },
  pollsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 6,
  },
  pollsSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pollIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifCardCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCardCloseBtnOrange: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCardCloseBtnRed: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesContainerWrap: {
    position: 'relative',
  },
  storiesOverlayNotification: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    zIndex: 99,
    elevation: 8,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  floatingReminderCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },
  floatingReminderIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingReminderTextWrap: {
    flex: 1,
  },
  floatingReminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingReminderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
  },
  floatingPill: {
    backgroundColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  floatingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  floatingReminderSubtitle: {
    fontSize: 11,
    color: '#78350f',
    marginTop: 1,
  },
  floatingCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  storiesSection: {
    marginHorizontal: -16,
    marginBottom: 4,
  },
  storiesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  storyItemWrap: {
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingGradient: {
    width: 78,
    height: 78,
    borderRadius: 39,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  storyImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  storyFallbackAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyFallbackText: {
    color: '#0284c7',
    fontSize: 22,
    fontWeight: '700',
  },
  loadingFeedCard: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingFeedText: {
    fontSize: 12,
    color: Colors.gray500,
  },
  emptyFeedCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.gray100,
    gap: 6,
    marginBottom: 20,
  },
  emptyFeedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  emptyFeedSub: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyCreateBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  emptyCreateBtnText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default MemberHomeScreen;
