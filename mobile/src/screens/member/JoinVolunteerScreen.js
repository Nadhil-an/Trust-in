import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { volunteersApi } from '../../api';
import { resolveImageUrl } from '../../utils/imageUrl';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function JoinVolunteerScreen({ navigation }) {
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applicationData, setApplicationData] = useState(null);

  // Form Fields
  const [fullName, setFullName] = useState(user?.full_name || user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [dob, setDob] = useState(user?.date_of_birth || '');
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || 'O+');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState(user?.address || '');
  const [addressProof, setAddressProof] = useState(null); // { uri, name, type }
  const [photo, setPhoto] = useState(null); // { uri, name, type }

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await volunteersApi.myStatus();
      if (res.data) {
        setApplicationData(res.data);
      }
    } catch (err) {
      console.log('Error fetching volunteer status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  useEffect(() => {
    if (user) {
      if (!fullName) setFullName(user.full_name || user.username || '');
      if (!phone) setPhone(user.phone || '');
      if (!email) setEmail(user.email || '');
      if (!dob && user.date_of_birth) setDob(user.date_of_birth);
      if (!address && user.address) setAddress(user.address);
    }
  }, [user]);

  // Document/Aadhaar Picker
  const pickAddressProof = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Photo library access is required to select document.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const filename = asset.uri.split('/').pop() || 'aadhaar_proof.jpg';
        setAddressProof({
          uri: asset.uri,
          name: filename,
          type: asset.mimeType || 'image/jpeg',
        });
        Toast.show({
          type: 'success',
          text1: 'Document Selected',
          text2: filename,
        });
      }
    } catch (err) {
      console.log('Error picking address proof:', err);
    }
  };

  // Photo Picker
  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Gallery permission required to select photo.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const filename = asset.uri.split('/').pop() || 'volunteer_photo.jpg';
        setPhoto({
          uri: asset.uri,
          name: filename,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.log('Error picking photo:', err);
    }
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required Field', 'Please enter your phone number.');
      return;
    }
    if (!occupation.trim()) {
      Alert.alert('Required Field', 'Please enter your occupation / profession.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please provide your residential address.');
      return;
    }
    if (!addressProof) {
      Alert.alert('Address Proof Required', 'Please attach your Aadhaar card or address proof document.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('phone', phone.trim());
      if (email.trim()) formData.append('email', email.trim());
      if (dob.trim()) formData.append('date_of_birth', dob.trim());
      formData.append('blood_group', bloodGroup);
      formData.append('occupation', occupation.trim());
      formData.append('address', address.trim());

      if (addressProof) {
        formData.append('address_proof', {
          uri: addressProof.uri,
          name: addressProof.name || 'proof.jpg',
          type: addressProof.type || 'image/jpeg',
        });
      }

      if (photo) {
        formData.append('photo', {
          uri: photo.uri,
          name: photo.name || 'volunteer.jpg',
          type: photo.type || 'image/jpeg',
        });
      }

      const res = await volunteersApi.apply(formData);
      Toast.show({
        type: 'success',
        text1: 'Application Submitted!',
        text2: 'Your volunteer application is sent for Trust review.',
      });
      fetchStatus();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Unable to submit application. Please try again.';
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareCard = async (vol) => {
    try {
      await Share.share({
        title: 'Sree Lakshmi Charitable Trust - Official Volunteer',
        message: `🌟 I am an Official Volunteer of Sree Lakshmi Charitable Trust!\nName: ${vol.full_name}\nVolunteer ID: ${vol.volunteer_id}\nBlood Group: ${vol.blood_group || 'N/A'}\nJoin us in serving humanity!`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking volunteer status...</Text>
      </View>
    );
  }

  const volunteer = applicationData?.volunteer;
  const currentStatus = applicationData?.status;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join as Volunteer</Text>
        <TouchableOpacity style={styles.headerRightBtn} onPress={fetchStatus}>
          <Ionicons name="refresh" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* CASE 1: ACTIVE VOLUNTEER (Approved ID Card) */}
        {currentStatus === 'ACTIVE' && volunteer ? (
          <View style={styles.activeContainer}>
            {/* Header Badge */}
            <View style={styles.approvedBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#10b981" />
              <Text style={styles.approvedBannerText}>Official Verified Volunteer</Text>
            </View>

            {/* Official Volunteership Card */}
            <View style={styles.idCard}>
              {/* Card Top Brand */}
              <View style={styles.idCardHeader}>
                <View style={styles.idLogoRow}>
                  <Image
                    source={require('../../../assets/android-icon-foreground.png')}
                    style={styles.trustLogoMini}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.idTrustTitle}>SREELAKSHMI</Text>
                    <Text style={styles.idTrustSub}>CHARITABLE TRUST</Text>
                  </View>
                </View>
                <View style={styles.volunteerTag}>
                  <Text style={styles.volunteerTagText}>VOLUNTEER</Text>
                </View>
              </View>

              {/* Card Body */}
              <View style={styles.idCardBody}>
                {/* Photo */}
                <View style={styles.idPhotoContainer}>
                  {volunteer.photo ? (
                    <Image
                      source={{ uri: resolveImageUrl(volunteer.photo) }}
                      style={styles.idPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.idPhotoPlaceholder}>
                      <Ionicons name="person" size={44} color="#0284c7" />
                    </View>
                  )}
                  <View style={styles.verifiedCheckBadge}>
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  </View>
                </View>

                {/* Details */}
                <View style={styles.idInfoCol}>
                  <Text style={styles.idNameText} numberOfLines={2}>
                    {volunteer.full_name}
                  </Text>
                  <View style={styles.idNumBadge}>
                    <Text style={styles.idNumLabel}>ID: </Text>
                    <Text style={styles.idNumValue}>{volunteer.volunteer_id}</Text>
                  </View>

                  <View style={styles.idDetailRow}>
                    <Ionicons name="water" size={14} color="#ef4444" />
                    <Text style={styles.idDetailLabel}>Blood Group: </Text>
                    <Text style={styles.idDetailValBold}>{volunteer.blood_group || 'N/A'}</Text>
                  </View>

                  <View style={styles.idDetailRow}>
                    <Ionicons name="briefcase-outline" size={13} color="#94a3b8" />
                    <Text style={styles.idDetailLabel}>Role: </Text>
                    <Text style={styles.idDetailVal}>{volunteer.occupation || 'Community Volunteer'}</Text>
                  </View>
                </View>
              </View>

              {/* Wave Separator */}
              <View style={styles.cardSeparator} />

              {/* Card Footer */}
              <View style={styles.idCardFooter}>
                <View>
                  <Text style={styles.idFooterLabel}>Issued Date</Text>
                  <Text style={styles.idFooterValue}>
                    {volunteer.approved_at
                      ? new Date(volunteer.approved_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : volunteer.joining_date || 'N/A'}
                  </Text>
                </View>

                {/* Seal / Authorized Stamp */}
                <View style={styles.sealContainer}>
                  <View style={styles.sealCircle}>
                    <Ionicons name="ribbon-outline" size={14} color="#f59e0b" />
                    <Text style={styles.sealText}>TRUST SEAL</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Share / Actions */}
            <View style={styles.cardActionsRow}>
              <TouchableOpacity
                style={styles.shareCardBtn}
                activeOpacity={0.85}
                onPress={() => handleShareCard(volunteer)}
              >
                <Ionicons name="share-social-outline" size={18} color="#ffffff" />
                <Text style={styles.shareCardBtnText}>Share Volunteer Card</Text>
              </TouchableOpacity>
            </View>

            {/* Volunteer Details & Contributions */}
            <View style={styles.statsCard}>
              <Text style={styles.sectionHeaderTitle}>Volunteer Profile & Impact</Text>

              <View style={styles.statRow}>
                <View style={styles.statIconBox}>
                  <Ionicons name="call-outline" size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Phone Number</Text>
                  <Text style={styles.statValue}>{volunteer.phone || 'N/A'}</Text>
                </View>
              </View>

              {volunteer.email ? (
                <View style={styles.statRow}>
                  <View style={styles.statIconBox}>
                    <Ionicons name="mail-outline" size={18} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>Email Address</Text>
                    <Text style={styles.statValue}>{volunteer.email}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.statRow}>
                <View style={styles.statIconBox}>
                  <Ionicons name="location-outline" size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Residential Address</Text>
                  <Text style={styles.statValue}>{volunteer.address || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statIconBox}>
                  <Ionicons name="time-outline" size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>Service Hours Contributed</Text>
                  <Text style={[styles.statValue, { color: '#10b981', fontWeight: '700' }]}>
                    {volunteer.total_hours || '0'} hrs
                  </Text>
                </View>
              </View>
            </View>

            {/* Helpline / Contact */}
            <View style={styles.infoNoticeCard}>
              <Ionicons name="information-circle-outline" size={20} color="#0284c7" />
              <Text style={styles.infoNoticeText}>
                As an official volunteer, you represent the heart of Sree Lakshmi Charitable Trust. Carry your digital card for field activities and community events.
              </Text>
            </View>
          </View>
        ) : currentStatus === 'PENDING' && volunteer ? (
          /* CASE 2: PENDING APPROVAL */
          <View style={styles.pendingContainer}>
            <View style={styles.pendingStatusCard}>
              <View style={styles.pendingHourglass}>
                <Ionicons name="hourglass" size={40} color="#f59e0b" />
              </View>
              <Text style={styles.pendingTitle}>Application Under Review</Text>
              <Text style={styles.pendingSubtitle}>
                Your application to join as an official Volunteer is currently being reviewed by the Trust Management.
              </Text>

              <View style={styles.appRefRow}>
                <Text style={styles.appRefLabel}>Application Reference:</Text>
                <Text style={styles.appRefValue}>{volunteer.volunteer_id}</Text>
              </View>
            </View>

            {/* Submitted Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardHeader}>Submitted Application Details</Text>

              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Full Name</Text>
                <Text style={styles.summaryItemVal}>{volunteer.full_name}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Phone Number</Text>
                <Text style={styles.summaryItemVal}>{volunteer.phone}</Text>
              </View>
              {volunteer.email ? (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Email</Text>
                  <Text style={styles.summaryItemVal}>{volunteer.email}</Text>
                </View>
              ) : null}
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Blood Group</Text>
                <Text style={styles.summaryItemVal}>{volunteer.blood_group || 'N/A'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Occupation</Text>
                <Text style={styles.summaryItemVal}>{volunteer.occupation || 'N/A'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Address</Text>
                <Text style={styles.summaryItemVal}>{volunteer.address || 'N/A'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Address Proof</Text>
                <View style={styles.proofBadge}>
                  <Ionicons name="document-attach" size={14} color="#059669" />
                  <Text style={styles.proofBadgeText}>Aadhaar Card Attached</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.refreshBtn} activeOpacity={0.8} onPress={fetchStatus}>
              <Ionicons name="sync-outline" size={18} color="#0284c7" />
              <Text style={styles.refreshBtnText}>Check Approval Status</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* CASE 3: APPLICATION FORM (Not applied or Rejected) */
          <View style={styles.formContainer}>
            {/* Hero / Intro Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroIconBox}>
                <Ionicons name="heart-circle" size={36} color="#0284c7" />
              </View>
              <Text style={styles.heroTitle}>Join Our Mission of Service</Text>
              <Text style={styles.heroSub}>
                Become an authorized volunteer of Sree Lakshmi Charitable Trust. Help us deliver relief, organize community programs, and transform lives.
              </Text>
            </View>

            {currentStatus === 'REJECTED' && (
              <View style={styles.rejectedAlert}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rejectedAlertTitle}>Previous Application Update</Text>
                  <Text style={styles.rejectedAlertText}>
                    {volunteer?.rejection_reason || 'Application was not approved. Please review and re-apply with valid details.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Profile Photo Picker */}
            <View style={styles.photoPickerSection}>
              <TouchableOpacity style={styles.photoPickerBox} activeOpacity={0.8} onPress={pickPhoto}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                ) : user?.photo ? (
                  <Image source={{ uri: resolveImageUrl(user.photo) }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={32} color="#94a3b8" />
                    <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <Ionicons name="pencil" size={12} color="#ffffff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Passport size photo for Volunteer ID Card</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>Personal Information</Text>

              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter full name"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Date of Birth */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (e.g. 1995-08-15)"
                  placeholderTextColor="#94a3b8"
                  value={dob}
                  onChangeText={setDob}
                />
              </View>

              {/* Blood Group */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Blood Group *</Text>
                <View style={styles.bloodGroupGrid}>
                  {BLOOD_GROUPS.map((bg) => (
                    <TouchableOpacity
                      key={bg}
                      style={[
                        styles.bloodPill,
                        bloodGroup === bg && styles.bloodPillActive,
                      ]}
                      onPress={() => setBloodGroup(bg)}
                    >
                      <Text
                        style={[
                          styles.bloodPillText,
                          bloodGroup === bg && styles.bloodPillTextActive,
                        ]}
                      >
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Occupation */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Occupation / Profession *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Teacher, Engineer, Student, Business"
                  placeholderTextColor="#94a3b8"
                  value={occupation}
                  onChangeText={setOccupation}
                />
              </View>

              {/* Residential Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Residential Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter complete residential address with PIN code"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              {/* Address Proof Upload */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address Proof (Aadhaar Card) *</Text>
                <TouchableOpacity
                  style={[
                    styles.uploadBox,
                    addressProof && styles.uploadBoxSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={pickAddressProof}
                >
                  {addressProof ? (
                    <View style={styles.uploadSuccessRow}>
                      <Image source={{ uri: addressProof.uri }} style={styles.docThumbnail} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadDocName} numberOfLines={1}>
                          {addressProof.name}
                        </Text>
                        <Text style={styles.uploadDocSub}>Tap to change document</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    </View>
                  ) : (
                    <View style={styles.uploadEmptyRow}>
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={24} color="#0284c7" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadMainText}>Upload Aadhaar / ID Proof</Text>
                        <Text style={styles.uploadSubText}>PNG, JPG or document format</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Declaration */}
              <View style={styles.declarationRow}>
                <Ionicons name="shield-checkmark" size={18} color="#0284c7" />
                <Text style={styles.declarationText}>
                  I hereby declare that the details provided are accurate and agree to abide by the principles of Sree Lakshmi Charitable Trust.
                </Text>
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                disabled={submitting}
                activeOpacity={0.85}
                onPress={handleSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Submit Volunteer Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  headerRightBtn: {
    padding: 6,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Rejected Alert
  rejectedAlert: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  rejectedAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 2,
  },
  rejectedAlertText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 17,
  },

  // Photo Section
  photoPickerSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  photoPickerBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  photoHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },

  // Form Card
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 75,
    textAlignVertical: 'top',
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bloodPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  bloodPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  bloodPillTextActive: {
    color: '#ffffff',
  },

  // Upload Box
  uploadBox: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  uploadBoxSelected: {
    borderColor: '#10b981',
    borderStyle: 'solid',
    backgroundColor: '#f0fdf4',
  },
  uploadEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  uploadSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  uploadSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  uploadDocName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  uploadDocSub: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },

  // Declaration
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  declarationText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },

  // Submit Button
  submitBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // PENDING STATE
  pendingContainer: {
    gap: 16,
  },
  pendingStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingHourglass: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  appRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  appRefLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350f',
  },
  appRefValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryCardHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  summaryItem: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryItemVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    gap: 8,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },

  // ACTIVE VOLUNTEER ID CARD
  activeContainer: {
    gap: 16,
  },
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  approvedBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  idCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  idCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  idLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustLogoMini: {
    width: 38,
    height: 38,
  },
  idTrustTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
  },
  idTrustSub: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  volunteerTag: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  volunteerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  idCardBody: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  idPhotoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  idPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  idPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10b981',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  idInfoCol: {
    flex: 1,
    gap: 4,
  },
  idNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  idNumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  idNumLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  idNumValue: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '700',
  },
  idDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  idDetailLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  idDetailValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ef4444',
  },
  idDetailVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  idCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idFooterLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  idFooterValue: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '700',
    marginTop: 2,
  },
  sealContainer: {
    alignItems: 'center',
  },
  sealCircle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  sealText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },

  // Actions
  cardActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shareCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  shareCardBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 1,
  },

  // Info Notice
  infoNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 14,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 18,
  },
});
