import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';

const ProfileScreen = ({ navigation }) => {
  const { user, updateUser, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  
  const toggleLanguage = async () => {
    const newLang = currentLang === 'en' ? 'ml' : 'en';
    await changeLanguage(newLang, user?.id);
    Toast.show({ type: 'success', text1: newLang === 'ml' ? 'ഭാഷ മാറ്റി' : 'Language changed' });
  };
  
  // Password Management States
  const [pwdChoiceModal, setPwdChoiceModal] = useState(false);
  const [updatePwdModal, setUpdatePwdModal] = useState(false);
  const [forgotPwdModal, setForgotPwdModal] = useState(false);

  // Update Password Form
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Forgot Password Flow
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotContact, setForgotContact] = useState('');
  const [forgotUserId, setForgotUserId] = useState(null);
  const [forgotMasked, setForgotMasked] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState('');
  const [showForgotNewPwd, setShowForgotNewPwd] = useState(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Edit Profile Modal state
  const [editModal, setEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    avatar: ''
  });

  const memberName = user?.full_name || user?.username || 'Staff Member';
  const memberId = user?.username || null;
  const memberSince = user?.joining_date ? new Date(user.joining_date).toLocaleDateString(undefined, {month: 'short', year: 'numeric'}) : null;
  const email = user?.email || null;
  const phone = user?.phone || null;
  const location = user?.address || null;
  const dateOfBirth = user?.date_of_birth || user?.dob || null;
  const avatar = user?.avatar;

  const openEditModal = () => {
    setEditForm({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      address: user?.address || '',
      date_of_birth: user?.date_of_birth || user?.dob || '',
      avatar: user?.avatar || ''
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
        setEditForm(prev => ({ ...prev, avatar: result.assets[0].uri }));
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
        setEditForm(prev => ({ ...prev, avatar: result.assets[0].uri }));
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
        ...user,
        full_name: editForm.full_name,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        date_of_birth: editForm.date_of_birth,
        dob: editForm.date_of_birth,
        avatar: editForm.avatar
      };

      await updateUser(updatedUser);

      try {
        const formData = new FormData();
        formData.append('full_name', editForm.full_name);
        if (editForm.phone) formData.append('phone', editForm.phone);
        if (editForm.email) formData.append('email', editForm.email);
        if (editForm.address) formData.append('address', editForm.address);
        if (editForm.date_of_birth) formData.append('date_of_birth', editForm.date_of_birth);
        
        // Ensure photo is sent as a file
        if (editForm.avatar && !editForm.avatar.startsWith('http')) {
          const avatarName = editForm.avatar.split('/').pop() || 'avatar.jpg';
          formData.append('photo', {
            uri: editForm.avatar,
            name: avatarName,
            type: 'image/jpeg',
          });
        }
        
        const res = await authApi.updateProfile(formData);
        
        // Update user with the server response (which includes the real photo URL)
        if (res.data) {
          const finalUser = {
            ...updatedUser,
            avatar: res.data.photo || updatedUser.avatar,
            photo: res.data.photo || updatedUser.photo
          };
          await updateUser(finalUser);
        }
        Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Changes saved across all dashboards!' });
        setEditModal(false);
      } catch (err) {
        console.log('Update profile error:', err.response?.data || err.message);
        Toast.show({ type: 'error', text1: 'Failed to update profile', text2: err.response?.data?.photo?.[0] || err.message });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to update profile' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setPwdChoiceModal(false);
    setForgotContact(user?.phone || user?.username || user?.email || '');
    setForgotStep(1);
    setForgotOtp('');
    setForgotNewPwd('');
    setForgotConfirmPwd('');
    setForgotPwdModal(true);
  };

  const handleOpenUpdateModal = () => {
    setPwdChoiceModal(false);
    setPasswords({ old: '', new: '', confirm: '' });
    setShowOldPwd(false);
    setShowNewPwd(false);
    setShowConfirmPwd(false);
    setUpdatePwdModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!passwords.old.trim() || !passwords.new.trim() || !passwords.confirm.trim()) {
      return Toast.show({ type: 'error', text1: 'Required', text2: 'Please fill all password fields' });
    }
    if (passwords.new.length < 6) {
      return Toast.show({ type: 'error', text1: 'Validation', text2: 'New password must be at least 6 characters' });
    }
    if (passwords.new !== passwords.confirm) {
      return Toast.show({ type: 'error', text1: 'Validation', text2: 'New passwords do not match' });
    }
    setPwdLoading(true);
    try {
      const res = await authApi.changePassword({
        current_password: passwords.old.trim(),
        old_password: passwords.old.trim(),
        new_password: passwords.new.trim(),
        confirm_password: passwords.confirm.trim(),
      });
      Toast.show({ type: 'success', text1: 'Password Updated', text2: res?.data?.message || 'Password updated successfully!' });
      setUpdatePwdModal(false);
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (e) {
      const errMsg = e?.response?.data?.error || 
                     e?.response?.data?.current_password?.[0] || 
                     e?.response?.data?.old_password?.[0] || 
                     e?.response?.data?.new_password?.[0] || 
                     e?.response?.data?.detail || 
                     'Failed to update password. Please check your current password.';
      Toast.show({ type: 'error', text1: 'Error', text2: errMsg });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSendForgotOtp = async () => {
    const contact = (forgotContact || user?.phone || user?.username || user?.email || '').trim();
    if (!contact) {
      return Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your phone number, member ID, or email' });
    }
    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword({ identifier: contact });
      setForgotUserId(res?.data?.user_id);
      setForgotMasked(res?.data?.masked_contact || contact);
      setForgotStep(2);
      setResendTimer(45);
      Toast.show({
        type: 'success',
        text1: 'Verification Code Sent',
        text2: res?.data?.message || 'OTP has been dispatched.',
      });
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.detail || 'Failed to send OTP. Please check your contact.';
      Toast.show({ type: 'error', text1: 'Error', text2: errMsg });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotOtp.trim()) {
      return Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter the 6-digit OTP' });
    }
    if (!forgotNewPwd.trim()) {
      return Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter a new password' });
    }
    if (forgotNewPwd.length < 6) {
      return Toast.show({ type: 'error', text1: 'Validation', text2: 'Password must be at least 6 characters' });
    }
    if (forgotNewPwd !== forgotConfirmPwd) {
      return Toast.show({ type: 'error', text1: 'Validation', text2: 'Passwords do not match' });
    }
    setForgotLoading(true);
    try {
      const res = await authApi.resetPassword({
        user_id: forgotUserId,
        otp: forgotOtp.trim(),
        new_password: forgotNewPwd.trim(),
        confirm_password: forgotConfirmPwd.trim(),
      });
      Toast.show({
        type: 'success',
        text1: 'Password Reset Successful',
        text2: res?.data?.message || 'Your password has been reset successfully!',
      });
      setForgotPwdModal(false);
      setForgotStep(1);
      setForgotOtp('');
      setForgotNewPwd('');
      setForgotConfirmPwd('');
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.detail || 'Failed to reset password. Please check OTP.';
      Toast.show({ type: 'error', text1: 'Error', text2: errMsg });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('member.my_profile')}</Text>
        <TouchableOpacity style={styles.editHeaderBtn} onPress={openEditModal}>
          <Ionicons name="create-outline" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <TouchableOpacity style={styles.avatarContainer} onPress={openEditModal} activeOpacity={0.8}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              ) : (
                <Ionicons name="person" size={40} color="#0284c7" />
              )}
            </TouchableOpacity>
            <View style={styles.profileHeaderInfo}>
              <Text style={styles.name}>{memberName}</Text>
              {memberId && <Text style={styles.metaText}>{t('member.member_id')}: {memberId}</Text>}
              {memberSince && <Text style={styles.metaText}>{t('member.member_since')} {memberSince}</Text>}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Contact Details */}
          <View style={styles.infoList}>
            {email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={18} color="#0284c7" />
                <Text style={styles.infoValue}>{email}</Text>
              </View>
            )}

            {phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={18} color="#0284c7" />
                <Text style={styles.infoValue}>{phone}</Text>
              </View>
            )}

            {location && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color="#0284c7" />
                <Text style={styles.infoValue}>{location}</Text>
              </View>
            )}

            {dateOfBirth && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color="#0284c7" />
                <Text style={styles.infoValue}>DOB: {dateOfBirth}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Account Details Section */}
        <Text style={styles.sectionTitle}>{t('staff.personal_info')}</Text>
        <View style={styles.menuBox}>
          <TouchableOpacity style={styles.menuRow} onPress={openEditModal}>
            <View style={styles.menuLeft}>
              <Ionicons name="person-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>{t('common.edit')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => setPwdChoiceModal(true)}>
            <View style={styles.menuLeft}>
              <Ionicons name="key-outline" size={20} color={Colors.gray600} />
              <View>
                <Text style={styles.menuText}>Change / Forgot Password</Text>
                <Text style={{ fontSize: 11, color: Colors.gray400, marginTop: 1 }}>Update existing or reset forgotten password</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={toggleLanguage}>
            <View style={styles.menuLeft}>
              <Ionicons name="language-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>{t('settings.language')} ( {currentLang === 'en' ? 'English' : 'മലയാളം'} )</Text>
            </View>
            <View pointerEvents="none">
              <Switch 
                value={currentLang === 'ml'} 
                trackColor={{ false: '#d1d5db', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={styles.menuLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>{t('settings.notifications')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
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
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.full_name}
                  onChangeText={v => setEditForm(p => ({ ...p, full_name: v }))}
                  placeholder="Enter full name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.phone}
                  onChangeText={v => setEditForm(p => ({ ...p, phone: v }))}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.email}
                  onChangeText={v => setEditForm(p => ({ ...p, email: v }))}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address / Location</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.address}
                  onChangeText={v => setEditForm(p => ({ ...p, address: v }))}
                  placeholder="Enter address or location"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.date_of_birth}
                  onChangeText={v => setEditForm(p => ({ ...p, date_of_birth: v }))}
                  placeholder="e.g. 1995-08-15"
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveProfile} disabled={editLoading}>
                {editLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Save Profile Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 1. Password Management Choice Modal ─────────────────────────── */}
      <Modal visible={pwdChoiceModal} transparent animationType="fade" onRequestClose={() => setPwdChoiceModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPwdChoiceModal(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.choiceModalContent}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Password Settings</Text>
                  <Text style={styles.modalSubtitle}>Select an option to manage your account access</Text>
                </View>
                <TouchableOpacity onPress={() => setPwdChoiceModal(false)} style={styles.closeCircleBtn}>
                  <Ionicons name="close" size={20} color={Colors.gray500} />
                </TouchableOpacity>
              </View>

              {/* Option 1: Update Password */}
              <TouchableOpacity
                style={styles.choiceCard}
                activeOpacity={0.8}
                onPress={handleOpenUpdateModal}
              >
                <View style={[styles.choiceIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="key" size={22} color="#0284C7" />
                </View>
                <View style={styles.choiceTextWrap}>
                  <Text style={styles.choiceTitle}>Update Password</Text>
                  <Text style={styles.choiceDesc}>I know my current password and want to change it</Text>
                </View>
                <View style={[styles.choiceArrowCircle, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="chevron-forward" size={18} color="#0284C7" />
                </View>
              </TouchableOpacity>

              {/* Option 2: Forgot Password */}
              <TouchableOpacity
                style={styles.choiceCard}
                activeOpacity={0.8}
                onPress={handleOpenForgotModal}
              >
                <View style={[styles.choiceIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="lock-open" size={22} color="#D97706" />
                </View>
                <View style={styles.choiceTextWrap}>
                  <Text style={styles.choiceTitle}>Forgot Password</Text>
                  <Text style={styles.choiceDesc}>Reset password securely via OTP verification</Text>
                </View>
                <View style={[styles.choiceArrowCircle, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="chevron-forward" size={18} color="#D97706" />
                </View>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* ── 2. Update Password Modal ────────────────────────────────────── */}
      <Modal visible={updatePwdModal} transparent animationType="slide" onRequestClose={() => setUpdatePwdModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => { setUpdatePwdModal(false); setPwdChoiceModal(true); }} style={styles.backCircleBtn}>
                  <Ionicons name="arrow-back" size={20} color={Colors.gray700} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.modalTitle}>Update Password</Text>
                  <Text style={styles.modalSubtitle}>Enter your current and new password</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setUpdatePwdModal(false)} style={styles.closeCircleBtn}>
                <Ionicons name="close" size={20} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.passwordInputWrap}>
                  <Ionicons name="lock-closed-outline" size={19} color="#64748B" style={styles.fieldLeftIcon} />
                  <TextInput
                    style={styles.passwordFieldInput}
                    secureTextEntry={!showOldPwd}
                    value={passwords.old}
                    onChangeText={v => setPasswords(p => ({ ...p, old: v }))}
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity onPress={() => setShowOldPwd(!showOldPwd)} style={styles.eyeBtn}>
                    <Ionicons name={showOldPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.passwordInputWrap}>
                  <Ionicons name="key-outline" size={19} color="#64748B" style={styles.fieldLeftIcon} />
                  <TextInput
                    style={styles.passwordFieldInput}
                    secureTextEntry={!showNewPwd}
                    value={passwords.new}
                    onChangeText={v => setPasswords(p => ({ ...p, new: v }))}
                    placeholder="Enter new password (min. 6 chars)"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity onPress={() => setShowNewPwd(!showNewPwd)} style={styles.eyeBtn}>
                    <Ionicons name={showNewPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.passwordInputWrap}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#64748B" style={styles.fieldLeftIcon} />
                  <TextInput
                    style={styles.passwordFieldInput}
                    secureTextEntry={!showConfirmPwd}
                    value={passwords.confirm}
                    onChangeText={v => setPasswords(p => ({ ...p, confirm: v }))}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPwd(!showConfirmPwd)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password hint link inside update modal */}
              <TouchableOpacity
                onPress={() => { setUpdatePwdModal(false); handleOpenForgotModal(); }}
                style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 16 }}
              >
                <Text style={{ fontSize: 13, color: '#0284c7', fontWeight: '600' }}>Forgot Current Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdatePassword} disabled={pwdLoading}>
                {pwdLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Update Password</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 3. Forgot Password Flow Modal ──────────────────────────────── */}
      <Modal visible={forgotPwdModal} transparent animationType="slide" onRequestClose={() => setForgotPwdModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => { setForgotPwdModal(false); setPwdChoiceModal(true); }} style={styles.backCircleBtn}>
                  <Ionicons name="arrow-back" size={20} color={Colors.gray700} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.modalTitle}>Forgot Password</Text>
                  <Text style={styles.modalSubtitle}>
                    {forgotStep === 1 ? 'Step 1 of 2: Verify Your Identity' : 'Step 2 of 2: Set New Password'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setForgotPwdModal(false)} style={styles.closeCircleBtn}>
                <Ionicons name="close" size={20} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {forgotStep === 1 ? (
                <>
                  <View style={styles.forgotInfoBox}>
                    <Ionicons name="information-circle" size={22} color="#0284c7" />
                    <Text style={styles.forgotInfoText}>
                      We will verify your account and send a 6-digit OTP code to your registered mobile or email address.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Registered Phone / Member ID / Email</Text>
                    <View style={styles.passwordInputWrap}>
                      <Ionicons name="person-circle-outline" size={20} color="#64748B" style={styles.fieldLeftIcon} />
                      <TextInput
                        style={styles.passwordFieldInput}
                        value={forgotContact}
                        onChangeText={setForgotContact}
                        placeholder="Enter phone number or email"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleSendForgotOtp}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>Send Verification Code (OTP)</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.forgotInfoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                    <Text style={[styles.forgotInfoText, { color: '#166534' }]}>
                      Verification code dispatched to {forgotMasked || 'your registered contact'}.
                    </Text>
                  </View>

                  {/* 6-Digit OTP */}
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.label}>6-Digit OTP Code <Text style={{ color: '#EF4444' }}>*</Text></Text>
                      {resendTimer > 0 ? (
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Resend in {resendTimer}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendForgotOtp} disabled={forgotLoading}>
                          <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700' }}>Resend OTP</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.passwordInputWrap}>
                      <Ionicons name="keypad-outline" size={20} color="#64748B" style={styles.fieldLeftIcon} />
                      <TextInput
                        style={[styles.passwordFieldInput, { letterSpacing: 6, fontWeight: '700', fontSize: 18 }]}
                        value={forgotOtp}
                        onChangeText={setForgotOtp}
                        placeholder="••••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  {/* New Password */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password <Text style={{ color: '#EF4444' }}>*</Text></Text>
                    <View style={styles.passwordInputWrap}>
                      <Ionicons name="lock-closed-outline" size={19} color="#64748B" style={styles.fieldLeftIcon} />
                      <TextInput
                        style={styles.passwordFieldInput}
                        secureTextEntry={!showForgotNewPwd}
                        value={forgotNewPwd}
                        onChangeText={setForgotNewPwd}
                        placeholder="Enter new password (min. 6 chars)"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowForgotNewPwd(!showForgotNewPwd)} style={styles.eyeBtn}>
                        <Ionicons name={showForgotNewPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm New Password */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password <Text style={{ color: '#EF4444' }}>*</Text></Text>
                    <View style={styles.passwordInputWrap}>
                      <Ionicons name="shield-checkmark-outline" size={19} color="#64748B" style={styles.fieldLeftIcon} />
                      <TextInput
                        style={styles.passwordFieldInput}
                        secureTextEntry={!showForgotConfirmPwd}
                        value={forgotConfirmPwd}
                        onChangeText={setForgotConfirmPwd}
                        placeholder="Confirm new password"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowForgotConfirmPwd(!showForgotConfirmPwd)} style={styles.eyeBtn}>
                        <Ionicons name={showForgotConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleResetPassword}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>Reset & Save Password</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setForgotStep(1)}
                    style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}
                  >
                    <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>Change Phone/Email</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Styled Photo Picker Options Modal */}
      <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
        <TouchableOpacity style={styles.photoModalOverlay} activeOpacity={1} onPress={() => setPhotoModalVisible(false)}>
          <TouchableWithoutFeedback>
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
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
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
    paddingTop: 44,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  editHeaderBtn: { padding: 4 },
  scroll: { padding: 16, gap: 16 },

  profileCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0284c7',
    overflow: 'hidden',
  },
  profileHeaderInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  metaText: { fontSize: 12, color: Colors.gray500, fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#bae6fd', marginVertical: 14 },

  infoList: { gap: 16, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoValue: { fontSize: 14, color: Colors.gray700, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray600, marginLeft: 4, marginTop: 6 },
  menuBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gray200,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.gray300, borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: Colors.gray50 },
  submitBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },

  /* Avatar Picker Styling */
  avatarPickerWrapper: { position: 'relative', width: 84, height: 84 },
  avatarPickerImg: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#0284c7' },
  avatarPickerPlaceholder: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#e0f2fe',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0284c7'
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0284c7',
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFFFFF'
  },

  /* Custom Photo Modal Styling */
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

  /* Password Modals & Choice Sheet Styles */
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 36,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  choiceIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  choiceDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  choiceArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  fieldLeftIcon: {
    marginRight: 8,
  },
  passwordFieldInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14.5,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 8,
  },
  forgotInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  forgotInfoText: {
    flex: 1,
    fontSize: 12.5,
    color: '#166534',
    lineHeight: 18,
  },
});

export default ProfileScreen;
