import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { memberPostsApi } from '../../api';
import { KERALA_DISTRICTS } from '../../utils/location';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';

export default function CreatePostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0
  );
  const headerPaddingTop = topInset > 0 ? topInset + 10 : (Platform.OS === 'ios' ? 50 : 36);

  const { user } = useAuthStore();
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePickPhotos = async () => {
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

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please describe the problem or assistance needed.' });
      return;
    }

    if (!address.trim()) {
      Toast.show({ type: 'error', text1: 'Address Required', text2: 'Please provide your location or address.' });
      return;
    }

    setLoading(true);
    try {
      await memberPostsApi.create({
        description: description.trim(),
        contact_number: contactNumber.trim(),
        address: address.trim(),
        images: photos,
      });

      Toast.show({
        type: 'success',
        text1: 'Problem Posted',
        text2: 'Your post is now visible to members & routed to the verification team.',
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
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={26} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Problem / Need</Text>
        <TouchableOpacity
          style={[styles.postHeaderBtn, (!description.trim() || !address.trim() || loading) && styles.postHeaderBtnDisabled]}
          onPress={handleSubmit}
          disabled={!description.trim() || !address.trim() || loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postHeaderBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284c7" />
          <Text style={styles.infoBannerText}>
            Share hardships or issues you or someone in your community are facing. Your post is visible to all members and routed to Trust officers.
          </Text>
        </View>

        {/* User Profile Info Tag */}
        <View style={styles.authorRow}>
          {user?.avatar || user?.photo ? (
            <Image source={{ uri: user.avatar || user.photo }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.authorAvatarPlaceholder}>
              <Text style={styles.authorAvatarText}>{(user?.full_name || user?.username || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.authorName}>{user?.full_name || user?.username || 'Community Member'}</Text>
            <Text style={styles.postingPubliclyText}>Posting to Community Feed</Text>
          </View>
        </View>

        {/* Problem Description Input */}
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

        {/* Photos Section (Up to 10) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos ({photos.length}/10)</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 photos of the problem</Text>
        </View>

        <View style={styles.photosGrid}>
          {/* Add Photos Button */}
          {photos.length < 10 && (
            <TouchableOpacity style={styles.addPhotoCard} onPress={handlePickPhotos} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={28} color="#0284c7" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
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
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 6 }}>
            Select District (Kerala):
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}
          >
            {KERALA_DISTRICTS.map((d) => {
              const isSelected = address.toLowerCase().includes(d.toLowerCase());
              return (
                <TouchableOpacity
                  key={d}
                  style={{
                    backgroundColor: isSelected ? '#0284c7' : '#EFF6FF',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? '#0284c7' : '#BFDBFE',
                  }}
                  onPress={() => {
                    setAddress(`${d}, Kerala`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isSelected ? '#ffffff' : '#0284c7',
                    }}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.fieldInputRow}>
            <Ionicons name="location-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.fieldInput}
              placeholder="House name, locality, village/town, district"
              placeholderTextColor="#94A3B8"
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        {/* Bottom Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, (!description.trim() || !address.trim() || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!description.trim() || !address.trim() || loading}
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
      </ScrollView>
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
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  postHeaderBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 6,
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
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  authorAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  authorAvatarText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  postingPubliclyText: {
    fontSize: 11,
    color: '#64748B',
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#0F172A',
    minHeight: 100,
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
    fontSize: 11,
    color: '#64748B',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  addPhotoCard: {
    width: 78,
    height: 78,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderStyle: 'dashed',
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  photoThumbWrap: {
    width: 78,
    height: 78,
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
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
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
    fontSize: 15,
    fontWeight: '700',
  },
});
