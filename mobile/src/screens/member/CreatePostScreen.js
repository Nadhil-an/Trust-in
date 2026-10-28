import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { memberPostsApi } from '../../api';
import { INDIAN_STATES, getDistrictsForState, formatAddress } from '../../utils/location';
import { OptionPickerModal } from '../../components/shared';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

export default function CreatePostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0
  );
  const headerPaddingTop = topInset > 0 ? topInset + 10 : (Platform.OS === 'ios' ? 50 : 36);

  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Auth');
    }
  }, [isAuthenticated]);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [postType, setPostType] = useState('AWARENESS');
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState(user?.phone || '');
  const [selectedState, setSelectedState] = useState('Kerala');
  const [selectedDistrict, setSelectedDistrict] = useState('Kozhikode');
  const [locality, setLocality] = useState('');
  const [pickerModal, setPickerModal] = useState({ visible: false, type: null });
  const [photos, setPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelectState = (newState) => {
    setSelectedState(newState);
    const districts = getDistrictsForState(newState);
    if (!districts.includes(selectedDistrict)) {
      setSelectedDistrict(districts[0] || '');
    }
  };

  const handleSelectDistrict = (newDistrict) => {
    setSelectedDistrict(newDistrict);
  };

  const handleTakePhoto = async () => {
    setMediaModalVisible(false);
    if (photos.length >= 10) {
      Alert.alert('Maximum Reached', 'You can upload a maximum of 10 photos.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, result.assets[0]]);
    }
  };

  const handlePickGalleryPhotos = async () => {
    setMediaModalVisible(false);
    if (photos.length >= 10) {
      Alert.alert('Maximum Reached', 'You can upload a maximum of 10 photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is needed to upload photos.');
      return;
    }
    const remainingLimit = 10 - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingLimit,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.slice(0, remainingLimit);
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const handleRecordVideo = async () => {
    setMediaModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to record video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const durationSec = (asset.duration || 0) > 100 ? (asset.duration / 1000) : asset.duration;
      if (durationSec > 31) {
        Alert.alert('Video Too Long', 'Video length must be 30 seconds or less.');
        return;
      }
      setVideo(asset);
      Toast.show({ type: 'success', text1: 'Video Attached', text2: 'Video clip attached (max 30s).' });
    }
  };

  const handlePickGalleryVideo = async () => {
    setMediaModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is needed to select videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const durationSec = (asset.duration || 0) > 100 ? (asset.duration / 1000) : asset.duration;
      if (durationSec > 31) {
        Alert.alert('Video Too Long', 'Video length must be 30 seconds or less.');
        return;
      }
      setVideo(asset);
      Toast.show({ type: 'success', text1: 'Video Attached', text2: 'Video clip attached (max 30s).' });
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please describe the problem or assistance needed.' });
      return;
    }

    if (!selectedDistrict || !selectedState) {
      Toast.show({ type: 'error', text1: 'Location Required', text2: 'Please select both state and district.' });
      return;
    }

    const fullAddress = formatAddress(locality, selectedDistrict, selectedState);

    setLoading(true);
    try {
      await memberPostsApi.create({
        post_type: postType,
        description: description.trim(),
        contact_number: contactNumber.trim(),
        address: fullAddress,
        images: photos,
        video: video,
      });

      Toast.show({
        type: 'success',
        text1: 'Submitted for Moderation',
        text2: 'Your post will be published to the mobile application once approved by the Social Media team.',
      });
      navigation.goBack();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: err.response?.data?.error || 'Could not submit your post. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle} numberOfLines={1}>Share Problem / Need</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.postHeaderBtn, (!description.trim() || !selectedState || !selectedDistrict || loading) && styles.postHeaderBtnDisabled]}
            onPress={handleSubmit}
            disabled={!description.trim() || !selectedState || !selectedDistrict || loading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postHeaderBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
        extraHeight={100}
        enableResetScrollToCoords={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner with small 'x' button to hide */}
        {showInfoBanner && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#0284c7" style={{ marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Share hardships or issues you or someone in your community are facing. Your post is visible to all members and routed to Trust officers.
            </Text>
            <TouchableOpacity
              style={styles.closeBannerBtn}
              onPress={() => setShowInfoBanner(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#0284c7" />
            </TouchableOpacity>
          </View>
        )}

        {/* User Profile Info Tag */}
        <View style={styles.authorRow}>
          {user?.avatar || user?.photo ? (
            <Image source={{ uri: user.avatar || user.photo }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.authorAvatarPlaceholder}>
              <Text style={styles.authorAvatarText}>{(user?.full_name || user?.username || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{user?.full_name || user?.username || 'Community Member'}</Text>
            <Text style={styles.postingPubliclyText}>Posting to Community Feed</Text>
          </View>
        </View>

        {/* 1. Upload Photos & Video Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Photos & Video ({photos.length + (video ? 1 : 0)}/10)
          </Text>
          <Text style={styles.sectionSubtitle}>
            Add photos from camera/gallery or video clip (max 30s)
          </Text>
        </View>

        {/* Selected Video Preview Card if video chosen */}
        {Boolean(video) && (
          <View style={styles.videoPreviewCard}>
            <View style={styles.videoPreviewIconWrap}>
              <Ionicons name="videocam" size={24} color="#0284c7" />
            </View>
            <View style={styles.videoPreviewInfo}>
              <Text style={styles.videoPreviewTitle} numberOfLines={1}>
                {video.fileName || 'Video Clip (≤30s)'}
              </Text>
              <Text style={styles.videoPreviewSub}>
                Max 30 seconds • Video attached
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeVideoBtn}
              onPress={() => setVideo(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Media Grid / Empty Zone */}
        {photos.length === 0 && !video ? (
          <TouchableOpacity
            style={styles.emptyMediaUploadZone}
            onPress={() => setMediaModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.emptyMediaIconCircle}>
              <Ionicons name="camera-outline" size={24} color="#0284c7" />
            </View>
            <View style={styles.emptyMediaTextWrap}>
              <Text style={styles.emptyMediaTitle}>Add Photos or Video</Text>
              <Text style={styles.emptyMediaSub}>Tap to capture or choose from gallery (max 10 photos, 30s video)</Text>
            </View>
            <Ionicons name="add-circle" size={22} color="#0284c7" />
          </TouchableOpacity>
        ) : (
          <View style={styles.photosGrid}>
            {/* Add More Media Button */}
            {photos.length < 10 && !video && (
              <TouchableOpacity
                style={styles.addMorePhotoCard}
                onPress={() => setMediaModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={26} color="#0284c7" />
                <Text style={styles.addMorePhotoText}>Add More</Text>
              </TouchableOpacity>
            )}

            {/* Selected Photos Reel */}
            {photos.map((item, index) => (
              <View key={index} style={styles.photoThumbWrap}>
                <Image source={{ uri: item.uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => handleRemovePhoto(index)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
                <View style={styles.photoIndexBadge}>
                  <Text style={styles.photoIndexText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 2. Problem Description Input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Describe the issue, illness, hardship, or help needed in detail..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={5}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* 3. Post Category / Type Selector (Awareness vs Charity) */}
        <View style={styles.typeSelectorCard}>
          <Text style={styles.typeSelectorLabel}>
            Post Category / Type <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View style={styles.typeButtonsRow}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                postType === 'AWARENESS' && styles.typeBtnActiveAwareness,
              ]}
              onPress={() => setPostType('AWARENESS')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="megaphone"
                size={18}
                color={postType === 'AWARENESS' ? '#FFFFFF' : '#0284c7'}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  postType === 'AWARENESS' && styles.typeBtnTextActive,
                ]}
              >
                Awareness
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                postType === 'CHARITY' && styles.typeBtnActiveCharity,
              ]}
              onPress={() => setPostType('CHARITY')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="heart"
                size={18}
                color={postType === 'CHARITY' ? '#FFFFFF' : '#EF4444'}
              />
              <Text
                style={[
                  styles.typeBtnText,
                  postType === 'CHARITY' && styles.typeBtnTextActive,
                ]}
              >
                Charity
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[
            styles.typeHelperBanner,
            postType === 'CHARITY' ? styles.typeHelperBannerCharity : styles.typeHelperBannerAwareness
          ]}>
            <Ionicons
              name={postType === 'CHARITY' ? 'heart-circle' : 'information-circle'}
              size={18}
              color={postType === 'CHARITY' ? '#E11D48' : '#0284c7'}
            />
            <Text style={[
              styles.typeHelperText,
              postType === 'CHARITY' ? { color: '#9F1239' } : { color: '#0369A1' }
            ]}>
              {postType === 'CHARITY'
                ? 'Charity: Adds a "Donate Now" button directly on the post so members can contribute financially.'
                : 'Awareness: Shared with the community to raise awareness about social issues or general updates.'}
            </Text>
          </View>
        </View>

        {/* Contact Number */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Contact Phone Number</Text>
          <View style={styles.fieldInputRow}>
            <Ionicons name="call-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Phone number to contact"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={contactNumber}
              onChangeText={setContactNumber}
            />
          </View>
        </View>

        {/* Address / Location */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>
            Location / Address <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>

          {/* Separate State and District Dropdown Selectors */}
          <View style={styles.locationDropdownRow}>
            {/* State Input Dropdown */}
            <View style={styles.locationDropdownCol}>
              <Text style={styles.dropdownMiniLabel}>State</Text>
              <TouchableOpacity
                style={styles.dropdownSelectorBtn}
                onPress={() => setPickerModal({ visible: true, type: 'state' })}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={16} color="#0284c7" style={styles.dropdownIcon} />
                <Text style={styles.dropdownValueText} numberOfLines={1}>
                  {selectedState}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* District Input Dropdown */}
            <View style={styles.locationDropdownCol}>
              <Text style={styles.dropdownMiniLabel}>District</Text>
              <TouchableOpacity
                style={styles.dropdownSelectorBtn}
                onPress={() => setPickerModal({ visible: true, type: 'district' })}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={16} color="#0284c7" style={styles.dropdownIcon} />
                <Text style={styles.dropdownValueText} numberOfLines={1}>
                  {selectedDistrict}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Specific Locality / House / Street Input */}
          <View style={[styles.fieldInputRow, { marginTop: 10 }]}>
            <Ionicons name="home-outline" size={17} color="#64748B" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.fieldInput}
              placeholder="House name, locality, street / village (optional)"
              placeholderTextColor="#94A3B8"
              value={locality}
              onChangeText={setLocality}
            />
          </View>
        </View>

        {/* Bottom Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, (!description.trim() || !selectedState || !selectedDistrict || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!description.trim() || !selectedState || !selectedDistrict || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Post Community Issue</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* State & District Dropdown Bottom Sheet Modal */}
      <OptionPickerModal
        visible={pickerModal.visible}
        onClose={() => setPickerModal({ visible: false, type: null })}
        title={pickerModal.type === 'state' ? 'Select State' : `Select District (${selectedState})`}
        options={pickerModal.type === 'state' ? INDIAN_STATES : getDistrictsForState(selectedState)}
        selectedValue={pickerModal.type === 'state' ? selectedState : selectedDistrict}
        onSelect={pickerModal.type === 'state' ? handleSelectState : handleSelectDistrict}
        searchPlaceholder={pickerModal.type === 'state' ? 'Search Indian state...' : 'Search district...'}
        iconName={pickerModal.type === 'state' ? 'map-outline' : 'location-outline'}
      />

      {/* ── Media Source Picker Modal (Camera, Gallery, 30s Video) ── */}
      <Modal
        visible={mediaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMediaModalVisible(false)}
        >
          <View style={styles.mediaSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Photos / Video</Text>
            <Text style={styles.sheetSub}>Upload images or clip up to 30 seconds</Text>

            <TouchableOpacity style={styles.sheetOption} onPress={handleTakePhoto} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="camera" size={22} color="#0284c7" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Take Photo</Text>
                <Text style={styles.sheetOptionDesc}>Capture with camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handlePickGalleryPhotos} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="images" size={22} color="#16A34A" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.sheetOptionDesc}>Select photos from library</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handleRecordVideo} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="videocam" size={22} color="#EF4444" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Record Video (Max 30s)</Text>
                <Text style={styles.sheetOptionDesc}>Record video up to 30 seconds</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handlePickGalleryVideo} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="film" size={22} color="#9333EA" />
              </View>
              <View style={styles.sheetOptionTextCol}>
                <Text style={styles.sheetOptionTitle}>Choose Video from Gallery (Max 30s)</Text>
                <Text style={styles.sheetOptionDesc}>Select a clip under 30 seconds</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setMediaModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  postHeaderBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  postHeaderBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  postHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18,
  },
  closeBannerBtn: {
    padding: 2,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  authorAvatarText: {
    color: '#0284c7',
    fontSize: 16,
    fontWeight: '700',
  },
  authorName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  postingPubliclyText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  typeSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  typeSelectorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  typeButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  typeBtnActiveAwareness: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typeBtnActiveCharity: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
  },
  typeHelperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeHelperBannerAwareness: {
    backgroundColor: '#F0F9FF',
  },
  typeHelperBannerCharity: {
    backgroundColor: '#FFF1F2',
  },
  typeHelperText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 20,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#0F172A',
    minHeight: 110,
    lineHeight: 22,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  emptyMediaUploadZone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  emptyMediaIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emptyMediaTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  emptyMediaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyMediaSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  addMorePhotoCard: {
    width: 82,
    height: 82,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderStyle: 'dashed',
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addMorePhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  photoThumbWrap: {
    width: 82,
    height: 82,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  photoIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoIndexText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 48,
    paddingHorizontal: 12,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0284c7',
    height: 50,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15.5,
    fontWeight: '700',
  },
  locationDropdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  locationDropdownCol: {
    flex: 1,
  },
  dropdownMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  dropdownIcon: {
    marginRight: 8,
  },
  dropdownValueText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  videoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  videoPreviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewInfo: {
    flex: 1,
  },
  videoPreviewTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  videoPreviewSub: {
    fontSize: 11.5,
    color: '#0284c7',
    marginTop: 2,
    fontWeight: '500',
  },
  removeVideoBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  mediaSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  sheetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sheetOptionTextCol: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});

