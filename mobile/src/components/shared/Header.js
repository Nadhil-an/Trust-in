// components/shared/Header.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';

import { useAuthStore } from '../../store/authStore';

const Header = ({ title, subtitle, showBack = false, showLogo = false, rightComponent, onBack, showLangToggle = true }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { i18n } = useTranslation();
  const { user } = useAuthStore();
  const currentLang = i18n.language || 'en';

  const handleBack = () => {
    if (onBack) onBack();
    else navigation.goBack();
  };

  const toggleLanguage = async () => {
    const nextLang = currentLang.startsWith('ml') ? 'en' : 'ml';
    await changeLanguage(nextLang, user?.id);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
        {showLogo && (
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        )}
        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>

        {rightComponent ? (
          <View style={styles.right}>{rightComponent}</View>
        ) : showLangToggle ? (
          <TouchableOpacity onPress={toggleLanguage} style={styles.langPill} activeOpacity={0.8}>
            <Ionicons name="globe-outline" size={14} color={Colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.langPillText}>{currentLang.startsWith('ml') ? 'മലയാളം' : 'EN'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12, padding: 4 },
  logo: { width: 36, height: 36, marginRight: 10, borderRadius: 8 },
  titleArea: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  right: { marginLeft: 8 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    marginLeft: 8,
  },
  langPillText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default Header;
