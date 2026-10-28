// screens/auth/SignupScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { Button, Input } from '../../components/shared';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const SignupScreen = ({ navigation }) => {
  const { login } = useAuthStore();

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    password: '',
    confirm_password: '',
    email: '',
    place: '',
    pincode: '',
    occupation: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);

  const setField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const validate = () => {
    const errs = {};
    const trimmedName = form.full_name.trim();
    const cleanPhone = form.phone.replace(/\D/g, '');

    if (!trimmedName) {
      errs.full_name = 'Full name is required';
    } else if (trimmedName.length < 2) {
      errs.full_name = 'Name must be at least 2 characters';
    }

    if (!cleanPhone) {
      errs.phone = 'Mobile number is required';
    } else if (cleanPhone.length !== 10) {
      errs.phone = 'Enter a valid 10-digit mobile number';
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!form.confirm_password) {
      errs.confirm_password = 'Confirm your password';
    } else if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match';
    }

    if (form.pincode.trim()) {
      const cleanPin = form.pincode.replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        errs.pincode = 'Pincode must be exactly 6 digits';
      }
    }

    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errs.email = 'Enter a valid email address';
      }
    }

    if (!agreed) {
      Alert.alert(
        'Terms & Conditions',
        'Please accept the Terms & Conditions and Privacy Policy to proceed.'
      );
      setErrors(errs);
      return false;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const cleanPhone = form.phone.replace(/\D/g, '');
      const payload = {
        full_name: form.full_name.trim(),
        phone: cleanPhone,
        password: form.password,
        place: form.place.trim() || undefined,
        pincode: form.pincode.trim() ? form.pincode.replace(/\D/g, '') : undefined,
        email: form.email.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
      };

      const res = await authApi.signup(payload);

      if (!res.data?.access || !res.data?.user) {
        Alert.alert('Signup Error', 'Unexpected server response. Please try again.');
        return;
      }

      // Persist credentials and authenticate in store
      await login(res.data);

      Toast.show({
        type: 'success',
        text1: '🎉 Welcome to Sree Lakshmi Trust!',
        text2: `Logged in as ${res.data.user.full_name || 'Member'}.`,
        visibilityTime: 4000,
      });

      // Seamlessly transition and open the mobile member interface
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err) {
      let mainError = 'Registration failed. Please try again.';

      if (err.response?.data) {
        const d = err.response.data;
        const fieldErrors = {};

        const fields = ['full_name', 'phone', 'email', 'password', 'pincode', 'place', 'occupation'];
        fields.forEach(field => {
          if (d[field]) {
            fieldErrors[field] = Array.isArray(d[field]) ? d[field][0] : String(d[field]);
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...fieldErrors }));
          mainError = Object.values(fieldErrors)[0];
        } else if (typeof d === 'string') {
          mainError = d;
        } else {
          mainError = d.detail || d.error || d.message || JSON.stringify(d);
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        mainError = 'Connection timed out. Please check your internet and try again.';
      } else if (err.message?.includes('Network Error')) {
        mainError = 'Unable to connect to the server. Please check your network connection.';
      }

      Alert.alert('Registration Failed', mainError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollView
          enableOnAndroid={true}
          extraScrollHeight={Platform.OS === 'android' ? 24 : 12}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={22} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.topBarCenter}>
              <Text style={styles.brandTitle}>SREE LAKSHMI</Text>
              <Text style={styles.brandSubtitle}>CHARITABLE TRUST</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <Image
              source={require('../../../assets/android-icon-foreground.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Sign Up as Member</Text>
            <Text style={styles.headerSubtitle}>
              Join our community, track your contributions and support our charitable mission.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Full Name */}
            <Input
              label="Full Name"
              required
              value={form.full_name}
              onChangeText={v => setField('full_name', v)}
              placeholder="e.g. Arun Kumar"
              leftIcon={<Ionicons name="person-outline" size={19} color="#64748b" />}
              error={errors.full_name}
              autoCapitalize="words"
            />

            {/* Mobile Number */}
            <Input
              label="Mobile Number"
              required
              value={form.phone}
              onChangeText={v => setField('phone', v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              leftIcon={<Ionicons name="call-outline" size={19} color="#64748b" />}
              error={errors.phone}
              keyboardType="phone-pad"
              maxLength={10}
            />

            {/* Password */}
            <Input
              label="Password"
              required
              type="password"
              value={form.password}
              onChangeText={v => setField('password', v)}
              placeholder="At least 6 characters"
              leftIcon={<Ionicons name="lock-closed-outline" size={19} color="#64748b" />}
              error={errors.password}
            />

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              required
              type="password"
              value={form.confirm_password}
              onChangeText={v => setField('confirm_password', v)}
              placeholder="Re-enter your password"
              leftIcon={<Ionicons name="shield-checkmark-outline" size={19} color="#64748b" />}
              error={errors.confirm_password}
            />

            {/* Additional Details Accordion Toggle */}
            <TouchableOpacity
              style={styles.accordionToggle}
              onPress={() => setShowAdditional(!showAdditional)}
              activeOpacity={0.7}
            >
              <View style={styles.accordionToggleLeft}>
                <Ionicons
                  name={showAdditional ? 'chevron-down-circle' : 'add-circle-outline'}
                  size={20}
                  color="#0284c7"
                />
                <Text style={styles.accordionToggleText}>
                  {showAdditional ? 'Hide Additional Details' : 'Add Location & Details (Optional)'}
                </Text>
              </View>
              <Text style={styles.accordionBadge}>Optional</Text>
            </TouchableOpacity>

            {showAdditional && (
              <View style={styles.additionalFieldsWrap}>
                <Input
                  label="City / Town"
                  value={form.place}
                  onChangeText={v => setField('place', v)}
                  placeholder="e.g. Kozhikode"
                  leftIcon={<Ionicons name="location-outline" size={19} color="#64748b" />}
                  error={errors.place}
                  autoCapitalize="words"
                />

                <Input
                  label="Pincode"
                  value={form.pincode}
                  onChangeText={v => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  leftIcon={<Ionicons name="map-outline" size={19} color="#64748b" />}
                  error={errors.pincode}
                  keyboardType="numeric"
                  maxLength={6}
                />

                <Input
                  label="Email Address"
                  value={form.email}
                  onChangeText={v => setField('email', v)}
                  placeholder="name@example.com"
                  leftIcon={<Ionicons name="mail-outline" size={19} color="#64748b" />}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Occupation"
                  value={form.occupation}
                  onChangeText={v => setField('occupation', v)}
                  placeholder="e.g. Business, Teacher, Engineer"
                  leftIcon={<Ionicons name="briefcase-outline" size={19} color="#64748b" />}
                  error={errors.occupation}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Terms and Conditions Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsHighlight}>Terms & Conditions</Text> and{' '}
                <Text style={styles.termsHighlight}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <Button
              title={loading ? 'Creating Member Account...' : 'Sign Up as Member'}
              onPress={handleSignup}
              loading={loading}
              disabled={loading}
              size="lg"
              style={styles.signupButton}
            />

            {/* Back to Login Link */}
            <View style={styles.loginLinkRow}>
              <Text style={styles.loginPromptText}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Auth')}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}> Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  topBarCenter: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284c7',
    letterSpacing: 1,
  },
  headerBanner: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  accordionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 16,
    marginTop: 4,
  },
  accordionToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accordionToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  accordionBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  additionalFieldsWrap: {
    paddingTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  termsHighlight: {
    color: '#0284c7',
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    paddingBottom: 4,
  },
  loginPromptText: {
    fontSize: 13,
    color: '#64748b',
  },
  loginLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
});

export default SignupScreen;
