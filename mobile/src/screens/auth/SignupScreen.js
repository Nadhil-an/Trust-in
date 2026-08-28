// screens/auth/SignupScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, Dimensions
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Button, Input } from '../../components/shared';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

const SignupScreen = ({ navigation }) => {
  const { login } = useAuthStore();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    occupation: '',
    place: '',
    pincode: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim())   errs.full_name  = 'Required';
    if (!form.phone.trim())       errs.phone      = 'Required';
    else if (!/^\d{10}$/.test(form.phone.trim())) errs.phone = 'Phone must be exactly 10 digits';
    if (!form.password)           errs.password   = 'Required';
    else if (form.password.length < 6) errs.password = 'Must be at least 6 characters';
    if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    if (!agreed) Alert.alert('Terms Required', 'You must agree to the Terms & Conditions and Privacy Policy.');
    
    setErrors(errs);
    return Object.keys(errs).length === 0 && agreed;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.signup({
        full_name:  form.full_name.trim(),
        phone:      form.phone.trim(),
        email:      form.email.trim(),
        occupation: form.occupation.trim(),
        place:      form.place.trim(),
        pincode:    form.pincode.trim(),
        password:   form.password,
      });
      await login(res.data);
    } catch (err) {
      let msg = 'Signup failed. Please try again.';
      if (err.response?.data) {
        const d = err.response.data;
        const fieldErrors = {};
        if (d.full_name)  fieldErrors.full_name  = d.full_name;
        if (d.phone)      fieldErrors.phone      = d.phone;
        if (d.email)      fieldErrors.email      = d.email;
        if (d.password)   fieldErrors.password   = d.password;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }
        msg = d.detail || d.error || msg;
      } else if (err.message?.includes('Network Error')) {
        msg = 'Could not connect to the server. Please check your network.';
      }
      Alert.alert('Signup Failed', msg);
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

      <View style={styles.container}>
        
        {/* Header with Back Arrow and Titles */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0284c7" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Sign Up as Member</Text>
            <Text style={styles.subtitle}>Create your account to join our mission</Text>
          </View>
        </View>

        {/* Branding Logo */}
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.trust}>Sree Lakshmi</Text>
          <Text style={styles.trustSub}>CHARITABLE TRUST</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} ref={scrollRef} style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Input
            label="Full Name"
            value={form.full_name}
            onChangeText={v => setField('full_name', v)}
            placeholder="Enter your full name"
            leftIcon={<Ionicons name="person-outline" size={20} color={Colors.gray400} />}
            error={errors.full_name}
          />

          <Input
            label="Phone Number"
            value={form.phone}
            onChangeText={v => setField('phone', v)}
            placeholder="Enter your phone number"
            leftIcon={<Ionicons name="call-outline" size={20} color={Colors.gray400} />}
            error={errors.phone}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Input
            label="Email Address"
            value={form.email}
            onChangeText={v => setField('email', v)}
            placeholder="Enter your email address"
            leftIcon={<Ionicons name="mail-outline" size={20} color={Colors.gray400} />}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Occupation"
            value={form.occupation}
            onChangeText={v => setField('occupation', v)}
            placeholder="Enter your occupation"
            leftIcon={<Ionicons name="briefcase-outline" size={20} color={Colors.gray400} />}
            error={errors.occupation}
          />

          <Input
            label="Place / City"
            value={form.place}
            onChangeText={v => setField('place', v)}
            placeholder="Enter your place or city"
            leftIcon={<Ionicons name="location-outline" size={20} color={Colors.gray400} />}
            error={errors.place}
          />

          <Input
            label="Pincode"
            value={form.pincode}
            onChangeText={v => setField('pincode', v)}
            placeholder="Enter your pincode"
            leftIcon={<Ionicons name="map-outline" size={20} color={Colors.gray400} />}
            error={errors.pincode}
            keyboardType="number-pad"
            onFocus={scrollToBottom}
          />

          <Input
            label="Password"
            value={form.password}
            onChangeText={v => setField('password', v)}
            placeholder="Create a password"
            type="password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} />}
            error={errors.password}
            onFocus={scrollToBottom}
          />

          <Input
            label="Confirm Password"
            value={form.confirm_password}
            onChangeText={v => setField('confirm_password', v)}
            placeholder="Confirm your password"
            type="password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} />}
            error={errors.confirm_password}
            onFocus={scrollToBottom}
          />

          </KeyboardAwareScrollView>

          {/* Terms Checkbox */}
          <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <Button
            title={loading ? 'Signing up...' : 'Sign Up'}
            onPress={handleSignup}
            loading={loading}
            size="lg"
            style={styles.signupBtn}
          />
        </View>

      </View>
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
    position: 'absolute', bottom: -100, left: -50, width: width + 100, height: 300,
    borderRadius: 150, backgroundColor: '#bae6fd', opacity: 0.6,
  },
  bottomWave2: {
    position: 'absolute', bottom: -150, left: -150, width: width + 300, height: 350,
    borderRadius: 175, backgroundColor: '#e0f2fe', opacity: 0.8,
  },
  
  container: { flex: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 },
  
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  backBtn: { padding: 4, marginRight: 8, marginTop: -2 },
  headerTextContainer: { flex: 1, alignItems: 'center', paddingRight: 32 },
  title: { fontSize: 20, fontWeight: '800', color: '#0284c7', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#475569', textAlign: 'center' },
  
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 70, height: 70, marginBottom: 8 },
  trust: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  trustSub: { fontSize: 9, color: '#0f172a', fontWeight: '700', letterSpacing: 1 },
  
  card: {
    flex: 1,
    backgroundColor: '#ffffff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    marginBottom: 0,
  },
  
  scrollArea: { flex: 1, marginBottom: 12 },
  scrollContent: { paddingBottom: 20 },
  
  termsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#0284c7', marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  checkboxActive: { backgroundColor: '#0284c7' },
  termsText: { flex: 1, fontSize: 12, color: '#475569', lineHeight: 18 },
  termsLink: { color: '#0284c7', fontWeight: '600' },
  
  signupBtn: { backgroundColor: '#0284c7', borderRadius: 12, paddingVertical: 14 },
});

export default SignupScreen;
