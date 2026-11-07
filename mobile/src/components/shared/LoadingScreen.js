// components/shared/LoadingScreen.js
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../constants/Colors';

const LoadingScreen = ({ message = 'Loading...' }) => (
  <View style={styles.container}>
    <View style={styles.brandBox}>
      <Image
        source={require('../../../assets/trust-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>Kerala Charity Community</Text>
      <Text style={styles.appTagline}>Together for a Better Tomorrow</Text>
    </View>

    <View style={styles.loadingBox}>
      <ActivityIndicator size="small" color="#0284c7" style={styles.spinner} />
      {Boolean(message) && <Text style={styles.text}>{message}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  brandBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 140,
    height: 110,
    marginBottom: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    marginTop: 8,
  },
  spinner: {
    marginBottom: 10,
  },
  text: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default LoadingScreen;
