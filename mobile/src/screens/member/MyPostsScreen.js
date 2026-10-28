import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { memberPostsApi } from '../../api';
import { INDIAN_STATES, getDistrictsForState, parseAddress, formatAddress } from '../../utils/location';
import { OptionPickerModal } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import PostCard from '../../components/feed/PostCard';
import CommentsModal from '../../components/feed/CommentsModal';
import Toast from 'react-native-toast-message';

export default function MyPostsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0
  );
  const headerPaddingTop = topInset > 0 ? topInset + 10 : (Platform.OS === 'ios' ? 50 : 36);

  const { user, isAuthenticated } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comments state
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // Edit Modal state
  const [editingPost, setEditingPost] = useState(null);
  const [editPostType, setEditPostType] = useState('AWARENESS');
  const [editDesc, setEditDesc] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editState, setEditState] = useState('Kerala');
  const [editDistrict, setEditDistrict] = useState('Kozhikode');
  const [editLocality, setEditLocality] = useState('');
  const [editPickerModal, setEditPickerModal] = useState({ visible: false, type: null });
  const [editSaving, setEditSaving] = useState(false);

  const fetchMyPosts = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await memberPostsApi.list({ my_posts: true });
      const results = res.data?.results || res.data || [];
      setPosts(results);
    } catch (_) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not load your posts. Please try again.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyPosts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyPosts();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyPosts();
  }, []);

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditPostType(post.post_type || 'AWARENESS');
    setEditDesc(post.description || '');
    setEditContact(post.contact_number || '');
    const parsed = parseAddress(post.address);
    setEditState(parsed.state || 'Kerala');
    setEditDistrict(parsed.district || 'Kozhikode');
    setEditLocality(parsed.locality || '');
  };

  const handleSaveEdit = async () => {
    if (!editDesc.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Description cannot be empty.' });
      return;
    }

    if (!editState || !editDistrict) {
      Toast.show({ type: 'error', text1: 'Location Required', text2: 'Please select state and district.' });
      return;
    }

    const fullAddress = formatAddress(editLocality, editDistrict, editState);

    setEditSaving(true);
    try {
      const res = await memberPostsApi.update(editingPost.id, {
        post_type: editPostType,
        description: editDesc.trim(),
        contact_number: editContact.trim(),
        address: fullAddress,
      });

      // Update post in local state
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, ...res.data } : p))
      );

      Toast.show({ type: 'success', text1: 'Updated', text2: 'Your post was updated successfully.' });
      setEditingPost(null);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: err.response?.data?.error || 'Could not update post.',
      });
    } finally {
      setEditSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

        {/* Top Header Bar */}
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>My Posts</Text>
            <Text style={styles.headerSubtitle}>
              Problems & help requests submitted by you
            </Text>
          </View>
        </View>

        {/* Centered Guest Card */}
        <View style={styles.guestBody}>
          <View style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <Ionicons name="newspaper-outline" size={40} color="#0284c7" />
            </View>

            <View style={styles.trustBadge}>
              <Text style={styles.trustBadgeText}>SREE LAKSHMI CHARITABLE TRUST</Text>
            </View>

            <Text style={styles.guestTitle}>Member Posts & Requests</Text>
            
            <Text style={styles.guestSubtitle}>
              Sign in as a registered member to post community issues, request assistance for medical or educational needs, and track your posts.
            </Text>

            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Auth')}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
              <Text style={styles.guestPrimaryBtnText}>Login to Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Signup')}
            >
              <Ionicons name="person-add-outline" size={18} color="#0284c7" />
              <Text style={styles.guestSecondaryBtnText}>Sign Up as Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>My Posts</Text>
          <Text style={styles.headerSubtitle}>
            Problems & help requests submitted by you
          </Text>
        </View>

        {/* Top Right: Post New Post Button */}
        <TouchableOpacity
          style={styles.newPostBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newPostBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      {/* Posts Feed ScrollView */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0284c7"
            colors={['#0284c7']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={styles.loadingText}>Loading your posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={38} color="#0284c7" />
            </View>
            <Text style={styles.emptyTitle}>You Haven't Posted Anything Yet</Text>
            <Text style={styles.emptySub}>
              Share problems, hardships, or assistance needed by you or people in your community.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CreatePost')}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.emptyActionBtnText}>Post a Problem Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onOpenComments={(id) => {
                setSelectedPostId(id);
                setCommentsModalVisible(true);
              }}
              onPostDeleted={(deletedId) => {
                setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                Toast.show({ type: 'success', text1: 'Post Deleted', text2: 'Your post was successfully deleted.' });
              }}
              onEditPost={handleOpenEdit}
            />
          ))
        )}
      </ScrollView>

      {/* Edit Post Modal */}
      <Modal
        visible={Boolean(editingPost)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity
                onPress={() => setEditingPost(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Post Type Selector */}
              <Text style={styles.fieldLabel}>Post Type *</Text>
              <View style={styles.editTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.editTypeBtn,
                    editPostType === 'AWARENESS' && styles.editTypeBtnActiveAwareness,
                  ]}
                  onPress={() => setEditPostType('AWARENESS')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="megaphone"
                    size={16}
                    color={editPostType === 'AWARENESS' ? '#FFFFFF' : '#0284c7'}
                  />
                  <Text
                    style={[
                      styles.editTypeBtnText,
                      editPostType === 'AWARENESS' && styles.editTypeBtnTextActive,
                    ]}
                  >
                    Awareness
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.editTypeBtn,
                    editPostType === 'CHARITY' && styles.editTypeBtnActiveCharity,
                  ]}
                  onPress={() => setEditPostType('CHARITY')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="heart"
                    size={16}
                    color={editPostType === 'CHARITY' ? '#FFFFFF' : '#EF4444'}
                  />
                  <Text
                    style={[
                      styles.editTypeBtnText,
                      editPostType === 'CHARITY' && styles.editTypeBtnTextActive,
                    ]}
                  >
                    Charity
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Description Input */}
              <Text style={styles.fieldLabel}>Problem Description *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Describe the issue or need..."
                placeholderTextColor="#94A3B8"
              />

              {/* Contact Phone */}
              <Text style={styles.fieldLabel}>Contact Number</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                value={editContact}
                onChangeText={setEditContact}
                placeholder="e.g. 9947703037"
                placeholderTextColor="#94A3B8"
              />

              {/* Address */}
              <Text style={styles.fieldLabel}>
                Location / Address <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>

              {/* State & District Dropdown Selectors */}
              <View style={styles.locationDropdownRow}>
                {/* State Dropdown */}
                <View style={styles.locationDropdownCol}>
                  <Text style={styles.dropdownMiniLabel}>State</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelectorBtn}
                    onPress={() => setEditPickerModal({ visible: true, type: 'state' })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="map-outline" size={16} color="#0284c7" style={styles.dropdownIcon} />
                    <Text style={styles.dropdownValueText} numberOfLines={1}>
                      {editState}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* District Dropdown */}
                <View style={styles.locationDropdownCol}>
                  <Text style={styles.dropdownMiniLabel}>District</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelectorBtn}
                    onPress={() => setEditPickerModal({ visible: true, type: 'district' })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={16} color="#0284c7" style={styles.dropdownIcon} />
                    <Text style={styles.dropdownValueText} numberOfLines={1}>
                      {editDistrict}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={[styles.textInput, { marginTop: 10 }]}
                value={editLocality}
                onChangeText={setEditLocality}
                placeholder="House, street, village/town (optional)"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingPost(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, (!editDesc.trim() || !editState || !editDistrict || editSaving) && { opacity: 0.5 }]}
                onPress={handleSaveEdit}
                disabled={!editDesc.trim() || !editState || !editDistrict || editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* State & District Dropdown Picker for Edit Modal */}
      <OptionPickerModal
        visible={editPickerModal.visible}
        onClose={() => setEditPickerModal({ visible: false, type: null })}
        title={editPickerModal.type === 'state' ? 'Select State' : `Select District (${editState})`}
        options={editPickerModal.type === 'state' ? INDIAN_STATES : getDistrictsForState(editState)}
        selectedValue={editPickerModal.type === 'state' ? editState : editDistrict}
        onSelect={(val) => {
          if (editPickerModal.type === 'state') {
            setEditState(val);
            const dists = getDistrictsForState(val);
            if (!dists.includes(editDistrict)) {
              setEditDistrict(dists[0] || '');
            }
          } else {
            setEditDistrict(val);
          }
        }}
        searchPlaceholder={editPickerModal.type === 'state' ? 'Search Indian state...' : 'Search district...'}
        iconName={editPickerModal.type === 'state' ? 'map-outline' : 'location-outline'}
      />

      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentAdded={fetchMyPosts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  newPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  newPostBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  editTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  editTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  editTypeBtnActiveAwareness: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  editTypeBtnActiveCharity: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  editTypeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  editTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0284c7',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  locationDropdownRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  locationDropdownCol: {
    flex: 1,
  },
  dropdownMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownIcon: {
    marginRight: 6,
  },
  dropdownValueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  // Guest State Styles
  guestBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  guestCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  guestIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trustBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  trustBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  guestPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  guestPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  guestSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    marginTop: 10,
  },
  guestSecondaryBtnText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
});