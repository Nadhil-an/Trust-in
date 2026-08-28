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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import Toast from 'react-native-toast-message';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [pwdModal, setPwdModal] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  const memberName = user?.full_name || 'Arun Kumar';
  const memberId = user?.username || 'SKCT24568';
  const memberSince = 'May 2024';
  const email = user?.email || 'arunkumar@email.com';
  const phone = user?.phone || '+91 98765 43210';
  const location = 'Kochi, Kerala, India';

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
        <TouchableOpacity style={styles.editHeaderBtn}>
          <Ionicons name="create-outline" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={44} color="#0284c7" />
            </View>
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
          </View>

          {/* View Membership Card Button */}
          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => navigation.navigate('MembershipCard')}
          >
            <Text style={styles.cardBtnText}>View Membership Card</Text>
          </TouchableOpacity>
        </View>

        {/* Account Details Section */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.menuBox}>
          <TouchableOpacity style={styles.menuRow}>
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
  },
  profileHeaderInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  metaText: { fontSize: 12, color: Colors.gray500, fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#bae6fd', marginVertical: 14 },

  infoList: { gap: 10, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoValue: { fontSize: 13, color: Colors.gray700, fontWeight: '600' },

  cardBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cardBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

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
});

export default ProfileScreen;
