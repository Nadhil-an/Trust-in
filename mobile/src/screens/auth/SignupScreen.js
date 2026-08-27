// screens/auth/SignupScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, Animated,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Button, Input } from '../../components/shared';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

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
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim())   errs.full_name  = 'Full name is required.';
    if (!form.phone.trim())       errs.phone      = 'Phone number is required.';
    else if (!/^\d{10}$/.test(form.phone.trim())) errs.phone = 'Phone must be exactly 10 digits.';
    if (!form.password)           errs.password   = 'Password is required.';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
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
      // Automatically log the user in after successful signup
      await login(res.data);
    } catch (err) {
      let msg = 'Signup failed. Please try again.';
      if (err.response?.data) {
        const d = err.response.data;
        // Server-side field errors
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
      <View style={styles.container}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.trust}>Sree Lakshmi</Text>
          <Text style={styles.trustSub}>Charitable Trust</Text>
        </Animated.View>

        {/* Card (Flexes to fill remaining space) */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the trust as a member</Text>

          {/* Form Fields - Only this part scrolls */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Input
              label="Full Name"
              value={form.full_name}
              onChangeText={v => setField('full_name', v)}
              placeholder="Enter your full name"
              error={errors.full_name}
              required
              autoFocus
            />

            <Input
              label="Phone Number"
              value={form.phone}
              onChangeText={v => setField('phone', v)}
              placeholder="Enter your mobile number"
              error={errors.phone}
              required
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Input
              label="Email Address (Optional)"
              value={form.email}
              onChangeText={v => setField('email', v)}
              placeholder="Enter your email (optional)"
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Occupation"
              value={form.occupation}
              onChangeText={v => setField('occupation', v)}
              placeholder="Enter your occupation"
              error={errors.occupation}
            />

            <Input
              label="Place / City"
              value={form.place}
              onChangeText={v => setField('place', v)}
              placeholder="Enter your place or city"
              error={errors.place}
            />

            <Input
              label="Pincode"
              value={form.pincode}
              onChangeText={v => setField('pincode', v)}
              placeholder="Enter pincode"
              error={errors.pincode}
              keyboardType="number-pad"
            />

            <Input
              label="Set Password"
              value={form.password}
              onChangeText={v => setField('password', v)}
              placeholder="Min. 6 characters"
              type="password"
              error={errors.password}
              required
            />
          </ScrollView>

          {/* Fixed Button at the bottom of the card */}
          <Button
            title={loading ? 'Creating Account...' : 'Create My Account'}
            onPress={handleSignup}
            loading={loading}
            size="lg"
            style={styles.signupBtn}
          />
        </Animated.View>

        {/* Back to Login & Footer */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Sree Lakshmi Charitable Trust © 2026</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24, paddingBottom: 16, paddingTop: Platform.OS === 'ios' ? 40 : 20 },
  header: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 64, height: 64, marginBottom: 8 },
  trust: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  trustSub: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  card: {
    flex: 1, // Takes up the rest of the height
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 16,
  },
  scrollArea: { flex: 1, marginBottom: 12 },
  scrollContent: { paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.gray500, marginBottom: 16 },
  signupBtn: { marginTop: 4 },
  backLink: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: Colors.gray400, fontSize: 12, marginTop: 12 },
});

export default SignupScreen;
