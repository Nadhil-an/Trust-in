import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { memberPostsApi } from '../../api';
import { resolveImageUrl } from '../../utils/imageUrl';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

export default function MemberSearchScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user: currentUser, isAuthenticated } = useAuthStore();

  const initialQuery = route?.params?.initialQuery || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [unfollowedSuggestions, setUnfollowedSuggestions] = useState([]);
  const [showAllUnfollowed, setShowAllUnfollowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [followingMap, setFollowingMap] = useState({});

  // 1. Fetch unfollowed members for suggestions
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await memberPostsApi.searchMembers({ unfollowed: true });
      const list = Array.isArray(res.data) ? res.data : [];
      setUnfollowedSuggestions(list);

      setFollowingMap((prev) => {
        const nextMap = { ...prev };
        list.forEach((m) => {
          if (nextMap[m.id] === undefined) {
            nextMap[m.id] = Boolean(m.is_following);
          }
        });
        return nextMap;
      });
    } catch (_) {
      setUnfollowedSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // 2. Fetch search results for text query
  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await memberPostsApi.searchMembers({ q: query.trim() });
      const list = Array.isArray(res.data) ? res.data : [];
      setSearchResults(list);

      setFollowingMap((prev) => {
        const nextMap = { ...prev };
        list.forEach((m) => {
          nextMap[m.id] = Boolean(m.is_following);
        });
        return nextMap;
      });
    } catch (_) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleToggleFollow = async (member) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    const currentStatus = Boolean(followingMap[member.id]);
    const nextStatus = !currentStatus;

    setFollowingMap((prev) => ({ ...prev, [member.id]: nextStatus }));

    try {
      const res = await memberPostsApi.toggleFollow(member.id);
      if (res.data) {
        setFollowingMap((prev) => ({ ...prev, [member.id]: Boolean(res.data.is_following) }));
      }
    } catch (_) {
      setFollowingMap((prev) => ({ ...prev, [member.id]: currentStatus }));
      Toast.show({ type: 'error', text1: 'Action failed', text2: 'Could not update follow status' });
    }
  };

  const isSearching = Boolean(searchQuery.trim());

  // Suggestions slice: either top 5 or all unfollowed members
  const displayedSuggestions = showAllUnfollowed
    ? unfollowedSuggestions
    : unfollowedSuggestions.slice(0, 5);

  const displayedList = isSearching ? searchResults : displayedSuggestions;

  const renderMemberItem = ({ item }) => {
    const isMe = currentUser && String(currentUser.id) === String(item.id);
    const photoUrl = resolveImageUrl(item.photo);
    const isFollowing = Boolean(followingMap[item.id]);

    return (
      <TouchableOpacity
        style={styles.memberRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('MemberProfile', { userId: item.id, user: item })}
      >
        <View style={styles.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {(item.full_name[0] || item.username[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.memberInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.fullNameText} numberOfLines={1}>
              {item.full_name || item.username}
            </Text>
            <Ionicons name="checkmark-circle" size={13} color="#0284c7" style={{ marginLeft: 3 }} />
          </View>
          <Text style={styles.usernameText} numberOfLines={1}>
            @{item.username} {item.district ? `• ${item.district}` : ''}
          </Text>
          <Text style={styles.statsSubText}>
            {item.followers_count || 0} followers • {item.posts_count || 0} posts
          </Text>
        </View>

        {!isMe && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => handleToggleFollow(item)}
            activeOpacity={0.8}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (isSearching) {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          <Text style={styles.sectionSub}>Matching "{searchQuery.trim()}"</Text>
        </View>
      );
    }

    return (
      <View style={styles.suggestionsHeaderBox}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="sparkles" size={16} color="#0284c7" />
            <Text style={styles.suggestionsTitle}>Suggested for you</Text>
          </View>
          <Text style={styles.suggestionsSubtitle}>
            {showAllUnfollowed
              ? `All accounts you don't follow yet (${unfollowedSuggestions.length})`
              : 'Popular accounts you might know'}
          </Text>
        </View>

        {unfollowedSuggestions.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => setShowAllUnfollowed(!showAllUnfollowed)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllBtnText}>
              {showAllUnfollowed ? 'Show 5' : 'View all'}
            </Text>
            <Ionicons
              name={showAllUnfollowed ? 'chevron-up' : 'chevron-forward'}
              size={14}
              color="#0284c7"
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />

      {/* ── Search Header Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#0284c7" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members by name or ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={true}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Members List / Suggestions ── */}
      {(loading && isSearching) || (loadingSuggestions && !isSearching && unfollowedSuggestions.length === 0) ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#0284c7" />
          <Text style={styles.loadingText}>
            {isSearching ? 'Searching community members...' : 'Loading suggestions...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMemberItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="person-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {isSearching ? 'No members found' : 'No suggestions available'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isSearching
                  ? 'Try searching with another name or member ID.'
                  : "You are currently following all available members!"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  listContent: {
    paddingVertical: 12,
    backgroundColor: '#F4F6F8',
  },
  suggestionsHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 6,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  suggestionsSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  usernameText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statsSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  followBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followingBtnText: {
    color: '#475569',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748B',
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
