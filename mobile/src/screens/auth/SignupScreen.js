// screens/auth/SignupScreen.js
import React, { useState, useRef } from 'react';
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
import { Button, Input, OptionPickerModal } from '../../components/shared';
import { INDIAN_STATES, getDistrictsForState } from '../../utils/location';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const MEMBERSHIP_OPTIONS = [
  { label: 'Member (₹100 monthly)', code: 'MEMBER', fee: 100 },
  { label: 'Group member (₹100 monthly)', code: 'GROUP_MEMBER', fee: 100 },
  { label: 'Organization staff (₹50 monthly)', code: 'ORG_STAFF', fee: 50 },
  { label: 'Society (₹1000 monthly)', code: 'SOCIETY', fee: 1000 },
  { label: 'Institution (₹5000 monthly)', code: 'INSTITUTION', fee: 5000 },
  { label: 'Club (₹500 monthly)', code: 'CLUB', fee: 500 },
];

const MEMBERSHIP_LABELS = MEMBERSHIP_OPTIONS.map((o) => o.label);

const SignupScreen = ({ navigation }) => {
  const { login } = useAuthStore();
  const scrollRef = useRef(null);

  // Multi-step flow: 1 = Member Info, 2 = Address & Password
  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState({
    // Section 1: Member Information
    full_name: '',
    email: '',
    phone: '',
    occupation: '',
    membership_label: 'Member (₹100 monthly)',
    membership_type: 'MEMBER',
    monthly_fee: 100,

    // Section 2: Address & Password
    address: '',
    pincode: '',
    state: 'Kerala',
    district: 'Kozhikode',
    password: '',
    confirm_password: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [pickerModal, setPickerModal] = useState({
    visible: false,
    type: null, // 'membership' | 'state' | 'district'
  });

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const validateStep1 = () => {
    const errs = {};
    const trimmedName = form.full_name.trim();
    const cleanPhone = form.phone.replace(/\D/g, '');
    const trimmedEmail = form.email.trim();

    if (!trimmedName) {
      errs.full_name = 'Full name is required';
    } else if (trimmedName.length < 2) {
      errs.full_name = 'Name must be at least 2 characters';
    }

    if (!trimmedEmail) {
      errs.email = 'Email address is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errs.email = 'Enter a valid email address';
      }
    }

    if (!cleanPhone) {
      errs.phone = 'Mobile number is required';
    } else if (cleanPhone.length !== 10) {
      errs.phone = 'Enter a valid 10-digit mobile number';
    }

    if (!form.occupation.trim()) {
      errs.occupation = 'Occupation is required';
    }

    if (!form.membership_type) {
      errs.membership_type = 'Please select a membership type';
    }

    setErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};

    if (!form.address.trim()) {
      errs.address = 'Address / House name is required';
    }

    const cleanPin = form.pincode.replace(/\D/g, '');
    if (!cleanPin) {
      errs.pincode = 'Pincode is required';
    } else if (cleanPin.length !== 6) {
      errs.pincode = 'Pincode must be exactly 6 digits';
    }

    if (!form.state) {
      errs.state = 'State is required';
    }

    if (!form.district) {
      errs.district = 'District is required';
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

    if (!agreed) {
      Alert.alert(
        'Terms & Conditions',
        'Please accept the Terms & Conditions and Privacy Policy to proceed.'
      );
      setErrors((prev) => ({ ...prev, ...errs }));
      return false;
    }

    setErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      scrollRef.current?.scrollToPosition(0, 0, true);
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
    scrollRef.current?.scrollToPosition(0, 0, true);
  };

  const handleTopBack = () => {
    if (currentStep === 2) {
      handleBackToStep1();
    } else {
      navigation.goBack();
    }
  };

  const handleSignup = async () => {
    const step1Ok = validateStep1();
    if (!step1Ok) {
      setCurrentStep(1);
      scrollRef.current?.scrollToPosition(0, 0, true);
      return;
    }

    const step2Ok = validateStep2();
    if (!step2Ok) return;

    setLoading(true);
    try {
      const cleanPhone = form.phone.replace(/\D/g, '');
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: cleanPhone,
        occupation: form.occupation.trim(),
        membership_type: form.membership_type,
        monthly_fee: form.monthly_fee,
        address: form.address.trim(),
        place: form.district.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        pincode: form.pincode.replace(/\D/g, ''),
        password: form.password,
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

        const fields = [
          'full_name',
          'email',
          'phone',
          'occupation',
          'membership_type',
          'address',
          'place',
          'district',
          'state',
          'pincode',
          'password',
          'confirm_password',
        ];
        fields.forEach((field) => {
          if (d[field]) {
            fieldErrors[field] = Array.isArray(d[field]) ? d[field][0] : String(d[field]);
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrors }));
          mainError = Object.values(fieldErrors)[0];
          // If any field in step 1 failed, navigate back to step 1
          if (
            fieldErrors.full_name ||
            fieldErrors.email ||
            fieldErrors.phone ||
            fieldErrors.occupation ||
            fieldErrors.membership_type
          ) {
            setCurrentStep(1);
          }
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
          ref={scrollRef}
          enableOnAndroid={true}
          extraScrollHeight={Platform.OS === 'android' ? 24 : 12}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleTopBack}
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
              source={require('../../../assets/trust-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Sign Up as Member</Text>
            <Text style={styles.headerSubtitle}>
              Join our community, track your contributions and support our charitable mission.
            </Text>
          </View>

          {/* Main Form Container */}
          <View style={styles.formCard}>
            {/* Step 1: Member Information */}
            {currentStep === 1 && (
              <View>
                {/* Full Name */}
                <Input
                  label="Full Name"
                  required
                  value={form.full_name}
                  onChangeText={(v) => setField('full_name', v)}
                  placeholder="e.g. Arun Kumar"
                  leftIcon={<Ionicons name="person-outline" size={19} color="#64748b" />}
                  error={errors.full_name}
                  autoCapitalize="words"
                />

                {/* Email Address */}
                <Input
                  label="Email Address"
                  required
                  type="email"
                  value={form.email}
                  onChangeText={(v) => setField('email', v)}
                  placeholder="e.g. name@example.com"
                  leftIcon={<Ionicons name="mail-outline" size={19} color="#64748b" />}
                  error={errors.email}
                  autoCapitalize="none"
                />

                {/* Phone Number */}
                <Input
                  label="Phone Number"
                  required
                  type="phone"
                  value={form.phone}
                  onChangeText={(v) => setField('phone', v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  leftIcon={<Ionicons name="call-outline" size={19} color="#64748b" />}
                  error={errors.phone}
                  maxLength={10}
                />

                {/* Occupation */}
                <Input
                  label="Occupation"
                  required
                  value={form.occupation}
                  onChangeText={(v) => setField('occupation', v)}
                  placeholder="e.g. Business, Teacher, Engineer"
                  leftIcon={<Ionicons name="briefcase-outline" size={19} color="#64748b" />}
                  error={errors.occupation}
                  autoCapitalize="words"
                />

                {/* Membership Type Dropdown Selector */}
                <View style={styles.selectFieldWrap}>
                  <View style={styles.selectLabelRow}>
                    <Text style={styles.selectLabel}>Membership Type</Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.selectTriggerBtn,
                      errors.membership_type && styles.selectTriggerError,
                    ]}
                    onPress={() => setPickerModal({ visible: true, type: 'membership' })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.selectTriggerLeft}>
                      <Ionicons name="ribbon-outline" size={19} color="#0284c7" />
                      <Text style={styles.selectTriggerValue} numberOfLines={1}>
                        {form.membership_label}
                      </Text>
                    </View>
                    <View style={styles.selectTriggerRight}>
                      <View style={styles.membershipFeeBadge}>
                        <Text style={styles.membershipFeeBadgeText}>
                          ₹{form.monthly_fee}/mo
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={17} color="#64748b" />
                    </View>
                  </TouchableOpacity>
                  {errors.membership_type ? (
                    <Text style={styles.fieldErrorText}>{errors.membership_type}</Text>
                  ) : null}
                </View>

                {/* Continue to Next Section Button */}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>

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
            )}

            {/* Step 2: Address & Security */}
            {currentStep === 2 && (
              <View>
                {/* Address / House Name */}
                <Input
                  label="Address / House Name"
                  required
                  value={form.address}
                  onChangeText={(v) => setField('address', v)}
                  placeholder="House name, Building, Street"
                  leftIcon={<Ionicons name="home-outline" size={19} color="#64748b" />}
                  error={errors.address}
                  autoCapitalize="words"
                />

                {/* Pincode */}
                <Input
                  label="Pincode"
                  required
                  type="number"
                  value={form.pincode}
                  onChangeText={(v) => setField('pincode', v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  leftIcon={<Ionicons name="map-outline" size={19} color="#64748b" />}
                  error={errors.pincode}
                  maxLength={6}
                />

                {/* State & District Dropdown Selectors */}
                <View style={styles.dropdownRow}>
                  {/* State Selector */}
                  <View style={styles.dropdownCol}>
                    <View style={styles.selectLabelRow}>
                      <Text style={styles.selectLabel}>State</Text>
                      <Text style={styles.requiredStar}> *</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniSelectBtn, errors.state && styles.selectTriggerError]}
                      onPress={() => setPickerModal({ visible: true, type: 'state' })}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="map-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.miniSelectText} numberOfLines={1}>
                        {form.state}
                      </Text>
                      <Ionicons name="chevron-down" size={15} color="#64748b" />
                    </TouchableOpacity>
                    {errors.state ? <Text style={styles.fieldErrorText}>{errors.state}</Text> : null}
                  </View>

                  {/* District Selector */}
                  <View style={styles.dropdownCol}>
                    <View style={styles.selectLabelRow}>
                      <Text style={styles.selectLabel}>District</Text>
                      <Text style={styles.requiredStar}> *</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniSelectBtn, errors.district && styles.selectTriggerError]}
                      onPress={() => setPickerModal({ visible: true, type: 'district' })}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="location-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.miniSelectText} numberOfLines={1}>
                        {form.district}
                      </Text>
                      <Ionicons name="chevron-down" size={15} color="#64748b" />
                    </TouchableOpacity>
                    {errors.district ? <Text style={styles.fieldErrorText}>{errors.district}</Text> : null}
                  </View>
                </View>

                {/* Password */}
                <Input
                  label="Password"
                  required
                  type="password"
                  value={form.password}
                  onChangeText={(v) => setField('password', v)}
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
                  onChangeText={(v) => setField('confirm_password', v)}
                  placeholder="Re-enter your password"
                  leftIcon={<Ionicons name="shield-checkmark-outline" size={19} color="#64748b" />}
                  error={errors.confirm_password}
                />

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

                {/* Back to Step 1 Button */}
                <TouchableOpacity
                  style={styles.backStepButton}
                  onPress={handleBackToStep1}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Ionicons name="arrow-back" size={16} color="#0284c7" />
                  <Text style={styles.backStepButtonText}>Back</Text>
                </TouchableOpacity>

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
            )}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Option Picker Modal for Membership Type, State, and District */}
      <OptionPickerModal
        visible={pickerModal.visible}
        onClose={() => setPickerModal({ visible: false, type: null })}
        title={
          pickerModal.type === 'membership'
            ? 'Select Membership Type'
            : pickerModal.type === 'state'
            ? 'Select State'
            : `Select District (${form.state || 'Kerala'})`
        }
        options={
          pickerModal.type === 'membership'
            ? MEMBERSHIP_LABELS
            : pickerModal.type === 'state'
            ? INDIAN_STATES
            : getDistrictsForState(form.state || 'Kerala')
        }
        selectedValue={
          pickerModal.type === 'membership'
            ? form.membership_label
            : pickerModal.type === 'state'
            ? form.state
            : form.district
        }
        onSelect={(val) => {
          if (pickerModal.type === 'membership') {
            const selected = MEMBERSHIP_OPTIONS.find((o) => o.label === val);
            if (selected) {
              setForm((prev) => ({
                ...prev,
                membership_label: selected.label,
                membership_type: selected.code,
                monthly_fee: selected.fee,
              }));
              if (errors.membership_type) {
                setErrors((prev) => ({ ...prev, membership_type: '' }));
              }
            }
          } else if (pickerModal.type === 'state') {
            setField('state', val);
            const dists = getDistrictsForState(val);
            if (!dists.includes(form.district)) {
              setField('district', dists[0] || '');
            }
          } else if (pickerModal.type === 'district') {
            setField('district', val);
          }
        }}
        searchPlaceholder={
          pickerModal.type === 'membership'
            ? 'Search membership type...'
            : pickerModal.type === 'state'
            ? 'Search state...'
            : 'Search district...'
        }
        iconName={
          pickerModal.type === 'membership'
            ? 'ribbon-outline'
            : pickerModal.type === 'state'
            ? 'map-outline'
            : 'location-outline'
        }
      />
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
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    marginBottom: 16,
  },
  logoImage: {
    width: 56,
    height: 56,
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
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  selectFieldWrap: {
    marginBottom: 16,
  },
  selectLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  requiredStar: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  selectTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
  },
  selectTriggerError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  selectTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  selectTriggerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  selectTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membershipFeeBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  membershipFeeBadgeText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  backStepButtonText: {
    color: '#0284c7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dropdownCol: {
    flex: 1,
  },
  miniSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
  },
  miniSelectText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  fieldErrorText: {
    fontSize: 11.5,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
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
