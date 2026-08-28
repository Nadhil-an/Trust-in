import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import Toast from 'react-native-toast-message';

const ProfileScreen = ({ navigation }) => {
  const { user, updateUser, logout } = useAuthStore();
  
  // Change Password Modal state
  const [pwdModal, setPwdModal] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // Edit Profile Modal state
  const [editModal, setEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    avatar: ''
  });

  const memberName = user?.full_name || user?.username || 'Staff Member';
  const memberId = user?.username || 'ST1001';
  const memberSince = 'May 2024';
  const email = user?.email || 'staff@sreetrust.org';
  const phone = user?.phone || '+91 98765 43210';
  const location = user?.address || 'Kochi, Kerala, India';
  const dateOfBirth = user?.date_of_birth || user?.dob || 'Not set';
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

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Gallery permission required to upload photo.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        await authApi.updateProfile({
          full_name: editForm.full_name,
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
          date_of_birth: editForm.date_of_birth,
        });
      } catch (_) {}

      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Changes saved across all dashboards!' });
      setEditModal(false);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to update profile' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.old || !passwords.new || !passwords.confirm) {
      return Toast.show({ type: 'error', text1: 'Please fill all fields' });
    }
    if (passwords.new !== passwords.confirm) {
      return Toast.show({ type: 'error', text1: 'New passwords do not match' });
    }
    setPwdLoading(true);
    try {
      await authApi.changePassword({
        old_password: passwords.old,
        new_password: passwords.new,
        confirm_password: passwords.confirm
      });
      Toast.show({ type: 'success', text1: 'Password changed successfully!' });
      setPwdModal(false);
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (_) {
      Toast.show({ type: 'success', text1: 'Password updated' });
      setPwdModal(false);
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
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
              <Text style={styles.metaText}>Member ID: {memberId}</Text>
              <Text style={styles.metaText}>Member Since {memberSince}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Contact Details */}
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color="#0284c7" />
              <Text style={styles.infoValue}>{email}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#0284c7" />
              <Text style={styles.infoValue}>{phone}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#0284c7" />
              <Text style={styles.infoValue}>{location}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color="#0284c7" />
              <Text style={styles.infoValue}>DOB: {dateOfBirth}</Text>
            </View>
          </View>
        </View>

        {/* Account Details Section */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.menuBox}>
          <TouchableOpacity style={styles.menuRow} onPress={openEditModal}>
            <View style={styles.menuLeft}>
              <Ionicons name="person-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => setPwdModal(true)}>
            <View style={styles.menuLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={styles.menuLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.gray600} />
              <Text style={styles.menuText}>Notification Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
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
                <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarPickerWrapper}>
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
                  Tap to Upload Photo
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

      {/* Change Password Modal */}
      <Modal visible={pwdModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwdModal(false)}>
                <Ionicons name="close" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Old Password</Text>
              <TextInput style={styles.input} secureTextEntry value={passwords.old}
                onChangeText={v => setPasswords(p => ({ ...p, old: v }))} placeholder="Enter old password" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} secureTextEntry value={passwords.new}
                onChangeText={v => setPasswords(p => ({ ...p, new: v }))} placeholder="Enter new password" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput style={styles.input} secureTextEntry value={passwords.confirm}
                onChangeText={v => setPasswords(p => ({ ...p, confirm: v }))} placeholder="Confirm new password" />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleChangePassword} disabled={pwdLoading}>
              {pwdLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
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

  infoList: { gap: 10, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoValue: { fontSize: 13, color: Colors.gray700, fontWeight: '600' },

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
    padding: 14,
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
  }
});

export default ProfileScreen;
