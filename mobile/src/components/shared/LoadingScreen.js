// components/shared/LoadingScreen.js
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../constants/Colors';

const LoadingScreen = ({ message = 'Loading...' }) => (
  <View style={styles.container}>
    <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
    <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: { width: 100, height: 100, marginBottom: 24 },
  spinner: { marginBottom: 16 },
  text: { color: Colors.gray500, fontSize: 15 },
});

export default LoadingScreen;
