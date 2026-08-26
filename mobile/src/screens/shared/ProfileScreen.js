import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Header, Card } from '../../components/shared';
import Toast from 'react-native-toast-message';
import { authApi } from '../../api';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    // AppNavigator automatically handles redirecting to Auth stack when user is null
  };

  const [pwdModal, setPwdModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleContactUs = () => {
    setContactModal(true);
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
    } catch (err) {
      const msg = err.response?.data?.non_field_errors?.[0] || 'Failed to change password. Check old password.';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <View style={styles.flex}>
      <Header title="My Profile" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.full_name?.[0] || user?.username?.[0]}</Text>
          </View>
          <Text style={styles.name}>{user?.full_name || 'User'}</Text>
          <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
        </View>

        <Card style={styles.infoCard}>
          <InfoRow icon="id-card" label="ID / Username" value={user?.username} />
          <InfoRow icon="call" label="Phone" value={user?.phone || 'Not provided'} />
          <InfoRow icon="mail" label="Email" value={user?.email || 'Not provided'} noBorder />
        </Card>

        <Text style={styles.sectionTitle}>More Options</Text>
        <Card style={styles.menuCard}>
          <MenuRow icon="key-outline" label="Reset password" onPress={() => setPwdModal(true)} />
          <MenuRow icon="document-text-outline" label="Privacy Policy" onPress={() => {}} />
          <MenuRow icon="call-outline" label="Contact us" onPress={handleContactUs} />
          <MenuRow icon="information-circle-outline" label="About us" onPress={() => {}} noBorder />
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
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
                onChangeText={v => setPasswords(p => ({ ...p, new: v }))} placeholder="Enter new password (min 8 chars)" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput style={styles.input} secureTextEntry value={passwords.confirm}
                onChangeText={v => setPasswords(p => ({ ...p, confirm: v }))} placeholder="Confirm new password" />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleChangePassword} disabled={pwdLoading}>
              {pwdLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Us Modal */}
      <Modal visible={contactModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="call" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.alertTitle}>Contact Us</Text>
              <Text style={styles.alertSubtitle}>We are here to help!</Text>
            </View>
            
            <View style={styles.contactItem}>
              <Ionicons name="person-circle-outline" size={24} color={Colors.gray500} style={styles.contactIcon} />
              <View>
                <Text style={styles.contactLabel}>Chairman</Text>
                <Text style={styles.contactNumber}>+91 80865 93094</Text>
              </View>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="business-outline" size={24} color={Colors.gray500} style={styles.contactIcon} />
              <View>
                <Text style={styles.contactLabel}>Trust Office</Text>
                <Text style={styles.contactNumber}>+91 62389 59787</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setContactModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const InfoRow = ({ icon, label, value, noBorder }) => (
  <View style={[styles.infoRow, !noBorder && styles.border]}>
    <Ionicons name={icon} size={20} color={Colors.gray500} style={styles.icon} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const MenuRow = ({ icon, label, onPress, noBorder }) => (
  <TouchableOpacity style={[styles.menuRow, !noBorder && styles.border]} onPress={onPress}>
    <Ionicons name={icon} size={22} color={Colors.gray600} style={styles.menuIcon} />
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  name: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  role: { fontSize: 13, color: Colors.primary, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
  infoCard: { padding: 0, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  icon: { marginRight: 16 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.gray500, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray600, marginBottom: 10, marginLeft: 4 },
  menuCard: { padding: 0, marginBottom: 24 },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIcon: { marginRight: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.errorLight, padding: 16, borderRadius: 12 },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.gray300, borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: Colors.gray50 },
  submitBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'stretch' },
  alertHeader: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  alertSubtitle: { fontSize: 14, color: Colors.gray500 },
  contactItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 12 },
  contactIcon: { marginRight: 16 },
  contactLabel: { fontSize: 13, color: Colors.gray500, marginBottom: 2 },
  contactNumber: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  closeBtn: { backgroundColor: Colors.gray100, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: Colors.gray800, fontSize: 16, fontWeight: '600' },
});

export default ProfileScreen;
