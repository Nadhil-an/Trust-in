import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Dimensions,
  Modal, ActivityIndicator, TextInput
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { Button, Input } from '../../components/shared';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const { login } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Forgot Password state
  const [forgotModal, setForgotModal] = useState(false);
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

  const handleOpenForgot = () => {
    setForgotContact(form.username.trim() || '');
    setForgotStep(1);
    setForgotOtp('');
    setForgotNewPwd('');
    setForgotConfirmPwd('');
    setForgotModal(true);
  };

  const handleSendForgotOtp = async () => {
    if (!forgotContact.trim()) {
      return Alert.alert('Required', 'Please enter your registered phone number, member ID, or email.');
    }
    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword({ identifier: forgotContact.trim() });
      setForgotUserId(res?.data?.user_id);
      setForgotMasked(res?.data?.masked_contact || forgotContact.trim());
      setForgotStep(2);
      setResendTimer(45);
      Alert.alert('Verification Code Sent', res?.data?.message || 'OTP has been dispatched.');
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.detail || 'Failed to send OTP. Please check your contact.';
      Alert.alert('Error', errMsg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotOtp.trim()) {
      return Alert.alert('Required', 'Please enter the 6-digit OTP code.');
    }
    if (!forgotNewPwd.trim()) {
      return Alert.alert('Required', 'Please enter a new password.');
    }
    if (forgotNewPwd.length < 6) {
      return Alert.alert('Validation', 'Password must be at least 6 characters.');
    }
    if (forgotNewPwd !== forgotConfirmPwd) {
      return Alert.alert('Validation', 'Passwords do not match.');
    }
    setForgotLoading(true);
    try {
      const res = await authApi.resetPassword({
        user_id: forgotUserId,
        otp: forgotOtp.trim(),
        new_password: forgotNewPwd.trim(),
        confirm_password: forgotConfirmPwd.trim(),
      });
      Alert.alert('Success', res?.data?.message || 'Password reset successfully! Please login with your new password.', [
        { text: 'OK', onPress: () => {
          setForgotModal(false);
          setForm(f => ({ ...f, password: forgotNewPwd }));
        }}
      ]);
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.detail || 'Failed to reset password. Please check OTP.';
      Alert.alert('Error', errMsg);
    } finally {
      setForgotLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Required';
    if (!form.password) errs.password = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login({ username: form.username.trim(), password: form.password });
      await login(res.data);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err) {
      console.log('Login error:', err.message);
      let msg = 'Wrong credentials';
      if (err.response) {
        msg = err.response.data?.error || err.response.data?.detail || err.response.data?.non_field_errors?.[0] || msg;
      } else if (err.message.includes('Network Error') || err.message.includes('timeout')) {
        msg = 'Could not connect to the server. Please check your network.';
      }
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.backgroundContainer}>
        {/* Top Wave (subtle) */}
        <View style={styles.topWave} />
        {/* Bottom Wave */}
        <View style={styles.bottomWave1} />
        <View style={styles.bottomWave2} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* Back button to return to public feed */}
        {navigation.canGoBack() && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0284c7" />
          </TouchableOpacity>
        )}

        {/* Branding Logo */}
        <View style={styles.header}>
          <Image source={require('../../../assets/android-icon-foreground.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.trust}>Sree Lakshmi</Text>
          <Text style={styles.trustSub}>CHARITABLE TRUST</Text>
        </View>

        {/* Welcome Text */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeSubtitle}>Login to continue your journey with us</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Input
            label="Mobile Number / Member ID / Email"
            value={form.username}
            onChangeText={(v) => { setForm(f => ({ ...f, username: v })); setErrors(e => ({ ...e, username: '' })); }}
            placeholder="Enter Mobile Number, Member ID or Email"
            leftIcon={<Ionicons name="call-outline" size={20} color={Colors.gray400} />}
            error={errors.username}
            autoCapitalize="none"
          />

          <Input
            label="Password"
            value={form.password}
            onChangeText={(v) => { setForm(f => ({ ...f, password: v })); setErrors(e => ({ ...e, password: '' })); }}
            placeholder="Enter your password"
            type="password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} />}
            error={errors.password}
          />

          <TouchableOpacity style={styles.forgotBtn} onPress={handleOpenForgot}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title={loading ? 'Logging in...' : 'Login'}
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginBtn}
          />
        </View>

        {/* Signup Section */}
        <View style={styles.signupSection}>
          <Text style={styles.noAccountText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.signupOutlineBtn}>
            <Ionicons name="person-add-outline" size={20} color="#0284c7" />
            <Text style={styles.signupOutlineText}>Sign Up as Member</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAwareScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotModal} transparent animationType="slide" onRequestClose={() => setForgotModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.modalSubtitle}>
                  {forgotStep === 1 ? 'Step 1 of 2: Verify Your Identity' : 'Step 2 of 2: Set New Password'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setForgotModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {forgotStep === 1 ? (
                <>
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#0284c7" />
                    <Text style={styles.infoText}>
                      Enter your registered Phone Number, Member ID, or Email to receive an OTP.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Registered Phone / Member ID / Email</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="person-circle-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.fieldInput}
                        value={forgotContact}
                        onChangeText={setForgotContact}
                        placeholder="e.g. 9947703037 or email"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.submitBtn} onPress={handleSendForgotOtp} disabled={forgotLoading}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Send Verification Code (OTP)</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.infoBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={[styles.infoText, { color: '#166534' }]}>
                      OTP dispatched to {forgotMasked || 'your registered contact'}.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.label}>6-Digit OTP Code</Text>
                      {resendTimer > 0 ? (
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Resend in {resendTimer}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendForgotOtp} disabled={forgotLoading}>
                          <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700' }}>Resend OTP</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.inputWrap}>
                      <Ionicons name="keypad-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.fieldInput, { letterSpacing: 6, fontWeight: '700', fontSize: 18 }]}
                        value={forgotOtp}
                        onChangeText={setForgotOtp}
                        placeholder="••••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.fieldInput}
                        secureTextEntry={!showForgotNewPwd}
                        value={forgotNewPwd}
                        onChangeText={setForgotNewPwd}
                        placeholder="Enter new password (min. 6 chars)"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowForgotNewPwd(!showForgotNewPwd)} style={{ padding: 6 }}>
                        <Ionicons name={showForgotNewPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.fieldInput}
                        secureTextEntry={!showForgotConfirmPwd}
                        value={forgotConfirmPwd}
                        onChangeText={setForgotConfirmPwd}
                        placeholder="Re-enter new password"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowForgotConfirmPwd(!showForgotConfirmPwd)} style={{ padding: 6 }}>
                        <Ionicons name={showForgotConfirmPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.submitBtn} onPress={handleResetPassword} disabled={forgotLoading}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Reset & Save Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setForgotStep(1)} style={{ alignSelf: 'center', marginTop: 12 }}>
                    <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>Change Phone/Email</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0f9ff' },
  backgroundContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  topWave: {
    position: 'absolute', top: -300, left: -100, width: width + 200, height: 400,
    borderRadius: 200, backgroundColor: '#e0f2fe', opacity: 0.5,
  },
  bottomWave1: {
    position: 'absolute', bottom: -200, left: -50, width: width + 100, height: 300,
    borderRadius: 150, backgroundColor: '#bae6fd', opacity: 0.6,
  },
  bottomWave2: {
    position: 'absolute', bottom: -250, left: -150, width: width + 300, height: 350,
    borderRadius: 175, backgroundColor: '#e0f2fe', opacity: 0.8,
  },
  
  container: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 8,
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 80, height: 80, marginBottom: 8 },
  trust: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  trustSub: { fontSize: 11, color: '#0f172a', fontWeight: '700', letterSpacing: 1 },
  
  welcomeSection: { alignItems: 'center', marginBottom: 24 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#0284c7', marginBottom: 6 },
  welcomeSubtitle: { fontSize: 13, color: '#475569' },
  
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    marginBottom: 24,
  },
  
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -8 },
  forgotText: { color: '#0284c7', fontSize: 13, fontWeight: '600' },
  
  loginBtn: { backgroundColor: '#0284c7', borderRadius: 12, paddingVertical: 14 },
  
  signupSection: { alignItems: 'center' },
  noAccountText: { fontSize: 13, color: '#475569', marginBottom: 12 },
  signupOutlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#0284c7', backgroundColor: '#ffffff',
  },
  signupOutlineText: { color: '#0284c7', fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 12.5, color: '#166534', lineHeight: 18 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12 },
  fieldInput: { flex: 1, paddingVertical: 12, fontSize: 14.5, color: '#0F172A' },
  submitBtn: { backgroundColor: '#0284c7', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default LoginScreen;
