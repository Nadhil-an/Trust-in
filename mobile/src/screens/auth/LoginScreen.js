// screens/auth/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/Colors';
import { Button, Input } from '../../components/shared';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const LoginScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = t('common.required');
    if (!form.password) errs.password = t('common.required');
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
      let msg = t('auth.wrong_credentials');
      if (err.response) {
        msg = err.response.data?.error || err.response.data?.detail || err.response.data?.non_field_errors?.[0] || msg;
      } else if (err.message.includes('Network Error') || err.message.includes('timeout')) {
        msg = 'Could not connect to the server. Please check your network and IP address.';
      }
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.trust}>Sree Lakshmi</Text>
          <Text style={styles.trustSub}>Charitable Trust</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{t('auth.login_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>

          <Input
            label={t('auth.username')}
            value={form.username}
            onChangeText={(v) => { setForm(f => ({ ...f, username: v })); setErrors(e => ({ ...e, username: '' })); }}
            placeholder="Enter username or member ID"
            error={errors.username}
            required
            autoFocus
          />

          <Input
            label={t('auth.password')}
            value={form.password}
            onChangeText={(v) => { setForm(f => ({ ...f, password: v })); setErrors(e => ({ ...e, password: '' })); }}
            placeholder="Enter password"
            type="password"
            error={errors.password}
            required
          />

          <Button
            title={loading ? t('auth.logging_in') : t('auth.login_button')}
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginBtn}
          />

          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Don't have an account? </Text>
            <Text style={[styles.signupLinkText, styles.signupLinkBold]}>Sign up as a Member →</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Sree Lakshmi Charitable Trust © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', minHeight: '100%' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 90, height: 90, marginBottom: 12 },
  trust: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  trustSub: { fontSize: 14, color: Colors.gray500, fontWeight: '500' },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.gray500, marginBottom: 24 },
  loginBtn: { marginTop: 8 },
  signupLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18, flexWrap: 'wrap' },
  signupLinkText: { color: Colors.gray500, fontSize: 13 },
  signupLinkBold: { color: Colors.primary, fontWeight: '700' },
  langBtn: { alignItems: 'center', padding: 12 },
  langText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: Colors.gray400, fontSize: 12, marginTop: 16 },
});

export default LoginScreen;
