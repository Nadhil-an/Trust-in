// screens/auth/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Dimensions
} from 'react-native'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
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
        
        {/* Branding Logo */}
        <View style={styles.header}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
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
            label="Username / Member ID"
            value={form.username}
            onChangeText={(v) => { setForm(f => ({ ...f, username: v })); setErrors(e => ({ ...e, username: '' })); }}
            placeholder="Enter your username or member ID"
            leftIcon={<Ionicons name="person-outline" size={20} color={Colors.gray400} />}
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

          <TouchableOpacity style={styles.forgotBtn}>
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
});

export default LoginScreen;
